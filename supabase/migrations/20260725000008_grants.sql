-- Fix retroativo (encontrado durante a verificação ao vivo da Milestone 13):
-- nenhuma migration desde a Milestone 11 concedia GRANT de tabela para as
-- roles `anon`/`authenticated`, e `auto_expose_new_tables` está desligado no
-- config.toml (padrão novo do Supabase — não expor automaticamente). Sem
-- GRANT, o PostgREST recusa qualquer select/insert/update/delete com
-- "permission denied for table X" mesmo quando a policy de RLS liberaria a
-- linha — GRANT e RLS são duas camadas independentes, a RLS nunca substitui
-- a primeira. Isso bloqueava M11, M12 e M13 inteiras via API, não só o
-- catálogo; nunca tinha sido percebido porque nenhum milestone anterior foi
-- testado contra um Postgres real rodando.
--
-- RLS continua sendo a barreira linha a linha de verdade — este GRANT só
-- abre a possibilidade de a role tentar a operação; a policy decide se ela
-- enxerga/altera aquela linha específica.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  profiles,
  organizations,
  organization_members,
  organization_invites,
  product_categories,
  tax_types,
  tax_rates,
  tax_settings,
  products
to authenticated;

-- Sem isto, toda Milestone futura que criar uma tabela precisaria lembrar de
-- um GRANT manual (como este arquivo corrigindo agora) ou repetir o mesmo
-- bug. `default privileges` cobre tabelas criadas depois deste ponto pela
-- mesma role que roda as migrations (`postgres`, via `supabase db push`/CLI).
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
