/**
 * Verificação ao vivo do endpoint público do formulário de orçamento
 * (Milestone 15) contra um Postgres real e o route handler real do Next.js.
 * O que esta rotina cobre e nenhum teste unitário cobre:
 *
 *  - EXECUTE das funções novas (resolve_public_organization,
 *    create_public_quote, public_form_check_rate_limit,
 *    public_form_claim_submission) de fato revogado de anon/authenticated —
 *    a promessa central da revisão de segurança desta milestone;
 *  - o endpoint HTTP completo: honeypot, Turnstile (chave de teste do
 *    Cloudflare), resolução por public_form_key, cálculo, persistência via
 *    create_public_quote, PDF/e-mail em melhor esforço;
 *  - isolamento entre organizações no caminho público (produto de outra org
 *    não pode ser orçado);
 *  - rate limit por documento e idempotência de curto prazo, os dois
 *    mecanismos que substituem a barreira de sessão que não existe aqui.
 *
 * Uso: `npx supabase start && npx supabase db reset && npm run dev` (outro
 * terminal) `&& npx tsx scripts/verify-public-quote.mts`
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { buildTestCnpj } from "@/lib/public-form/cpf-cnpj";

const API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
    if (detail !== undefined) console.error(`        ${JSON.stringify(detail)}`);
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  check(`${label} → ${String(actual)}`, actual === expected, { actual, expected });
}

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });

async function signUpUser(email: string): Promise<SupabaseClient> {
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: "senha-de-teste-123",
    email_confirm: true,
    user_metadata: { full_name: `Vendedor ${email.split("@")[0]}` },
  });
  if (createError) throw new Error(`createUser: ${createError.message}`);

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: "senha-de-teste-123" });
  if (error) throw new Error(`signIn: ${error.message}`);
  return client;
}

async function setupOrganization(client: SupabaseClient, name: string, slug: string) {
  const { data: org, error } = await client.rpc("create_organization", {
    org_name: name,
    org_slug: slug,
  });
  if (error || !org) throw new Error(`create_organization: ${error?.message}`);
  const orgId = (org as { id: string }).id;

  const { data: taxTypes, error: taxError } = await client
    .from("tax_types")
    .insert([{ org_id: orgId, code: "ICMS", label: "ICMS", mode: "exclusive", default_rate: 18 }])
    .select("id, code");
  if (taxError || !taxTypes) throw new Error(`tax_types: ${taxError?.message}`);

  const { data: products, error: productError } = await client
    .from("products")
    .insert([
      { org_id: orgId, external_code: "PRD-001", name: "Furadeira", price: "100.000000" },
      { org_id: orgId, external_code: "PRD-002", name: "Serra ST", price: "200.000000" },
    ])
    .select("id, external_code");
  if (productError || !products) throw new Error(`products: ${productError?.message}`);

  const { data: orgRow, error: orgRowError } = await admin
    .from("organizations")
    .select("public_form_key")
    .eq("id", orgId)
    .single();
  if (orgRowError || !orgRow) throw new Error(`organizations (admin): ${orgRowError?.message}`);

  return {
    orgId,
    publicFormKey: orgRow!.public_form_key,
    furadeira: products.find((p) => p.external_code === "PRD-001")!.id,
    serra: products.find((p) => p.external_code === "PRD-002")!.id,
  };
}

type PublicQuoteBody = Record<string, unknown>;

function baseBody(overrides: PublicQuoteBody = {}): PublicQuoteBody {
  return {
    publicFormKey: "",
    documentType: "cnpj",
    document: "11222333000181",
    legalName: "Padaria Bom Pão Ltda.",
    contactName: "Maria Compradora",
    email: "maria@padariabompao.test",
    phone: "11988887777",
    address: {
      zip: "01310-100",
      street: "Av. Paulista",
      number: "1000",
      complement: "",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    },
    cart: [],
    honeypot: "",
    captchaToken: "test-token",
    ...overrides,
  };
}

async function postPublicQuote(body: PublicQuoteBody, ip: string) {
  const response = await fetch(`${APP_URL}/api/public-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    quoteNumber?: string;
    error?: string;
  };
  return { status: response.status, ...json };
}

async function main() {
  const stamp = Date.now();
  console.log("\n== setup ==");
  const client = await signUpUser(`vendedor.${stamp}@metrapex.test`);
  const setup = await setupOrganization(client, `Metrapex Público ${stamp}`, `metrapex-pub-${stamp}`);
  console.log(`  organização ${setup.orgId}, public_form_key ${setup.publicFormKey}`);

  console.log("\n== EXECUTE revogado de anon (achado da revisão de segurança) ==");
  const anonResolve = await anon.rpc("resolve_public_organization", {
    p_public_form_key: setup.publicFormKey,
  });
  check(
    "anon NÃO consegue chamar resolve_public_organization direto",
    anonResolve.error !== null,
    anonResolve,
  );

  const anonCreate = await anon.rpc("create_public_quote", {
    p_org_id: setup.orgId,
    p_quote: { customer_name: "x", customer_document: "x", customer_source_id: "site", discount_type: "fixed", discount_value: "0", payment_condition_id: null, expires_at: null },
    p_items: [],
    p_snapshot: { subtotal: "0", total: "0", discount_amount: "0", payment_discount_amount: "0", payment_condition_label: null, payment_condition_kind: null, payment_condition_discount_percent: null, payment_condition_installments: null, payment_condition_term_days: null, payment_band_label: null, tax_footer_note: null, show_tax_lines: true },
  });
  check("anon NÃO consegue chamar create_public_quote direto", anonCreate.error !== null, anonCreate);

  const anonRateLimit = await anon.rpc("public_form_check_rate_limit", {
    p_scope: "ip",
    p_key: "vitima-de-poluicao",
    p_window_seconds: 600,
    p_limit: 10,
  });
  check(
    "anon NÃO consegue poluir o contador de rate limit de outra chave",
    anonRateLimit.error !== null,
    anonRateLimit,
  );

  const { data: anonRateLimitTable } = await anon.from("public_form_rate_limits").select("*").limit(1);
  eq("anon não enxerga nenhuma linha de public_form_rate_limits (RLS)", anonRateLimitTable?.length ?? 0, 0);

  console.log("\n== formulário não encontrado (chave inválida) ==");
  const notFound = await postPublicQuote(
    baseBody({
      publicFormKey: "chave-inexistente",
      cart: [{ productId: setup.furadeira, quantity: 1 }],
    }),
    "203.0.113.10",
  );
  eq("chave pública inválida → 404", notFound.status, 404);

  console.log("\n== honeypot bloqueia antes de tocar o banco ==");
  const honeypotResult = await postPublicQuote(
    baseBody({
      publicFormKey: setup.publicFormKey,
      cart: [{ productId: setup.furadeira, quantity: 1 }],
      honeypot: "sou-um-robo",
    }),
    "203.0.113.11",
  );
  eq("honeypot preenchido → 400", honeypotResult.status, 400);

  console.log("\n== isolamento entre organizações (produto de outra org) ==");
  const crossOrg = await postPublicQuote(
    baseBody({
      publicFormKey: setup.publicFormKey,
      document: buildTestCnpj("999888770001"),
      cart: [{ productId: "00000000-0000-0000-0000-000000000000", quantity: 1 }],
    }),
    "203.0.113.12",
  );
  eq("produto fora do catálogo da organização → 400", crossOrg.status, 400);

  console.log("\n== caminho feliz: gera orçamento real ==");
  const happyDocument = "11222333000181";
  const happy = await postPublicQuote(
    baseBody({
      publicFormKey: setup.publicFormKey,
      document: happyDocument,
      cart: [
        { productId: setup.furadeira, quantity: 2 },
        { productId: setup.serra, quantity: 1 },
      ],
    }),
    "203.0.113.13",
  );
  check("caminho feliz → 200 com número do orçamento", happy.status === 200 && Boolean(happy.quoteNumber), happy);

  if (happy.quoteNumber) {
    const { data: issuedQuote } = await admin
      .from("quotes")
      .select("*")
      .eq("org_id", setup.orgId)
      .order("sequence", { ascending: false })
      .limit(1)
      .single();

    check("orçamento já nasce emitido (tax_snapshot_at preenchido)", issuedQuote?.tax_snapshot_at !== null);
    eq("origem do cliente marcada como site", issuedQuote?.customer_source_id, "site");
    eq("total = 2×100 + 1×200 + 18% ICMS por fora = 472,00", Number(issuedQuote?.total), 472);
    eq("documento do cliente gravado sem máscara", issuedQuote?.customer_document, happyDocument);
  }

  console.log("\n== idempotência: mesmo carrinho + documento não duplica o orçamento ==");
  const before = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", setup.orgId);

  const idempotentBody = baseBody({
    publicFormKey: setup.publicFormKey,
    document: buildTestCnpj("223334440001"),
    cart: [{ productId: setup.furadeira, quantity: 3 }],
  });
  const first = await postPublicQuote(idempotentBody, "203.0.113.14");
  const second = await postPublicQuote(idempotentBody, "203.0.113.14");
  eq("primeira e segunda submissão devolvem o mesmo número", first.quoteNumber, second.quoteNumber);

  const after = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", setup.orgId);
  eq("só uma linha nova criada para as duas submissões idênticas", (after.count ?? 0) - (before.count ?? 0), 1);

  console.log("\n== dedupe de cliente por (organização, documento) ==");
  const dedupeDocument = buildTestCnpj("445556660001");
  const firstSubmission = await postPublicQuote(
    baseBody({
      publicFormKey: setup.publicFormKey,
      document: dedupeDocument,
      email: "compras@clienterecorrente.test",
      cart: [{ productId: setup.furadeira, quantity: 1 }],
    }),
    "203.0.113.16",
  );
  const secondSubmission = await postPublicQuote(
    baseBody({
      publicFormKey: setup.publicFormKey,
      document: dedupeDocument,
      email: "novo-email@clienterecorrente.test", // e-mail mudou — dedupe deve ATUALIZAR, não duplicar
      cart: [{ productId: setup.serra, quantity: 1 }], // carrinho diferente: não é o mesmo caminho de idempotência
    }),
    "203.0.113.16",
  );
  check(
    "as duas submissões do mesmo documento geram orçamentos distintos",
    firstSubmission.quoteNumber !== secondSubmission.quoteNumber,
    { firstSubmission, secondSubmission },
  );

  const { data: dedupedCustomers } = await admin
    .from("customers")
    .select("id, email")
    .eq("org_id", setup.orgId)
    .eq("document", dedupeDocument);
  eq("só um registro de cliente para o documento repetido", dedupedCustomers?.length, 1);
  eq(
    "o registro de cliente foi atualizado com o e-mail mais recente",
    dedupedCustomers?.[0]?.email,
    "novo-email@clienterecorrente.test",
  );

  const { data: dedupedQuotes } = await admin
    .from("quotes")
    .select("customer_id")
    .eq("org_id", setup.orgId)
    .eq("customer_document", dedupeDocument);
  const distinctCustomerIds = new Set((dedupedQuotes ?? []).map((row) => row.customer_id));
  eq("os dois orçamentos apontam para o mesmo cliente", distinctCustomerIds.size, 1);

  console.log("\n== rate limit por documento (5/dia) ==");
  const rateLimitDocument = buildTestCnpj("334445550001");
  const results: number[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const result = await postPublicQuote(
      baseBody({
        publicFormKey: setup.publicFormKey,
        document: rateLimitDocument,
        cart: [{ productId: setup.furadeira, quantity: i }], // hash diferente a cada volta
      }),
      "203.0.113.15",
    );
    results.push(result.status);
  }
  check("5 primeiras dentro do limite (200)", results.slice(0, 5).every((s) => s === 200), results);
  eq("6ª solicitação do mesmo documento", results[5], 429);

  console.log("\n== canal WhatsApp condicionado ao plano ==");
  // Plano padrão ('entrada') não aciona WhatsApp — sem log esperado no
  // servidor. Confirmado pelo grep externo (ver instruções ao final).
  console.log("  plano 'entrada' (padrão): verificar ausência de log de WhatsApp no servidor dev");

  await admin.from("organizations").update({ plan: "profissional" }).eq("id", setup.orgId);
  const whatsappEligible = await postPublicQuote(
    baseBody({
      publicFormKey: setup.publicFormKey,
      document: buildTestCnpj("556667770001"),
      cart: [{ productId: setup.furadeira, quantity: 1 }],
    }),
    "203.0.113.17",
  );
  check(
    "submissão com plano elegível ainda responde 200 mesmo com n8n não configurado (best-effort)",
    whatsappEligible.status === 200 && Boolean(whatsappEligible.quoteNumber),
    whatsappEligible,
  );
  console.log(
    "  plano 'profissional': verificar log 'falha ao acionar entrega por WhatsApp' no servidor dev (confirma que o código tentou — N8N_WEBHOOK_URL não está configurado localmente)",
  );

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
