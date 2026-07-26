-- Milestone 13 — catálogo (briefing-motor-impostos.md §3): persistência real de
-- produtos, ligando à Milestone 6 (UI) e fechando a FK pendente da Milestone 12.
--
-- `products` NÃO ganha nenhuma coluna fiscal (nem NCM, nem alíquota) — só o
-- vínculo genérico `category_id`. O motor de impostos resolve tudo via
-- `tax_types`/`tax_rates`, nunca por coluna do produto.

create table products (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  external_code        text not null,
  name                 text not null,
  price                numeric(18, 6) not null check (price >= 0),
  stock                integer not null default 0 check (stock >= 0),
  category_id          uuid references product_categories (id) on delete set null,
  photo_url            text,
  alternative_title    text not null default '',
  catalog_url          text not null default '',
  manual_url           text not null default '',
  video_url            text not null default '',
  certificate_eligible boolean not null default false,
  lead_time            text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (org_id, external_code)
);

create index on products (org_id);
create index on products (category_id);

-- Categoria e produto devem pertencer à mesma organização. A FK sozinha não
-- garante isso (só exige que a linha exista em product_categories, de
-- qualquer org) — sem esta trigger, um produto poderia apontar para uma
-- categoria de outra empresa, e a resolução de alíquota por categoria do
-- motor de impostos cairia silenciosamente no padrão da própria org em vez
-- de barrar o vínculo cross-tenant no schema.
create or replace function products_check_category_org()
returns trigger
language plpgsql
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from product_categories
    where id = new.category_id and org_id = new.org_id
  ) then
    raise exception 'Categoria não pertence à organização do produto.';
  end if;
  return new;
end;
$$;

create trigger products_check_category_org
  before insert or update of category_id, org_id on products
  for each row execute function products_check_category_org();

create or replace function products_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on products
  for each row execute function products_set_updated_at();

-- FK que a Milestone 12 deixou pendente (comentário em 20260725000006_tax_engine.sql):
-- `products` não existia ainda quando `tax_rates` nasceu.
alter table tax_rates
  add constraint tax_rates_product_id_fkey
  foreign key (product_id) references products (id) on delete cascade;

alter table products enable row level security;

-- Mesmo padrão de product_categories/tax_types: todo membro lê, só admin escreve.
-- Vendedor cadastra/edita produto no dia a dia (não é só configuração admin),
-- então insert/update são liberados para qualquer membro da org; delete fica
-- restrito a admin (remover produto do catálogo é decisão administrativa).
create policy "products_select_member" on products
  for select using (org_id in (select auth_org_ids()));

create policy "products_insert_member" on products
  for insert with check (org_id in (select auth_org_ids()));

create policy "products_update_member" on products
  for update using (org_id in (select auth_org_ids()));

create policy "products_delete_admin" on products
  for delete using ((select auth_is_org_admin(org_id)));

-- Upsert atômico de produto por (org_id, external_code) — usado pelo import de
-- planilha. `security invoker` (padrão): o insert/update roda como o próprio
-- usuário chamador, então as policies products_insert_member/update_member
-- (`org_id in (select auth_org_ids())`) são reavaliadas normalmente. A
-- checagem explícita abaixo é defesa em profundidade — não depende só da
-- keyword `security invoker` continuar como está: se alguém trocar para
-- `security definer` no futuro, o RLS deixa de ser reavaliado e esta função
-- passaria a permitir escrita cross-org sem esta guarda.
create or replace function upsert_product_by_external_code(
  p_org_id uuid,
  p_external_code text,
  p_name text,
  p_price numeric,
  p_stock integer,
  p_category_id uuid
)
returns products
language plpgsql security invoker
set search_path = public
as $$
declare
  v_product products;
begin
  if p_org_id not in (select auth_org_ids()) then
    raise exception 'Não autorizado para esta organização.';
  end if;

  insert into products (org_id, external_code, name, price, stock, category_id)
  values (p_org_id, p_external_code, p_name, p_price, p_stock, p_category_id)
  on conflict (org_id, external_code) do update set
    name = excluded.name,
    price = excluded.price,
    stock = excluded.stock,
    category_id = excluded.category_id,
    updated_at = now()
  returning * into v_product;

  return v_product;
end;
$$;

-- Storage: foto de produto. Caminho `{org_id}/{uuid-aleatório}.<ext>` — um id
-- aleatório, não o product_id, porque o formulário sobe a foto antes de o
-- produto existir (cadastro ainda não salvo). As policies abaixo travam
-- escrita ao primeiro segmento do caminho ser uma org da qual o usuário é
-- membro. Leitura é pública porque a foto aparece no formulário público de
-- orçamento (Milestone 15), sem sessão.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  true,
  5242880, -- 5MB, mesmo limite já anunciado na UI do Milestone 6
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "product_photos_public_read" on storage.objects
  for select using (bucket_id = 'product-photos');

create policy "product_photos_member_write" on storage.objects
  for insert with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1]::uuid in (select auth_org_ids())
  );

create policy "product_photos_member_update" on storage.objects
  for update using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1]::uuid in (select auth_org_ids())
  );

create policy "product_photos_member_delete" on storage.objects
  for delete using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1]::uuid in (select auth_org_ids())
  );
