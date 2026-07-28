/**
 * Verificação ao vivo das automações agendadas (Milestone 18) contra um
 * Postgres real e o route handler real do Next.js. O que esta rotina cobre
 * e nenhum teste unitário cobre:
 *
 *  - EXECUTE das funções novas (automation_claim_run, automation_complete_run,
 *    automation_fail_run, automation_find_stale_quotes,
 *    automation_find_expirable_quotes, automation_expire_quote,
 *    record_system_quote_activity) de fato revogado de anon/authenticated;
 *  - `automation_claim_run` reivindica uma janela uma única vez — segunda
 *    chamada na mesma janela não reprocessa (`claimed = false`), job que
 *    falhou pode ser reivindicado de novo, job concluído devolve o resumo
 *    congelado;
 *  - `automation_find_stale_quotes` só devolve orçamento com dono, na
 *    revisão atual, parado há mais dias que o limite e sem lembrete
 *    recente (cooldown lido de `quote_activities`, não de coluna dedicada);
 *  - `automation_expire_quote` só expira quem ainda está elegível NO
 *    MOMENTO do update (reconfere a condição na própria cláusula WHERE) —
 *    idempotente por linha, mesmo sob duas chamadas concorrentes;
 *  - o endpoint HTTP completo: 401 sem segredo/com segredo errado, e a
 *    proteção contra execução duplicada (409 na segunda chamada dentro da
 *    mesma janela) — sem provocar nenhum envio real pela Resend (chamado
 *    com filtro que garante zero candidatos, ver nota abaixo).
 *
 * Nota deliberada: este script NÃO testa o envio de e-mail de verdade. As
 * chaves em `.env.local` são credenciais reais da Resend/PDFMonkey/Turnstile
 * (ver memória do projeto) — testes automatizados que disparam e-mail real
 * sem querer já causaram problema aqui antes. As duas chamadas HTTP deste
 * script usam parâmetros que garantem `checked: 0`, então nenhum e-mail é
 * tentado. Confirmar o envio de verdade é passo manual (ver instruções ao
 * final).
 *
 * Uso: `npx supabase start && npx supabase db reset && npm run dev` (outro
 * terminal) `&& npx tsx scripts/verify-automations.mts`
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, QuoteStatus } from "@/lib/supabase/types";

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

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Insere o orçamento direto (bypassa `save_quote_draft`/`issue_quote`) — não
 * importa cálculo/snapshot para este teste, só `status`, `owner_id`,
 * `expires_at` e um `updated_at` no passado (o trigger de `updated_at` só
 * dispara em UPDATE, não em INSERT, então o valor explícito aqui sobrevive).
 */
