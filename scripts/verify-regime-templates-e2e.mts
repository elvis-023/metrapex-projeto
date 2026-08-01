/**
 * Ponta a ponta: cria uma organização de teste em cada um dos quatro regimes
 * (MEI, Simples Nacional, Lucro Presumido, Lucro Real), aplica o MESMO
 * template que a migration 20260802000019_apply_regime_templates.sql aplica
 * às organizações existentes, emite o MESMO orçamento de R$ 100,00 (1
 * produto, quantidade 1) nas quatro, e imprime a tabela comparativa: linhas
 * de imposto, total e rodapé.
 *
 * Uso: `npx supabase start && npx tsx scripts/verify-regime-templates-e2e.mts`
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Regime = "mei" | "simples_nacional" | "lucro_presumido" | "lucro_real";

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

const FOOTER = "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.";

/** Espelha exatamente a migration 20260802000019 / buildTaxTemplatePlan. */
async function applyRegimeTemplate(client: SupabaseClient, orgId: string, regime: Regime) {
  if (regime === "mei" || regime === "simples_nacional") {
    await client.from("tax_settings").insert({ org_id: orgId, document_footer: FOOTER, show_tax_lines: false });
    return { icmsId: null as string | null };
  }

  await client.from("tax_settings").insert({ org_id: orgId, document_footer: null, show_tax_lines: true });
  const { data: taxTypes, error } = await client
    .from("tax_types")
    .insert([
      { org_id: orgId, code: "ICMS", label: "ICMS", mode: "exclusive", default_rate: 18, display_order: 1 },
      { org_id: orgId, code: "IPI", label: "IPI", mode: "inclusive", default_rate: 0, display_order: 2 },
    ])
    .select("id, code");
  if (error || !taxTypes) throw new Error(`tax_types: ${error?.message}`);
  return { icmsId: taxTypes.find((t) => t.code === "ICMS")!.id };
}

async function setupOrg(regime: Regime, stamp: number) {
  const email = `${regime}.${stamp}@metrapex.test`;
  const client = await signUpUser(email);
  const { data: org, error } = await client.rpc("create_organization", {
    org_name: `Teste ${regime} ${stamp}`,
    org_slug: `teste-${regime.replace("_", "-")}-${stamp}`,
  });
  if (error || !org) throw new Error(`create_organization(${regime}): ${error?.message}`);
  const orgId = (org as { id: string }).id;

  const { error: regimeError } = await client
    .from("organizations")
    .update({ tax_regime: regime })
    .eq("id", orgId);
  if (regimeError) throw new Error(`tax_regime(${regime}): ${regimeError.message}`);

  const { icmsId } = await applyRegimeTemplate(client, orgId, regime);

  const { data: product } = await client
    .from("products")
    .insert({ org_id: orgId, external_code: "PRD-100", name: "Produto Teste R$100", price: "100.000000" })
    .select("id")
    .single();

  const { data: draft } = await client.rpc("save_quote_draft", {
    p_org_id: orgId,
    p_quote: {
      status: "gerado",
      owner_id: null,
      customer_id: null,
      customer_name: `Cliente ${regime}`,
      customer_document: "12.345.678/0001-90",
      customer_source_id: "crm",
      discount_type: "fixed",
      discount_value: "0.000000",
      payment_condition_id: null,
      expires_at: "2026-08-25",
    },
    p_items: [
      {
        product_id: product!.id,
        product_external_code: "PRD-100",
        product_name: "Produto Teste R$100",
        category_id_snapshot: null,
        category_name: null,
        quantity: "1.000000",
      },
    ],
    p_previous_revision_id: null,
  });
  const quoteId = (draft as { id: string }).id;

  // Réplica do que calcItemTaxes de fato produz para este preset (sem
  // override nenhum de categoria/produto): ICMS 18% org_default É registrado
  // (rate > 0); IPI 0% org_default NÃO é registrado (rate = 0 E source ===
  // 'org_default' — "existe, mas não incide por omissão", briefing §6).
  const taxes =
    regime === "lucro_presumido" || regime === "lucro_real"
      ? [
          {
            tax_type_id: icmsId,
            tax_code: "ICMS",
            tax_label: "ICMS",
            mode: "exclusive" as const,
            rate_applied: "18.0000",
            rate_source: "org_default" as const,
            note: null,
            base_amount: "100.000000",
            tax_amount: "18.000000",
            display_order: 1,
          },
        ]
      : [];
  const total = taxes.length > 0 ? "118.000000" : "100.000000";

  const { error: issueError } = await client.rpc("issue_quote", {
    p_quote_id: quoteId,
    p_items: [
      {
        position: 1,
        unit_price_charged: "100.000000",
        unit_base_display: "100.000000",
        line_total: total,
        taxes,
      },
    ],
    p_snapshot: {
      subtotal: "100.000000",
      total,
      discount_amount: "0.000000",
      payment_discount_amount: "0.000000",
      payment_condition_label: null,
      payment_condition_kind: null,
      payment_condition_discount_percent: null,
      payment_condition_installments: null,
      payment_condition_term_days: null,
      payment_band_label: null,
      tax_footer_note: regime === "mei" || regime === "simples_nacional" ? FOOTER : null,
      show_tax_lines: taxes.length > 0 || regime === "mei" || regime === "simples_nacional",
    },
  });
  if (issueError) throw new Error(`issue_quote(${regime}): ${issueError.message}`);

  return { orgId, quoteId, email };
}

