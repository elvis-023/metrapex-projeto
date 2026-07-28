-- Milestone 17 — clientes e contatos (PLAN.md): CRUD completo de clientes por
-- CPF/CNPJ, deduplicação automática dentro da organização e múltiplos
-- contatos por cliente. A tabela `customers` e o dedupe por (org_id,
-- document) já existem desde a Milestone 15 ("fatia mínima" — só o formulário
-- público escrevia nela); esta migration completa o resto: CRUD autenticado,
-- invariante de formato de documento, e a tabela de contatos.

-- ---------------------------------------------------------------------------
-- Documento normalizado, só dígitos — invariante de banco, não só de
-- validação em TS. `isValidDocument`/`onlyDigits` (lib/public-form/cpf-cnpj.ts)
-- já garantem isso no caminho do formulário público e do CRUD autenticado,
-- mas um insert direto (script, painel do Supabase) não passa por lá — esta
-- CHECK é a mesma defesa em profundidade de `customers_document_digits`-style
-- constraints já usadas no resto do schema (ex.: `products_check_category_org`).
-- ---------------------------------------------------------------------------

alter table customers
  add constraint customers_document_digits
  check (document ~ '^[0-9]{11}$' or document ~ '^[0-9]{14}$');

-- ---------------------------------------------------------------------------
-- Múltiplos contatos por cliente
-- ---------------------------------------------------------------------------
-- `customers` continua sendo a identidade única por documento (a empresa/
-- pessoa dona do CPF/CNPJ); `customer_contacts` são as PESSOAS associadas a
-- ela (quem pediu o orçamento pelo site, quem compra, quem é o financeiro).
-- Sem org_id própria — mesmo padrão de `quote_items`/`quote_activities`: o
-- isolamento entre organizações vem do join até `customers.org_id`.

create table customer_contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on customer_contacts (customer_id);

-- Dedupe de contato: mesmo e-mail no mesmo cliente é a mesma pessoa (nome e
-- telefone atualizam); sem e-mail não há outra chave estável para casar, então
-- cada envio sem e-mail vira uma linha nova. Índice parcial porque email é
-- opcional — `on conflict` abaixo repete o mesmo predicado (exigência do
-- Postgres para inferir um índice parcial como alvo do conflito).
create unique index customer_contacts_customer_email_key
  on customer_contacts (customer_id, lower(email))
  where email is not null and email <> '';

alter table customer_contacts enable row level security;

create policy "customer_contacts_select_member" on customer_contacts
  for select using (
    customer_id in (select id from customers where org_id in (select auth_org_ids()))
  );

create policy "customer_contacts_write_member" on customer_contacts
  for all using (
    customer_id in (select id from customers where org_id in (select auth_org_ids()))
  )
  with check (
    customer_id in (select id from customers where org_id in (select auth_org_ids()))
  );

-- ---------------------------------------------------------------------------
-- CRUD autenticado de cliente com o MESMO dedupe do formulário público —
-- upsert atômico por (org_id, document), não select-depois-insert (mesma
-- razão de `upsert_public_customer`: duas gravações quase simultâneas do
-- mesmo documento não podem criar dois registros). Cadastrar manualmente um
-- documento que já existe na organização não é erro: reaproveita e atualiza o
-- registro existente, como já descrito ao time antes desta implementação.
--
-- `address` é COALESCE (preserva o valor anterior quando não informado) —
-- diferente de name/email/phone (sobrescrita direta, mesma convenção de
-- `upsert_public_customer`) porque o diálogo rápido de "novo cliente" do
-- construtor de orçamento não tem campos de endereço: passar null ali nunca
-- deve apagar um endereço que o formulário público já tinha coletado.
-- ---------------------------------------------------------------------------

create or replace function upsert_customer(
  p_org_id uuid,
  p_document text,
  p_name text,
  p_email text,
  p_phone text,
  p_address jsonb default null
) returns customers
language plpgsql security invoker
set search_path = public
as $$
declare
  v_customer customers;
