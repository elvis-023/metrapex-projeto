-- Milestone 12 — motor de impostos configurável (briefing-motor-impostos.md §3).
--
-- `products` ainda não existe (Milestone 13 — catálogo). `tax_rates.product_id`
-- fica sem FK forte por enquanto; a Milestone 13 adiciona a FK e a coluna
-- `products.category_id` quando a tabela nascer. Isso é ordenação de milestone,
-- não redesenho do schema do briefing.

create table product_categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

-- Uma linha por tributo que a organização usa. Vazio = organização sem destaque.
create table tax_types (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  code          text not null,                    -- 'ICMS', 'IPI', 'ISS' — livre, sem significado para o motor
  label         text not null,                    -- rótulo impresso no documento
  mode          text not null
                check (mode in ('inclusive', 'exclusive')),
  default_rate  numeric(7,4) not null default 0   -- alíquota da organização, em %
                check (default_rate >= 0 and default_rate <= 100),
  active        boolean not null default true,
  display_order smallint not null default 0,      -- só ordem de impressão, não afeta o cálculo
  footer_note   text,
  created_at    timestamptz not null default now(),
  unique (org_id, code)
);
-- Índice completo (FK/cascade de organizations) + parcial (hot path: listar só ativos).
create index on tax_types (org_id);
create index on tax_types (org_id) where active;

-- Overrides de alíquota. Exatamente um de category_id / product_id preenchido.
create table tax_rates (
  id           uuid primary key default gen_random_uuid(),
  tax_type_id  uuid not null references tax_types (id) on delete cascade,
  category_id  uuid references product_categories (id) on delete cascade,
  product_id   uuid,             -- FK para products(id) chega na Milestone 13
  rate         numeric(7,4) not null
               check (rate >= 0 and rate <= 100),
  note         text,             -- ex.: 'ICMS-ST recolhido pelo fabricante'
  created_at   timestamptz not null default now(),
  constraint tax_rates_exactly_one_scope
    check ((category_id is null) <> (product_id is null))
);

-- Um override por escopo por tributo.
create unique index tax_rates_uniq_category
  on tax_rates (tax_type_id, category_id) where category_id is not null;
create unique index tax_rates_uniq_product
  on tax_rates (tax_type_id, product_id) where product_id is not null;

-- Configuração da organização (rodapé de transparência, etc).
create table tax_settings (
  org_id             uuid primary key references organizations (id) on delete cascade,
  document_footer    text,
  show_tax_lines     boolean not null default true,
  updated_at         timestamptz not null default now()
);

create index on product_categories (org_id);
create index on tax_rates (tax_type_id);
create index on tax_rates (category_id);

alter table product_categories enable row level security;
alter table tax_types enable row level security;
alter table tax_rates enable row level security;
alter table tax_settings enable row level security;

-- product_categories: qualquer membro da org lê; só admin gerencia (é configuração).
create policy "product_categories_select_member" on product_categories
  for select using (org_id in (select auth_org_ids()));

create policy "product_categories_insert_admin" on product_categories
  for insert with check ((select auth_is_org_admin(org_id)));

create policy "product_categories_update_admin" on product_categories
  for update using ((select auth_is_org_admin(org_id)));

create policy "product_categories_delete_admin" on product_categories
  for delete using ((select auth_is_org_admin(org_id)));

-- tax_types: idem — todo mundo vê a alíquota aplicada, só admin configura.
create policy "tax_types_select_member" on tax_types
  for select using (org_id in (select auth_org_ids()));

create policy "tax_types_insert_admin" on tax_types
  for insert with check ((select auth_is_org_admin(org_id)));

create policy "tax_types_update_admin" on tax_types
  for update using ((select auth_is_org_admin(org_id)));

create policy "tax_types_delete_admin" on tax_types
  for delete using ((select auth_is_org_admin(org_id)));

-- tax_rates: não tem org_id direto — deriva da organização do tax_type.
create policy "tax_rates_select_member" on tax_rates
  for select using (
    tax_type_id in (
      select id from tax_types where org_id in (select auth_org_ids())
    )
  );

create policy "tax_rates_insert_admin" on tax_rates
  for insert with check (
    tax_type_id in (
      select id from tax_types where (select auth_is_org_admin(org_id))
    )
  );

create policy "tax_rates_update_admin" on tax_rates
  for update using (
    tax_type_id in (
      select id from tax_types where (select auth_is_org_admin(org_id))
    )
  );

create policy "tax_rates_delete_admin" on tax_rates
  for delete using (
    tax_type_id in (
      select id from tax_types where (select auth_is_org_admin(org_id))
    )
  );

-- tax_settings: idem product_categories/tax_types.
create policy "tax_settings_select_member" on tax_settings
  for select using (org_id in (select auth_org_ids()));

create policy "tax_settings_insert_admin" on tax_settings
  for insert with check ((select auth_is_org_admin(org_id)));

create policy "tax_settings_update_admin" on tax_settings
  for update using ((select auth_is_org_admin(org_id)));

create policy "tax_settings_delete_admin" on tax_settings
  for delete using ((select auth_is_org_admin(org_id)));
