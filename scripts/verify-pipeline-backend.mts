/**
 * Verificação ao vivo da persistência do pipeline (Milestone 16) contra um
 * Postgres real. O que esta rotina cobre e nenhum teste unitário cobre:
 *
 *  - GRANT + RLS em `quote_activities` (a Milestone 13 descobriu que RLS não
 *    substitui GRANT, e a Milestone 15 achou o mesmo problema pro
 *    service_role);
 *  - a regra de permissão VALE NO BANCO, não só na Server Action: vendedor
 *    que não é dono do orçamento é recusado pelo RPC `move_quote_stage` E por
 *    um insert DIRETO em `quote_activities` (bypassando a função de propósito
 *    — é o teste que prova que a regra não está só escondendo o botão);
 *  - admin sempre pode mover a etapa de qualquer orçamento da organização;
 *  - orçamento sem dono (nascido do formulário público) pode ser movido por
 *    qualquer membro, não só admin — decisão registrada na migration
 *    20260727000011_pipeline_backend.sql;
 *  - visualização continua liberada a todo membro, mesmo sem poder editar;
 *  - a timeline grava `criacao` (autenticado e formulário público),
 *    `mudanca_status` e `nota` nos eventos certos, e mover pra mesma etapa
 *    não duplica atividade;
 *  - `record_system_quote_activity` só é executável por service_role;
 *  - isolamento entre organizações;
 *  - fix retroativo de 20260727000012: um membro enxerga o `full_name` de
 *    outro membro da MESMA organização (o board/detalhe do orçamento
 *    depende disso pra mostrar o responsável) — achado nesta mesma QA do
 *    Milestone 16, testando o board pelo navegador como um segundo usuário.
 *
 * Uso: `npx supabase start && npx supabase db reset && npx tsx scripts/verify-pipeline-backend.mts`
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
    if (detail !== undefined) console.error(`        ${JSON.stringify(detail)}`);
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  check(`${label} → ${String(actual)}`, actual === expected, { actual, expected });
}

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function signUpUser(
  email: string,
  fullName: string,
): Promise<{ client: SupabaseClient; userId: string }> {
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password: "senha-de-teste-123",
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !data.user) throw new Error(`createUser: ${createError?.message}`);

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: "senha-de-teste-123" });
  if (error) throw new Error(`signIn: ${error.message}`);
  return { client, userId: data.user.id };
}

/**
 * `organization_members` não tem GRANT pra `service_role` (só `authenticated`,
 * 20260725000008_grants.sql) — service_role bypassa RLS, não GRANT, mesma
 * lição documentada em 20260726000010_public_form_backend.sql. Por isso o
 * convite passa pelo fluxo real (admin convida, o convidado aceita) em vez de
 * um insert direto via client de service_role.
 */
async function addMember(
  adminClient: SupabaseClient,
  orgId: string,
  memberClient: SupabaseClient,
  email: string,
  role: "admin" | "vendedor",
) {
  const { data: invite, error: inviteError } = await adminClient
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email,
      role,
      invited_by: (await adminClient.auth.getUser()).data.user!.id,
    })
    .select("token")
    .single();
  if (inviteError || !invite)
    throw new Error(`organization_invites insert: ${inviteError?.message}`);

  const { error: acceptError } = await memberClient.rpc("accept_invite", {
    invite_token: invite.token,
  });
  if (acceptError) throw new Error(`accept_invite: ${acceptError.message}`);
}

function draftPayload(orgId: string, ownerId: string | null) {
  return {
    p_org_id: orgId,
    p_quote: {
      status: "gerado",
      owner_id: ownerId,
      customer_id: null,
      customer_name: "Cliente Teste",
      customer_document: "",
      customer_source_id: "crm",
      discount_type: "fixed",
      discount_value: "0.000000",
      payment_condition_id: null,
      expires_at: "2026-08-25",
    },
    p_items: [],
    p_previous_revision_id: null,
  };
}

