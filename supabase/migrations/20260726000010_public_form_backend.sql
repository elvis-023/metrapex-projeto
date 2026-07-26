-- Milestone 15 — formulário público: chave de resolução de organização,
-- rate limit + idempotência para o endpoint aberto, e a via de emissão que
-- não depende de sessão autenticada.
--
-- Este endpoint não tem usuário logado, então roda inteiro com
-- `service_role`. Três consequências diretas:
--
-- 1. Toda função nova aqui embaixo é invocável, por padrão, via
--    PostgREST (`/rest/v1/rpc/...`) por QUALQUER role — Postgres concede
--    EXECUTE a PUBLIC na criação da função, diferente de tabela (que exige
--    GRANT explícito, achado da Milestone 13 em 20260725000008_grants.sql).
--    Sem revogar isso, `anon` chamaria estas funções direto, pulando o
--    endpoint inteiro (honeypot, Turnstile, rate limit). Por isso toda
--    função abaixo tem `revoke execute ... from public` logo depois de
--    criada — só `service_role`/`postgres` continuam podendo chamar.
--
-- 2. `service_role` só bypassa RLS — GRANT é camada independente, e por
--    padrão ele NÃO tem select/insert/update/delete em nenhuma tabela (só os
--    três privilégios que Postgres concede a PUBLIC na criação da tabela:
--    truncate/references/trigger). Achado ao verificar contra Postgres real:
--    sem os GRANTs explícitos no fim deste arquivo, o route handler falhava
--    com "permission denied" em toda query, e `revoke execute ... from
--    public` também tira o EXECUTE do próprio `service_role` — ele nunca
--    tinha um grant próprio, só herdava o de PUBLIC que acabou de ser
--    revogado. Mesma classe de bug do achado da Milestone 13
--    (20260725000008_grants.sql), desta vez batendo em `service_role` em vez
--    de `authenticated`.
--
-- 3. As funções não checam `auth_org_ids()` (não existe usuário
--    autenticado neste fluxo) — elas confiam no `org_id` recebido porque só
--    quem já passou pela resolução via `public_form_key` dentro do route
--    handler (que roda com service_role) pode chamar.

-- ---------------------------------------------------------------------------
-- Chave pública do snippet — distinta do slug
-- ---------------------------------------------------------------------------

-- Não reusa `organizations.slug`: o slug é nome de negócio (editável, usado
-- na URL/branding internos); a chave do embed precisa ser rotacionável sem
-- quebrar o snippet já colado no site do cliente, e idealmente não é um
-- dicionário de nome de empresa (enumerável). Ela NÃO é segredo — vai para o
-- HTML de qualquer visitante do site do cliente — a segurança do endpoint
-- nunca depende dela ser secreta, só de ser imprevisível o suficiente para
-- não ser adivinhada por dicionário, e revogável.
alter table organizations
  add column public_form_key text
  not null unique
  default ('pfk_' || encode(extensions.gen_random_bytes(16), 'hex'));

-- ---------------------------------------------------------------------------
-- Rate limit — contador atômico por (scope, key, janela)
-- ---------------------------------------------------------------------------

-- Janela fixa (não deslizante): `window_start` é o início do bucket de
-- `p_window_seconds` segundos em que a chamada caiu. Mais simples que uma
-- janela deslizante; o preço é permitir até 2x o limite numa rajada bem na
-- borda de duas janelas — aceitável para este modelo de ameaça (formulário
-- público, não sistema de pagamento).
create table public_form_rate_limits (
  scope        text not null,
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0 check (count >= 0),
  primary key (scope, key, window_start)
);

alter table public_form_rate_limits enable row level security;
-- Nenhuma policy: tabela de uso interno do endpoint público, nunca lida ou
-- escrita por uma sessão de dashboard. RLS sem policy já nega tudo por
-- padrão; os REVOKEs abaixo tornam a intenção explícita em vez de depender
-- só disso.
revoke select, insert, update, delete on public_form_rate_limits from authenticated, anon;

-- Incrementa o contador da janela atual e devolve se ainda está dentro do
-- limite. `insert ... on conflict ... do update set count = count + 1` é
-- atômico por construção: duas chamadas concorrentes com a mesma chave
-- serializam no lock da unique index (primary key) — não existe janela de
-- ler-depois-escrever para furar o limite.
--
-- Autolimpeza oportunista (1% das chamadas) em vez de cron/pg_cron: este
-- projeto não tem agendador de infra configurado, e n8n (CLAUDE.md) é
-- reservado a e-mail/WhatsApp e rotina de negócio (follow-up, expiração),
-- não housekeeping de tabela interna. Sem tráfego, não há linha para
-- limpar — o que é aceitável.
create or replace function public_form_check_rate_limit(
  p_scope text,
  p_key text,
  p_window_seconds integer,
  p_limit integer
) returns boolean
language plpgsql security invoker
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public_form_rate_limits (scope, key, window_start, count)
  values (p_scope, p_key, v_window_start, 1)
  on conflict (scope, key, window_start)
  do update set count = public_form_rate_limits.count + 1
  returning count into v_count;

  if random() < 0.01 then
    delete from public_form_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public_form_check_rate_limit(text, text, integer, integer) from public;

