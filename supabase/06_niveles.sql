-- Ejecutar en el SQL Editor DESPUÉS de 05_club_vivo.sql.
-- Niveles definidos por club: los crea administración; profes y grupos eligen de esa lista.

create table if not exists niveles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  unique (club_id, nombre)
);
alter table niveles enable row level security;
create policy "club propio" on niveles for select using (club_id = mi_club());
create policy "admin" on niveles for select using (es_admin());
grant select on niveles to authenticated;

-- Los niveles que ya se usan pasan a ser la lista inicial de cada club
insert into niveles (club_id, nombre, orden)
select club_id, nivel, row_number() over (partition by club_id order by nivel)
from (select club_id, nivel from grupos union select club_id, nivel from usuarios where nivel is not null and club_id is not null) x
on conflict do nothing;

-- Crear (p_id null) o renombrar/reordenar. Al renombrar se cambia en grupos y alumnos.
create or replace function admin_guardar_nivel(p_id uuid, p_club uuid, p_nombre text, p_orden int) returns void
language plpgsql security definer set search_path = public as $$
declare antes text; n text := trim(p_nombre);
begin
  perform exigir_admin();
  if n = '' then raise exception 'Escribe el nombre del nivel.'; end if;
  if p_id is null then
    insert into niveles (club_id, nombre, orden)
    values (p_club, n, coalesce(p_orden, (select coalesce(max(orden), 0) + 1 from niveles where club_id = p_club)));
  else
    select nombre into antes from niveles where id = p_id and club_id = p_club;
    update niveles set nombre = n, orden = coalesce(p_orden, orden) where id = p_id;
    if antes is distinct from n then
      update grupos set nivel = n where club_id = p_club and nivel = antes;
      update usuarios set nivel = n where club_id = p_club and nivel = antes;
      update invitaciones set nivel = n where club_id = p_club and nivel = antes;
    end if;
  end if;
end $$;

create or replace function admin_borrar_nivel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v niveles;
begin
  perform exigir_admin();
  select * into v from niveles where id = p_id;
  if exists (select 1 from grupos where club_id = v.club_id and nivel = v.nombre)
     or exists (select 1 from usuarios where club_id = v.club_id and nivel = v.nombre) then
    raise exception 'Ese nivel tiene grupos o alumnos. Cámbialos de nivel antes de borrarlo.';
  end if;
  delete from niveles where id = p_id;
end $$;

-- Al dar de alta o cambiar el nivel de un alumno, el nivel tiene que existir en el club
create or replace function comprobar_nivel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nivel is not null and new.club_id is not null
     and exists (select 1 from niveles where club_id = new.club_id)
     and not exists (select 1 from niveles where club_id = new.club_id and nombre = new.nivel) then
    raise exception 'Ese nivel no existe en el club.';
  end if;
  return new;
end $$;
drop trigger if exists nivel_valido on usuarios;
create trigger nivel_valido before insert or update of nivel on usuarios for each row execute function comprobar_nivel();
drop trigger if exists nivel_valido on grupos;
create trigger nivel_valido before insert or update of nivel on grupos for each row execute function comprobar_nivel();

revoke all on function admin_guardar_nivel, admin_borrar_nivel, comprobar_nivel from public, anon;
grant execute on function admin_guardar_nivel, admin_borrar_nivel to authenticated;