async function main() {
  const stamp = Date.now();

  console.log("\n== setup ==");
  const { client: adminUser } = await signUpUser(`admin.${stamp}@metrapex.test`, "Admin Um");
  const { data: org, error: orgError } = await adminUser.rpc("create_organization", {
    org_name: `Metrapex Pipeline ${stamp}`,
    org_slug: `metrapex-pipeline-${stamp}`,
  });
  if (orgError || !org) throw new Error(`create_organization: ${orgError?.message}`);
  const orgId = (org as { id: string }).id;

  const vendedorAEmail = `vendedora.${stamp}@metrapex.test`;
  const vendedorBEmail = `vendedorb.${stamp}@metrapex.test`;
  const { client: vendedorA, userId: vendedorAId } = await signUpUser(
    vendedorAEmail,
    "Vendedora A",
  );
  const { client: vendedorB } = await signUpUser(vendedorBEmail, "Vendedor B");
  await addMember(adminUser, orgId, vendedorA, vendedorAEmail, "vendedor");
  await addMember(adminUser, orgId, vendedorB, vendedorBEmail, "vendedor");

  console.log("\n== GRANT + RLS em quote_activities ==");
  const { error: selectError } = await vendedorA.from("quote_activities").select("*").limit(1);
  check('select em quote_activities sem "permission denied"', !selectError, selectError?.message);

  console.log("\n== criação loga atividade (fluxo autenticado) ==");
  const { data: draft, error: draftError } = await vendedorA.rpc(
    "save_quote_draft",
    draftPayload(orgId, vendedorAId),
  );
  check("save_quote_draft cria o rascunho", !draftError && Boolean(draft), draftError?.message);
  const quoteId = (draft as { id: string }).id;

  const { data: creationActivity } = await vendedorA
    .from("quote_activities")
    .select("type, label, author_label")
    .eq("quote_id", quoteId)
    .eq("type", "criacao")
    .maybeSingle();
  check("atividade de criação gravada", Boolean(creationActivity), creationActivity);
  eq("autor da criação é quem criou o rascunho", creationActivity?.author_label, "Vendedora A");

  console.log("\n== vendedor que não é dono não pode mover a etapa (RPC) ==");
  const { error: forbiddenMove } = await vendedorB.rpc("move_quote_stage", {
    p_quote_id: quoteId,
    p_status: "enviado",
  });
  check(
    "recusa mover orçamento de outro vendedor",
    Boolean(forbiddenMove),
    forbiddenMove?.message ?? "aceitou!",
  );

  const { data: afterForbidden } = await vendedorA
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();
  eq("status não mudou após tentativa recusada", afterForbidden!.status, "gerado");

  console.log("\n== vendedor que não é dono não pode adicionar nota (RPC) ==");
  const { error: forbiddenNote } = await vendedorB.rpc("add_quote_note", {
    p_quote_id: quoteId,
    p_detail: "Tentativa indevida",
  });
  check(
    "recusa nota de outro vendedor",
    Boolean(forbiddenNote),
    forbiddenNote?.message ?? "aceitou!",
  );

  console.log("\n== a regra vale na RLS, não só dentro das funções ==");
  const { error: rawInsertError } = await vendedorB.from("quote_activities").insert({
    quote_id: quoteId,
    type: "mudanca_status",
    label: "Movido para Convertido (forjado)",
    author_label: "Vendedor B",
  });
  check(
    "recusa insert DIRETO de mudanca_status por quem não é dono/admin (bypassando a função)",
    Boolean(rawInsertError),
    rawInsertError?.message ?? "aceitou!",
  );

  console.log("\n== dono move a própria etapa e a atividade é gravada ==");
  const { error: ownerMoveError } = await vendedorA.rpc("move_quote_stage", {
    p_quote_id: quoteId,
    p_status: "enviado",
  });
  check("dono move a etapa", !ownerMoveError, ownerMoveError?.message);
  const { data: afterOwnerMove } = await vendedorA
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();
  eq("status atualizado pelo dono", afterOwnerMove!.status, "enviado");

  const { data: stageActivity } = await vendedorA
    .from("quote_activities")
    .select("label")
    .eq("quote_id", quoteId)
    .eq("type", "mudanca_status")
    .maybeSingle();
  check("atividade de mudança de etapa gravada", Boolean(stageActivity), stageActivity);
  eq("rótulo da mudança de etapa", stageActivity?.label, "Movido para Enviado");

  console.log("\n== mover para a mesma etapa não duplica atividade ==");
  await vendedorA.rpc("move_quote_stage", { p_quote_id: quoteId, p_status: "enviado" });
  const { data: stageActivities } = await vendedorA
    .from("quote_activities")
    .select("id")
    .eq("quote_id", quoteId)
    .eq("type", "mudanca_status");
  eq("continua uma única atividade de mudança de etapa", stageActivities?.length, 1);

  console.log("\n== dono adiciona nota ==");
  const { error: noteError } = await vendedorA.rpc("add_quote_note", {
    p_quote_id: quoteId,
    p_detail: "Cliente pediu desconto de 5%.",
  });
  check("dono adiciona nota", !noteError, noteError?.message);
  const { data: noteActivity } = await vendedorA
    .from("quote_activities")
    .select("detail")
    .eq("quote_id", quoteId)
    .eq("type", "nota")
    .maybeSingle();
  eq("detalhe da nota gravado", noteActivity?.detail, "Cliente pediu desconto de 5%.");

  console.log("\n== admin move etapa de orçamento alheio ==");
  const { error: adminMoveError } = await adminUser.rpc("move_quote_stage", {
    p_quote_id: quoteId,
    p_status: "negociacao",
  });
  check(
    "admin move etapa de orçamento de outro vendedor",
    !adminMoveError,
    adminMoveError?.message,
  );
  const { data: afterAdminMove } = await vendedorA
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();
  eq("status atualizado pelo admin", afterAdminMove!.status, "negociacao");

  console.log("\n== orçamento sem dono pode ser movido por qualquer membro ==");
  const { data: unassignedDraft, error: unassignedDraftError } = await vendedorB.rpc(
    "save_quote_draft",
    draftPayload(orgId, null),
  );
  check(
    "cria rascunho sem dono",
    !unassignedDraftError && Boolean(unassignedDraft),
    unassignedDraftError?.message,
  );
  const unassignedId = (unassignedDraft as { id: string }).id;
  const { error: unassignedMoveError } = await vendedorB.rpc("move_quote_stage", {
    p_quote_id: unassignedId,
    p_status: "enviado",
  });
  check(
    "orçamento sem dono é movido por qualquer membro",
    !unassignedMoveError,
    unassignedMoveError?.message,
  );

  console.log("\n== visualização liberada a todo membro, mesmo sem poder editar ==");
  const { data: visibleToB, error: visibleToBError } = await vendedorB
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .maybeSingle();
  check(
    "vendedor B enxerga o orçamento de A (só não edita)",
    !visibleToBError && Boolean(visibleToB),
    visibleToBError?.message,
  );

  console.log("\n== atividade de sistema via service_role (formulário público) ==");
  const { data: publicQuote, error: publicQuoteError } = await admin.rpc("create_public_quote", {
    p_org_id: orgId,
    p_quote: {
      customer_name: "Cliente Público",
      customer_document: "12345678900",
      customer_source_id: "site",
      discount_type: "fixed",
      discount_value: "0",
      payment_condition_id: null,
      expires_at: "2026-08-25",
    },
    p_items: [],
    p_snapshot: {
      subtotal: "0.000000",
      total: "0.000000",
      discount_amount: "0.000000",
      payment_discount_amount: "0.000000",
      payment_condition_label: null,
      payment_condition_kind: null,
      payment_condition_discount_percent: null,
      payment_condition_installments: null,
      payment_condition_term_days: null,
      payment_band_label: null,
      tax_footer_note: null,
      show_tax_lines: true,
    },
  });
  check(
    "create_public_quote (service_role) cria o orçamento",
    !publicQuoteError && Boolean(publicQuote),
    publicQuoteError?.message,
  );
  const publicQuoteId = (publicQuote as { id: string }).id;

  const { data: publicCreationActivity } = await admin
    .from("quote_activities")
    .select("author_label")
    .eq("quote_id", publicQuoteId)
    .eq("type", "criacao")
    .maybeSingle();
  eq(
    "criação do formulário público tem autor 'Formulário público'",
    publicCreationActivity?.author_label,
    "Formulário público",
  );

  const { error: recordActivityError } = await admin.rpc("record_system_quote_activity", {
    p_quote_id: publicQuoteId,
    p_type: "envio",
    p_label: "Enviado por e-mail ao cliente",
    p_detail: null,
  });
  check(
    "record_system_quote_activity grava o envio",
    !recordActivityError,
    recordActivityError?.message,
  );

  console.log("\n== record_system_quote_activity não é chamável fora do service_role ==");
  const { error: leakedExecError } = await vendedorA.rpc("record_system_quote_activity", {
    p_quote_id: quoteId,
    p_type: "envio",
    p_label: "Tentativa indevida",
    p_detail: null,
  });
  check(
    "recusa execução por usuário autenticado (revoke execute from public)",
    Boolean(leakedExecError),
    leakedExecError?.message ?? "aceitou!",
  );

  console.log("\n== fix: membro enxerga o nome de outro membro da mesma org ==");
  const { data: peerProfile, error: peerProfileError } = await vendedorB
    .from("profiles")
    .select("full_name")
    .eq("id", vendedorAId)
    .maybeSingle();
  check(
    "vendedor B lê o perfil da vendedora A (mesma organização)",
    !peerProfileError && Boolean(peerProfile),
    peerProfileError?.message,
  );
  eq("full_name correto", peerProfile?.full_name, "Vendedora A");

  console.log("\n== isolamento entre organizações ==");
  const { client: intruder } = await signUpUser(`intruso.${stamp}@metrapex.test`, "Intruso");
  await intruder.rpc("create_organization", {
    org_name: `Outra Pipeline ${stamp}`,
    org_slug: `outra-pipeline-${stamp}`,
  });
  const { error: crossOrgMoveError } = await intruder.rpc("move_quote_stage", {
    p_quote_id: quoteId,
    p_status: "convertido",
  });
  check(
    "outra organização não consegue mover orçamento alheio (nem acha a linha)",
    Boolean(crossOrgMoveError),
    crossOrgMoveError?.message ?? "aceitou!",
  );

  const { data: leakedProfile } = await intruder
    .from("profiles")
    .select("full_name")
    .eq("id", vendedorAId)
    .maybeSingle();
  check(
    "a visibilidade de perfil do fix NÃO vaza entre organizações diferentes",
    leakedProfile === null,
    leakedProfile,
  );

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