begin
  if p_org_id not in (select auth_org_ids()) then
    raise exception 'Não autorizado para esta organização.';
  end if;

  insert into customers (org_id, document, name, email, phone, address)
  values (p_org_id, p_document, p_name, p_email, p_phone, p_address)
  on conflict (org_id, document) do update
    set name       = excluded.name,
        email      = excluded.email,
        phone      = excluded.phone,
        address    = coalesce(excluded.address, customers.address),
        updated_at = now()
  returning * into v_customer;

  return v_customer;
end;
$$;

revoke execute on function upsert_customer(uuid, text, text, text, text, jsonb) from public;
grant execute on function upsert_customer(uuid, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Upsert de contato — mesma dedupe (customer_id, email) usada pela tabela.
-- Chamável pelo CRUD autenticado (tela de cliente) diretamente.
-- ---------------------------------------------------------------------------

create or replace function upsert_customer_contact(
  p_customer_id uuid,
  p_name text,
  p_email text,
  p_phone text
) returns customer_contacts
language plpgsql security invoker
set search_path = public
as $$
declare
  v_contact customer_contacts;
begin
  if p_customer_id not in (
    select id from customers where org_id in (select auth_org_ids())
  ) then
    raise exception 'Cliente não encontrado nesta organização.';
  end if;

  if p_email is not null and trim(p_email) <> '' then
    insert into customer_contacts (customer_id, name, email, phone)
    values (p_customer_id, p_name, p_email, p_phone)
    on conflict (customer_id, lower(email)) where email is not null and email <> ''
    do update set name = excluded.name, phone = excluded.phone, updated_at = now()
    returning * into v_contact;
  else
    insert into customer_contacts (customer_id, name, email, phone)
    values (p_customer_id, p_name, null, p_phone)
    returning * into v_contact;
  end if;

  return v_contact;
end;
$$;

revoke execute on function upsert_customer_contact(uuid, text, text, text) from public;
grant execute on function upsert_customer_contact(uuid, text, text, text) to authenticated;

-- `customer_contacts` para `authenticated` chega via `alter default
-- privileges` (20260725000008_grants.sql, tabela criada depois daquele
-- ponto) — nenhum GRANT explícito necessário aqui, mesma observação já feita
-- para `quote_activities` em 20260727000011_pipeline_backend.sql.
--
-- `service_role` não tem esse default e precisa do GRANT explícito, porque
-- `upsert_public_customer` (redefinida abaixo) passa a gravar nesta tabela
-- também quando chamada pelo endpoint do formulário público.
grant select, insert, update on customer_contacts to service_role;

-- ---------------------------------------------------------------------------
-- `upsert_public_customer` (Milestone 15) — redefinida só para também gravar/
-- atualizar o CONTATO de quem preencheu o formulário (nome do campo
-- "Responsável", não necessariamente quem responde pela empresa). Corpo
-- idêntico ao original em 20260726000010_public_form_backend.sql fora do
-- parâmetro novo e do trecho marcado abaixo. `create or replace` preserva o
-- `revoke execute ... from public` já aplicado — não precisa repetir.
-- ---------------------------------------------------------------------------

create or replace function upsert_public_customer(
  p_org_id uuid,
  p_document text,
  p_name text,
  p_email text,
  p_phone text,
  p_address jsonb,
  p_contact_name text default null
) returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into customers (org_id, document, name, email, phone, address)
  values (p_org_id, p_document, p_name, p_email, p_phone, p_address)
  on conflict (org_id, document) do update
    set name       = excluded.name,
        email      = excluded.email,
        phone      = excluded.phone,
        address    = excluded.address,
        updated_at = now()
  returning id into v_id;

  -- NOVO na Milestone 17.
  if p_email is not null and trim(p_email) <> '' then
    insert into customer_contacts (customer_id, name, email, phone)
    values (v_id, coalesce(nullif(trim(p_contact_name), ''), p_name), p_email, p_phone)
    on conflict (customer_id, lower(email)) where email is not null and email <> ''
    do update set name = excluded.name, phone = excluded.phone, updated_at = now();
  end if;

  return v_id;
end;
$$;