-- ---------------------------------------------------------------------------
-- Idempotência — absorve duplo clique e retry de script
-- ---------------------------------------------------------------------------

-- Não é a barreira de segurança contra abuso (essa é o rate limit acima) —
-- é um best-effort para não recalcular/gerar PDF/reenviar e-mail quando o
-- mesmo (organização, documento, carrinho) chega de novo em poucos minutos.
-- Numa colisão de milissegundo exata entre duas requisições genuinamente
-- concorrentes, as duas podem processar — aceitável, não é o mecanismo que
-- impede geração em massa.
create table public_form_submissions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  document      text not null,
  cart_hash     text not null,
  window_bucket bigint not null,
  status        text not null default 'processing' check (status in ('processing', 'done')),
  quote_id      uuid references quotes (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (org_id, document, cart_hash, window_bucket)
);

create index on public_form_submissions (org_id);

alter table public_form_submissions enable row level security;
revoke select, insert, update, delete on public_form_submissions from authenticated, anon;

-- Tenta reivindicar o slot da janela atual. Devolve a linha (nova ou
-- existente) — o caller decide: `claimed = true` é quem deve processar;
-- `claimed = false` com `status = 'done'` deve devolver `quote_id` direto
-- sem recalcular; `claimed = false` com `status = 'processing'` é uma
-- corrida genuína em andamento (raro, aceito processar de novo).
create or replace function public_form_claim_submission(
  p_org_id uuid,
  p_document text,
  p_cart_hash text,
  p_window_seconds integer
) returns table (id uuid, status text, quote_id uuid, claimed boolean)
language plpgsql security invoker
set search_path = public
as $$
declare
  v_window_bucket bigint;
begin
  v_window_bucket := floor(extract(epoch from now()) / p_window_seconds)::bigint;

  return query
  insert into public_form_submissions (org_id, document, cart_hash, window_bucket)
  values (p_org_id, p_document, p_cart_hash, v_window_bucket)
  on conflict (org_id, document, cart_hash, window_bucket) do update
    set window_bucket = excluded.window_bucket
  returning
    public_form_submissions.id,
    public_form_submissions.status,
    public_form_submissions.quote_id,
    (xmax = 0);
end;
$$;

revoke execute on function public_form_claim_submission(uuid, text, text, integer) from public;

-- Marca o slot como concluído com o orçamento gerado.
create or replace function public_form_complete_submission(
  p_id uuid,
  p_quote_id uuid
) returns void
language sql security invoker
set search_path = public
as $$
  update public_form_submissions set status = 'done', quote_id = p_quote_id where id = p_id;
$$;

revoke execute on function public_form_complete_submission(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Template de PDF por organização — leitura necessária para o PDFMonkey ter
-- dado real por org; a tela de edição (Milestone 10, hoje mock) continua
-- fora do escopo desta migration.
-- ---------------------------------------------------------------------------

create table pdf_settings (
  org_id                uuid primary key references organizations (id) on delete cascade,
  logo_url              text,
  issuer_name           text,
  issuer_document       text,
  issuer_address        text,
  warranty_text         text,
  terms_text            text,
  shipping_text         text,
  -- Nulo = usa o template padrão da conta PDFMonkey (`PDFMONKEY_DEFAULT_TEMPLATE_ID`).
  pdfmonkey_template_id text,
  updated_at            timestamptz not null default now()
);

alter table pdf_settings enable row level security;

create policy "pdf_settings_select_member" on pdf_settings
  for select using (org_id in (select auth_org_ids()));

create policy "pdf_settings_write_admin" on pdf_settings
  for all using ((select auth_is_org_admin(org_id)))
  with check ((select auth_is_org_admin(org_id)));

-- ---------------------------------------------------------------------------
-- Clientes — fatia mínima para o formulário público deduplicar por
-- documento. CRUD completo, múltiplos contatos e a tela dedicada continuam
-- sendo escopo da Milestone 17 (PLAN.md); aqui só o necessário para o
-- endpoint público não criar um cliente novo a cada solicitação repetida.
-- ---------------------------------------------------------------------------

create table customers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  document   text not null,
  name       text not null,
  email      text,
  phone      text,
  address    jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, document)
);

create index on customers (org_id);

alter table customers enable row level security;

create policy "customers_select_member" on customers
  for select using (org_id in (select auth_org_ids()));

create policy "customers_write_member" on customers
  for all using (org_id in (select auth_org_ids()))
  with check (org_id in (select auth_org_ids()));

