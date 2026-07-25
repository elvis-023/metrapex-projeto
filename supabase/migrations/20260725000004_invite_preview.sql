-- Preview público de convite (tela /invite/[token], sem sessão de admin).
-- RLS de organization_invites só libera select para admin da org — quem recebe
-- o convite não é membro ainda, então precisa de uma função security definer
-- que expõe só os campos necessários para a tela, não a tabela inteira.
create or replace function get_invite_preview(invite_token text)
returns table (
  org_name text,
  email text,
  role text,
  invited_by_name text,
  is_valid boolean
)
language plpgsql security definer
set search_path = public
as $$
declare
  v_invite organization_invites;
begin
  select * into v_invite from organization_invites where token = invite_token;

  if v_invite is null or v_invite.accepted_at is not null or v_invite.expires_at < now() then
    return query select null::text, null::text, null::text, null::text, false;
    return;
  end if;

  return query
    select o.name, v_invite.email, v_invite.role, p.full_name, true
    from organizations o
    left join profiles p on p.id = v_invite.invited_by
    where o.id = v_invite.org_id;
end;
$$;

grant execute on function get_invite_preview(text) to anon, authenticated;
