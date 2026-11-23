-- Ejecutar en el SQL Editor DESPUÉS de 02 y 03.
-- Añade: administradora general (ve y gestiona todos los clubs), fichas de alumno y funciones de gestión.

-- Máximo de alumnos por grupo (si está vacío, se usa el del club). Caducidad por defecto: 4 semanas.
alter table grupos add column if not exists max_alumnos int check (max_alumnos > 0);
alter table clubs alter column dias_caducidad_recuperacion set default 28;

create or replace function max_grupo(p_grupo uuid) returns int language sql stable security definer set search_path = public as
  $$ select coalesce(g.max_alumnos, c.max_alumnos_clase) from grupos g join clubs c on c.id = g.club_id where g.id = p_grupo $$;

-- Alumnos inactivos: no entran en la app y salen de sus grupos, pero se guarda su ficha
alter table usuarios add column if not exists activo boolean not null default true;

-- Las invitaciones de administración no llevan club
alter table invitaciones alter column club_id drop not null;
alter table invitaciones drop constraint if exists invitaciones_club_id_email_key;
create unique index if not exists invitaciones_email_unico on invitaciones (lower(email));

create or replace function es_admin() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from usuarios where id = auth.uid() and rol = 'admin') $$;

-- La administradora lo ve todo
create policy "admin" on clubs for select using (es_admin());
create policy "admin" on usuarios for select using (es_admin());
create policy "admin" on grupos for select using (es_admin());
create policy "admin" on grupo_alumnos for select using (es_admin());
create policy "admin" on sesiones for select using (es_admin());
create policy "admin" on bajas for select using (es_admin());
create policy "admin" on creditos for select using (es_admin());
create policy "admin" on recuperaciones for select using (es_admin());
create policy "admin" on invitaciones for select using (es_admin());
create policy "profes del club" on invitaciones for select using (
  club_id = mi_club() and exists (select 1 from usuarios where id = auth.uid() and rol = 'profe'));
grant select on invitaciones to authenticated;

