-- Bloco 1 (feat/01-icms-st-schema) — schema da reversão de duas exclusões do V1
-- registrada em briefing-motor-impostos.md §2/§3/§8 e em
-- .claude/skills/decisao-pendente/references/decisoes-registradas.md, seção
-- "ICMS-ST/NCM": NCM obrigatório por categoria e ICMS-ST por UF (configuração
-- manual, sem cálculo automático de MVA — isso continua fora de escopo).
--
-- Este bloco só mexe em schema. Nenhum código de resolução/cálculo lê as
-- colunas/tabela novas ainda — isso é Bloco 4/5.

-- -----------------------------------------------------------------------
-- 1. NCM obrigatório em product_categories
-- -----------------------------------------------------------------------
-- Diagnóstico (sessão anterior): 0 categorias existem hoje, em nenhuma das 6
-- organizações de dev. Um `ALTER ... ADD COLUMN ... NOT NULL` direto não
-- quebra nenhuma linha neste ambiente — mas a migration não deve depender
-- silenciosamente desse número. Se alguma categoria já existir quando esta
-- migration rodar (branch paralela, stage, produção), falha alto e explícito
-- em vez de exigir backfill manual antes; ver plano de schema na conversa
-- anterior para o caminho de coluna-nullable-depois-NOT-NULL caso isto
-- dispare de verdade.
do $$
begin
  if exists (select 1 from product_categories) then
    raise exception
      'product_categories já tem % linha(s); NCM obrigatório exige backfill manual antes desta migration (ver briefing-motor-impostos.md §2 e o plano de schema registrado na conversa).',
      (select count(*) from product_categories);
  end if;
end $$;

alter table product_categories
  add column ncm text not null check (ncm ~ '^[0-9]{8}$');

-- -----------------------------------------------------------------------
-- 2. ICMS-ST por UF — tabela nova, deliberadamente separada de tax_rates
-- -----------------------------------------------------------------------
-- Não estende tax_rates: ICMS-ST-por-UF depende de um dado transacional (UF
-- do cliente do orçamento), que resolveRate nunca conhece por desenho.
-- Misturar as duas dimensões de escopo (produto/categoria vs. UF) na mesma
-- tabela introduziria uma terceira dimensão sem que resolveRate tivesse
-- assinatura para resolvê-la, e quebraria a garantia de unicidade hoje
-- expressa nos índices de tax_rates — decisão "ICMS-ST/NCM #1" em
-- decisoes-registradas.md, conferida pelo agent consultor-briefing.
--
-- Chave única por (categoria, UF) — sem override por produto (diferente de
-- tax_rates): a granularidade pedida foi categoria/NCM × UF, não por item de
-- catálogo individual.
--
-- org_id vem direto na tabela (não derivado por join até tax_types, como
-- tax_rates faz) para poder replicar o mesmo padrão simples de RLS de
-- product_categories/tax_types/tax_settings (org_id in (select auth_org_ids())).
--
-- iva_simples/iva_normal são cadastro de referência (o motor não calcula MVA
-- sozinho — briefing §8) — não alimentam calcTax nesta fase; ficam
-- registrados aqui para o contador consultar/auditar ao lado da alíquota
-- final já pronta (st_contribuinte_rate/st_nao_contribuinte_rate).
--
-- cst_comercializacao, cst_consumo, codigo_beneficio, decreto_contribuinte e
-- decreto_nao_contribuinte são metadado puro, sem uso em cálculo.
create table icms_st_state_rules (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  category_id  uuid not null references product_categories (id) on delete cascade,
  uf           text not null check (uf ~ '^[A-Z]{2}$'),

  icms_contribuinte_rate     numeric(7,4) not null
                             check (icms_contribuinte_rate >= 0 and icms_contribuinte_rate <= 100),
  icms_nao_contribuinte_rate numeric(7,4) not null
                             check (icms_nao_contribuinte_rate >= 0 and icms_nao_contribuinte_rate <= 100),
  icms_reducao_base          numeric(7,4) not null default 0
                             check (icms_reducao_base >= 0 and icms_reducao_base <= 100),

  st_contribuinte_rate       numeric(7,4) not null
                             check (st_contribuinte_rate >= 0 and st_contribuinte_rate <= 100),
  st_nao_contribuinte_rate   numeric(7,4) not null
                             check (st_nao_contribuinte_rate >= 0 and st_nao_contribuinte_rate <= 100),

  -- Referência/auditoria (IVA-ST cadastrado por origem do fornecedor) — o
  -- motor não deriva nem valida contra as colunas de alíquota acima.
  iva_simples  numeric(7,4) check (iva_simples is null or (iva_simples >= 0 and iva_simples <= 100)),
  iva_normal   numeric(7,4) check (iva_normal is null or (iva_normal >= 0 and iva_normal <= 100)),

  fcp_comercializacao    numeric(7,4) not null default 0
                         check (fcp_comercializacao >= 0 and fcp_comercializacao <= 100),
  fcp_consumo            numeric(7,4) not null default 0
                         check (fcp_consumo >= 0 and fcp_consumo <= 100),
  fcp_st_comercializacao numeric(7,4) not null default 0
                         check (fcp_st_comercializacao >= 0 and fcp_st_comercializacao <= 100),
  fcp_st_consumo         numeric(7,4) not null default 0
                         check (fcp_st_consumo >= 0 and fcp_st_consumo <= 100),

  -- Metadado puro, sem uso em cálculo — só para o contador/relatório fiscal.
  cst_comercializacao      text,
  cst_consumo              text,
  codigo_beneficio         text,
  decreto_contribuinte     text,
  decreto_nao_contribuinte text,

  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, category_id, uf)
);

