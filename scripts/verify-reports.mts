/**
 * Verificação ao vivo do Milestone 20 (relatórios) contra um Postgres real e
 * o route handler real do Next.js. Cobre o que teste unitário não cobre:
 *
 *  - RLS de `report_schedules`: todo membro lê, só admin escreve, isolamento
 *    entre organizações;
 *  - EXECUTE de `report_schedules_due`/`report_schedules_mark_sent` de fato
 *    revogado de anon/authenticated (só service_role);
 *  - `report_schedules_due` só devolve schedule ativo e vencido;
 *  - `report_schedules_mark_sent` avança `next_run_at` e grava `last_sent_at`;
 *  - a query com `quote_items!inner(quotes)` filtrando por org/revisão
 *    atual/emitido (usada por `loadReportQuoteItems`/`fetchRawQuoteItemsCore`)
 *    isola corretamente entre organizações e não vaza item de rascunho;
 *  - o endpoint HTTP: 401 sem segredo/com segredo errado, e a proteção
 *    contra execução duplicada (409) — sem provocar envio real de e-mail
 *    (mesma disciplina de verify-automations.mts: nenhum schedule fica
 *    vencido na fase HTTP).
 *
 * Uso: `npx supabase start && npx supabase db reset && npm run dev` (outro
 * terminal) `&& npx tsx scripts/verify-reports.mts`
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

const API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const AUTOMATIONS_SECRET = process.env.AUTOMATIONS_API_SECRET;

if (!AUTOMATIONS_SECRET) {
  console.error(
    "AUTOMATIONS_API_SECRET não está no ambiente deste script — export antes de rodar.",
  );
  process.exit(1);
}

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

const admin = createClient<Database>(API_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient<Database>(API_URL, ANON_KEY, { auth: { persistSession: false } });

/**
 * Client SEM o generic `<Database>`, só para fabricar dado de teste que
 * grava direto nas colunas de snapshot (`quotes.subtotal/total/...`,
 * `quote_items.unit_price_charged/...`). O `Database` tipado deixa essas
 * colunas de fora de `Insert`/`Update` de propósito — só `issue_quote`/
 * `create_public_quote` (funções SQL, não o client tipado) devem escrevê-las
 * na aplicação de verdade (ver 20260726000009_quote_engine.sql). Usar o
 * client tipado aqui accusaria esse guardrail incorretamente: quem está
 * fabricando o dado é este script de seed, não um caminho de código real.
 */
const adminRaw = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function signUpUser(
  email: string,
  fullName: string,
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password: "senha-de-teste-123",
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !data.user) throw new Error(`createUser: ${createError?.message}`);

  const client = createClient<Database>(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: "senha-de-teste-123" });
  if (error) throw new Error(`signIn: ${error.message}`);
  return { client, userId: data.user.id };
}

async function inviteAndAccept(
  adminClient: SupabaseClient<Database>,
  orgId: string,
  email: string,
  vendedorClient: SupabaseClient<Database>,
) {
  const { data: invite, error: inviteError } = await adminClient
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email,
      role: "vendedor",
      invited_by: (await adminClient.auth.getUser()).data.user!.id,
    })
    .select("token")
    .single();
  if (inviteError || !invite) throw new Error(`organization_invites: ${inviteError?.message}`);
  const { error: acceptError } = await vendedorClient.rpc("accept_invite", {
    invite_token: invite.token,
  });
  if (acceptError) throw new Error(`accept_invite: ${acceptError.message}`);
}

