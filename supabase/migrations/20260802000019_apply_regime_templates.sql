-- Bloco 3 (parte 2): repopula tax_types/tax_rates/tax_settings a partir do
-- Regime Tributário já backfillado em cada organização (briefing §6,
-- 20260801000017_tax_regime.sql). É o "Bloco 3 repopula" prometido pelo
-- comentário de 20260801000018_tax_config_reset.sql, que zerou essas
-- tabelas de propósito pra este momento.
--
-- Espelha exatamente `buildTaxTemplatePlan`
-- (lib/tax-engine/onboarding-templates.ts) — mesmo preset que o onboarding
-- aplicaria pra cada regime:
--
--   MEI / Simples Nacional -> case "simples": nenhum tax_type, só o rodapé
--   da Lei 12.741/2012 e show_tax_lines = false.
--
--   Lucro Presumido / Lucro Real -> case "icms-ipi" / "lucro-real": ICMS
--   exclusive a 18% (sugestão), IPI inclusive com default_rate 0. SEM
--   override de categoria — o próprio `buildTaxTemplatePlan` não cria esse
--   override no onboarding (comentário do arquivo: "não há category_id pra
--   vincular a essa altura"), e aqui vale a mesma razão: não existe garantia
--   de que a organização já tenha uma categoria "industrializados", então
--   inventar um vínculo seria pior que deixar em 0 até o admin configurar em
--   /settings/taxes.
--
--   tax_regime IS NULL (regime não confirmado) -> nada é inserido. Não
--   adivinha; a organização fica com a mesma tela vazia de antes até alguém
--   confirmar o regime.
--
-- Todas as alíquotas de exemplo são SUGESTÃO INICIAL, editável — nunca regra
-- travada (briefing §9); a tela de configuração exibe esse aviso
-- (components/settings/tax-settings-manager.tsx).
--
-- Idempotente e não-destrutivo: cada insert só roda para organização que
-- ainda não tem NENHUMA linha em tax_types/tax_settings. Reaplicar esta
-- migration (ou rodá-la depois de uma organização já ter configuração
-- própria) não sobrescreve nada.

-- MEI e Simples Nacional: só o rodapé informativo.
insert into tax_settings (org_id, document_footer, show_tax_lines)
select o.id, 'Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.', false
from organizations o
where o.tax_regime in ('mei', 'simples_nacional')
  and not exists (select 1 from tax_settings ts where ts.org_id = o.id)
  and not exists (select 1 from tax_types tt where tt.org_id = o.id);

-- Lucro Presumido e Lucro Real: tax_settings sem rodapé (o documento destaca
-- tributo, não precisa da nota de transparência) e show_tax_lines = true.
insert into tax_settings (org_id, document_footer, show_tax_lines)
select o.id, null, true
from organizations o
where o.tax_regime in ('lucro_presumido', 'lucro_real')
  and not exists (select 1 from tax_settings ts where ts.org_id = o.id)
  and not exists (select 1 from tax_types tt where tt.org_id = o.id);

-- Lucro Presumido e Lucro Real: ICMS exclusive + IPI inclusive, num único
-- INSERT (as duas linhas leem o mesmo "not exists" contra o estado anterior
-- ao statement, então a organização recebe as duas ou nenhuma).
insert into tax_types (org_id, code, label, mode, default_rate, display_order)
select o.id, 'ICMS', 'ICMS', 'exclusive', 18.0000, 1
from organizations o
where o.tax_regime in ('lucro_presumido', 'lucro_real')
  and not exists (select 1 from tax_types tt where tt.org_id = o.id)
union all
select o.id, 'IPI', 'IPI', 'inclusive', 0.0000, 2
from organizations o
where o.tax_regime in ('lucro_presumido', 'lucro_real')
  and not exists (select 1 from tax_types tt where tt.org_id = o.id);
