-- Bloco 3b (feat/03b-organization-origin-state): UF de origem da organização.
-- Resolve a pergunta 1 do diagnóstico do Bloco 4 (coluna única, mesmo padrão
-- de customers.state — Bloco 1/2; zero evidência de suporte a múltiplas
-- origens/filiais em qualquer lugar do código, sem motivo para modelar isso
-- agora). A pergunta 2 (como a fórmula de ICMS-ST usa origem × destino)
-- continua deliberadamente em aberto — não é resolvida por este bloco.

-- Nullable: nenhuma organização existente tem este dado (nunca foi
-- coletado), e o passo 1 do onboarding hoje descarta a UF que ele mesmo
-- junta via CNPJ/CEP — cadastro/edição de organização não pode passar a
-- exigir UF de uma hora para outra.
alter table organizations
  add column state text check (state is null or state ~ '^[A-Z]{2}$');

-- create_organization ganha o parâmetro opcional org_state. `create or
-- replace` sozinho NÃO substitui a função de 2 parâmetros — uma lista mais
-- longa (mesmo com default) é uma assinatura diferente pro Postgres, cria
-- uma sobrecarga ao lado da antiga e quebra a chamada de sempre com "Could
-- not choose the best candidate function" (mesmo problema já corrigido em
-- 20260805000021_customer_tax_fields_rpc.sql para upsert_customer). A versão
-- antiga precisa ser derrubada explicitamente primeiro.
drop function if exists create_organization(text, text);

create or replace function create_organization(
  org_name text,
  org_slug text,
  org_state text default null
) returns organizations
language plpgsql security definer
set search_path = public
as $$
declare
  v_org organizations;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  insert into organizations (name, slug, state) values (org_name, org_slug, org_state)
  returning * into v_org;

  insert into organization_members (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  return v_org;
end;
$$;

grant execute on function create_organization(text, text, text) to authenticated;
