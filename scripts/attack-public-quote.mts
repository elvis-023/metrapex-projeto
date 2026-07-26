/**
 * Ataque manual ao endpoint público (Milestone 15) — não é a suite de
 * regressão (scripts/verify-public-quote.mts), é uma sondagem adversarial
 * pontual pedida na revisão: captcha ausente, rajada de rate limit, CNPJ
 * inválido, e confusão de chave entre organizações.
 *
 * Uso: `npx supabase start && npx supabase db reset && npm run dev` (outro
 * terminal) `&& npx tsx scripts/attack-public-quote.mts`
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { buildTestCnpj } from "@/lib/public-form/cpf-cnpj";

const API_URL = "http://127.0.0.1:54321";
const APP_URL = "http://localhost:3000";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function signUpUser(email: string): Promise<SupabaseClient> {
  await admin.auth.admin.createUser({ email, password: "senha-de-teste-123", email_confirm: true });
  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: "senha-de-teste-123" });
  return client;
}

async function setupOrganization(client: SupabaseClient, name: string, slug: string) {
  const { data: org, error } = await client.rpc("create_organization", {
    org_name: name,
    org_slug: slug,
  });
  if (error || !org) throw new Error(`create_organization: ${error?.message}`);
  const orgId = (org as { id: string }).id;

  await client
    .from("tax_types")
    .insert([{ org_id: orgId, code: "ICMS", label: "ICMS", mode: "exclusive", default_rate: 18 }]);

  const { data: product } = await client
    .from("products")
    .insert({ org_id: orgId, external_code: "PRD-001", name: `Produto ${name}`, price: "100.000000" })
    .select("id")
    .single();

  const { data: orgRow } = await admin
    .from("organizations")
    .select("public_form_key")
    .eq("id", orgId)
    .single();

  return { orgId, publicFormKey: orgRow!.public_form_key, productId: product!.id };
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    publicFormKey: "",
    documentType: "cnpj",
    document: "11222333000181",
    legalName: "Empresa Atacante Ltda.",
    contactName: "Fulano",
    email: "fulano@atacante.test",
    phone: "11988887777",
    address: {
      zip: "01310100",
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

async function post(body: Record<string, unknown>, ip: string) {
  const response = await fetch(`${APP_URL}/api/public-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ...json };
}

async function main() {
  const stamp = Date.now();
  console.log("== setup: duas organizações ==");
  const clientA = await signUpUser(`org-a.${stamp}@metrapex.test`);
  const orgA = await setupOrganization(clientA, `Org A ${stamp}`, `org-a-${stamp}`);
  const clientB = await signUpUser(`org-b.${stamp}@metrapex.test`);
  const orgB = await setupOrganization(clientB, `Org B ${stamp}`, `org-b-${stamp}`);
  console.log(`  Org A: ${orgA.orgId} / ${orgA.publicFormKey} / produto ${orgA.productId}`);
  console.log(`  Org B: ${orgB.orgId} / ${orgB.publicFormKey} / produto ${orgB.productId}`);

  console.log("\n== ataque 1: submissão sem captchaToken ==");
  const noCaptcha = await post(
    baseBody({
      publicFormKey: orgA.publicFormKey,
      document: buildTestCnpj("101010100001"),
      cart: [{ productId: orgA.productId, quantity: 1 }],
      captchaToken: null,
    }),
    "198.51.100.1",
  );
  console.log(`  resposta: ${noCaptcha.status} — ${JSON.stringify(noCaptcha)}`);

  console.log("\n== ataque 2: 10 requisições seguidas, mesmo IP e mesmo documento ==");
  const burstDocument = buildTestCnpj("202020200001");
  const burstResults: { attempt: number; status: number; body: unknown }[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const result = await post(
      baseBody({
        publicFormKey: orgA.publicFormKey,
        document: burstDocument,
        cart: [{ productId: orgA.productId, quantity: i }], // hash diferente a cada volta — não some no cache de idempotência
      }),
      "198.51.100.2",
    );
    burstResults.push({ attempt: i, status: result.status, body: result });
  }
  for (const r of burstResults) {
    console.log(`  tentativa ${r.attempt}: ${r.status}`);
  }

  console.log("\n== ataque 3: CNPJ inválido ==");
  const badLengthCnpj = await post(
    baseBody({
      publicFormKey: orgA.publicFormKey,
      document: "123",
      cart: [{ productId: orgA.productId, quantity: 1 }],
    }),
    "198.51.100.3",
  );
  console.log(`  tamanho errado (3 dígitos): ${badLengthCnpj.status} — ${JSON.stringify(badLengthCnpj)}`);

  const checksumInvalidCnpj = await post(
    baseBody({
      publicFormKey: orgA.publicFormKey,
      document: "11111111111111", // 14 dígitos, mas repetido — não é CNPJ real (falha no dígito verificador)
      cart: [{ productId: orgA.productId, quantity: 1 }],
    }),
    "198.51.100.4",
  );
  console.log(
    `  14 dígitos mas dígito verificador inválido: ${checksumInvalidCnpj.status} — ${JSON.stringify(checksumInvalidCnpj)}`,
  );
  console.log(
    `  esperado agora: 400 "CNPJ inválido." (lib/public-form/cpf-cnpj.ts — antes desta correção, era aceito como 200)`,
  );

  console.log("\n== ataque 4: chave do snippet da Org A + produto da Org B ==");
  const crossOrgDocument = buildTestCnpj("303030300001");
  const crossOrg = await post(
    baseBody({
      publicFormKey: orgA.publicFormKey, // chave da Org A
      document: crossOrgDocument,
      cart: [{ productId: orgB.productId, quantity: 1 }], // produto da Org B
    }),
    "198.51.100.5",
  );
  console.log(`  resposta: ${crossOrg.status} — ${JSON.stringify(crossOrg)}`);

  // Confirma que o orçamento NÃO foi criado na Org A nem na Org B com esse produto cruzado.
  const { data: leaked } = await admin
    .from("quotes")
    .select("id, org_id")
    .eq("customer_document", crossOrgDocument);
  console.log(`  linhas em 'quotes' com esse documento: ${leaked?.length ?? 0} (esperado: 0)`);

  console.log("\n== envio legítimo, ponta a ponta ==");
  const legit = await post(
    baseBody({
      publicFormKey: orgA.publicFormKey,
      document: buildTestCnpj("404040400001"),
      email: "cliente.legitimo@teste.test",
      cart: [{ productId: orgA.productId, quantity: 3 }],
    }),
    "198.51.100.6",
  );
  console.log(`  resposta: ${legit.status} — ${JSON.stringify(legit)}`);

  if (legit.quoteNumber) {
    const { data: quote } = await admin
      .from("quotes")
      .select("id, tax_snapshot_at, total, customer_document")
      .eq("org_id", orgA.orgId)
      .order("sequence", { ascending: false })
      .limit(1)
      .single();
    console.log(`  orçamento persistido: ${JSON.stringify(quote)}`);
  }
}

main().catch((error) => {
  console.error("erro fatal:", error);
  process.exit(1);
});
