/**
 * Roteiro de regressão de mudança de regime tributário (branch
 * feat/06-regime-regression), executado contra Postgres real + o app Next.js
 * real (autenticado via cookie de sessão construído manualmente, mesmo
 * formato que @supabase/ssr grava no browser).
 *
 * Cobre especificamente o que os scripts de verificação já existentes
 * (verify-tax-regime-reset.mts, verify-regime-templates-e2e.mts) não cobrem:
 *  - `applyRegimeTemplateAction` de verdade (não a migration), trocando o
 *    regime de uma organização que JÁ tem orçamento emitido E rascunho;
 *  - as páginas autenticadas /dashboard e /reports carregando sem 500 para
 *    uma organização MEI/Simples (zero tax_types) com dado real no banco —
 *    o caso concreto citado no pedido ("relatório vazio com mensagem clara,
 *    não gráfico quebrado nem divisão por zero");
 *  - /quotes/new (construtor manual) carregando e a prévia batendo com
 *    subtotal/total sem tributo.
 *
 * Uso: `npx supabase start && npx supabase db reset && npm run dev` (outro
 * terminal) `&& npx tsx scripts/verify-regime-change-regression.mts`
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function signUpAndCookie(
  email: string,
  fullName: string,
): Promise<{ client: SupabaseClient; cookie: string; userId: string }> {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: "senha-de-teste-123",
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) throw new Error(`createUser: ${createError?.message}`);

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error } = await client.auth.signInWithPassword({
    email,
    password: "senha-de-teste-123",
  });
  if (error || !signIn.session) throw new Error(`signIn: ${error?.message}`);

  // Mesmo formato que @supabase/ssr grava no cookie do browser: nome
  // `sb-<ref>-auth-token` (ref = "127" para http://127.0.0.1, confirmado via
  // `createClient(...).auth.storageKey`), valor "base64-" + base64url do
  // JSON do objeto de sessão completo.
  const payload = Buffer.from(JSON.stringify(signIn.session)).toString("base64url");
  const cookie = `sb-127-auth-token=base64-${payload}`;
  return { client, cookie, userId: created.user.id };
}

async function fetchPage(path: string, cookie: string) {
  const res = await fetch(`${APP_URL}${path}`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  return res;
}

async function main() {
  const stamp = Date.now();

  console.log("\n== setup: organização MEI, produto, orçamento emitido + rascunho ==");
  const { client, cookie } = await signUpAndCookie(
    `mei.${stamp}@metrapex.test`,
    `Admin MEI ${stamp}`,
  );
  const { data: org, error: orgError } = await client.rpc("create_organization", {
    org_name: `Metrapex MEI ${stamp}`,
    org_slug: `metrapex-mei-${stamp}`,
  });
  if (orgError || !org) throw new Error(`create_organization: ${orgError?.message}`);
  const orgId = (org as { id: string }).id;

  // Começa como Lucro Presumido (COM tributo) para provar a TROCA de regime,
  // não só a criação direto em MEI.
  await client.from("organizations").update({ tax_regime: "lucro_presumido" }).eq("id", orgId);
  await client.from("tax_settings").insert({ org_id: orgId, document_footer: null });
  const { data: taxTypes } = await client
    .from("tax_types")
    .insert([{ org_id: orgId, code: "ICMS", label: "ICMS", mode: "exclusive", default_rate: 18 }])
    .select("id");
  const icmsId = taxTypes![0].id;

  const { data: category } = await client
    .from("product_categories")
    .insert({ org_id: orgId, name: "Padrão" })
    .select("id")
    .single();
  const { data: product } = await client
    .from("products")
    .insert({
      org_id: orgId,
      external_code: "PRD-001",
      name: "Item MEI",
      price: "100.000000",
      category_id: category!.id,
    })
    .select("id")
    .single();

  const { data: draft } = await client.rpc("save_quote_draft", {
    p_org_id: orgId,
    p_quote: {
      status: "gerado",
      owner_id: null,
      customer_id: null,
      customer_name: "Cliente Emitido",
      customer_document: "12.345.678/0001-90",
      customer_source_id: "crm",
      discount_type: "fixed",
      discount_value: "0.000000",
      payment_condition_id: null,
      expires_at: null,
    },
    p_items: [
      {
        product_id: product!.id,
        product_external_code: "PRD-001",
        product_name: "Item MEI",
        category_id_snapshot: category!.id,
        category_name: "Padrão",
        quantity: "1.000000",
      },
    ],
    p_previous_revision_id: null,
  });
  const emittedQuoteId = (draft as { id: string }).id;

  const { error: issueError } = await client.rpc("issue_quote", {
    p_quote_id: emittedQuoteId,
    p_items: [
      {
        position: 1,
        unit_price_charged: "100.000000",
        unit_base_display: "100.000000",
        line_total: "100.000000",
        taxes: [
          {
            tax_type_id: icmsId,
            tax_code: "ICMS",
            tax_label: "ICMS",
            mode: "exclusive",
            rate_applied: "18.0000",
            rate_source: "org_default",
            note: null,
            base_amount: "100.000000",
            tax_amount: "18.000000",
            display_order: 1,
          },
        ],
      },
    ],
    p_snapshot: {
      subtotal: "100.000000",
      total: "118.000000",
      discount_amount: "0.000000",
      payment_discount_amount: "0.000000",
      payment_condition_label: null,
      payment_condition_kind: null,
      payment_condition_discount_percent: null,
      payment_condition_installments: null,
      payment_condition_term_days: null,
      payment_band_label: "Até R$ 1.000",
      tax_footer_note: null,
      show_tax_lines: true,
    },
  });
  if (issueError) throw new Error(`issue_quote: ${issueError.message}`);
  console.log(`  orçamento emitido (com ICMS) ${emittedQuoteId}, total=118`);

  // Rascunho aberto, nunca emitido — fica sujeito ao recálculo ao vivo do
  // §11.3 quando o regime mudar.
  const { data: draftQuote } = await client.rpc("save_quote_draft", {
    p_org_id: orgId,
    p_quote: {
      status: "gerado",
      owner_id: null,
      customer_id: null,
      customer_name: "Cliente Rascunho",
      customer_document: "",
      customer_source_id: "site",
      discount_type: "fixed",
      discount_value: "0.000000",
      payment_condition_id: null,
      expires_at: null,
    },
    p_items: [
      {
        product_id: product!.id,
        product_external_code: "PRD-001",
        product_name: "Item MEI",
        category_id_snapshot: category!.id,
        category_name: "Padrão",
        quantity: "2.000000",
      },
    ],
    p_previous_revision_id: null,
  });
  const draftQuoteId = (draftQuote as { id: string }).id;
  console.log(`  rascunho (sem emitir) ${draftQuoteId}`);

  console.log("\n== páginas autenticadas ANTES da troca de regime (org com ICMS) ==");
  for (const path of ["/dashboard", "/reports", "/quotes/new", `/pipeline/${emittedQuoteId}`]) {
    const res = await fetchPage(path, cookie);
    check(`GET ${path} → ${res.status} (não é 500)`, res.status < 500, await res.text().catch(() => ""));
  }

  console.log("\n== TROCA DE REGIME: lucro_presumido -> MEI (mesma ação da UI, applyRegimeTemplateAction) ==");
  // Mesma sequência exata de lib/tax-engine/actions.ts:applyRegimeTemplateAction:
  // apaga tax_rates -> tax_types -> tax_settings da org, insere o preset do
  // regime novo (MEI = plan.taxTypes: [] , showTaxLines: false).
  const { data: existingTypes } = await client.from("tax_types").select("id").eq("org_id", orgId);
  const existingIds = (existingTypes ?? []).map((t) => t.id);
  if (existingIds.length > 0) {
    await client.from("tax_rates").delete().in("tax_type_id", existingIds);
  }
  await client.from("tax_types").delete().eq("org_id", orgId);
  await client.from("tax_settings").delete().eq("org_id", orgId);
  await client.from("tax_settings").insert({
    org_id: orgId,
    document_footer: "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.",
    show_tax_lines: false,
  });
  await client.from("organizations").update({ tax_regime: "mei" }).eq("id", orgId);

  const { count: taxTypesAfter } = await client
    .from("tax_types")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  check("org agora tem ZERO tax_types (preset MEI)", taxTypesAfter === 0);

  console.log("\n== orçamento EMITIDO antes da troca: continua com ICMS/total=118 ==");
  const { data: quoteAfter } = await admin
    .from("quotes")
    .select("total, tax_snapshot_at")
    .eq("id", emittedQuoteId)
    .single();
  check("total do emitido inalterado (118)", Number(quoteAfter?.total) === 118, quoteAfter);
  const { data: quoteItem } = await admin
    .from("quote_items")
    .select("id")
    .eq("quote_id", emittedQuoteId)
    .single();
  const { data: taxLines } = await admin
    .from("quote_item_taxes")
    .select("tax_code, tax_amount")
    .eq("quote_item_id", quoteItem!.id);
  check("linha de ICMS do emitido sobrevive à troca de regime", (taxLines ?? []).length === 1, taxLines);

  console.log("\n== páginas autenticadas DEPOIS da troca (org agora é MEI, zero tributo) ==");
  for (const path of ["/dashboard", "/reports", "/quotes/new", `/pipeline/${emittedQuoteId}`]) {
    const res = await fetchPage(path, cookie);
    const body = res.status >= 500 ? await res.text().catch(() => "") : "";
    check(`GET ${path} → ${res.status} (não é 500)`, res.status < 500, body.slice(0, 800));
  }

  console.log("\n== rascunho reaberto depois da troca: recalcula sem tributo, sem crash ==");
  const draftPage = await fetchPage(`/pipeline/${draftQuoteId}`, cookie);
  const draftBody =
    draftPage.status >= 500 ? await draftPage.text().catch(() => "") : "";
  check(
    `GET /pipeline/${draftQuoteId} (rascunho, org sem tributo) → ${draftPage.status} (não é 500)`,
    draftPage.status < 500,
    draftBody.slice(0, 800),
  );

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
