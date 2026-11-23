-- Ejecutar en el SQL Editor de Supabase DESPUÉS de schema.sql.
-- Añade: zona horaria por club, invitaciones (solo entra quien el club ha dado de alta),
-- permisos y las funciones que validan bajas, recuperaciones y sesiones.

alter table clubs add column if not exists zona_horaria text not null default 'Atlantic/Canary';

-- Quién puede entrar. Al iniciar sesión por primera vez con ese email se crea su usuario.
create table if not exists invitaciones (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol rol not null,
  nivel text,
  grupos uuid[] not null default '{}', -- alumnos: grupos donde está; profes: grupos que da
  unique (club_id, email)
);
alter table invitaciones enable row level security; -- sin políticas: nadie la lee desde la app

create or replace function crear_usuario_invitado() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invitaciones;
begin
  select * into inv from invitaciones where lower(email) = lower(new.email) limit 1;
  if inv.id is null then
    raise exception 'Este email no está dado de alta en ningún club';
  end if;
  insert into usuarios (id, club_id, nombre, email, rol, nivel)
    values (new.id, inv.club_id, inv.nombre, new.email, inv.rol, inv.nivel);
  if inv.rol = 'alumno' then
    insert into grupo_alumnos (grupo_id, alumno_id)
      select g, new.id from unnest(inv.grupos) g on conflict do nothing;
  elsif inv.rol = 'profe' then
    update grupos set profe_id = new.id where id = any(inv.grupos) and club_id = inv.club_id;
  end if;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function crear_usuario_invitado();

-- Paso 1 del acceso: el código del club. Solo devuelve id, enlace y nombre.
create or replace function club_por_codigo(p_codigo text)
returns table (id uuid, slug text, nombre text)
language sql stable security definer set search_path = public as $$
  select id, slug, nombre from clubs where upper(codigo_acceso) = upper(trim(p_codigo))
$$;

-- Plazas ocupadas en una clase concreta
create or replace function ocupacion(p_grupo uuid, p_fecha date, p_con_pendientes boolean)
returns int language sql stable security definer set search_path = public as $$
  select (select count(*) from grupo_alumnos where grupo_id = p_grupo)::int
       - (select count(*) from bajas where grupo_id = p_grupo and fecha = p_fecha)::int
       + (select count(*) from recuperaciones where grupo_id = p_grupo and fecha = p_fecha
            and (estado = 'aprobada' or (p_con_pendientes and estado = 'pendiente')))::int
$$;

create or replace function inicio_clase(g grupos, p_fecha date)
returns timestamptz language sql stable set search_path = public as $$
  select (p_fecha + g.hora_inicio) at time zone (select zona_horaria from clubs where id = g.club_id)
$$;

create or replace function dar_baja(p_grupo uuid, p_fecha date)
returns void language plpgsql security definer set search_path = public as $$
declare g grupos; c clubs; b_id uuid;
begin
  select * into g from grupos where id = p_grupo;
  select * into c from clubs where id = g.club_id;
  if not exists (select 1 from grupo_alumnos where grupo_id = p_grupo and alumno_id = auth.uid()) then
    raise exception 'No estás en esa clase.';
  end if;
  if extract(isodow from p_fecha) <> g.dia_semana then raise exception 'Ese día no hay clase.'; end if;
  if exists (select 1 from bajas where alumno_id = auth.uid() and grupo_id = p_grupo and fecha = p_fecha) then
    raise exception 'Ya te diste de baja.';
  end if;
  if now() > inicio_clase(g, p_fecha) - make_interval(hours => c.horas_antelacion_baja) then
    raise exception 'El plazo para darte de baja ya pasó.';
  end if;
  insert into bajas (club_id, alumno_id, grupo_id, fecha) values (g.club_id, auth.uid(), p_grupo, p_fecha)
    returning id into b_id;
  insert into creditos (club_id, alumno_id, baja_id, caduca)
    values (g.club_id, auth.uid(), b_id, p_fecha + c.dias_caducidad_recuperacion);
end $$;

create or replace function pedir_recuperacion(p_grupo uuid, p_fecha date)
returns void language plpgsql security definer set search_path = public as $$
declare g grupos; c clubs; u usuarios; cr uuid;
begin
  select * into u from usuarios where id = auth.uid();
  select * into g from grupos where id = p_grupo;
  select * into c from clubs where id = g.club_id;
  if u.rol <> 'alumno' or g.club_id <> u.club_id or g.nivel <> u.nivel then
    raise exception 'Esa clase no es de tu nivel.';
  end if;
  if extract(isodow from p_fecha) <> g.dia_semana or inicio_clase(g, p_fecha) <= now() then
    raise exception 'Esa clase ya no está disponible.';
  end if;
  if exists (select 1 from grupo_alumnos where grupo_id = p_grupo and alumno_id = u.id)
     or exists (select 1 from recuperaciones where grupo_id = p_grupo and fecha = p_fecha
                and alumno_id = u.id and estado <> 'rechazada') then
    raise exception 'Ya estás en esa clase.';
  end if;
  if ocupacion(p_grupo, p_fecha, true) >= c.max_alumnos_clase then
    raise exception 'Esa clase ya está completa.';
  end if;
  select k.id into cr from creditos k
   where k.alumno_id = u.id and not k.usado and k.caduca >= p_fecha
     and not exists (select 1 from recuperaciones r where r.credito_id = k.id and r.estado <> 'rechazada')
   order by k.caduca limit 1;
  if cr is null then raise exception 'No tienes recuperaciones disponibles para esa fecha.'; end if;
  insert into recuperaciones (club_id, alumno_id, credito_id, grupo_id, fecha)
    values (g.club_id, u.id, cr, p_grupo, p_fecha);
end $$;

create or replace function resolver_recuperacion(p_rec uuid, p_aprobar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r recuperaciones; g grupos; c clubs;
begin
  select * into r from recuperaciones where id = p_rec for update;
  select * into g from grupos where id = r.grupo_id;
  select * into c from clubs where id = g.club_id;
  if g.profe_id is distinct from auth.uid() then raise exception 'Esa clase no es tuya.'; end if;
  if r.estado <> 'pendiente' then raise exception 'La solicitud ya no está pendiente.'; end if;
  if p_aprobar then
    if ocupacion(r.grupo_id, r.fecha, false) >= c.max_alumnos_clase then
      raise exception 'La clase ya está completa.';
    end if;
    update creditos set usado = true where id = r.credito_id;
  end if;
  update recuperaciones set estado = case when p_aprobar then 'aprobada' else 'rechazada' end::estado_recuperacion
   where id = p_rec;
end $$;

create or replace function guardar_sesion(p_grupo uuid, p_fecha date, p_contenido text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from grupos where id = p_grupo and profe_id = auth.uid()) then
    raise exception 'Esa clase no es tuya.';
  end if;
  insert into sesiones (grupo_id, fecha, contenido) values (p_grupo, p_fecha, trim(p_contenido))
    on conflict (grupo_id, fecha) do update set contenido = excluded.contenido;
end $$;

-- Permisos: la app lee con el usuario conectado (filtrado por club) y escribe solo con estas funciones.
grant usage on schema public to anon, authenticated;
grant select on clubs, usuarios, grupos, grupo_alumnos, sesiones, bajas, creditos, recuperaciones to authenticated;
revoke all on function dar_baja, pedir_recuperacion, resolver_recuperacion, guardar_sesion, ocupacion from public, anon;
grant execute on function dar_baja, pedir_recuperacion, resolver_recuperacion, guardar_sesion to authenticated;
grant execute on function club_por_codigo to anon, authenticated;
