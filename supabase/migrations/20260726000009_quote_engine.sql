-- Milestone 14 — motor de orçamento: cálculo, snapshot e versionamento
-- (briefing-motor-impostos.md §3, seção "Snapshot no documento de venda").
--
-- Três invariantes governam este schema:
--
-- 1. DOCUMENTO EMITIDO É FOTOGRAFIA. Depois de `quotes.tax_snapshot_at`
--    preenchido, o documento nunca mais lê `tax_types`, `tax_rates`,
--    `tax_settings`, `payment_conditions` nem `products`. Tudo que a
--    reimpressão precisa está copiado aqui. O teste é literal: se essas
--    tabelas fossem apagadas, o orçamento emitido ainda imprimiria idêntico.
--
-- 2. RASCUNHO GUARDA ENTRADA, NÃO RESULTADO (§11.3, decidido em 2026-07-26).
--    Enquanto `tax_snapshot_at is null`, o orçamento guarda só produto +
--    quantidade + desconto + condição escolhida; preço, imposto e totais são
--    recalculados a cada abertura com a configuração vigente. As colunas de
--    dinheiro ficam nulas até a emissão — é por isso que elas são nullable
--    apesar de o DDL do briefing §3 mostrá-las `not null` (lá o recorte é só
--    o documento já emitido). Isso evita duas fontes de verdade para o mesmo
--    número num rascunho.
--
-- 3. REVISÃO É REGISTRO NOVO. Nunca sobrescrita. A anterior fica congelada,
--    acessível pelo link antigo, e marcada via `superseded_by_revision_id`.
--
-- Nenhuma coluna nomeada por tributo, aqui ou em qualquer lugar: valor
-- calculado por tributo mora em `quote_item_taxes`, uma linha por
-- (item × tributo), com o código do tributo como DADO.

-- ---------------------------------------------------------------------------
-- Condições de pagamento e faixas de valor (Milestone 10 passa a gravar real)
-- ---------------------------------------------------------------------------

create table payment_conditions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations (id) on delete cascade,
  label            text not null,
  kind             text not null
                   check (kind in ('a_vista', 'cartao', 'boleto')),
  discount_percent numeric(7,4) not null default 0
                   check (discount_percent >= 0 and discount_percent <= 100),
  installments     smallint not null default 1 check (installments >= 1),
  term_days        smallint not null default 0 check (term_days >= 0),
  active           boolean not null default true,
  display_order    smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (org_id, label)
);

create index on payment_conditions (org_id);
create index on payment_conditions (org_id) where active;

-- Faixa de valor do orçamento que libera um subconjunto de condições.
-- `max_value` nulo = faixa sem teto.
create table payment_value_bands (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  label      text not null,
  min_value  numeric(18,6) not null default 0 check (min_value >= 0),
  max_value  numeric(18,6)
             check (max_value is null or max_value > min_value),
  created_at timestamptz not null default now(),
  unique (org_id, label)
);

create index on payment_value_bands (org_id);

create table payment_band_conditions (
  band_id              uuid not null references payment_value_bands (id) on delete cascade,
  payment_condition_id uuid not null references payment_conditions (id) on delete cascade,
  primary key (band_id, payment_condition_id)
);

create index on payment_band_conditions (payment_condition_id);

-- Faixa e condição precisam ser da mesma organização. As duas FKs sozinhas só
-- exigem que as linhas existam — de qualquer org. Mesmo motivo da trigger
-- products_check_category_org (Milestone 13): sem isto, uma faixa poderia
-- liberar a condição de pagamento de outra empresa.
create or replace function payment_band_conditions_check_org()
returns trigger
language plpgsql
as $$
begin
  if (select org_id from payment_value_bands where id = new.band_id)
     is distinct from
     (select org_id from payment_conditions where id = new.payment_condition_id) then
    raise exception 'Faixa de valor e condição de pagamento pertencem a organizações diferentes.';
  end if;
  return new;
end;
$$;

create trigger payment_band_conditions_check_org
  before insert or update on payment_band_conditions
  for each row execute function payment_band_conditions_check_org();

create or replace function payment_conditions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger payment_conditions_set_updated_at
  before update on payment_conditions
  for each row execute function payment_conditions_set_updated_at();

