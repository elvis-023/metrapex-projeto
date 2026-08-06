-- Bloco 2 (feat/02-customer-tax-classification): upsert_customer passa a
-- aceitar e gravar tax_classification, icms_contribuinte e
-- simples_nacional_optante — colunas já existentes desde o Bloco 1
-- (20260805000020_icms_st_schema.sql), mas a RPC autenticada de
-- cadastro/edição de cliente ainda não escrevia nelas.
--
-- Parâmetros novos com default igual ao default da coluna: chamadas
-- existentes que não passam os 3 novos argumentos (ex.:
-- components/quotes/customer-picker.tsx, que ainda não tem esta UI) continuam
-- funcionando sem alteração, gravando os mesmos defaults de sempre.
--
-- `create or replace` sozinho NÃO substitui a função de 6 parâmetros — uma
-- lista de parâmetros mais longa (mesmo com default) é uma assinatura
-- diferente pro Postgres, então as duas ficariam sobrecarregadas lado a
-- lado. Isso quebra a chamada via PostgREST com os 6 argumentos nomeados de
-- sempre: "Could not choose the best candidate function" (as duas
-- resolvem, e o Postgres não sabe qual usar) — confirmado ao vivo rodando
-- scripts/verify-customers-backend.mts contra esta migration antes do drop
-- abaixo. A versão antiga precisa ser derrubada explicitamente primeiro.
drop function if exists upsert_customer(uuid, text, text, text, text, jsonb);
--
-- upsert_public_customer (formulário público, visitante anônimo) NÃO ganha
-- estes parâmetros — classificação fiscal e contribuinte de ICMS são
-- decisão do vendedor, não algo que o cliente final preenche sozinho; um
-- cadastro criado pelo formulário público continua nos defaults do schema
-- ('consumidor_final', false, null) até um vendedor revisar.
create or replace function upsert_customer(
  p_org_id uuid,
  p_document text,
  p_name text,
  p_email text,
  p_phone text,
  p_address jsonb default null,
  p_tax_classification text default 'consumidor_final',
  p_icms_contribuinte boolean default false,
  p_simples_nacional_optante boolean default null
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

  insert into customers (
    org_id, document, name, email, phone, address,
    tax_classification, icms_contribuinte, simples_nacional_optante
  )
  values (
    p_org_id, p_document, p_name, p_email, p_phone, p_address,
    p_tax_classification, p_icms_contribuinte, p_simples_nacional_optante
  )
  on conflict (org_id, document) do update
    set name                     = excluded.name,
        email                    = excluded.email,
        phone                    = excluded.phone,
        address                  = coalesce(excluded.address, customers.address),
        tax_classification       = excluded.tax_classification,
        icms_contribuinte        = excluded.icms_contribuinte,
        simples_nacional_optante = excluded.simples_nacional_optante,
        updated_at               = now()
  returning * into v_customer;

  return v_customer;
end;
$$;

grant execute on function upsert_customer(
  uuid, text, text, text, text, jsonb, text, boolean, boolean
) to authenticated;
