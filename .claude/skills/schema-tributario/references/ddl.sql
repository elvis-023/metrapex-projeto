-- =============================================================================
-- Motor de imposto configurável — DDL de referência (PostgreSQL)
-- Fonte: §3 do briefing-motor-impostos.md. O briefing é a fonte de verdade.
--
-- Tipos e nomes são portáveis; adapte `uuid` / `org_id` ao que o sistema
-- hospedeiro já usa. Assume que já existem: organizations, products,
-- quotes, quote_items.
--
-- INVARIANTE: nenhum tributo aparece como nome de coluna. Todo tributo é
-- uma LINHA em tax_types.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Categorias de produto da organização. Substituto genérico do NCM.
--    A organização cria as próprias categorias; nada obriga classificação
--    pela TIPI.
-- -----------------------------------------------------------------------------
create table product_categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);


-- -----------------------------------------------------------------------------
-- 2. Produto NÃO ganha nenhuma coluna fiscal. Só o vínculo de categoria.
--    Esta é a ÚNICA coluna nova em products. Não adicione ipi_rate, ncm,
--    cest, cfop, cst, origem, st, isento nem equivalentes.
-- -----------------------------------------------------------------------------
alter table products
  add column category_id uuid references product_categories(id) on delete set null;

create index on products (category_id);


-- -----------------------------------------------------------------------------
-- 3. Uma linha por tributo que a organização usa.
--    Zero linhas ativas = organização sem destaque (Simples/MEI). É
--    configuração normal, não estado vazio nem erro.
-- -----------------------------------------------------------------------------
create table tax_types (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  code          text not null,                    -- 'ICMS', 'IPI', 'ISS' — livre
  label         text not null,                    -- rótulo impresso no documento
  mode          text not null
                check (mode in ('inclusive', 'exclusive')),
  default_rate  numeric(7,4) not null default 0   -- alíquota da organização, em %
                check (default_rate >= 0 and default_rate <= 100),
  active        boolean not null default true,
  display_order smallint not null default 0,      -- SÓ ordem de impressão;
                                                  -- o cálculo é comutativo
  footer_note   text,                             -- texto informativo opcional
  created_at    timestamptz not null default now(),
  unique (org_id, code)
);

create index on tax_types (org_id) where active;

-- footer_note cobre "não destaco nada, mas preciso imprimir uma frase"
-- (Lei da Transparência, Lei 12.741/2012). Quando a organização tem ZERO
-- tax_types, a nota vive no nível da organização, em tax_settings.document_footer.


-- -----------------------------------------------------------------------------
-- 4. Overrides de alíquota. Exatamente um de category_id / product_id preenchido.
--    Hierarquia: produto > categoria > tax_types.default_rate.
--    rate = 0 é override VÁLIDO (isenção por ST) e vence a categoria.
--    Ausência de override é AUSÊNCIA DE LINHA — nunca rate null, nunca
--    rate 0 usado como sentinela de "não configurado".
-- -----------------------------------------------------------------------------
create table tax_rates (
  id           uuid primary key default gen_random_uuid(),
  tax_type_id  uuid not null references tax_types(id) on delete cascade,
  category_id  uuid references product_categories(id) on delete cascade,
  product_id   uuid references products(id) on delete cascade,
  rate         numeric(7,4) not null
               check (rate >= 0 and rate <= 100),
  note         text,          -- ex.: 'ICMS-ST recolhido pelo fabricante'
  created_at   timestamptz not null default now(),
  constraint tax_rates_exactly_one_scope
    check ((category_id is null) <> (product_id is null))
);

-- Um override por escopo por tributo.
create unique index tax_rates_uniq_category
  on tax_rates (tax_type_id, category_id) where category_id is not null;

create unique index tax_rates_uniq_product
  on tax_rates (tax_type_id, product_id)  where product_id is not null;


-- -----------------------------------------------------------------------------
-- 5. Configuração da organização.
--    (Alternativa: colunas na tabela organizations existente.)
-- -----------------------------------------------------------------------------
create table tax_settings (
  org_id             uuid primary key references organizations(id) on delete cascade,
  document_footer    text,     -- nota de tributos aproximados, quando aplicável
  show_tax_lines     boolean not null default true,
  updated_at         timestamptz not null default now()
);


-- =============================================================================
-- SNAPSHOT NO DOCUMENTO DE VENDA
-- O documento emitido é fotografia, não consulta. Depois de emitido ele nunca
-- lê tax_types / tax_rates de novo — nem para reimprimir, nem para exportar,
-- nem se a alíquota mudar amanhã.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 6. Uma linha por (item × tributo) aplicado no momento da emissão.
-- -----------------------------------------------------------------------------
create table quote_item_taxes (
  id             uuid primary key default gen_random_uuid(),
  quote_item_id  uuid not null references quote_items(id) on delete cascade,

  -- Cópia literal da regra, não FK "viva".
  -- ATENÇÃO: tax_type_id NÃO tem FK, de propósito. Existe só para auditoria;
  -- o tributo pode ser deletado depois e o documento continua imprimível.
  -- NÃO adicione `references tax_types(id)` aqui.
  tax_type_id    uuid,
  tax_code       text not null,
  tax_label      text not null,
  mode           text not null check (mode in ('inclusive', 'exclusive')),

  rate_applied   numeric(7,4) not null,
  rate_source    text not null
                 check (rate_source in ('org_default', 'category', 'product')),
  note           text,

  base_amount    numeric(18,6) not null,     -- base da linha (já × quantidade)
  tax_amount     numeric(18,6) not null,     -- imposto da linha

  created_at     timestamptz not null default now()
);

create index on quote_item_taxes (quote_item_id);


-- -----------------------------------------------------------------------------
-- 7. Colunas de snapshot no item e no documento.
--    numeric(18,6) em toda parte: arredondar para 2 casas é coisa de
--    renderização, nunca de persistência.
-- -----------------------------------------------------------------------------
alter table quote_items
  add column unit_price_charged numeric(18,6) not null,  -- preço do catálogo aplicado
  add column unit_base_display  numeric(18,6) not null,  -- unitário mostrado ao cliente
  add column line_total         numeric(18,6) not null;  -- o que entra no total

alter table quotes
  add column tax_snapshot_at    timestamptz,   -- quando a config foi congelada
  add column tax_footer_note    text;          -- cópia do rodapé vigente na emissão
