-- Milestone 18 — automações agendadas: follow-up de orçamento parado e
-- expiração automática, disparadas por Schedule Trigger do n8n batendo na
-- API do backend (CLAUDE.md — n8n só envia e-mail/WhatsApp e roda rotina
-- agendada; TODO o cálculo de quem está parado/vencido continua aqui).
--
-- Sem sessão de usuário (chamada máquina-a-máquina do n8n), mesmo modelo do
-- endpoint público (20260726000010_public_form_backend.sql): route handler
-- roda com service_role, então toda função nova aqui embaixo segue as três
-- consequências já documentadas naquele arquivo (EXECUTE revogado de
-- PUBLIC, GRANT explícito a service_role, sem checar auth_org_ids()).

-- ---------------------------------------------------------------------------
-- Ajuste ao trigger de permissão do Milestone 16 — a expiração automática
-- muda `quotes.status` sem sessão de usuário (service_role, `auth.uid()`
-- nulo), e `quotes_guard_stage_permission` (20260727000011_pipeline_backend.sql)
-- rejeitava qualquer UPDATE de status em orçamento com dono, mesmo vindo do
-- próprio sistema — achado ao rodar `scripts/verify-automations.mts` contra
-- Postgres real: toda expiração de orçamento atribuído falhava com "Só o
-- responsável pelo orçamento ou um admin pode mudar a etapa."
--
-- A regra "dono ou admin" protege contra OUTRO USUÁRIO autenticado mexendo
-- no card de alguém — não se aplica ao próprio backend, cuja autorização já
-- foi verificada na cláusula WHERE de `automation_expire_quote` (só expira
-- quem já está de fato vencido e não convertido). `auth.role() =
-- 'service_role'` é como identificar essa chamada sem sessão nenhuma; sem
-- este bypass, a Milestone 18 exigiria remover o dono do orçamento antes de
-- expirar, destruindo justamente o dado que o vendedor precisa ver.
create or replace function quotes_guard_stage_permission()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and auth.role() is distinct from 'service_role'
     and old.owner_id is not null
     and old.owner_id is distinct from auth.uid()
     and not auth_is_org_admin(old.org_id) then
    raise exception 'Só o responsável pelo orçamento ou um admin pode mudar a etapa.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Proteção contra execução duplicada — mesma reivindicação atômica por
-- janela usada em public_form_submissions, agora por (job, janela de tempo)
-- em vez de (org, documento, carrinho). Cobre dois casos: duas chamadas
-- concorrentes do n8n (retry sobrepondo a execução anterior) e o mesmo job
-- disparado duas vezes na mesma janela — a segunda não reprocessa.
-- ---------------------------------------------------------------------------

create table automation_runs (
  job_name      text not null,
  window_bucket bigint not null,
  status        text not null default 'processing'
                check (status in ('processing', 'done', 'failed')),
  summary       jsonb,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  primary key (job_name, window_bucket)
);

alter table automation_runs enable row level security;
-- Tabela de controle interno do job — nunca lida por sessão de dashboard.
revoke select, insert, update, delete on automation_runs from authenticated, anon;

-- Reivindica a janela atual do job. `claimed = true` é quem deve processar;
-- `claimed = false` devolve o status já registrado (`processing` = execução
-- concorrente em andamento, `done` = já rodou nesta janela — o `summary`
-- volta junto para o caller responder sem reprocessar). Um job que falhou
-- (`status = 'failed'`) pode ser reivindicado de novo dentro da mesma
-- janela — sem isso, uma falha a meio do processamento travaria o job por
-- toda a janela sem chance de retry.
--
-- Insert com `on conflict do nothing` primeiro, e só cai para o
-- `select ... for update` quando o insert não reivindicou a linha: isso
-- serializa duas chamadas concorrentes no lock implícito da linha inserida,
-- sem a corrida de duas transações lendo "não existe" ao mesmo tempo e as
-- duas tentando inserir.
create or replace function automation_claim_run(
  p_job_name text,
  p_window_seconds integer
) returns table (run_window bigint, claimed boolean, status text, summary jsonb)
language plpgsql security invoker
set search_path = public
as $$
declare
  v_window_bucket bigint;
  v_existing automation_runs;
  v_row_count integer;
begin
  v_window_bucket := floor(extract(epoch from now()) / p_window_seconds)::bigint;

  insert into automation_runs (job_name, window_bucket, status)
  values (p_job_name, v_window_bucket, 'processing')
  on conflict (job_name, window_bucket) do nothing;

  get diagnostics v_row_count = row_count;
  if v_row_count > 0 then
    return query select v_window_bucket, true, 'processing'::text, null::jsonb;
    return;
  end if;

  select * into v_existing
  from automation_runs
  where job_name = p_job_name and window_bucket = v_window_bucket
  for update;

  if v_existing.status = 'failed' then
    update automation_runs
      set status = 'processing', started_at = now(), finished_at = null, summary = null
      where job_name = p_job_name and window_bucket = v_window_bucket;
    return query select v_window_bucket, true, 'processing'::text, null::jsonb;
    return;
  end if;

  return query select v_window_bucket, false, v_existing.status, v_existing.summary;
end;
$$;

revoke execute on function automation_claim_run(text, integer) from public;

create or replace function automation_complete_run(
  p_job_name text,
  p_window_bucket bigint,
  p_summary jsonb
) returns void
language sql security invoker
set search_path = public
as $$
  update automation_runs
    set status = 'done', finished_at = now(), summary = p_summary
    where job_name = p_job_name and window_bucket = p_window_bucket;
$$;

revoke execute on function automation_complete_run(text, bigint, jsonb) from public;