-- ---------------------------------------------------------------------------
-- Numeração sequencial, independente por organização
-- ---------------------------------------------------------------------------

-- Contador dedicado em vez de `max(sequence) + 1`: o formulário público
-- (Milestone 15) é caminho de escrita concorrente, e `max + 1` sob duas
-- requisições simultâneas entrega o mesmo número para as duas. O `on conflict
-- do update ... returning` abaixo trava a linha da organização e serializa a
-- alocação sem travar a tabela de orçamentos.
create table quote_sequences (
  org_id        uuid primary key references organizations (id) on delete cascade,
  last_sequence integer not null default 0 check (last_sequence >= 0)
);

-- ---------------------------------------------------------------------------
-- Documento
-- ---------------------------------------------------------------------------

create table quotes (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references organizations (id) on delete cascade,

  -- `sequence` é a numeração por organização; o rótulo impresso ("ORC-0128")
  -- é formatado na aplicação a partir dele, para não existirem duas fontes de
  -- verdade para o mesmo número. Revisões do mesmo orçamento compartilham
  -- `sequence` e se distinguem por `revision`.
  sequence                  integer not null check (sequence >= 1),
  revision                  smallint not null default 1 check (revision >= 1),
  previous_revision_id      uuid references quotes (id) on delete set null,
  superseded_by_revision_id uuid references quotes (id) on delete set null,

  status                    text not null default 'gerado'
                            check (status in ('gerado', 'enviado', 'negociacao', 'convertido', 'expirado')),
  owner_id                  uuid references profiles (id) on delete set null,

  -- `customers` chega na Milestone 17; até lá o cliente do documento vive
  -- copiado aqui. Mesmo depois dela, nome e documento continuam copiados:
  -- cliente que corrige a razão social não pode alterar orçamento emitido.
  customer_id               uuid,
  customer_name             text not null,
  customer_document         text not null default '',
  customer_source_id        text,

  -- Desconto negociado: ENTRADA do vendedor (tipo + valor digitado).
  -- `discount_amount` é o resultado em R$, congelado só na emissão.
  discount_type             text not null default 'fixed'
                            check (discount_type in ('fixed', 'percent')),
  discount_value            numeric(18,6) not null default 0 check (discount_value >= 0),
  discount_amount           numeric(18,6) check (discount_amount >= 0),

  -- Condição de pagamento CONGELADA por valor, não por FK viva: se o admin
  -- editar o parcelamento amanhã, o documento emitido não pode mudar.
  -- `payment_condition_id` fica só para auditoria e propositalmente SEM FK,
  -- pela mesma razão de `quote_item_taxes.tax_type_id` — a condição pode ser
  -- excluída e o documento antigo continua imprimível.
  payment_condition_id                uuid,
  payment_condition_label             text,
  payment_condition_kind              text,
  payment_condition_discount_percent  numeric(7,4)
                                      check (payment_condition_discount_percent >= 0
                                             and payment_condition_discount_percent <= 100),
  payment_condition_installments      smallint check (payment_condition_installments >= 1),
  payment_condition_term_days         smallint check (payment_condition_term_days >= 0),
  payment_band_label                  text,
  payment_discount_amount             numeric(18,6) check (payment_discount_amount >= 0),

  -- Totais do documento. Só o que o board e o dashboard precisam ler sem
  -- tocar nos itens. Totais POR TRIBUTO não são persistidos aqui: eles são
  -- agregados na leitura a partir de `quote_item_taxes`, que já está
  -- congelado (§11.7, decidido em 2026-07-26) — persistir de novo criaria
  -- uma segunda fonte de verdade a manter sincronizada.
  subtotal                  numeric(18,6) check (subtotal >= 0),
  total                     numeric(18,6) check (total >= 0),

  -- Snapshot fiscal. `tax_snapshot_at` preenchido = documento emitido e
  -- congelado; nulo = rascunho, recalculado a cada abertura.
  tax_snapshot_at           timestamptz,
  tax_footer_note           text,
  show_tax_lines            boolean not null default true,

  expires_at                date,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  unique (org_id, sequence, revision),

  -- Emitido exige o pacote completo de totais congelados. Rascunho exige
  -- todos nulos — meio-caminho é bug de gravação, não estado válido.
  constraint quotes_snapshot_totals_complete check (
    (tax_snapshot_at is null
      and subtotal is null and total is null
      and discount_amount is null and payment_discount_amount is null)
    or
    (tax_snapshot_at is not null
      and subtotal is not null and total is not null
      and discount_amount is not null and payment_discount_amount is not null)
  ),

  constraint quotes_revision_chain_distinct check (
    id <> previous_revision_id and id <> superseded_by_revision_id
  )
);

