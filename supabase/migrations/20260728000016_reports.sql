-- Milestone 20 — relatórios e exportação (PLAN.md).
--
-- Os 8 relatórios pré-construídos e o relatório customizável não precisam de
-- tabela nova: leem `quotes`/`quote_items` já existentes, com as mesmas
-- policies de select member da Milestone 14. A única coisa nova no schema é
-- o AGENDAMENTO de envio por e-mail — o resto do milestone é leitura pura.
--
-- Relatórios monetários (ticket médio, faixa de valor, produtos) só
-- consideram orçamento EMITIDO (`tax_snapshot_at is not null`) — mesma
-- fotografia usada pelo documento (20260726000009_quote_engine.sql,
-- invariante 1): rascunho não tem `total`/`payment_band_label` gravados sem
-- recalcular contra catálogo e impostos vigentes, e um relatório histórico
-- não deveria mudar de valor porque o catálogo mudou depois. Relatórios só de
-- CONTAGEM (orçamentos por período, taxa de expiração, conversão) continuam
-- contando rascunho — contar quantos orçamentos existem não depende de
-- nenhum valor monetário congelado.

create table report_schedules (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  created_by   uuid references profiles (id) on delete set null,

  name         text not null,
  -- Chave de um dos 8 relatórios pré-construídos, ou 'custom' — nesse caso
  -- `definition` carrega objeto/métrica/agrupamento/filtro (lib/reports/types.ts).
  -- Sem FK (não há tabela de catálogo de relatórios): é um enum de código,
  -- validado em `lib/reports/types.ts` (prebuiltReports) antes de gravar.
  report_key   text not null,
  definition   jsonb not null default '{}'::jsonb,

  frequency    text not null check (frequency in ('diario', 'semanal', 'mensal')),
  recipients   text[] not null,
  active       boolean not null default true,

  -- Quando o job deve enviar de novo. Avançado por
  -- `report_schedules_mark_sent` depois de cada envio bem-sucedido — não é
  -- recalculado a partir de `last_sent_at` a cada execução do job porque isso
  -- deixaria o agendamento andar (drift) se o job atrasar num dia.
  next_run_at  timestamptz not null default now(),
  last_sent_at timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint report_schedules_recipients_not_empty check (cardinality(recipients) > 0)
);

create index on report_schedules (org_id);
-- Caminho quente do job agendado (Milestone 18, mesmo padrão de
-- quotes_current_revision): só schedules ativos e vencidos.
create index report_schedules_due on report_schedules (next_run_at) where active;

alter table report_schedules enable row level security;

-- Agendamento de e-mail é configuração: todo membro vê o que está agendado
-- (transparência sobre quem recebe o quê), só admin cria/edita/exclui — mesmo
-- padrão de payment_conditions (20260726000009_quote_engine.sql).
create policy "report_schedules_select_member" on report_schedules
  for select using (org_id in (select auth_org_ids()));

create policy "report_schedules_write_admin" on report_schedules
  for all using ((select auth_is_org_admin(org_id)))
  with check ((select auth_is_org_admin(org_id)));

create or replace function report_schedules_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger report_schedules_set_updated_at
  before update on report_schedules
  for each row execute function report_schedules_set_updated_at();

-- ---------------------------------------------------------------------------
-- Chamadas do job agendado (service_role, sem sessão — mesmo modelo das
-- funções automation_* da Milestone 18: EXECUTE revogado de PUBLIC).
-- ---------------------------------------------------------------------------

create or replace function report_schedules_due()
returns setof report_schedules
language sql security invoker stable
set search_path = public
as $$
  select * from report_schedules
  where active and next_run_at <= now();
$$;

revoke execute on function report_schedules_due() from public;
grant execute on function report_schedules_due() to service_role;

create or replace function report_schedules_mark_sent(
  p_id uuid,
  p_next_run_at timestamptz
) returns void
language sql security invoker
set search_path = public
as $$
  update report_schedules
    set last_sent_at = now(), next_run_at = p_next_run_at
    where id = p_id;
$$;

revoke execute on function report_schedules_mark_sent(uuid, timestamptz) from public;
grant execute on function report_schedules_mark_sent(uuid, timestamptz) to service_role;

grant select, update on report_schedules to service_role;
grant select on organizations to service_role;

-- `report_schedules` para `authenticated` chega via `alter default privileges`
-- (20260725000008_grants.sql) — sem GRANT explícito necessário aqui.