-- Ficha de cada alumno: la escriben sus profes; el alumno la puede leer.
create table if not exists fichas (
  alumno_id uuid primary key references usuarios(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  lesiones text not null default '',
  trabajado text not null default '',
  a_trabajar text not null default '',
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references usuarios(id)
);
alter table fichas enable row level security;
create policy "propia" on fichas for select using (alumno_id = auth.uid());
create policy "profes del club" on fichas for select using (
  club_id = mi_club() and exists (select 1 from usuarios where id = auth.uid() and rol = 'profe'));
create policy "admin" on fichas for select using (es_admin());
grant select on fichas to authenticated;

-- Alta de administración (cambiar el email si hace falta)
insert into invitaciones (club_id, email, nombre, rol)
values (null, 'manu.gonzalez.almeida@gmail.com', 'Administración', 'admin')
on conflict do nothing;

-- El alta crea el usuario aunque no tenga club (administración)
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

create or replace function exigir_admin() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administración puede hacer esto.'; end if;
end $$;

-- Puede gestionar alumnos de un club: administración o un profe de ese club
create or replace function exigir_gestor(p_club uuid) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not (es_admin() or exists (select 1 from usuarios where id = auth.uid() and club_id = p_club and rol = 'profe' and activo)) then
    raise exception 'No puedes gestionar alumnos de este club.';
  end if;
end $$;

-- Crear o editar un club (p_id null = nuevo). Devuelve su id.
create or replace function admin_guardar_club(p_id uuid, p_nombre text, p_slug text, p_codigo text,
  p_horas int, p_dias int, p_max int) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform exigir_admin();
  if p_id is null then
    insert into clubs (nombre, slug, codigo_acceso, horas_antelacion_baja, dias_caducidad_recuperacion, max_alumnos_clase)
    values (trim(p_nombre), lower(trim(p_slug)), upper(trim(p_codigo)), p_horas, p_dias, p_max) returning id into v;
  else
    update clubs set nombre = trim(p_nombre), slug = lower(trim(p_slug)), codigo_acceso = upper(trim(p_codigo)),
      horas_antelacion_baja = p_horas, dias_caducidad_recuperacion = p_dias, max_alumnos_clase = p_max
    where id = p_id returning id into v;
  end if;
  return v;
end $$;

-- Crear o editar un grupo (p_id null = nuevo). El profe va por email: si aún no ha entrado nunca,
-- se le asigna el grupo en cuanto entre por primera vez.
create or replace function admin_guardar_grupo(p_id uuid, p_club uuid, p_nombre text, p_nivel text, p_dia int,
  p_hora time, p_duracion int, p_pista text, p_profe_email text, p_max int default null) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid; prof uuid; e text := lower(trim(coalesce(p_profe_email, '')));
begin
  perform exigir_admin();
  if e <> '' then
    select id into prof from usuarios where lower(email) = e and club_id = p_club and rol = 'profe';
    if prof is null and not exists (select 1 from invitaciones where lower(email) = e and club_id = p_club and rol = 'profe') then
      raise exception 'Ese profe no es de este club.';
    end if;
  end if;
  if p_id is null then
    insert into grupos (club_id, nombre, nivel, dia_semana, hora_inicio, duracion_min, pista, profe_id, max_alumnos)
    values (p_club, trim(p_nombre), trim(p_nivel), p_dia, p_hora, p_duracion, trim(p_pista), prof, p_max) returning id into v;
  else
    update grupos set nombre = trim(p_nombre), nivel = trim(p_nivel), dia_semana = p_dia, hora_inicio = p_hora,
      duracion_min = p_duracion, pista = trim(p_pista), profe_id = prof, max_alumnos = p_max
    where id = p_id and club_id = p_club returning id into v;
  end if;
  -- Recordar el grupo en la invitación del profe (y quitarlo de las demás)
  update invitaciones set grupos = array_remove(grupos, v) where club_id = p_club and rol = 'profe';
  if e <> '' then
    update invitaciones set grupos = array(select distinct unnest(grupos || v)) where lower(email) = e and club_id = p_club;
  end if;
end $$;

create or replace function admin_borrar_grupo(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  delete from grupos where id = p_id;
end $$;

-- Dar de alta a una persona en un club. Entra con su email; si ya existe, se actualizan sus datos.
create or replace function admin_alta(p_club uuid, p_email text, p_nombre text, p_rol rol, p_nivel text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  perform exigir_gestor(p_club);
  if p_rol = 'admin' then raise exception 'Las altas de administración se hacen aparte.'; end if;
  if p_rol = 'profe' and not es_admin() then raise exception 'Solo administración puede dar de alta profes.'; end if;
  insert into invitaciones (club_id, email, nombre, rol, nivel)
  values (p_club, e, trim(p_nombre), p_rol, nullif(trim(p_nivel), ''))
  on conflict ((lower(email))) do update set nombre = excluded.nombre, rol = excluded.rol, nivel = excluded.nivel
    where invitaciones.club_id = p_club;
  if not found then raise exception 'Ese email ya está dado de alta en otro club.'; end if;
  update usuarios set nombre = trim(p_nombre), rol = p_rol, nivel = nullif(trim(p_nivel), '')
   where lower(email) = e and club_id = p_club;
end $$;

-- Meter o sacar a un alumno de un grupo (sirve también antes de que entre por primera vez)
create or replace function admin_grupo_alumno(p_grupo uuid, p_email text, p_dentro boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); u uuid; c uuid;
begin
  select club_id into c from grupos where id = p_grupo;
  perform exigir_gestor(c);
  select id into u from usuarios where lower(email) = e and club_id = c;
  if p_dentro then
    update invitaciones set grupos = array(select distinct unnest(grupos || p_grupo)) where lower(email) = e and club_id = c;
    if u is not null then insert into grupo_alumnos values (p_grupo, u) on conflict do nothing; end if;
  else
    update invitaciones set grupos = array_remove(grupos, p_grupo) where lower(email) = e and club_id = c;
    if u is not null then delete from grupo_alumnos where grupo_id = p_grupo and alumno_id = u; end if;
  end if;
end $$;

-- Quitar a una persona del club (se borra su acceso y sus datos de este club)
create or replace function admin_baja_persona(p_club uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  perform exigir_admin();
  delete from invitaciones where lower(email) = e and club_id = p_club;
  delete from auth.users where id in (select id from usuarios where lower(email) = e and club_id = p_club);
end $$;

-- Ficha del alumno: la guarda un profe de su club
create or replace function guardar_ficha(p_alumno uuid, p_lesiones text, p_trabajado text, p_a_trabajar text) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select club_id into c from usuarios where id = p_alumno and rol = 'alumno';
  if c is null or not exists (select 1 from usuarios where id = auth.uid() and club_id = c and rol = 'profe') then
    raise exception 'Solo los profes del club pueden editar la ficha.';
  end if;
  insert into fichas (alumno_id, club_id, lesiones, trabajado, a_trabajar, actualizado_por)
  values (p_alumno, c, trim(p_lesiones), trim(p_trabajado), trim(p_a_trabajar), auth.uid())
  on conflict (alumno_id) do update set lesiones = excluded.lesiones, trabajado = excluded.trabajado,
    a_trabajar = excluded.a_trabajar, actualizado_en = now(), actualizado_por = auth.uid();
end $$;

-- Activar o desactivar a un alumno. Al desactivarlo sale de sus grupos y no puede entrar.
create or replace function cambiar_activo(p_club uuid, p_email text, p_activo boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); u usuarios;
begin
  perform exigir_gestor(p_club);
  select * into u from usuarios where lower(email) = e and club_id = p_club;
  if u.id is not null and u.rol <> 'alumno' and not es_admin() then raise exception 'Solo puedes cambiar alumnos.'; end if;
  update usuarios set activo = p_activo where id = u.id;
  if not p_activo then
    delete from grupo_alumnos where alumno_id = u.id;
    update invitaciones set grupos = '{}' where lower(email) = e and club_id = p_club;
  end if;
end $$;

-- El profe pone el máximo de alumnos de sus grupos
create or replace function profe_max_grupo(p_grupo uuid, p_max int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from grupos where id = p_grupo and (profe_id = auth.uid() or es_admin())) then
    raise exception 'Esa clase no es tuya.';
  end if;
  update grupos set max_alumnos = greatest(1, p_max) where id = p_grupo;
end $$;

-- Las recuperaciones usan el máximo de cada grupo
create or replace function pedir_recuperacion(p_grupo uuid, p_fecha date)
returns void language plpgsql security definer set search_path = public as $$
declare g grupos; u usuarios; cr uuid;
begin
  select * into u from usuarios where id = auth.uid();
  select * into g from grupos where id = p_grupo;
  if u.rol <> 'alumno' or not u.activo or g.club_id <> u.club_id or g.nivel <> u.nivel then
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
  if ocupacion(p_grupo, p_fecha, true) >= max_grupo(p_grupo) then
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
declare r recuperaciones; g grupos;
begin
  select * into r from recuperaciones where id = p_rec for update;
  select * into g from grupos where id = r.grupo_id;
  if g.profe_id is distinct from auth.uid() then raise exception 'Esa clase no es tuya.'; end if;
  if r.estado <> 'pendiente' then raise exception 'La solicitud ya no está pendiente.'; end if;
  if p_aprobar then
    if ocupacion(r.grupo_id, r.fecha, false) >= max_grupo(r.grupo_id) then
      raise exception 'La clase ya está completa.';
    end if;
    update creditos set usado = true where id = r.credito_id;
  end if;
  update recuperaciones set estado = case when p_aprobar then 'aprobada' else 'rechazada' end::estado_recuperacion
   where id = p_rec;
end $$;

revoke all on function profe_max_grupo, max_grupo from public, anon;
grant execute on function profe_max_grupo to authenticated;

revoke all on function exigir_admin, exigir_gestor, cambiar_activo, admin_guardar_club, admin_guardar_grupo, admin_borrar_grupo, admin_alta,
  admin_grupo_alumno, admin_baja_persona, guardar_ficha from public, anon;
grant execute on function cambiar_activo, admin_guardar_club, admin_guardar_grupo, admin_borrar_grupo, admin_alta,
  admin_grupo_alumno, admin_baja_persona, guardar_ficha, es_admin to authenticated;
