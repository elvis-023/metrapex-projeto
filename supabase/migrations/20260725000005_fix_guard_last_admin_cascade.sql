-- Corrige guard_last_admin(): estava bloqueando a exclusão em cascata de
-- organization_members quando a PRÓPRIA organização (ou o usuário, via FK
-- organization_members.user_id) está sendo apagada — nesse caso não faz
-- sentido exigir "pelo menos um admin restante", porque não vai sobrar
-- organização nenhuma. A guarda só deve valer enquanto a org continua existindo.
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

  if tg_op = 'DELETE' and not exists (select 1 from organizations where id = v_org_id) then
    return old;
  end if;

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
