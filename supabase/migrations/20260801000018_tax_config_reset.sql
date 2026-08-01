-- Reset da configuração fiscal, em preparação para o Bloco 3 (repopulação de
-- tax_types/tax_rates/tax_settings a partir do Regime Tributário, briefing §6).
--
-- Limpa SÓ configuração: tax_types, tax_rates, tax_settings. Nenhuma organização fica
-- com regime "certo" ainda depois desta migration -- organizations.tax_regime (backfill
-- da migration anterior) não é tocado aqui; ele é o dado que o Bloco 3 vai ler pra
-- escolher qual preset repopular.
--
-- REGRA INEGOCIÁVEL (briefing §3, confirmada antes de escrever esta migration):
-- quote_item_taxes, quote_items e quotes são o documento emitido -- fotografia, não
-- consulta -- e não podem ser tocados por este reset.
--
--   - quote_item_taxes.tax_type_id NÃO tem FK para tax_types (proposital --
--     20260726000009_quote_engine.sql:279-281: "SEM FK, de propósito [...] Adicionar FK
--     aqui quebra o produto"). Apagar tax_types não cascateia pra quote_item_taxes.
--   - tax_rates.tax_type_id TEM "on delete cascade" para tax_types -- isso é esperado e
--     correto: tax_rates é configuração (override de alíquota), não snapshot.
--   - quote_items/quotes não têm FK nenhuma para tax_types/tax_rates/tax_settings --
--     eles guardam cópia literal dos valores (unit_price_charged, tax_footer_note etc.),
--     nunca uma referência viva.
--
-- Confirmado por leitura do schema antes desta migration: nenhuma cascade ou constraint
-- ameaça quote_item_taxes/quote_items/quotes. Ainda assim, a trava abaixo não confia só
-- nessa leitura -- ela mede as três tabelas antes e depois do delete, na mesma
-- transação, e aborta a migration inteira (RAISE EXCEPTION reverte o `do $$ ... $$`
-- block e, por transitividade, o arquivo inteiro, já que o Supabase CLI aplica cada
-- migration dentro de uma transação) se qualquer contagem mudar. Se dispararem, é sinal
-- de que uma FK/cascade nova quebrou o invariante do §3 -- não rode de novo sem
-- investigar antes.
do $$
declare
  quotes_before            bigint;
  quote_items_before       bigint;
  quote_item_taxes_before  bigint;
  quotes_after             bigint;
  quote_items_after        bigint;
  quote_item_taxes_after   bigint;
begin
  select count(*) into quotes_before from quotes;
  select count(*) into quote_items_before from quote_items;
  select count(*) into quote_item_taxes_before from quote_item_taxes;

  delete from tax_rates;
  delete from tax_types;
  delete from tax_settings;

  select count(*) into quotes_after from quotes;
  select count(*) into quote_items_after from quote_items;
  select count(*) into quote_item_taxes_after from quote_item_taxes;

  if quotes_before <> quotes_after
     or quote_items_before <> quote_items_after
     or quote_item_taxes_before <> quote_item_taxes_after then
    raise exception
      'RESET FISCAL ABORTADO: quotes/quote_items/quote_item_taxes mudaram de %/%/% para %/%/% -- viola o invariante de snapshot do briefing §3. Não continue sem investigar a cascade.',
      quotes_before, quote_items_before, quote_item_taxes_before,
      quotes_after, quote_items_after, quote_item_taxes_after;
  end if;
end $$;