async function insertRawQuote(params: {
  orgId: string;
  sequence: number;
  revision?: number;
  status: QuoteStatus;
  ownerId: string | null;
  customerName: string;
  expiresAt: string | null;
  updatedAt: string;
  supersededByRevisionId?: string | null;
}) {
  const { data, error } = await admin
    .from("quotes")
    .insert({
      org_id: params.orgId,
      sequence: params.sequence,
      revision: params.revision ?? 1,
      status: params.status,
      owner_id: params.ownerId,
      customer_name: params.customerName,
      customer_document: "",
      customer_source_id: "crm",
      discount_type: "fixed",
      discount_value: "0",
      expires_at: params.expiresAt,
      updated_at: params.updatedAt,
      superseded_by_revision_id: params.supersededByRevisionId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`insertRawQuote: ${error?.message}`);
  return data.id as string;
}

async function main() {
  const stamp = Date.now();

  console.log("\n== setup ==");
  const { client: adminUser } = await signUpUser(
    `admin.auto.${stamp}@metrapex.test`,
    "Admin Automações",
  );
  const { data: org, error: orgError } = await adminUser.rpc("create_organization", {
    org_name: `Metrapex Automações ${stamp}`,
    org_slug: `metrapex-automations-${stamp}`,
  });
  if (orgError || !org) throw new Error(`create_organization: ${orgError?.message}`);
  const orgId = (org as { id: string }).id;

  const vendedorEmail = `vendedor.auto.${stamp}@metrapex.test`;
  const { client: vendedorClient, userId: vendedorId } = await signUpUser(
    vendedorEmail,
    "Vendedor Automações",
  );
  // Convite real (mesmo motivo documentado em verify-pipeline-backend.mts:
  // organization_members não tem GRANT pra service_role).
  const { data: invite, error: inviteError } = await adminUser
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email: vendedorEmail,
      role: "vendedor",
      invited_by: (await adminUser.auth.getUser()).data.user!.id,
    })
    .select("token")
    .single();
  if (inviteError || !invite) throw new Error(`organization_invites: ${inviteError?.message}`);
  const { error: acceptError } = await vendedorClient.rpc("accept_invite", {
    invite_token: invite.token,
  });
  if (acceptError) throw new Error(`accept_invite: ${acceptError.message}`);

  console.log("\n== EXECUTE revogado de anon/authenticated (achado de segurança) ==");
  const anonClaim = await anon.rpc("automation_claim_run", {
    p_job_name: "follow_up",
    p_window_seconds: 3600,
  });
  check(
    "anon NÃO consegue chamar automation_claim_run direto",
    anonClaim.error !== null,
    anonClaim,
  );

  const vendedorFindStale = await vendedorClient.rpc("automation_find_stale_quotes", {
    p_stale_days: 3,
  });
  check(
    "vendedor autenticado NÃO consegue chamar automation_find_stale_quotes direto",
    vendedorFindStale.error !== null,
    vendedorFindStale,
  );

  const vendedorExpire = await vendedorClient.rpc("automation_expire_quote", {
    p_quote_id: "00000000-0000-0000-0000-000000000000",
  });
  check(
    "vendedor autenticado NÃO consegue chamar automation_expire_quote direto",
    vendedorExpire.error !== null,
    vendedorExpire,
  );

  const vendedorRecordActivity = await vendedorClient.rpc("record_system_quote_activity", {
    p_quote_id: "00000000-0000-0000-0000-000000000000",
    p_type: "follow_up",
    p_label: "tentativa indevida",
    p_detail: null,
  });
  check(
    "vendedor autenticado NÃO consegue chamar record_system_quote_activity direto",
    vendedorRecordActivity.error !== null,
    vendedorRecordActivity,
  );

  console.log("\n== automation_claim_run: dedupe por janela ==");
  const jobName = `test_job_${stamp}`;
  const firstClaim = await admin
    .rpc("automation_claim_run", { p_job_name: jobName, p_window_seconds: 3600 })
    .single();
  check(
    "primeira reivindicação da janela → claimed = true",
    firstClaim.data?.claimed === true,
    firstClaim,
  );

  const secondClaim = await admin
    .rpc("automation_claim_run", { p_job_name: jobName, p_window_seconds: 3600 })
    .single();
  eq("segunda reivindicação concorrente → claimed", secondClaim.data?.claimed, false);
  eq("segunda reivindicação concorrente → status", secondClaim.data?.status, "processing");

  await admin.rpc("automation_complete_run", {
    p_job_name: jobName,
    p_window_bucket: firstClaim.data!.run_window,
    p_summary: { checked: 5, notified: 2 },
  });

  const claimAfterDone = await admin
    .rpc("automation_claim_run", { p_job_name: jobName, p_window_seconds: 3600 })
    .single();
  eq("reivindicação após conclusão → claimed", claimAfterDone.data?.claimed, false);
  eq("reivindicação após conclusão → status", claimAfterDone.data?.status, "done");
  eq(
    "reivindicação após conclusão devolve o resumo congelado",
    (claimAfterDone.data?.summary as { notified: number } | null)?.notified,
    2,
  );

  const failJobName = `test_job_fail_${stamp}`;
  const failClaim = await admin
    .rpc("automation_claim_run", { p_job_name: failJobName, p_window_seconds: 3600 })
    .single();
  await admin.rpc("automation_fail_run", {
    p_job_name: failJobName,
    p_window_bucket: failClaim.data!.run_window,
    p_error: "erro simulado",
  });
  const retryClaim = await admin
    .rpc("automation_claim_run", { p_job_name: failJobName, p_window_seconds: 3600 })
    .single();
  eq(
    "job que falhou pode ser reivindicado de novo na mesma janela",
    retryClaim.data?.claimed,
    true,
  );

  console.log("\n== automation_find_stale_quotes ==");
  const staleQuoteId = await insertRawQuote({
    orgId,
    sequence: 1001,
    status: "enviado",
    ownerId: vendedorId,
    customerName: "Cliente Parado",
    expiresAt: daysFromNow(20),
    updatedAt: daysAgo(10),
  });
  const freshQuoteId = await insertRawQuote({
    orgId,
    sequence: 1002,
    status: "enviado",
    ownerId: vendedorId,
    customerName: "Cliente Recente",
    expiresAt: daysFromNow(20),
    updatedAt: daysAgo(1),
  });
  const noOwnerQuoteId = await insertRawQuote({
    orgId,
    sequence: 1003,
    status: "gerado",
    ownerId: null,
    customerName: "Cliente Sem Dono",
    expiresAt: daysFromNow(20),
    updatedAt: daysAgo(10),
  });
  const convertedQuoteId = await insertRawQuote({
    orgId,
    sequence: 1004,
    status: "convertido",
    ownerId: vendedorId,
    customerName: "Cliente Convertido",
    expiresAt: daysFromNow(20),
    updatedAt: daysAgo(10),
  });

  const { data: staleResults, error: staleError } = await admin.rpc(
    "automation_find_stale_quotes",
    {
      p_stale_days: 3,
    },
  );
  check("automation_find_stale_quotes executa sem erro", !staleError, staleError?.message);
  const staleIds = new Set((staleResults ?? []).map((r) => r.quote_id));
  check("orçamento parado há 10 dias aparece", staleIds.has(staleQuoteId));
  check("orçamento atualizado há 1 dia NÃO aparece", !staleIds.has(freshQuoteId));
  check("orçamento sem dono NÃO aparece", !staleIds.has(noOwnerQuoteId));
  check("orçamento convertido NÃO aparece", !staleIds.has(convertedQuoteId));

  console.log("\n== cooldown: lembrete recente tira o orçamento da lista ==");
  await admin.rpc("record_system_quote_activity", {
    p_quote_id: staleQuoteId,
    p_type: "follow_up",
    p_label: "Lembrete de follow-up enviado automaticamente",
    p_detail: "teste",
  });
  const { data: afterCooldown } = await admin.rpc("automation_find_stale_quotes", {
    p_stale_days: 3,
  });
  const idsAfterCooldown = new Set((afterCooldown ?? []).map((r) => r.quote_id));
  check(
    "orçamento com lembrete recente sai da lista (cooldown)",
    !idsAfterCooldown.has(staleQuoteId),
  );

  console.log("\n== apenas a revisão atual entra na busca ==");
  const supersededQuoteId = await insertRawQuote({
    orgId,
    sequence: 1005,
    status: "enviado",
    ownerId: vendedorId,
    customerName: "Cliente Revisão Antiga",
    expiresAt: daysFromNow(20),
    updatedAt: daysAgo(10),
  });
  const currentRevisionId = await insertRawQuote({
    orgId,
    sequence: 1005,
    revision: 2,
    status: "enviado",
    ownerId: vendedorId,
    customerName: "Cliente Revisão Antiga",
    expiresAt: daysFromNow(20),
    updatedAt: daysAgo(10),
  });
  await admin
    .from("quotes")
    .update({ superseded_by_revision_id: currentRevisionId })
    .eq("id", supersededQuoteId);
  const { data: revisionCheck } = await admin.rpc("automation_find_stale_quotes", {
    p_stale_days: 3,
  });
  const revisionIds = new Set((revisionCheck ?? []).map((r) => r.quote_id));
  check("revisão antiga (superseded) NÃO aparece", !revisionIds.has(supersededQuoteId));
  check("revisão atual aparece", revisionIds.has(currentRevisionId));

  console.log("\n== automation_find_expirable_quotes + automation_expire_quote ==");
  const expiredCandidateId = await insertRawQuote({
    orgId,
    sequence: 1006,
    status: "negociacao",
    ownerId: vendedorId,
    customerName: "Cliente Vencido",
    expiresAt: daysFromNow(-5),
    updatedAt: daysAgo(6),
  });
  const notYetDueId = await insertRawQuote({
    orgId,
    sequence: 1007,
    status: "negociacao",
    ownerId: vendedorId,
    customerName: "Cliente No Prazo",
    expiresAt: daysFromNow(5),
    updatedAt: daysAgo(1),
  });

  const { data: expirable } = await admin.rpc("automation_find_expirable_quotes");
  const expirableIds = new Set((expirable ?? []).map((r) => r.quote_id));
  check("orçamento vencido entra na lista de expiráveis", expirableIds.has(expiredCandidateId));
  check("orçamento ainda no prazo NÃO entra na lista", !expirableIds.has(notYetDueId));

  const firstExpire = await admin
    .rpc("automation_expire_quote", { p_quote_id: expiredCandidateId })
    .single();
  eq("primeira expiração → true", firstExpire.data, true);

  const { data: expiredRow } = await admin
    .from("quotes")
    .select("status")
    .eq("id", expiredCandidateId)
    .single();
  eq("status do orçamento vira 'expirado'", expiredRow?.status, "expirado");

  const secondExpire = await admin
    .rpc("automation_expire_quote", { p_quote_id: expiredCandidateId })
    .single();
  eq("segunda tentativa (idempotência/concorrência) → false", secondExpire.data, false);

  console.log("\n== corrida: vendedor converte entre a leitura e a expiração ==");
  const raceQuoteId = await insertRawQuote({
    orgId,
    sequence: 1008,
    status: "negociacao",
    ownerId: vendedorId,
    customerName: "Cliente Corrida",
    expiresAt: daysFromNow(-2),
    updatedAt: daysAgo(3),
  });
  // Simula o vendedor convertendo DEPOIS que o job já leu o candidato mas
  // ANTES de chamar automation_expire_quote.
  await admin.from("quotes").update({ status: "convertido" }).eq("id", raceQuoteId);
  const raceExpire = await admin
    .rpc("automation_expire_quote", { p_quote_id: raceQuoteId })
    .single();
  eq("orçamento convertido no meio da corrida NÃO é expirado", raceExpire.data, false);
  const { data: raceRow } = await admin
    .from("quotes")
    .select("status")
    .eq("id", raceQuoteId)
    .single();
  eq("status permanece 'convertido'", raceRow?.status, "convertido");

  // Limpa os orçamentos de teste antes da fase HTTP — o objetivo daquela
  // fase é confirmar 401/409 sem provocar nenhum envio real pela Resend.
  await admin
    .from("quotes")
    .delete()
    .in("id", [
      staleQuoteId,
      freshQuoteId,
      noOwnerQuoteId,
      convertedQuoteId,
      supersededQuoteId,
      currentRevisionId,
      expiredCandidateId,
      notYetDueId,
      raceQuoteId,
    ]);

  console.log("\n== HTTP: autenticação de serviço ==");
  const noAuth = await fetch(`${APP_URL}/api/automations/follow-up`, { method: "POST" });
  eq("sem Authorization → 401", noAuth.status, 401);

  const wrongAuth = await fetch(`${APP_URL}/api/automations/follow-up`, {
    method: "POST",
    headers: { Authorization: "Bearer segredo-errado" },
  });
  eq("segredo incorreto → 401", wrongAuth.status, 401);

  console.log("\n== HTTP: execução com zero candidatos (sem provocar e-mail real) ==");
  const validHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${AUTOMATIONS_SECRET}`,
  };
  // staleDays absurdamente alto garante checked = 0 mesmo com dado real de
  // outros milestones no banco local — nenhum e-mail é tentado.
  const followUpRun = await fetch(`${APP_URL}/api/automations/follow-up`, {
    method: "POST",
    headers: validHeaders,
    body: JSON.stringify({ staleDays: 36500 }),
  });
  const followUpBody = (await followUpRun.json()) as { checked?: number; notified?: number };
  check(
    "primeira execução autenticada → 200 com checked=0",
    followUpRun.status === 200 && followUpBody.checked === 0 && followUpBody.notified === 0,
    followUpBody,
  );

  console.log("\n== HTTP: proteção contra execução duplicada ==");
  const followUpRunAgain = await fetch(`${APP_URL}/api/automations/follow-up`, {
    method: "POST",
    headers: validHeaders,
    body: JSON.stringify({ staleDays: 36500 }),
  });
  eq("segunda chamada na mesma janela → 409", followUpRunAgain.status, 409);
  const followUpAgainBody = (await followUpRunAgain.json()) as {
    skipped?: boolean;
    reason?: string;
  };
  eq("segunda chamada → reason 'done'", followUpAgainBody.reason, "done");

  const expireRun = await fetch(`${APP_URL}/api/automations/expire-quotes`, {
    method: "POST",
    headers: validHeaders,
  });
  const expireBody = (await expireRun.json()) as { checked?: number; expired?: number };
  check(
    "expire-quotes: primeira execução → 200 com checked=0",
    expireRun.status === 200 && expireBody.checked === 0 && expireBody.expired === 0,
    expireBody,
  );

  const expireRunAgain = await fetch(`${APP_URL}/api/automations/expire-quotes`, {
    method: "POST",
    headers: validHeaders,
  });
  eq("expire-quotes: segunda chamada na mesma janela → 409", expireRunAgain.status, 409);

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  console.log(
    "\nPasso manual (não coberto aqui de propósito): configurar RESEND_API_KEY de teste, criar " +
      "um orçamento realmente parado/vencido e chamar os dois endpoints sem o filtro staleDays " +
      "absurdo, confirmando o e-mail recebido e a atividade 'follow_up'/'mudanca_status' gravada.",
  );
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
