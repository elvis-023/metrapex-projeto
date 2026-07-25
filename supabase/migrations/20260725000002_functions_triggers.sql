-- Milestone 11 — funções de suporte a RLS, criação de org, convite e guarda do último admin.

-- security definer + ignora RLS: evita a recursão infinita de uma policy em
-- organization_members que precisaria consultar a própria organization_members.
create or replace function auth_org_ids()
returns setof uuid
language sql security definer stable
set search_path = public
as $$
  select org_id from organization_members where user_id = auth.uid();
$$;

create or replace function auth_is_org_admin(target_org uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where org_id = target_org and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Cria profile automaticamente quando um usuário se cadastra no Supabase Auth.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Cria organização + membership admin do criador na mesma transação — o client
-- nunca insere em organizations/organization_members diretamente (ovo e galinha do RLS).
create or replace function create_organization(org_name text, org_slug text)
returns organizations
language plpgsql security definer
set search_path = public
as $$
declare
  v_org organizations;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  insert into organizations (name, slug) values (org_name, org_slug)
  returning * into v_org;

  insert into organization_members (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  return v_org;
end;
$$;

-- Aceita convite por token. Trava no e-mail do convite: só o destinatário
-- convidado pode aceitar, mesmo autenticado com outra conta.
create or replace function accept_invite(invite_token text)
returns organization_members
language plpgsql security definer
set search_path = public
as $$
declare
  v_invite organization_invites;
  v_user_email text;
  v_member organization_members;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select * into v_invite from organization_invites where token = invite_token for update;

  if v_invite is null or v_invite.accepted_at is not null or v_invite.expires_at < now() then
    raise exception 'Convite inválido ou expirado.';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();

  if v_user_email is null or lower(v_user_email) <> lower(v_invite.email) then
    raise exception 'Este convite foi emitido para outro e-mail.';
  end if;

  insert into organization_members (org_id, user_id, role)
  values (v_invite.org_id, auth.uid(), v_invite.role)
  on conflict (org_id, user_id) do update set role = excluded.role
  returning * into v_member;

  update organization_invites set accepted_at = now() where id = v_invite.id;

  return v_member;
end;
$$;

-- Impede remover ou rebaixar o último admin de uma organização.
create or replace function guard_last_admin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_remaining_admins int;
begin
  v_org_id := coalesce(old.org_id, new.org_id);

  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    select count(*) into v_remaining_admins
    from organization_members
    where org_id = v_org_id and role = 'admin' and id <> old.id;

    if v_remaining_admins = 0 then
      raise exception 'A organização precisa de pelo menos um administrador.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organization_members_guard_last_admin
  before update or delete on organization_members
  for each row execute function guard_last_admin();