create index on quotes (org_id);
create index on quotes (org_id, status);
create index on quotes (owner_id);
create index on quotes (previous_revision_id);
create index on quotes (superseded_by_revision_id);

-- Caminho quente do Kanban e do dashboard: só a revisão atual de cada
-- orçamento aparece no board (CLAUDE.md > Orçamento manual).
create index quotes_current_revision on quotes (org_id, status)
  where superseded_by_revision_id is null;

-- Uma revisão só pode ser substituída por uma. Sem isto, duas revisões
-- concorrentes poderiam apontar para a mesma anterior e o board mostraria
-- duas "revisões atuais" do mesmo orçamento.
create unique index quotes_uniq_previous_revision on quotes (previous_revision_id)
  where previous_revision_id is not null;

create table quote_items (
  id                   uuid primary key default gen_random_uuid(),
  quote_id             uuid not null references quotes (id) on delete cascade,
  position             smallint not null check (position >= 1),

  -- Sem FK para `products`: FK forte impediria excluir produto já orçado, e
  -- `on delete set null` apagaria a rastreabilidade de um documento emitido.
  -- Código e nome ficam copiados — produto renomeado não altera documento
  -- antigo. O id serve para auditoria e para o rascunho recalcular.
  product_id           uuid,
  product_external_code text not null,
  product_name         text not null,

  -- §11.5 (decidido em 2026-07-26): categoria copiada para o snapshot. Sem
  -- isto, produto que troca de categoria move retroativamente os totais
  -- históricos entre categorias nos relatórios, e a coluna não poderia ser
  -- adicionada depois (o dado histórico já teria se perdido).
  category_id_snapshot uuid,
  category_name        text,

  quantity             numeric(18,6) not null check (quantity > 0),

  -- Nulos no rascunho, preenchidos na emissão (invariante 2 no topo).
  -- `numeric(18,6)`, nunca 2 casas: arredondar aqui é o que faz
  -- `base + imposto` deixar de reconstruir o preço de catálogo.
  unit_price_charged   numeric(18,6) check (unit_price_charged >= 0),
  unit_base_display    numeric(18,6) check (unit_base_display >= 0),
  line_total           numeric(18,6) check (line_total >= 0),

  created_at           timestamptz not null default now(),

  unique (quote_id, position),

  constraint quote_items_snapshot_money_complete check (
    (unit_price_charged is null and unit_base_display is null and line_total is null)
    or
    (unit_price_charged is not null and unit_base_display is not null and line_total is not null)
  )
);

create index on quote_items (quote_id);

-- Uma linha por (item × tributo) aplicado no momento da emissão.
-- Cópia literal da regra — briefing §3.
create table quote_item_taxes (
  id            uuid primary key default gen_random_uuid(),
  quote_item_id uuid not null references quote_items (id) on delete cascade,

  -- SEM FK, de propósito. É snapshot, não referência viva: o tributo pode ser
  -- desativado ou DELETADO depois e o documento antigo continua imprimível.
  -- A coluna existe só para auditoria. Adicionar FK aqui quebra o produto.
  tax_type_id   uuid,
  tax_code      text not null,
  tax_label     text not null,
  mode          text not null check (mode in ('inclusive', 'exclusive')),

  rate_applied  numeric(7,4) not null
                check (rate_applied >= 0 and rate_applied <= 100),
  rate_source   text not null
                check (rate_source in ('org_default', 'category', 'product')),
  note          text,

  base_amount   numeric(18,6) not null check (base_amount >= 0),
  tax_amount    numeric(18,6) not null check (tax_amount >= 0),

  -- Ordem de impressão copiada junto: a linha do snapshot tem que ser
  -- autossuficiente, e `tax_types.display_order` pode mudar depois.
  display_order smallint not null default 0,

  created_at    timestamptz not null default now(),

  unique (quote_item_id, tax_code)
);

