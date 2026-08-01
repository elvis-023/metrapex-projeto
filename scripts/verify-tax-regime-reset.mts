/**
 * Prova, contra um Postgres real, que o reset de configuração fiscal
 * (20260801000018_tax_config_reset.sql) não altera uma vírgula de documento
 * já emitido — mesmo com linhas REAIS em quote_item_taxes (o teste feito na
 * migration em si rodou contra um banco sem nenhuma linha de tributo
 * emitida; este script fecha essa lacuna).
 *
 * Duas organizações, regimes diferentes (Lucro Presumido: ICMS+IPI; Lucro
 * Real: ICMS+ISS), cada uma com um orçamento emitido com tributos reais.
 * Captura os valores de quote_item_taxes ANTES do reset, roda o mesmo DELETE
 * que a migration roda (tax_rates, tax_types, tax_settings), e confere que
 * as linhas voltam byte-a-byte idênticas — e que nenhuma leitura de
 * documento emitido precisa de tax_types para funcionar (§11.8).
 *
 * Uso: `npx supabase start && npx tsx scripts/verify-tax-regime-reset.mts`
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
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
    if (detail !== undefined) console.error(`        ${JSON.stringify(detail, null, 2)}`);
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  check(`${label} → ${String(actual)}`, actual === expected, { actual, expected });
}

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

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

type TaxCodes = {
  icms: { mode: "exclusive" | "inclusive"; rate: number };
  second: { code: string; mode: "exclusive" | "inclusive"; rate: number };
};

async function setupOrgWithEmittedQuote(
  client: SupabaseClient,
  label: string,
  slug: string,
  regime: string,
  codes: TaxCodes,
) {
  const { data: org, error } = await client.rpc("create_organization", {
    org_name: label,
    org_slug: slug,
  });
  if (error || !org) throw new Error(`create_organization(${label}): ${error?.message}`);
  const orgId = (org as { id: string }).id;

  // tax_regime ainda não é setado pela UI (Bloco 3 não existe) — setando via
  // client autenticado (o próprio admin da organização, mesmo caminho que a
  // UI vai usar) só para simular o estado pós-onboarding. NÃO usar o client
  // de service_role aqui: este projeto só concede GRANT de escrita em
  // organizations/tax_types/tax_rates/tax_settings para `authenticated`
  // (20260725000008_grants.sql) — service_role tem só SELECT nessas tabelas
  // (achado desta verificação, ver relatório).
  const { error: regimeError } = await client
    .from("organizations")
    .update({ tax_regime: regime })
    .eq("id", orgId);
  if (regimeError) throw new Error(`tax_regime(${label}): ${regimeError.message}`);

  const footer = "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.";
  await client.from("tax_settings").insert({ org_id: orgId, document_footer: footer });

  const { data: taxTypes, error: taxError } = await client
    .from("tax_types")
    .insert([
      {
        org_id: orgId,
        code: "ICMS",
        label: "ICMS",
        mode: codes.icms.mode,
        default_rate: codes.icms.rate,
        display_order: 1,
      },
      {
        org_id: orgId,
        code: codes.second.code,
        label: codes.second.code,
        mode: codes.second.mode,
        default_rate: codes.second.rate,
        display_order: 2,
      },
    ])
    .select("id, code");
  if (taxError || !taxTypes) throw new Error(`tax_types(${label}): ${taxError?.message}`);
  const icmsId = taxTypes.find((t) => t.code === "ICMS")!.id;
  const secondId = taxTypes.find((t) => t.code === codes.second.code)!.id;

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
      name: "Item",
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
      customer_name: `Cliente ${label}`,
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
        product_external_code: "PRD-001",
        product_name: "Item",
        category_id_snapshot: category!.id,
        category_name: "Padrão",
        quantity: "1.000000",
      },
    ],
    p_previous_revision_id: null,
  });
  const quoteId = (draft as { id: string }).id;

  const { error: issueError } = await client.rpc("issue_quote", {
    p_quote_id: quoteId,
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
            mode: codes.icms.mode,
            rate_applied: codes.icms.rate.toFixed(4),
            rate_source: "org_default",
            note: null,
            base_amount: "100.000000",
            tax_amount: ((100 * codes.icms.rate) / 100).toFixed(6),
            display_order: 1,
          },
          {
            tax_type_id: secondId,
            tax_code: codes.second.code,
            tax_label: codes.second.code,
            mode: codes.second.mode,
            rate_applied: codes.second.rate.toFixed(4),
            rate_source: "org_default",
            note: null,
            base_amount: "100.000000",
            tax_amount: ((100 * codes.second.rate) / 100).toFixed(6),
            display_order: 2,
          },
        ],
      },
    ],
    p_snapshot: {
      subtotal: "100.000000",
      total: "100.000000",
      discount_amount: "0.000000",
      payment_discount_amount: "0.000000",
      payment_condition_label: null,
      payment_condition_kind: null,
      payment_condition_discount_percent: null,
      payment_condition_installments: null,
      payment_condition_term_days: null,
      payment_band_label: null,
      tax_footer_note: footer,
      show_tax_lines: true,
    },
  });
  if (issueError) throw new Error(`issue_quote(${label}): ${issueError.message}`);

  return { orgId, quoteId, label };
}

type TaxSnapshotRow = {
  id: string;
  quote_item_id: string;
  tax_code: string;
  tax_label: string;
  mode: string;
  rate_applied: string;
  rate_source: string;
  base_amount: string;
  tax_amount: string;
};

async function fetchTaxSnapshot(quoteId: string): Promise<TaxSnapshotRow[]> {
  const { data: item } = await admin
    .from("quote_items")
    .select("id")
    .eq("quote_id", quoteId)
    .single();
  const { data } = await admin
    .from("quote_item_taxes")
    .select(
      "id, quote_item_id, tax_code, tax_label, mode, rate_applied, rate_source, base_amount, tax_amount",
    )
    .eq("quote_item_id", item!.id)
    .order("display_order")
    .returns<TaxSnapshotRow[]>();
  return data ?? [];
}

async function main() {
  const stamp = Date.now();

  console.log("\n== setup: duas organizações, regimes diferentes ==");
  const clientA = await signUpUser(`presumido.${stamp}@metrapex.test`);
  const orgA = await setupOrgWithEmittedQuote(
    clientA,
    `Presumido ${stamp}`,
    `presumido-${stamp}`,
    "lucro_presumido",
    {
      icms: { mode: "exclusive", rate: 18 },
      second: { code: "IPI", mode: "inclusive", rate: 5 },
    },
  );
  console.log(`  org A (lucro_presumido) ${orgA.orgId} — orçamento ${orgA.quoteId}`);

  const clientB = await signUpUser(`real.${stamp}@metrapex.test`);
  const orgB = await setupOrgWithEmittedQuote(
    clientB,
    `Real ${stamp}`,
    `real-${stamp}`,
    "lucro_real",
    {
      icms: { mode: "exclusive", rate: 12 },
      second: { code: "ISS", mode: "exclusive", rate: 3 },
    },
  );
  console.log(`  org B (lucro_real) ${orgB.orgId} — orçamento ${orgB.quoteId}`);

  console.log("\n== ANTES do reset: captura das linhas de quote_item_taxes ==");
  const beforeA = await fetchTaxSnapshot(orgA.quoteId);
  const beforeB = await fetchTaxSnapshot(orgB.quoteId);
  eq("org A: 2 linhas de tributo emitidas", beforeA.length, 2);
  eq("org B: 2 linhas de tributo emitidas", beforeB.length, 2);
  check(
    "pelo menos 3 linhas de quote_item_taxes ao todo (pedido do usuário)",
    beforeA.length + beforeB.length >= 3,
    beforeA.length + beforeB.length,
  );

  console.log("\n  -- org A (Lucro Presumido) --");
  for (const row of beforeA) {
    console.log(
      `  ${row.tax_code.padEnd(6)} rate=${row.rate_applied} base=${row.base_amount} tax=${row.tax_amount} source=${row.rate_source}`,
    );
  }
  console.log("  -- org B (Lucro Real) --");
  for (const row of beforeB) {
    console.log(
      `  ${row.tax_code.padEnd(6)} rate=${row.rate_applied} base=${row.base_amount} tax=${row.tax_amount} source=${row.rate_source}`,
    );
  }

  const { data: quotesBefore } = await admin.from("quotes").select("id, total, tax_footer_note");
  const totalOrgABefore = quotesBefore!.find((q) => q.id === orgA.quoteId)!;
  const totalOrgBBefore = quotesBefore!.find((q) => q.id === orgB.quoteId)!;

  console.log("\n== RESET: mesmo delete da migration 20260801000018, um por organização ==");
  // Via client autenticado (admin da própria org), não service_role — mesma
  // razão do comentário acima. Cada org só consegue apagar a PRÓPRIA
  // configuração (RLS), o que já é uma prova extra de isolamento: org A não
  // consegue tocar em tax_types de org B nem vice-versa.
  const quotesCountBefore = (await admin.from("quotes").select("*", { count: "exact", head: true }))
    .count!;
  const quoteItemsCountBefore = (
    await admin.from("quote_items").select("*", { count: "exact", head: true })
  ).count!;
  const quoteItemTaxesCountBefore = (
    await admin.from("quote_item_taxes").select("*", { count: "exact", head: true })
  ).count!;

  for (const c of [clientA, clientB]) {
    const del1 = await c
      .from("tax_rates")
      .delete()
      .in("tax_type_id", (await c.from("tax_types").select("id")).data?.map((r) => r.id) ?? []);
    if (del1.error) throw new Error(`delete tax_rates: ${del1.error.message}`);
    const del2 = await c.from("tax_types").delete().not("id", "is", null);
    if (del2.error) throw new Error(`delete tax_types: ${del2.error.message}`);
    const del3 = await c.from("tax_settings").delete().not("org_id", "is", null);
    if (del3.error) throw new Error(`delete tax_settings: ${del3.error.message}`);
  }

  const quotesCountAfter = (await admin.from("quotes").select("*", { count: "exact", head: true }))
    .count!;
  const quoteItemsCountAfter = (
    await admin.from("quote_items").select("*", { count: "exact", head: true })
  ).count!;
  const quoteItemTaxesCountAfter = (
    await admin.from("quote_item_taxes").select("*", { count: "exact", head: true })
  ).count!;

  eq("contagem global de quotes inalterada", quotesCountAfter, quotesCountBefore);
  eq("contagem global de quote_items inalterada", quoteItemsCountAfter, quoteItemsCountBefore);
  eq(
    "contagem global de quote_item_taxes inalterada",
    quoteItemTaxesCountAfter,
    quoteItemTaxesCountBefore,
  );

  const taxTypesOrgAAfter = (
    await admin
      .from("tax_types")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgA.orgId)
  ).count;
  const taxTypesOrgBAfter = (
    await admin
      .from("tax_types")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgB.orgId)
  ).count;
  const taxSettingsOrgAAfter = (
    await admin
      .from("tax_settings")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgA.orgId)
  ).count;
  const taxSettingsOrgBAfter = (
    await admin
      .from("tax_settings")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgB.orgId)
  ).count;
  eq("org A: tax_types zerado", taxTypesOrgAAfter, 0);
  eq("org B: tax_types zerado", taxTypesOrgBAfter, 0);
  eq("org A: tax_settings zerado", taxSettingsOrgAAfter, 0);
  eq("org B: tax_settings zerado", taxSettingsOrgBAfter, 0);

  console.log("\n== DEPOIS do reset: mesmas linhas, lado a lado ==");
  const afterA = await fetchTaxSnapshot(orgA.quoteId);
  const afterB = await fetchTaxSnapshot(orgB.quoteId);

  console.log("\n  -- org A (Lucro Presumido) --");
  console.log(
    "  código  | antes (rate/base/tax)              | depois (rate/base/tax)             | idêntico?",
  );
  for (let i = 0; i < beforeA.length; i += 1) {
    const b = beforeA[i];
    const a = afterA[i];
    const same = JSON.stringify(b) === JSON.stringify(a);
    console.log(
      `  ${b.tax_code.padEnd(7)} | ${b.rate_applied}/${b.base_amount}/${b.tax_amount}`.padEnd(60) +
        ` | ${a.rate_applied}/${a.base_amount}/${a.tax_amount}`.padEnd(38) +
        ` | ${same ? "SIM" : "NÃO — FALHOU"}`,
    );
  }
  console.log("\n  -- org B (Lucro Real) --");
  console.log(
    "  código  | antes (rate/base/tax)              | depois (rate/base/tax)             | idêntico?",
  );
  for (let i = 0; i < beforeB.length; i += 1) {
    const b = beforeB[i];
    const a = afterB[i];
    const same = JSON.stringify(b) === JSON.stringify(a);
    console.log(
      `  ${b.tax_code.padEnd(7)} | ${b.rate_applied}/${b.base_amount}/${b.tax_amount}`.padEnd(60) +
        ` | ${a.rate_applied}/${a.base_amount}/${a.tax_amount}`.padEnd(38) +
        ` | ${same ? "SIM" : "NÃO — FALHOU"}`,
    );
  }

  check(
    "org A: linhas de tributo byte-idênticas antes/depois",
    JSON.stringify(beforeA) === JSON.stringify(afterA),
    {
      antes: beforeA,
      depois: afterA,
    },
  );
  check(
    "org B: linhas de tributo byte-idênticas antes/depois",
    JSON.stringify(beforeB) === JSON.stringify(afterB),
    {
      antes: beforeB,
      depois: afterB,
    },
  );

  const { data: quotesAfter } = await admin.from("quotes").select("id, total, tax_footer_note");
  const totalOrgAAfter = quotesAfter!.find((q) => q.id === orgA.quoteId)!;
  const totalOrgBAfter = quotesAfter!.find((q) => q.id === orgB.quoteId)!;
  eq("org A: total do orçamento inalterado", totalOrgAAfter.total, totalOrgABefore.total);
  eq(
    "org A: rodapé fiscal inalterado",
    totalOrgAAfter.tax_footer_note,
    totalOrgABefore.tax_footer_note,
  );
  eq("org B: total do orçamento inalterado", totalOrgBAfter.total, totalOrgBBefore.total);
  eq(
    "org B: rodapé fiscal inalterado",
    totalOrgBAfter.tax_footer_note,
    totalOrgBBefore.tax_footer_note,
  );

  console.log("\n== org A e org B: tax_regime sobrevive ao reset (não é config, é metadado) ==");
  const { data: orgsAfter } = await admin
    .from("organizations")
    .select("id, tax_regime")
    .in("id", [orgA.orgId, orgB.orgId]);
  eq(
    "org A mantém tax_regime",
    orgsAfter!.find((o) => o.id === orgA.orgId)!.tax_regime,
    "lucro_presumido",
  );
  eq(
    "org B mantém tax_regime",
    orgsAfter!.find((o) => o.id === orgB.orgId)!.tax_regime,
    "lucro_real",
  );

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  console.log(`\nOrçamentos pra abrir na tela (org A / org B): ${orgA.quoteId} / ${orgB.quoteId}`);
  console.log(
    `Login: presumido.${stamp}@metrapex.test / real.${stamp}@metrapex.test (senha: senha-de-teste-123)`,
  );
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