-- Mesma dedupe usada pelo formulário público E, quando a Milestone 8 passar a
-- gravar cliente de verdade, pelo construtor manual — upsert por
-- (org_id, document) em vez de dois passos (select, depois insert/update)
-- para não abrir janela de corrida entre duas submissões simultâneas do
-- mesmo documento.
create or replace function upsert_public_customer(
  p_org_id uuid,
  p_document text,
  p_name text,
  p_email text,
  p_phone text,
  p_address jsonb
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

  return v_id;
end;
$$;

revoke execute on function upsert_public_customer(uuid, text, text, text, text, jsonb) from public;

-- `quotes.customer_id` não tinha FK até aqui ("customers chega na Milestone
-- 17" — comentário original em 20260726000009_quote_engine.sql): agora que a
-- tabela existe, a referência passa a ser real. Nome e documento continuam
-- copiados em `quotes` mesmo assim — cliente que corrige a razão social não
-- pode alterar um orçamento já emitido, mesmo pool desses dados vir do
-- mesmo registro de cliente.
alter table quotes
  add constraint quotes_customer_id_fkey
  foreign key (customer_id) references customers (id) on delete set null;

-- Mesmo motivo de `products_check_category_org` (Milestone 13) e
-- `payment_band_conditions_check_org` (Milestone 14): a FK sozinha só exige
-- que a linha exista, de qualquer organização — sem esta trigger um
-- orçamento poderia apontar para o cliente de outra empresa.
create or replace function quotes_check_customer_org()
returns trigger
language plpgsql
as $$
begin
  if new.customer_id is not null
     and (select org_id from customers where id = new.customer_id) is distinct from new.org_id then
    raise exception 'Cliente e orçamento pertencem a organizações diferentes.';
  end if;
  return new;
end;
$$;

create trigger quotes_check_customer_org
  before insert or update on quotes
  for each row execute function quotes_check_customer_org();

-- ---------------------------------------------------------------------------
-- Emissão sem sessão — o formulário público nasce direto emitido (o cliente
-- final recebe o PDF na hora; não existe fase de rascunho para ele revisar).
-- Mesma ordem de `issue_quote` (Milestone 14): itens e tributos preenchidos
-- ANTES de `tax_snapshot_at` — as triggers de imutabilidade rejeitam
-- qualquer escrita em item/tributo depois que o documento pai já está
-- marcado como emitido.
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

  return v_quote;
end;
$$;

revoke execute on function create_public_quote(uuid, jsonb, jsonb, jsonb) from public;

-- Resolução da organização pela chave pública — projeção mínima, sem
-- vazar nenhuma coluna interna além do necessário para o formulário
-- renderizar (nome) e para o caller montar o restante das consultas
-- (id). Roda via service_role (bypassa RLS); `security invoker` mesmo
-- assim, mesmo padrão do resto do arquivo — quem chama já é o único
-- autorizado, via EXECUTE.
-- `plan` viaja junto: o canal WhatsApp da entrega (route handler) é
-- condicionado a ele, e sem billing (Milestone 21) ainda essa é a única
-- fonte de verdade de plano que existe.
create or replace function resolve_public_organization(p_public_form_key text)
returns table (id uuid, name text, slug text, plan text)
language sql security invoker stable
set search_path = public
as $$
  select id, name, slug, plan from organizations where public_form_key = p_public_form_key;
$$;

revoke execute on function resolve_public_organization(text) from public;

-- ---------------------------------------------------------------------------
-- GRANTs para service_role — ver nota 2 no topo do arquivo. Concedido por
-- nome, não via `alter default privileges`: o alcance do service_role deve
-- ficar visível migration a migration, não crescer sozinho a cada tabela
-- nova (diferente da escolha para `authenticated` em
-- 20260725000008_grants.sql, que é o client de sessão normal do dashboard).
-- ---------------------------------------------------------------------------

grant usage on schema public to service_role;

grant execute on function
  resolve_public_organization(text),
  public_form_check_rate_limit(text, text, integer, integer),
  public_form_claim_submission(uuid, text, text, integer),
  public_form_complete_submission(uuid, uuid),
  upsert_public_customer(uuid, text, text, text, text, jsonb),
  create_public_quote(uuid, jsonb, jsonb, jsonb)
to service_role;

-- Leitura do catálogo e configuração da organização, escopada por org_id
-- explicitamente no route handler (service_role bypassa RLS, então essa
-- query é a única barreira de isolamento entre organizações que resta).
grant select on
  organizations,
  products,
  product_categories,
  tax_types,
  tax_rates,
  tax_settings,
  pdf_settings
to service_role;

-- Persistência do documento emitido — mesmas tabelas de
-- 20260726000009_quote_engine.sql, agora também acessíveis por service_role
-- (antes só `authenticated` tinha GRANT nelas).
grant select, insert, update on
  quote_sequences,
  quotes,
  quote_items,
  quote_item_taxes
to service_role;

grant select, insert, update on customers to service_role;

grant select, insert, update, delete on
  public_form_rate_limits,
  public_form_submissions
to service_role;