create index on quote_item_taxes (quote_item_id);

-- ---------------------------------------------------------------------------
-- Imutabilidade do documento emitido
-- ---------------------------------------------------------------------------

-- O invariante "fotografia, não consulta" só vale se ninguém puder reescrever
-- a fotografia. Estas triggers são a única barreira real — código de
-- aplicação pode ser contornado por outra rota, por script ou por SQL manual.
--
-- `status`, `expires_at` e `superseded_by_revision_id` continuam editáveis:
-- são metadados de pipeline (a que coluna do Kanban o documento pertence, se
-- venceu, se uma revisão nova o substituiu), não conteúdo do documento.
create or replace function quotes_guard_issued_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.tax_snapshot_at is null then
    return new;
  end if;

  -- `id` e `created_at` entram na comparação por defesa em profundidade:
  -- `id` porque reapontar a chave primária de uma linha emitida não é
  -- diferente de reescrevê-la; `created_at` porque é a DATA do documento
  -- (conteúdo, não metadado de pipeline) — sem isto um `update` conseguia
  -- redatar um orçamento já entregue ao cliente sem tocar em nenhum outro
  -- campo protegido (achado da revisão do Milestone 14).
  if row(
       new.id, new.org_id, new.sequence, new.revision, new.previous_revision_id,
       new.customer_id, new.customer_name, new.customer_document, new.customer_source_id,
       new.discount_type, new.discount_value, new.discount_amount,
       new.payment_condition_id, new.payment_condition_label, new.payment_condition_kind,
       new.payment_condition_discount_percent, new.payment_condition_installments,
       new.payment_condition_term_days, new.payment_band_label, new.payment_discount_amount,
       new.subtotal, new.total,
       new.tax_snapshot_at, new.tax_footer_note, new.show_tax_lines, new.created_at
     ) is distinct from row(
       old.id, old.org_id, old.sequence, old.revision, old.previous_revision_id,
       old.customer_id, old.customer_name, old.customer_document, old.customer_source_id,
       old.discount_type, old.discount_value, old.discount_amount,
       old.payment_condition_id, old.payment_condition_label, old.payment_condition_kind,
       old.payment_condition_discount_percent, old.payment_condition_installments,
       old.payment_condition_term_days, old.payment_band_label, old.payment_discount_amount,
       old.subtotal, old.total,
       old.tax_snapshot_at, old.tax_footer_note, old.show_tax_lines, old.created_at
     ) then
    raise exception 'Orçamento já emitido é imutável — crie uma revisão nova em vez de alterá-lo.';
  end if;

  return new;
end;
$$;

create trigger quotes_guard_issued_immutable
  before update on quotes
  for each row execute function quotes_guard_issued_immutable();

-- A checagem é "o orçamento pai AINDA EXISTE e está emitido". Quando o
-- documento inteiro (ou a organização) é excluído, o cascade apaga a linha
-- pai primeiro e esta consulta não acha nada — então a exclusão em cascata
-- passa. Excluir o documento todo é ato governado pela policy de RLS (só
-- admin); o que a imutabilidade proíbe é reescrever a fotografia por dentro.
create or replace function quote_items_guard_issued_immutable()
returns trigger
language plpgsql
as $$
declare
  v_quote_id uuid := coalesce(new.quote_id, old.quote_id);
begin
  if exists (select 1 from quotes where id = v_quote_id and tax_snapshot_at is not null) then
    raise exception 'Itens de orçamento já emitido são imutáveis — crie uma revisão nova.';
  end if;
  return coalesce(new, old);
end;
$$;

-- A emissão preenche as colunas de dinheiro do item, então ela precisa rodar
-- ANTES de o documento ser marcado como emitido. `issue_quote` garante essa
-- ordem (itens e tributos primeiro, `tax_snapshot_at` por último).
create trigger quote_items_guard_issued_immutable
  before insert or update or delete on quote_items
  for each row execute function quote_items_guard_issued_immutable();

create or replace function quote_item_taxes_guard_issued_immutable()
returns trigger
language plpgsql
as $$
declare
  v_item_id uuid := coalesce(new.quote_item_id, old.quote_item_id);