create index on icms_st_state_rules (org_id);
create index on icms_st_state_rules (category_id);

-- Mesma guarda cross-tenant de products_check_category_org (Milestone 13):
-- a FK sozinha não impede category_id apontar para categoria de outra
-- organização. A função já é genérica (só olha new.category_id/new.org_id),
-- reaproveitada aqui sem duplicar lógica.
create trigger icms_st_state_rules_check_category_org
  before insert or update of category_id, org_id on icms_st_state_rules
  for each row execute function products_check_category_org();

create or replace function icms_st_state_rules_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger icms_st_state_rules_set_updated_at
  before update on icms_st_state_rules
  for each row execute function icms_st_state_rules_set_updated_at();

alter table icms_st_state_rules enable row level security;

-- Mesmo padrão de product_categories/tax_types/tax_settings: todo membro lê
-- (a alíquota aplicada é visível pra quem monta orçamento), só admin configura.
create policy "icms_st_state_rules_select_member" on icms_st_state_rules
  for select using (org_id in (select auth_org_ids()));

create policy "icms_st_state_rules_insert_admin" on icms_st_state_rules
  for insert with check ((select auth_is_org_admin(org_id)));

create policy "icms_st_state_rules_update_admin" on icms_st_state_rules
  for update using ((select auth_is_org_admin(org_id)));

create policy "icms_st_state_rules_delete_admin" on icms_st_state_rules
  for delete using ((select auth_is_org_admin(org_id)));

-- -----------------------------------------------------------------------
-- 3. Snapshot: quote_item_taxes ganha 'state_rule' + resolved_uf
-- -----------------------------------------------------------------------
-- Decisão "ICMS-ST/NCM #2" em decisoes-registradas.md: sem isso, o snapshot
-- de ICMS-ST não teria onde registrar de onde veio a alíquota nem qual UF foi
-- usada na emissão, quebrando "fotografia, não consulta" (briefing §3)
-- especificamente para este tributo. Nomeado pelo mecanismo de resolução
-- ('state_rule'), não pelo tributo — outro tributo pode precisar do mesmo
-- mecanismo no futuro. Schema pronto para receber; nenhuma rotina de emissão
-- grava estas colunas ainda (Bloco 4/5).
alter table quote_item_taxes
  drop constraint quote_item_taxes_rate_source_check,
  add constraint quote_item_taxes_rate_source_check
    check (rate_source in ('org_default', 'category', 'product', 'state_rule')),
  add column resolved_uf text;

-- -----------------------------------------------------------------------
-- 4. customers: classificação, contribuinte, Simples Nacional e UF estruturada
-- -----------------------------------------------------------------------
-- UF hoje só existe como address->>'state' (jsonb), texto livre sem
-- validação — confirmado no diagnóstico anterior (um cliente real de dev já
-- está com esse campo nulo). Vira coluna própria, nullable (não força os
-- clientes existentes a ganhar um valor inventado), com formato validado só
-- quando presente.
alter table customers
  add column state text check (state is null or state ~ '^[A-Z]{2}$');

-- Backfill: copia o que já existe em address->>'state' pra coluna nova, só
-- quando já bate no formato de UF (2 letras) — não inventa dado para o resto.
update customers
  set state = upper(address ->> 'state')
  where address ->> 'state' ~ '^[A-Za-z]{2}$';

-- tax_classification: default conservador ('consumidor_final') para os
-- clientes já cadastrados — não presume revenda sem confirmação do vendedor.
alter table customers
  add column tax_classification text not null default 'consumidor_final'
    check (tax_classification in ('consumidor_final', 'revenda'));

-- icms_contribuinte: manual, sem detecção automática — é Inscrição Estadual,
-- não é dado público centralizado como opcao_pelo_mei/opcao_pelo_simples.
-- Default false: não presume condição de contribuinte sem confirmação.
alter table customers
  add column icms_contribuinte boolean not null default false;

-- simples_nacional_optante: nullable, NÃO `not null default false` — a
-- detecção é automática (mesmo client de BrasilAPI já genérico,
-- lib/integrations/brasil-api.ts, reaproveitado do onboarding), mas pode
-- simplesmente não ter rodado ainda para um cliente já cadastrado. null =
-- "não detectado ainda"; false = "detectado, não é optante" — os dois
-- estados não podem ser confundidos.
alter table customers
  add column simples_nacional_optante boolean;
