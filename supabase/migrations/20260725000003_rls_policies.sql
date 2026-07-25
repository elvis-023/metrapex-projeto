-- Milestone 11 — Row Level Security.

alter table profiles enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_invites enable row level security;

-- profiles: cada usuário só enxerga e edita o próprio perfil.
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- organizations: membro enxerga só as próprias orgs; update/delete restrito a admin.
-- Insert não tem policy — criação é só via create_organization() (security definer).
create policy "organizations_select_member" on organizations
  for select using (id in (select auth_org_ids()));

create policy "organizations_update_admin" on organizations
  for update using (auth_is_org_admin(id));

create policy "organizations_delete_admin" on organizations
  for delete using (auth_is_org_admin(id));

-- organization_members: membro enxerga só as memberships da própria org;
-- gestão (mudar papel, remover) restrita a admin. Insert só via RPC
-- (create_organization / accept_invite).
create policy "organization_members_select_same_org" on organization_members
  for select using (org_id in (select auth_org_ids()));

create policy "organization_members_update_admin" on organization_members
  for update using (auth_is_org_admin(org_id));

create policy "organization_members_delete_admin" on organization_members
  for delete using (auth_is_org_admin(org_id));

-- organization_invites: só admin da org gerencia convites.
-- Aceite não lê a tabela diretamente — passa por accept_invite() com o token.
create policy "organization_invites_select_admin" on organization_invites
  for select using (auth_is_org_admin(org_id));

create policy "organization_invites_insert_admin" on organization_invites
  for insert with check (auth_is_org_admin(org_id));

create policy "organization_invites_update_admin" on organization_invites
  for update using (auth_is_org_admin(org_id));

create policy "organization_invites_delete_admin" on organization_invites
  for delete using (auth_is_org_admin(org_id));
