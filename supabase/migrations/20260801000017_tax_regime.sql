-- Regime Tributário da organização (briefing-motor-impostos.md §6, decisão registrada em
-- .claude/skills/decisao-pendente/references/decisoes-registradas.md, seção "Regime
-- Tributário", #1).
--
-- Metadado da organização, não dado de cálculo: determina qual preset de
-- tax_types/tax_rates/tax_settings roda no onboarding e orienta a UI. resolveRate/calcTax
-- nunca leem esta coluna — a hierarquia de resolução de alíquota (§4) continua sendo só
-- produto > categoria > padrão da organização.
--
-- text + check, não um `create type ... as enum`: mesmo padrão já usado no projeto para
-- conjuntos fechados de valores (organizations.plan, tax_types.mode,
-- quote_item_taxes.rate_source) — evita o custo de ALTER TYPE para adicionar/remover
-- valor depois, que um enum nativo do Postgres exigiria.
--
-- Nullable de propósito: NULL é "regime não confirmado", não um quinto regime. Cobre
-- tanto organização nova que ainda não passou pelo onboarding quanto organização cujo
-- shape de configuração fiscal não permite inferir o regime no backfill abaixo.
alter table organizations
  add column tax_regime text
  check (tax_regime is null or tax_regime in ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real'));

-- RLS: nenhuma policy nova é necessária. `organizations` já tem RLS habilitada com
-- select-member/update-admin/delete-admin (20260725000003_rls_policies.sql) — essas
-- policies são por linha, não por coluna, então já cobrem `tax_regime` como cobrem
-- `plan`. Escrita continua restrita a admin da própria organização, leitura a qualquer
-- membro; nenhuma organização enxerga o regime de outra.

-- Backfill das organizações existentes. Nenhum registro guarda regime hoje — só o
-- EFEITO de um dos 3 templates antigos do onboarding em tax_types/tax_settings. A
-- inferência é por shape de dado, e é palpite, não confirmação fiscal:
--
--   1. Zero tax_types + tax_settings com o texto padrão da Lei 12.741/2012 e
--      show_tax_lines=false -> era o template "Simples Nacional (sem destaque)".
--      O template antigo não distinguia MEI de Simples Nacional, então o mais fiel
--      é 'simples_nacional' (nome do template original), não 'mei'.
--   2. Zero tax_types + tax_settings com document_footer nulo -> era o template
--      "Isento", que deixou de ser regime (briefing §6) -> fica NULL, não força
--      nenhum dos quatro.
--   3. tax_types com exatamente ICMS (exclusive) + IPI (inclusive), o shape do
--      antigo template "ICMS + IPI padrão" -> 'lucro_presumido', que era o regime
--      citado nominalmente pra esse template no briefing. Não dá pra saber se a
--      organização é Presumido ou Real de verdade -> palpite, sinalizado como tal.
--   4. Qualquer outro shape (organização editou tax_types manualmente, ou shape não
--      bate com nenhum dos três acima) -> fica NULL. Mais seguro não inferir do que
--      adivinhar errado.
--
-- Toda organização que sair com tax_regime NULL deve ver um banner de "confirme seu
-- regime tributário" na UI (não um bloqueio — o motor de cálculo não depende disso).
update organizations o
set tax_regime = 'simples_nacional'
where o.tax_regime is null
  and not exists (select 1 from tax_types tt where tt.org_id = o.id)
  and exists (
    select 1
    from tax_settings ts
    where ts.org_id = o.id
      and ts.document_footer = 'Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.'
      and ts.show_tax_lines = false
  );

update organizations o
set tax_regime = 'lucro_presumido'
where o.tax_regime is null
  and (select count(*) from tax_types tt where tt.org_id = o.id) = 2
  and exists (
    select 1 from tax_types tt
    where tt.org_id = o.id and tt.code = 'ICMS' and tt.mode = 'exclusive'
  )
  and exists (
    select 1 from tax_types tt
    where tt.org_id = o.id and tt.code = 'IPI' and tt.mode = 'inclusive'
  );

-- Organizações com zero tax_types e document_footer nulo (era "Isento"), e qualquer
-- shape que não bateu com as duas regras acima, permanecem com tax_regime = NULL.