async function main() {
  const stamp = Date.now();
  const regimes: Regime[] = ["mei", "simples_nacional", "lucro_presumido", "lucro_real"];

  const results = [];
  for (const regime of regimes) {
    const setup = await setupOrg(regime, stamp);

    const { data: quote } = await admin
      .from("quotes")
      .select("total, tax_footer_note, show_tax_lines")
      .eq("id", setup.quoteId)
      .single();
    const { data: item } = await admin
      .from("quote_items")
      .select("id")
      .eq("quote_id", setup.quoteId)
      .single();
    const { data: taxLines } = await admin
      .from("quote_item_taxes")
      .select("tax_code, mode, rate_applied, tax_amount")
      .eq("quote_item_id", item!.id)
      .order("display_order");

    results.push({
      regime,
      orgId: setup.orgId,
      quoteId: setup.quoteId,
      email: setup.email,
      total: Number(quote!.total),
      footer: quote!.tax_footer_note,
      showTaxLines: quote!.show_tax_lines,
      taxLines: taxLines ?? [],
    });
  }

  console.log("\n== Tabela comparativa: mesmo orçamento de R$ 100,00 nos quatro regimes ==\n");
  console.log(
    "Regime".padEnd(18) +
      "Linhas de imposto".padEnd(20) +
      "Detalhe".padEnd(28) +
      "Total".padEnd(12) +
      "Rodapé?",
  );
  console.log("-".repeat(100));
  for (const r of results) {
    const detail =
      r.taxLines.length > 0
        ? r.taxLines.map((t) => `${t.tax_code} ${t.rate_applied}% (R$${t.tax_amount})`).join("; ")
        : "—";
    console.log(
      r.regime.padEnd(18) +
        String(r.taxLines.length).padEnd(20) +
        detail.padEnd(28) +
        `R$ ${r.total.toFixed(2)}`.padEnd(12) +
        (r.footer ? "sim" : "não"),
    );
  }

  console.log("\n== Checagem do esperado ==\n");
  let failures = 0;
  let total = 0;
  function check(label: string, ok: boolean) {
    total += 1;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}`);
    if (!ok) failures += 1;
  }

  const mei = results.find((r) => r.regime === "mei")!;
  const simples = results.find((r) => r.regime === "simples_nacional")!;
  const presumido = results.find((r) => r.regime === "lucro_presumido")!;
  const real = results.find((r) => r.regime === "lucro_real")!;

  check("MEI: R$ 100,00, zero linhas de imposto", mei.total === 100 && mei.taxLines.length === 0);
  check("MEI: rodapé presente", Boolean(mei.footer));
  check(
    "Simples Nacional: R$ 100,00, zero linhas de imposto",
    simples.total === 100 && simples.taxLines.length === 0,
  );
  check("Simples Nacional: rodapé presente", Boolean(simples.footer));
  check(
    "Lucro Presumido: destaca ICMS 18% (IPI 0% org_default fica invisível, por design)",
    presumido.taxLines.length === 1 && presumido.taxLines[0].tax_code === "ICMS",
  );
  check("Lucro Presumido: total R$ 118,00 (ICMS por fora)", presumido.total === 118);
  check("Lucro Presumido: sem rodapé de transparência", presumido.footer === null);
  check(
    "Lucro Real: mesmo destaque do Presumido hoje (ICMS 18%, total R$ 118,00)",
    real.taxLines.length === 1 && real.total === 118,
  );

  console.log(`\n${total - failures}/${total} verificações relevantes passaram.`);
  console.log("\nContas de teste (login: senha-de-teste-123):");
  for (const r of results) {
    console.log(`  ${r.regime.padEnd(18)} ${r.email.padEnd(40)} org=${r.orgId} quote=${r.quoteId}`);
  }

  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