async function insertRawQuote(params: {
  orgId: string;
  sequence: number;
  status: Database["public"]["Tables"]["quotes"]["Row"]["status"];
  ownerId: string | null;
  customerSourceId: string;
}) {
  const { data, error } = await admin
    .from("quotes")
    .insert({
      org_id: params.orgId,
      sequence: params.sequence,
      revision: 1,
      status: params.status,
      owner_id: params.ownerId,
      customer_name: "Cliente Relatório",
      customer_document: "",
      customer_source_id: params.customerSourceId,
      discount_type: "fixed",
      discount_value: "0",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`insertRawQuote: ${error?.message}`);
  return data.id as string;
}

/**
 * Emite a quote de teste DEPOIS dos itens já estarem gravados — a trigger de
 * imutabilidade (`quote_items_guard_issued_immutable`, Milestone 14) rejeita
 * insert de item num orçamento cujo `tax_snapshot_at` já está preenchido,
 * mesma ordem que `issue_quote` segue de verdade (itens antes do snapshot).
 */
async function emitRawQuote(id: string, total: number, paymentBandLabel: string) {
  const { error } = await adminRaw
    .from("quotes")
    .update({
      subtotal: total,
      total,
      discount_amount: 0,
      payment_discount_amount: 0,
      payment_band_label: paymentBandLabel,
      tax_snapshot_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`emitir quote de teste: ${error.message}`);
}

async function main() {
  const stamp = Date.now();

  console.log("\n== setup: duas organizações (isolamento) ==");
  const { client: adminA } = await signUpUser(`admin.a.${stamp}@metrapex.test`, "Admin Org A");
  const { data: orgA, error: orgAError } = await adminA.rpc("create_organization", {
    org_name: `Metrapex Relatórios A ${stamp}`,
    org_slug: `metrapex-reports-a-${stamp}`,
  });
  if (orgAError || !orgA) throw new Error(`create_organization A: ${orgAError?.message}`);
  const orgAId = (orgA as { id: string }).id;

  const vendedorAEmail = `vendedor.a.${stamp}@metrapex.test`;
  const { client: vendedorA, userId: vendedorAId } = await signUpUser(vendedorAEmail, "Vendedor A");
  await inviteAndAccept(adminA, orgAId, vendedorAEmail, vendedorA);

  const { client: adminB } = await signUpUser(`admin.b.${stamp}@metrapex.test`, "Admin Org B");
  const { data: orgB, error: orgBError } = await adminB.rpc("create_organization", {
    org_name: `Metrapex Relatórios B ${stamp}`,
    org_slug: `metrapex-reports-b-${stamp}`,
  });
  if (orgBError || !orgB) throw new Error(`create_organization B: ${orgBError?.message}`);
  const orgBId = (orgB as { id: string }).id;

  console.log("\n== dado de orçamento para os relatórios ==");
  const convertedId = await insertRawQuote({
    orgId: orgAId,
    sequence: 2001,
    status: "convertido",
    ownerId: vendedorAId,
    customerSourceId: "site",
  });
  const sentId = await insertRawQuote({
    orgId: orgAId,
    sequence: 2002,
    status: "enviado",
    ownerId: vendedorAId,
    customerSourceId: "crm",
  });
  const draftId = await insertRawQuote({
    orgId: orgAId,
    sequence: 2003,
    status: "gerado",
    ownerId: null,
    customerSourceId: "site",
  });
  const orgBQuoteId = await insertRawQuote({
    orgId: orgBId,
    sequence: 1,
    status: "convertido",
    ownerId: null,
    customerSourceId: "site",
  });

  // Itens gravados ANTES da emissão (mesma ordem de issue_quote) — só depois
  // disso o snapshot de cada quote é congelado, abaixo.
  const { error: itemError } = await adminRaw.from("quote_items").insert([
    {
      quote_id: convertedId,
      position: 1,
      product_external_code: "SKU-1",
      product_name: "Produto Relatório",
      quantity: "2",
      unit_price_charged: "100",
      unit_base_display: "100",
      line_total: "200",
    },
    {
      quote_id: draftId,
      position: 1,
      product_external_code: "SKU-2",
      product_name: "Produto Rascunho",
      quantity: "1",
    },
    {
      quote_id: orgBQuoteId,
      position: 1,
      product_external_code: "SKU-3",
      product_name: "Produto Org B",
      quantity: "1",
      unit_price_charged: "999",
      unit_base_display: "999",
      line_total: "999",
    },
  ]);
  if (itemError) throw new Error(`insert quote_items: ${itemError.message}`);

  await emitRawQuote(convertedId, 500, "Até R$ 1.000");
  await emitRawQuote(sentId, 250, "Até R$ 1.000");
  // draftId fica sem emitir de propósito — é o caso "rascunho" do teste.
  await emitRawQuote(orgBQuoteId, 999, "Até R$ 1.000");

  console.log("\n== quote_items!inner filtrado por org/revisão/emitido ==");
  const { data: itemsOrgA, error: itemsOrgAError } = await admin
    .from("quote_items")
    .select("product_name, quotes!inner(org_id, superseded_by_revision_id, tax_snapshot_at)")
    .eq("quotes.org_id", orgAId)
    .is("quotes.superseded_by_revision_id", null)
    .not("quotes.tax_snapshot_at", "is", null);
  check("query quote_items!inner executa sem erro", !itemsOrgAError, itemsOrgAError?.message);
  const namesOrgA = new Set((itemsOrgA ?? []).map((row) => row.product_name));
  check("item do orçamento emitido da org A aparece", namesOrgA.has("Produto Relatório"));
  check("item do RASCUNHO da org A não aparece (só emitido)", !namesOrgA.has("Produto Rascunho"));
  check("item da org B não vaza para a query da org A", !namesOrgA.has("Produto Org B"));

  console.log("\n== RLS de report_schedules: select member, write admin ==");
  const { data: created, error: createError } = await adminA
    .from("report_schedules")
    .insert({
      org_id: orgAId,
      name: "Relatório semanal de teste",
      report_key: "quotes_by_period",
      frequency: "semanal",
      recipients: ["vendas@example.com"],
    })
    .select("id, next_run_at")
    .single();
  check("admin consegue criar agendamento", !createError && !!created, createError?.message);
  const scheduleId = created!.id as string;

  const vendedorRead = await vendedorA.from("report_schedules").select("id").eq("id", scheduleId);
  check(
    "vendedor da mesma org consegue LER o agendamento (transparência)",
    (vendedorRead.data ?? []).length === 1,
    vendedorRead.error?.message,
  );

  const vendedorWrite = await vendedorA
    .from("report_schedules")
    .update({ name: "tentativa indevida" })
    .eq("id", scheduleId);
  const { data: afterVendedorWrite } = await adminA
    .from("report_schedules")
    .select("name")
    .eq("id", scheduleId)
    .single();
  check(
    "vendedor NÃO consegue editar o agendamento (RLS write_admin barra a linha)",
    afterVendedorWrite?.name === "Relatório semanal de teste",
    { updateError: vendedorWrite.error?.message, nameAfter: afterVendedorWrite?.name },
  );

  const orgBRead = await adminB.from("report_schedules").select("id").eq("id", scheduleId);
  check(
    "admin de outra organização NÃO enxerga o agendamento (isolamento)",
    (orgBRead.data ?? []).length === 0,
    orgBRead.error?.message,
  );

  console.log("\n== EXECUTE revogado de anon/authenticated ==");
  const anonDue = await anon.rpc("report_schedules_due");
  check("anon NÃO consegue chamar report_schedules_due direto", anonDue.error !== null, anonDue);

  const vendedorDue = await vendedorA.rpc("report_schedules_due");
  check(
    "vendedor autenticado NÃO consegue chamar report_schedules_due direto",
    vendedorDue.error !== null,
    vendedorDue,
  );

  const vendedorMarkSent = await vendedorA.rpc("report_schedules_mark_sent", {
    p_id: scheduleId,
    p_next_run_at: new Date().toISOString(),
  });
  check(
    "vendedor autenticado NÃO consegue chamar report_schedules_mark_sent direto",
    vendedorMarkSent.error !== null,
    vendedorMarkSent,
  );

  console.log("\n== report_schedules_due / report_schedules_mark_sent (service_role) ==");
  const dueBefore = await admin.rpc("report_schedules_due");
  const dueIdsBefore = new Set((dueBefore.data ?? []).map((row) => row.id));
  check(
    "agendamento recém-criado (next_run_at = now() por padrão) está vencido",
    dueIdsBefore.has(scheduleId),
    dueBefore.error?.message,
  );

  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 30);
  const markSent = await admin.rpc("report_schedules_mark_sent", {
    p_id: scheduleId,
    p_next_run_at: farFuture.toISOString(),
  });
  check("report_schedules_mark_sent executa sem erro", !markSent.error, markSent.error?.message);

  const { data: afterMarkSent } = await admin
    .from("report_schedules")
    .select("last_sent_at, next_run_at")
    .eq("id", scheduleId)
    .single();
  check("last_sent_at foi gravado", !!afterMarkSent?.last_sent_at);
  check(
    "next_run_at avançou para o valor passado",
    // Postgres devolve timestamptz com offset "+00:00", não sufixo "Z" —
    // compara o instante (epoch ms), não a formatação textual da ISO string.
    !!afterMarkSent?.next_run_at &&
      Math.abs(new Date(afterMarkSent.next_run_at).getTime() - farFuture.getTime()) < 1000,
    afterMarkSent,
  );

  const dueAfter = await admin.rpc("report_schedules_due");
  const dueIdsAfter = new Set((dueAfter.data ?? []).map((row) => row.id));
  check(
    "agendamento com next_run_at no futuro NÃO aparece mais em report_schedules_due",
    !dueIdsAfter.has(scheduleId),
  );

  console.log("\n== agendamento pausado não aparece mesmo vencido ==");
  await admin
    .from("report_schedules")
    .update({ active: false, next_run_at: new Date().toISOString() })
    .eq("id", scheduleId);
  const dueWhilePaused = await admin.rpc("report_schedules_due");
  const dueIdsPaused = new Set((dueWhilePaused.data ?? []).map((row) => row.id));
  check(
    "schedule pausado (active=false) NÃO aparece em report_schedules_due",
    !dueIdsPaused.has(scheduleId),
  );

  // Limpa antes da fase HTTP — garante checked=0 sem provocar envio real
  // pela Resend (mesma disciplina de verify-automations.mts).
  await admin.from("report_schedules").delete().eq("id", scheduleId);
  await admin.from("quotes").delete().in("id", [convertedId, sentId, draftId, orgBQuoteId]);

  console.log("\n== HTTP: autenticação de serviço ==");
  const noAuth = await fetch(`${APP_URL}/api/automations/send-reports`, { method: "POST" });
  eq("sem Authorization → 401", noAuth.status, 401);

  const wrongAuth = await fetch(`${APP_URL}/api/automations/send-reports`, {
    method: "POST",
    headers: { Authorization: "Bearer segredo-errado" },
  });
  eq("segredo incorreto → 401", wrongAuth.status, 401);

  console.log("\n== HTTP: execução com zero candidatos (sem provocar e-mail real) ==");
  const validHeaders = { Authorization: `Bearer ${AUTOMATIONS_SECRET}` };
  const firstRun = await fetch(`${APP_URL}/api/automations/send-reports`, {
    method: "POST",
    headers: validHeaders,
  });
  const firstBody = (await firstRun.json()) as { checked?: number; sent?: number };
  check(
    "primeira execução autenticada → 200 com checked=0 (nenhum schedule vencido)",
    firstRun.status === 200 && firstBody.checked === 0 && firstBody.sent === 0,
    firstBody,
  );

  console.log("\n== HTTP: proteção contra execução duplicada ==");
  const secondRun = await fetch(`${APP_URL}/api/automations/send-reports`, {
    method: "POST",
    headers: validHeaders,
  });
  eq("segunda chamada na mesma janela → 409", secondRun.status, 409);

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  console.log(
    "\nPasso manual (não coberto aqui de propósito): configurar RESEND_API_KEY de teste, criar " +
      "um agendamento com next_run_at vencido de verdade e chamar o endpoint sem limpar antes, " +
      "confirmando o e-mail recebido (resumo + anexo CSV) e o avanço de next_run_at.",
  );
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