begin
  if exists (
    select 1 from quote_items qi
    join quotes q on q.id = qi.quote_id
    where qi.id = v_item_id and q.tax_snapshot_at is not null
  ) then
    raise exception 'Impostos de orçamento já emitido são imutáveis — crie uma revisão nova.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger quote_item_taxes_guard_issued_immutable
  before insert or update or delete on quote_item_taxes
  for each row execute function quote_item_taxes_guard_issued_immutable();

create or replace function quotes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotes_set_updated_at
  before update on quotes
  for each row execute function quotes_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table payment_conditions enable row level security;
alter table payment_value_bands enable row level security;
alter table payment_band_conditions enable row level security;
alter table quote_sequences enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table quote_item_taxes enable row level security;

-- Condição de pagamento e faixa são configuração: todo membro lê, só admin
-- escreve (mesmo padrão de tax_types/tax_rates na Milestone 12).
create policy "payment_conditions_select_member" on payment_conditions
  for select using (org_id in (select auth_org_ids()));

create policy "payment_conditions_write_admin" on payment_conditions
  for all using ((select auth_is_org_admin(org_id)))
  with check ((select auth_is_org_admin(org_id)));

create policy "payment_value_bands_select_member" on payment_value_bands
  for select using (org_id in (select auth_org_ids()));

create policy "payment_value_bands_write_admin" on payment_value_bands
  for all using ((select auth_is_org_admin(org_id)))
  with check ((select auth_is_org_admin(org_id)));

create policy "payment_band_conditions_select_member" on payment_band_conditions
  for select using (
    band_id in (select id from payment_value_bands where org_id in (select auth_org_ids()))
  );

create policy "payment_band_conditions_write_admin" on payment_band_conditions
  for all using (
    band_id in (select id from payment_value_bands where (select auth_is_org_admin(org_id)))
  )
  with check (
    band_id in (select id from payment_value_bands where (select auth_is_org_admin(org_id)))
  );

-- Orçamento é operação de vendedor: todo membro da organização lê e escreve.
-- A restrição "editar só o próprio orçamento, ou ser admin" é da Milestone 16
-- (PLAN.md > Milestone 16, regra de permissão) — não antecipar aqui.
create policy "quotes_select_member" on quotes
  for select using (org_id in (select auth_org_ids()));

create policy "quotes_insert_member" on quotes
  for insert with check (org_id in (select auth_org_ids()));

create policy "quotes_update_member" on quotes
  for update using (org_id in (select auth_org_ids()));

create policy "quotes_delete_admin" on quotes
  for delete using ((select auth_is_org_admin(org_id)));

-- `quote_items`/`quote_item_taxes` não carregam `org_id`: o isolamento vem do
-- documento pai. Subquery em vez de coluna denormalizada evita ter que
-- garantir com trigger que item e orçamento sempre concordam de org.
create policy "quote_items_all_member" on quote_items
  for all using (quote_id in (select id from quotes where org_id in (select auth_org_ids())))
  with check (quote_id in (select id from quotes where org_id in (select auth_org_ids())));

create policy "quote_item_taxes_all_member" on quote_item_taxes
  for all using (
    quote_item_id in (
      select qi.id from quote_items qi
      join quotes q on q.id = qi.quote_id
      where q.org_id in (select auth_org_ids())
    )
  )
  with check (
    quote_item_id in (
      select qi.id from quote_items qi
      join quotes q on q.id = qi.quote_id
      where q.org_id in (select auth_org_ids())
    )
  );

-- O contador é lido e escrito só pela função `next_quote_sequence` abaixo
-- (`security invoker`), então a policy precisa liberar o membro da org.
create policy "quote_sequences_all_member" on quote_sequences
  for all using (org_id in (select auth_org_ids()))
  with check (org_id in (select auth_org_ids()));

-- ---------------------------------------------------------------------------
-- Alocação de número e persistência atômica
-- ---------------------------------------------------------------------------

-- Defesa em profundidade em todas as funções abaixo: a checagem explícita de
-- `auth_org_ids()` não depende de a keyword `security invoker` continuar como
-- está (mesmo raciocínio de `upsert_product_by_external_code`, Milestone 13).

