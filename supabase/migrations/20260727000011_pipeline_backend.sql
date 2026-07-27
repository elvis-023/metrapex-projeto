-- Milestone 16 — pipeline/Kanban: persistência da etapa arrastada, timeline
-- de atividades e a regra de permissão (PLAN.md): edição restrita ao dono do
-- orçamento ou admin, visualização liberada a todo membro autenticado da
-- organização.
--
-- ONDE A REGRA DE PERMISSÃO REALMENTE TRAVA — a parte que "vale na API, não
-- só esconde botão": um trigger `before update` em `quotes`
-- (`quotes_guard_stage_permission`), não uma checagem em Server Action nem
-- só a RLS. Motivo: a policy de `update` (`quotes_update_member`, Milestone
-- 14) libera qualquer membro a atualizar a linha — ela não distingue QUAL
-- coluna mudou, e RLS declarativo (USING/WITH CHECK) não compara OLD vs NEW
-- de um jeito direto. Um trigger tem OLD e NEW e roda para QUALQUER caminho
-- de escrita (a função `move_quote_stage` abaixo, um PATCH direto via
-- PostgREST, um script) — é a mesma técnica que `quotes_guard_issued_immutable`
-- (Milestone 14) já usa neste schema para proteger o documento emitido.
--
-- Decisão: orçamento SEM dono (`owner_id is null` — todo orçamento nascido do
-- formulário público, Milestone 15) pode ser movido por qualquer membro da
-- organização, não só admin. A regra "dono ou admin" existe para proteger o
-- trabalho JÁ ATRIBUÍDO de outra pessoa, não para travar a triagem de leads
-- que ainda não têm responsável.

-- ---------------------------------------------------------------------------
-- Timeline de atividades
-- ---------------------------------------------------------------------------

create table quote_activities (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes (id) on delete cascade,
  type        text not null
              check (type in ('criacao', 'envio', 'mudanca_status', 'nota', 'follow_up')),
  label       text not null,
  detail      text,

  -- `author_label` é SNAPSHOT do nome no momento do evento, não um join vivo
  -- em `profiles` — mesma convenção do resto do schema (nome do produto, do
  -- cliente): um vendedor que troca de nome depois não pode reescrever quem
  -- fez o quê no histórico. `author_id` fica só para eventual navegação/
  -- auditoria; nulo para atividade de sistema (formulário público, envio
  -- automático, follow-up agendado da Milestone 18).
  author_id    uuid references profiles (id) on delete set null,
  author_label text not null,

  created_at  timestamptz not null default now()
);

create index on quote_activities (quote_id);
create index on quote_activities (quote_id, created_at);

alter table quote_activities enable row level security;