create or replace function automation_fail_run(
  p_job_name text,
  p_window_bucket bigint,
  p_error text
) returns void
language sql security invoker
set search_path = public
as $$
  update automation_runs
    set status = 'failed', finished_at = now(), summary = jsonb_build_object('error', p_error)
    where job_name = p_job_name and window_bucket = p_window_bucket;
$$;

revoke execute on function automation_fail_run(text, bigint, text) from public;

-- ---------------------------------------------------------------------------
-- Follow-up — orçamento parado há mais de X dias
-- ---------------------------------------------------------------------------

-- "Parado" = `updated_at` não se move há X dias. Não precisa de coluna nova
-- de "última interação": `quotes_set_updated_at` (Milestone 14) já carimba
-- qualquer escrita real no documento (mudança de status, desconto, revisão),
-- e este job nunca escreve na própria `quotes` — só em `quote_activities` —
-- então carimbar o follow-up não reseta o próprio relógio de "parado" que
-- está medindo.
--
-- "Já notificado recentemente" é lido do próprio `quote_activities`
-- (`type = 'follow_up'`) em vez de uma coluna dedicada em `quotes`, pelo
-- mesmo motivo: a tabela de atividade já é o registro de auditoria do que
-- aconteceu, não precisa de uma segunda fonte de verdade em paralelo.
--
-- Só considera a revisão atual (`superseded_by_revision_id is null`) e
-- exige `owner_id` — sem vendedor responsável não há para quem notificar; o
-- orçamento fica de fora do lembrete até alguém assumi-lo no Kanban.
create or replace function automation_find_stale_quotes(p_stale_days integer)
returns table (
  quote_id      uuid,
  org_id        uuid,
  org_name      text,
  owner_id      uuid,
  owner_email   text,
  owner_name    text,
  customer_name text,
  sequence      integer,
  updated_at    timestamptz
)
language sql security invoker stable
set search_path = public
as $$
  select
    q.id, q.org_id, o.name, q.owner_id, p.email, p.full_name,
    q.customer_name, q.sequence, q.updated_at
  from quotes q
  join organizations o on o.id = q.org_id
  join profiles p on p.id = q.owner_id
  where q.superseded_by_revision_id is null
    and q.status in ('gerado', 'enviado', 'negociacao')
    and q.updated_at < now() - make_interval(days => p_stale_days)
    and not exists (
      select 1 from quote_activities a
      where a.quote_id = q.id
        and a.type = 'follow_up'
        and a.created_at > now() - make_interval(days => p_stale_days)
    );
$$;

revoke execute on function automation_find_stale_quotes(integer) from public;

-- ---------------------------------------------------------------------------
-- Expiração — orçamento vencido, não convertido
-- ---------------------------------------------------------------------------

-- Candidatos a expirar: só leitura, não muda nada — o route handler decide
-- por linha se ainda notifica, e `automation_expire_quote` é quem de fato
-- muda o status, de forma atômica e idempotente por si só.
create or replace function automation_find_expirable_quotes()
returns table (
  quote_id      uuid,
  org_id        uuid,
  org_name      text,
  owner_id      uuid,
  owner_email   text,
  owner_name    text,
  customer_name text,
  sequence      integer
)
language sql security invoker stable
set search_path = public
as $$
  select q.id, q.org_id, o.name, q.owner_id, p.email, p.full_name, q.customer_name, q.sequence
  from quotes q
  join organizations o on o.id = q.org_id
  left join profiles p on p.id = q.owner_id
  where q.superseded_by_revision_id is null
    and q.status not in ('convertido', 'expirado')
    and q.expires_at is not null
    and q.expires_at < current_date;
$$;

revoke execute on function automation_find_expirable_quotes() from public;

-- Expira UM orçamento, reconferindo a condição na própria cláusula WHERE do
-- UPDATE (não só no SELECT de `automation_find_expirable_quotes`) — protege
-- contra a corrida de um vendedor convertendo o orçamento entre a leitura e
-- a escrita, e contra duas execuções concorrentes do mesmo job tentando
-- expirar a mesma linha duas vezes (a segunda não encontra mais o WHERE
-- satisfeito e devolve `false`, sem re-notificar).
create or replace function automation_expire_quote(p_quote_id uuid)
returns boolean
language sql security invoker
set search_path = public
as $$
  with updated as (
    update quotes
      set status = 'expirado'
      where id = p_quote_id
        and superseded_by_revision_id is null
        and status not in ('convertido', 'expirado')
        and expires_at is not null
        and expires_at < current_date
      returning id
  )
  select exists (select 1 from updated);
$$;

revoke execute on function automation_expire_quote(uuid) from public;

-- ---------------------------------------------------------------------------
-- Timeline — reaproveita a função de registro de atividade "de sistema" já
-- criada na Milestone 15 (comentário original em
-- 20260727000011_pipeline_backend.sql já previa este uso). Renomeada porque
-- agora serve dois chamadores sem relação com o formulário público — o nome
-- antigo (`record_public_quote_activity`) ficaria enganoso.
-- ---------------------------------------------------------------------------

alter function record_public_quote_activity(uuid, text, text, text)
  rename to record_system_quote_activity;

-- ---------------------------------------------------------------------------
-- GRANTs para service_role — mesmo padrão de
-- 20260726000010_public_form_backend.sql: concedido por nome, para o
-- alcance do service_role ficar visível migration a migration.
-- ---------------------------------------------------------------------------

grant execute on function
  automation_claim_run(text, integer),
  automation_complete_run(text, bigint, jsonb),
  automation_fail_run(text, bigint, text),
  automation_find_stale_quotes(integer),
  automation_find_expirable_quotes(),
  automation_expire_quote(uuid)
to service_role;

grant select, insert, update on automation_runs to service_role;

grant select on organizations, profiles to service_role;
grant select, update on quotes to service_role;
grant select, insert on quote_activities to service_role;