create or replace function next_quote_sequence(p_org_id uuid)
returns integer
language plpgsql security invoker
set search_path = public
as $$
declare
  v_sequence integer;
begin
  if p_org_id not in (select auth_org_ids()) then
    raise exception 'Não autorizado para esta organização.';
  end if;

  insert into quote_sequences (org_id, last_sequence)
  values (p_org_id, 1)
  on conflict (org_id) do update
    set last_sequence = quote_sequences.last_sequence + 1
  returning last_sequence into v_sequence;

  return v_sequence;
end;
$$;

-- Cria o rascunho (ou a revisão nova) e seus itens numa só transação. Um
-- orçamento com itens pela metade não é estado válido de documento, e o
-- PostgREST não daria atomicidade entre chamadas separadas.
--
-- NÃO faz cálculo nenhum: preço, imposto e total são resolvidos pelo motor em
-- TypeScript (CLAUDE.md — o cálculo roda sempre no backend Next.js). Esta
-- função só persiste.
--
-- `p_items` é um array de objetos:
--   { product_id, product_external_code, product_name,
--     category_id_snapshot, category_name, quantity }
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
    -- `for update` serializa duas revisões concorrentes da mesma versão: a
    -- segunda espera, relê `superseded_by_revision_id` já preenchido e é
    -- recusada abaixo, em vez de criar duas "revisões atuais".
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

  return v_quote;
end;
$$;

-- Congela o documento. Recebe o resultado já calculado pelo motor em
-- TypeScript e grava tudo numa transação, com `tax_snapshot_at` por ÚLTIMO —
-- as triggens de imutabilidade rejeitam qualquer escrita em item ou tributo
-- depois que essa coluna está preenchida.
--
-- `p_items`: [{ position, unit_price_charged, unit_base_display, line_total,
--               taxes: [{ tax_type_id, tax_code, tax_label, mode,
--                         rate_applied, rate_source, note,
--                         base_amount, tax_amount, display_order }] }]
create or replace function issue_quote(
  p_quote_id uuid,
  p_items jsonb,
  p_snapshot jsonb
)
returns quotes
language plpgsql security invoker
set search_path = public
as $$
declare
  v_quote          quotes;
  v_item           jsonb;
  v_tax            jsonb;
  v_item_id        uuid;
  v_existing_count integer;
begin
  select * into v_quote from quotes
    where id = p_quote_id and org_id in (select auth_org_ids())
    for update;

  if v_quote.id is null then
    raise exception 'Orçamento não encontrado.';
  end if;
  if v_quote.tax_snapshot_at is not null then
    raise exception 'Orçamento já emitido.';
  end if;

  -- Fail-fast ANTES de escrever qualquer linha: sem isto, um item do
  -- orçamento ausente de `p_items` (um filtro incompleto do caller, uma
  -- `position` recontada) ficava com as três colunas de dinheiro nulas —
  -- estado que a própria constraint `quote_items_snapshot_money_complete`
  -- permite isoladamente (ela só exige "todas nulas OU todas preenchidas" por
  -- item, não que o item tenha sido tocado) — e a leitura convertia isso em
  -- R$ 0,00 silencioso num documento já marcado como emitido e imutável.
  select count(*) into v_existing_count from quote_items where quote_id = p_quote_id;
  if v_existing_count <> jsonb_array_length(p_items) then
    raise exception
      'Snapshot com % item(ns), mas o orçamento tem % item(ns) — emissão recusada.',
      jsonb_array_length(p_items), v_existing_count;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    update quote_items set
      unit_price_charged = (v_item->>'unit_price_charged')::numeric,
      unit_base_display  = (v_item->>'unit_base_display')::numeric,
      line_total         = (v_item->>'line_total')::numeric
    where quote_id = p_quote_id
      and position = (v_item->>'position')::smallint
    returning id into v_item_id;

    if v_item_id is null then
      raise exception 'Item % não encontrado no orçamento.', v_item->>'position';
    end if;

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
  where id = p_quote_id
  returning * into v_quote;

  return v_quote;
end;
$$;

grant select, insert, update, delete on
  payment_conditions,
  payment_value_bands,
  payment_band_conditions,
  quote_sequences,
  quotes,
  quote_items,
  quote_item_taxes
to authenticated;