-- Leitura: qualquer membro da organização (PLAN.md — "visualização liberada
-- a todos os usuários autenticados da organização"). Mesmo padrão de join de
-- `quote_items`/`quote_item_taxes`: a tabela não carrega `org_id` próprio.
create policy "quote_activities_select_member" on quote_activities
  for select using (
    quote_id in (select id from quotes where org_id in (select auth_org_ids()))
  );

-- Escrita: `criacao`/`envio`/`follow_up` são eventos de sistema, gravados
-- pelas próprias funções de persistência do documento (qualquer membro pode
-- criar/revisar um orçamento seu, Milestone 14) — sem restrição extra aqui.
-- `mudanca_status` e `nota` são a "edição" que o PLAN.md restringe: só quem é
-- dono do orçamento (ou dono nulo — orçamento não atribuído) ou admin pode
-- gravar uma dessas duas. Isto está na RLS, não só dentro das funções
-- `move_quote_stage`/`add_quote_note` abaixo — um insert direto na tabela,
-- sem passar pelas funções, cai na mesma regra.
create policy "quote_activities_insert_permission" on quote_activities
  for insert
  with check (
    quote_id in (select id from quotes where org_id in (select auth_org_ids()))
    and (
      type not in ('mudanca_status', 'nota')
      or exists (
        select 1 from quotes q
        where q.id = quote_activities.quote_id
          and (q.owner_id is null or q.owner_id = auth.uid() or auth_is_org_admin(q.org_id))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Regra de permissão sobre a PRÓPRIA mudança de etapa (não só o log dela)
-- ---------------------------------------------------------------------------

create or replace function quotes_guard_stage_permission()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and old.owner_id is not null
     and old.owner_id is distinct from auth.uid()
     and not auth_is_org_admin(old.org_id) then
    raise exception 'Só o responsável pelo orçamento ou um admin pode mudar a etapa.';
  end if;
  return new;
end;
$$;

create trigger quotes_guard_stage_permission
  before update on quotes
  for each row execute function quotes_guard_stage_permission();

-- ---------------------------------------------------------------------------
-- Mover etapa (drag-and-drop) — persiste e loga a atividade na mesma
-- transação. A checagem de permissão aqui é REDUNDANTE com o trigger acima
-- (defesa em profundidade, mesmo padrão de `next_quote_sequence`): existe só
-- para devolver uma mensagem legível em vez do erro cru do trigger.
-- ---------------------------------------------------------------------------

create or replace function move_quote_stage(
  p_quote_id uuid,
  p_status text
) returns quotes
language plpgsql security invoker
set search_path = public
as $$
declare
  v_quote quotes;
  v_label text;
begin
  select * into v_quote from quotes
    where id = p_quote_id and org_id in (select auth_org_ids())
    for update;

  if v_quote.id is null then
    raise exception 'Orçamento não encontrado.';
  end if;

  if v_quote.owner_id is not null
     and v_quote.owner_id is distinct from auth.uid()
     and not (select auth_is_org_admin(v_quote.org_id)) then
    raise exception 'Só o responsável pelo orçamento ou um admin pode mudar a etapa.';
  end if;

  -- Idempotente: soltar o card na mesma coluna não é uma mudança de etapa e
  -- não deve gravar uma atividade "Movido para X" redundante.
  if v_quote.status = p_status then
    return v_quote;
  end if;

  v_label := case p_status
    when 'gerado' then 'Gerado'
    when 'enviado' then 'Enviado'
    when 'negociacao' then 'Em negociação'
    when 'convertido' then 'Convertido'
    when 'expirado' then 'Expirado'
    else p_status
  end;

  update quotes set status = p_status where id = p_quote_id returning * into v_quote;

  insert into quote_activities (quote_id, type, label, author_id, author_label)
  values (
    p_quote_id,
    'mudanca_status',
    'Movido para ' || v_label,
    auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'Usuário')
  );

  return v_quote;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nota manual — mesma regra de permissão de mudar etapa (dono ou admin).
-- ---------------------------------------------------------------------------

create or replace function add_quote_note(
  p_quote_id uuid,
  p_detail text
) returns quote_activities
language plpgsql security invoker
set search_path = public
as $$
declare
  v_quote    quotes;
  v_activity quote_activities;
  v_detail   text := trim(both from coalesce(p_detail, ''));
begin
  if v_detail = '' then
    raise exception 'A nota não pode ser vazia.';
  end if;

  select * into v_quote from quotes
    where id = p_quote_id and org_id in (select auth_org_ids());

  if v_quote.id is null then
    raise exception 'Orçamento não encontrado.';
  end if;

  if v_quote.owner_id is not null
     and v_quote.owner_id is distinct from auth.uid()
     and not (select auth_is_org_admin(v_quote.org_id)) then
    raise exception 'Só o responsável pelo orçamento ou um admin pode adicionar notas.';
  end if;

  insert into quote_activities (quote_id, type, label, detail, author_id, author_label)
  values (
    p_quote_id, 'nota', 'Nota adicionada', v_detail,
    auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'Usuário')
  )
  returning * into v_activity;

  return v_activity;
end;
$$;

-- ---------------------------------------------------------------------------
-- `save_quote_draft` (Milestone 14) — redefinida só para acrescentar o log
-- de `criacao` na mesma transação. Corpo idêntico ao original em
-- 20260726000009_quote_engine.sql fora do trecho marcado abaixo.
-- ---------------------------------------------------------------------------

create or replace function save_quote_draft(
  p_org_id uuid,
  p_quote jsonb,
  p_items jsonb,
  p_previous_revision_id uuid default null
)
returns quotes
language plpgsql security invoker
set search_path = public
as $$
declare
  v_quote     quotes;
  v_sequence  integer;
  v_revision  smallint := 1;
  v_previous  quotes;
  v_item      jsonb;
  v_position  smallint := 0;
begin
  if p_org_id not in (select auth_org_ids()) then
    raise exception 'Não autorizado para esta organização.';
  end if;

  if p_previous_revision_id is null then
    v_sequence := next_quote_sequence(p_org_id);
  else
    select * into v_previous from quotes
      where id = p_previous_revision_id and org_id = p_org_id
      for update;

    if v_previous.id is null then
      raise exception 'Revisão anterior não encontrada nesta organização.';
    end if;
    if v_previous.superseded_by_revision_id is not null then
      raise exception 'Esta versão já foi substituída por uma revisão mais nova.';
    end if;

    v_sequence := v_previous.sequence;
    v_revision := v_previous.revision + 1;
  end if;

  insert into quotes (
    org_id, sequence, revision, previous_revision_id,
    status, owner_id,
    customer_id, customer_name, customer_document, customer_source_id,
    discount_type, discount_value,
    payment_condition_id, expires_at
  )
  values (
    p_org_id, v_sequence, v_revision, p_previous_revision_id,
    coalesce(p_quote->>'status', 'gerado'),
    (p_quote->>'owner_id')::uuid,
    (p_quote->>'customer_id')::uuid,
    p_quote->>'customer_name',
    coalesce(p_quote->>'customer_document', ''),
    p_quote->>'customer_source_id',
    coalesce(p_quote->>'discount_type', 'fixed'),
    coalesce((p_quote->>'discount_value')::numeric, 0),
    (p_quote->>'payment_condition_id')::uuid,
    (p_quote->>'expires_at')::date
  )
  returning * into v_quote;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    insert into quote_items (
      quote_id, position, product_id, product_external_code, product_name,
      category_id_snapshot, category_name, quantity
    )
    values (
      v_quote.id, v_position,
      (v_item->>'product_id')::uuid,
      v_item->>'product_external_code',
      v_item->>'product_name',
      (v_item->>'category_id_snapshot')::uuid,
      v_item->>'category_name',
      (v_item->>'quantity')::numeric
    );
  end loop;

  if p_previous_revision_id is not null then
    update quotes set superseded_by_revision_id = v_quote.id
      where id = p_previous_revision_id;
  end if;

  -- NOVO na Milestone 16: log de criação/nova revisão na timeline.
  insert into quote_activities (quote_id, type, label, author_id, author_label)
  values (
    v_quote.id,
    'criacao',
    case when p_previous_revision_id is null then 'Orçamento gerado' else 'Nova revisão criada' end,
    auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'Usuário')
  );

  return v_quote;
end;
$$;

-- ---------------------------------------------------------------------------
-- `create_public_quote` (Milestone 15) — mesma ideia: redefinida só para
-- logar `criacao`. Corpo idêntico ao original em
-- 20260726000010_public_form_backend.sql fora do trecho marcado abaixo.
-- `create or replace` preserva o `revoke execute ... from public` já
-- aplicado a esta função — não precisa repetir.
-- ---------------------------------------------------------------------------

create or replace function create_public_quote(
  p_org_id uuid,
  p_quote jsonb,
  p_items jsonb,
  p_snapshot jsonb
) returns quotes
language plpgsql security invoker
set search_path = public
as $$
declare
  v_quote    quotes;
  v_sequence integer;
  v_item     jsonb;
  v_tax      jsonb;
  v_position smallint := 0;
  v_item_id  uuid;
begin
  insert into quote_sequences (org_id, last_sequence)
  values (p_org_id, 1)
  on conflict (org_id) do update
    set last_sequence = quote_sequences.last_sequence + 1
  returning last_sequence into v_sequence;

  insert into quotes (
    org_id, sequence, revision,
    status, owner_id,
    customer_id, customer_name, customer_document, customer_source_id,
    discount_type, discount_value,
    payment_condition_id, expires_at
  )
  values (
    p_org_id, v_sequence, 1,
    'gerado', null,
    (p_quote->>'customer_id')::uuid,
    p_quote->>'customer_name',
    coalesce(p_quote->>'customer_document', ''),
    p_quote->>'customer_source_id',
    coalesce(p_quote->>'discount_type', 'fixed'),
    coalesce((p_quote->>'discount_value')::numeric, 0),
    (p_quote->>'payment_condition_id')::uuid,
    (p_quote->>'expires_at')::date
  )
  returning * into v_quote;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    insert into quote_items (
      quote_id, position, product_id, product_external_code, product_name,
      category_id_snapshot, category_name, quantity,
      unit_price_charged, unit_base_display, line_total
    )
    values (
      v_quote.id, v_position,
      (v_item->>'product_id')::uuid,
      v_item->>'product_external_code',
      v_item->>'product_name',
      (v_item->>'category_id_snapshot')::uuid,
      v_item->>'category_name',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price_charged')::numeric,
      (v_item->>'unit_base_display')::numeric,
      (v_item->>'line_total')::numeric
    )
    returning id into v_item_id;

    for v_tax in select * from jsonb_array_elements(coalesce(v_item->'taxes', '[]'::jsonb)) loop
      insert into quote_item_taxes (
        quote_item_id, tax_type_id, tax_code, tax_label, mode,
        rate_applied, rate_source, note, base_amount, tax_amount, display_order
      )
      values (
        v_item_id,
        (v_tax->>'tax_type_id')::uuid,
        v_tax->>'tax_code',
        v_tax->>'tax_label',
        v_tax->>'mode',
        (v_tax->>'rate_applied')::numeric,
        v_tax->>'rate_source',
        v_tax->>'note',
        (v_tax->>'base_amount')::numeric,
        (v_tax->>'tax_amount')::numeric,
        coalesce((v_tax->>'display_order')::smallint, 0)
      );
    end loop;
  end loop;

  update quotes set
    subtotal                           = (p_snapshot->>'subtotal')::numeric,
    total                              = (p_snapshot->>'total')::numeric,
    discount_amount                    = (p_snapshot->>'discount_amount')::numeric,
    payment_discount_amount            = (p_snapshot->>'payment_discount_amount')::numeric,
    payment_condition_label            = p_snapshot->>'payment_condition_label',
    payment_condition_kind             = p_snapshot->>'payment_condition_kind',
    payment_condition_discount_percent = (p_snapshot->>'payment_condition_discount_percent')::numeric,
    payment_condition_installments     = (p_snapshot->>'payment_condition_installments')::smallint,
    payment_condition_term_days        = (p_snapshot->>'payment_condition_term_days')::smallint,
    payment_band_label                 = p_snapshot->>'payment_band_label',
    tax_footer_note                    = p_snapshot->>'tax_footer_note',
    show_tax_lines                     = coalesce((p_snapshot->>'show_tax_lines')::boolean, true),
    tax_snapshot_at                    = now()
  where id = v_quote.id
  returning * into v_quote;

  -- NOVO na Milestone 16: log de criação na timeline. `author_id` nulo e
  -- rótulo fixo — não existe usuário autenticado neste fluxo (service_role).
  insert into quote_activities (quote_id, type, label, author_label)
  values (v_quote.id, 'criacao', 'Orçamento gerado', 'Formulário público');

  return v_quote;
end;
$$;

-- Log do envio de e-mail ao cliente final (Milestone 15, `sendQuoteEmail`) —
-- chamada pelo route handler do formulário público (service_role) depois do
-- envio ter sucesso. Só service_role pode chamar (mesma razão de todo o
-- resto de 20260726000010_public_form_backend.sql: EXECUTE é PUBLIC por
-- padrão numa função nova, e este fluxo não tem sessão para a RLS filtrar).
create or replace function record_public_quote_activity(
  p_quote_id uuid,
  p_type text,
  p_label text,
  p_detail text default null
) returns void
language sql security invoker
set search_path = public
as $$
  insert into quote_activities (quote_id, type, label, detail, author_label)
  values (p_quote_id, p_type, p_label, p_detail, 'Sistema');
$$;

revoke execute on function record_public_quote_activity(uuid, text, text, text) from public;
grant execute on function record_public_quote_activity(uuid, text, text, text) to service_role;

-- `quote_activities` para service_role: GRANT de tabela não é automático
-- para essa role (nota 2 de 20260726000010_public_form_backend.sql) — sem
-- isto `record_public_quote_activity` falharia com "permission denied" apesar
-- de `security invoker` e do EXECUTE já concedido acima.
grant select, insert on quote_activities to service_role;

-- `authenticated` recebe select/insert/update/delete em `quote_activities`
-- automaticamente via `alter default privileges` (20260725000008_grants.sql)
-- — RLS acima é quem decide o que cada policy realmente libera (não existe
-- policy de update/delete, então essas duas ficam de fato bloqueadas mesmo
-- com o GRANT presente, mesmo desenho de `public_form_rate_limits`).
