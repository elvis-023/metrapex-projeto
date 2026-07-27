-- Fix retroativo (encontrado na QA manual do Milestone 16, testando o board
-- pelo navegador como vendedor que NÃO é o dono do orçamento — não algo que
-- um teste unitário ou uma chamada de RPC direta expõe).
--
-- `profiles` só tinha `profiles_select_own` (id = auth.uid()) desde a
-- Milestone 11. Toda leitura de nome de outro usuário da mesma organização —
-- responsável no card do Kanban, no detalhe do orçamento, na lista de
-- colaboradores — ficava vazia pra qualquer um que não fosse o próprio dono
-- da linha, porque o `select` em `profiles` de um vendedor pro perfil de
-- outro voltava zero linhas (RLS filtrando, sem erro). Consequência visível:
-- "Não atribuído" aparecia pra todo mundo, inclusive admin, exceto o próprio
-- dono olhando o próprio orçamento — mascarado até agora porque nenhuma
-- verificação anterior tinha logado como um SEGUNDO usuário autenticado pra
-- olhar o board de outro.
--
-- A regra de permissão do Milestone 16 (quem move a etapa) não dependia disso
-- — usa `owner_id`/`auth_is_org_admin` direto — e a timeline também não,
-- porque `quote_activities.author_label` é snapshot de texto, não join. Só a
-- APRESENTAÇÃO do responsável quebrava.
--
-- RLS com múltiplas policies `for select` soma por OR — isto ACRESCENTA
-- visibilidade além de `profiles_select_own`, não a substitui.
create policy "profiles_select_org_member" on profiles
  for select using (
    id in (
      select user_id from organization_members
      where org_id in (select auth_org_ids())
    )
  );
