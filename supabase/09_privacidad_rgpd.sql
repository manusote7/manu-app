-- Ejecutar en el SQL Editor DESPUÉS de 07_chat_plan.sql (y después de publicar la app que lo usa).
-- Privacidad entre alumnos, bloqueo de inactivos, recuperación automática, deshacer baja y RGPD.

-- ---------- Quién soy (solo si estoy activo) ----------
-- Un usuario inactivo deja de pertenecer a su club a efectos de lectura: no ve nada del club.
create or replace function mi_club() returns uuid language sql stable security definer set search_path = public as
  $$ select club_id from usuarios where id = auth.uid() and activo $$;

create or replace function mi_rol() returns rol language sql stable security definer set search_path = public as
  $$ select rol from usuarios where id = auth.uid() and activo $$;

-- ¿Comparto grupo con esta persona? (para ver el nombre de los compañeros)
create or replace function comparto_grupo(p_otro uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from grupo_alumnos a join grupo_alumnos b on b.grupo_id = a.grupo_id
                  where a.alumno_id = auth.uid() and b.alumno_id = p_otro)
$$;

-- ---------- Usuarios: cada uno ve lo justo ----------
-- Profesores: todo su club. Alumnos: ellos mismos, los profesores y sus compañeros de grupo. Nadie ve emails ajenos
-- salvo profesores (de su club) y administración, a través de emails_visibles().
drop policy if exists "club propio" on usuarios;
drop policy if exists "propio" on usuarios;
drop policy if exists "club segun rol" on usuarios;
create policy "propio" on usuarios for select using (id = auth.uid());
create policy "club segun rol" on usuarios for select using (
  club_id = mi_club() and (mi_rol() = 'profe' or rol = 'profe' or comparto_grupo(id)));

revoke select on usuarios from anon, authenticated;
grant select (id, club_id, nombre, rol, nivel, activo) on usuarios to authenticated;

create or replace function emails_visibles() returns table (id uuid, email text)
language sql stable security definer set search_path = public as $$
  select u.id, u.email from usuarios u
   where u.id = auth.uid() or es_admin() or (mi_rol() = 'profe' and u.club_id = mi_club())
$$;

-- ---------- Asistencias y créditos: solo los propios (o el profesorado del club) ----------
drop policy if exists "club propio" on asistencias;
drop policy if exists "propias o profesorado" on asistencias;
create policy "propias o profesorado" on asistencias for select using (
  alumno_id = auth.uid() or (mi_rol() = 'profe' and exists (select 1 from grupos g where g.id = grupo_id and g.club_id = mi_club())));

drop policy if exists "club propio" on creditos;
drop policy if exists "propios o profesorado" on creditos;
create policy "propios o profesorado" on creditos for select using (
  alumno_id = auth.uid() or (mi_rol() = 'profe' and club_id = mi_club()));

-- ---------- Recuperación automática si hay hueco (ajuste por club) ----------
alter table clubs add column if not exists recuperacion_automatica boolean not null default true;

create or replace function pedir_recuperacion(p_grupo uuid, p_fecha date)
returns void language plpgsql security definer set search_path = public as $$
declare g grupos; u usuarios; c clubs; cr uuid; r uuid;
begin
  select * into u from usuarios where id = auth.uid();
  select * into g from grupos where id = p_grupo;
  select * into c from clubs where id = g.club_id;
  if u.rol <> 'alumno' or not u.activo or g.club_id <> u.club_id or g.nivel <> u.nivel then
    raise exception 'Esa clase no es de tu nivel.';
  end if;
  if extract(isodow from p_fecha) <> g.dia_semana or inicio_clase(g, p_fecha) <= now() then
    raise exception 'Esa clase ya no está disponible.';
  end if;
  if exists (select 1 from cancelaciones where grupo_id = p_grupo and fecha = p_fecha) then
    raise exception 'Esa clase está cancelada.';
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
     and not exists (select 1 from recuperaciones x where x.credito_id = k.id and x.estado <> 'rechazada')
   order by k.caduca limit 1;
  if cr is null then raise exception 'No tienes recuperaciones disponibles para esa fecha.'; end if;
  insert into recuperaciones (club_id, alumno_id, credito_id, grupo_id, fecha)
    values (g.club_id, u.id, cr, p_grupo, p_fecha) returning id into r;
  -- Con hueco y el club en automático, la plaza queda confirmada al momento
  if c.recuperacion_automatica and ocupacion(p_grupo, p_fecha, false) < max_grupo(p_grupo) then
    update creditos set usado = true where id = cr;
    update recuperaciones set estado = 'aprobada' where id = r;
  end if;
end $$;

-- Avisos: en automático, al profesor se le dice que viene alguien (no que lo pide)
create or replace function avisos_recuperacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare g grupos; nombre text; auto boolean;
begin
  select * into g from grupos where id = new.grupo_id;
  select u.nombre into nombre from usuarios u where u.id = new.alumno_id;
  select recuperacion_automatica into auto from clubs where id = g.club_id;
  if tg_op = 'INSERT' and new.estado = 'pendiente' then
    perform avisar(g.profe_id, nombre || case when auto then ' viene a recuperar a ' else ' pide recuperar en ' end
      || g.nombre || ' el ' || fecha_corta(new.fecha), '/semana?d=' || new.fecha);
  elsif tg_op = 'INSERT' and new.estado = 'aprobada' then
    perform avisar(new.alumno_id, 'Tu profesor te ha puesto en ' || g.nombre || ', ' || fecha_corta(new.fecha)
      || ' a las ' || to_char(g.hora_inicio, 'HH24:MI'), '/semana?d=' || new.fecha);
  elsif tg_op = 'UPDATE' and new.estado <> old.estado and new.estado in ('aprobada', 'rechazada') then
    perform avisar(new.alumno_id,
      case when new.estado = 'aprobada' then 'Plaza confirmada para recuperar: ' else 'No hay plaza para tu recuperación: ' end
      || g.nombre || ', ' || fecha_corta(new.fecha) || ' a las ' || to_char(g.hora_inicio, 'HH24:MI'),
      '/semana?d=' || new.fecha);
  end if;
  return new;
end $$;

create or replace function admin_ajustes_club(p_club uuid, p_recuperacion_automatica boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  update clubs set recuperacion_automatica = p_recuperacion_automatica where id = p_club;
end $$;

-- ---------- Deshacer "No puedo ir" (dentro del plazo y si no se ha usado la recuperación) ----------
create or replace function deshacer_baja(p_grupo uuid, p_fecha date) returns void
language plpgsql security definer set search_path = public as $$
declare g grupos; c clubs; b bajas; k creditos;
begin
  select * into g from grupos where id = p_grupo;
  select * into c from clubs where id = g.club_id;
  select * into b from bajas where grupo_id = p_grupo and fecha = p_fecha and alumno_id = auth.uid();
  if b.id is null then raise exception 'No tienes baja en esa clase.'; end if;
  if exists (select 1 from cancelaciones where grupo_id = p_grupo and fecha = p_fecha) then raise exception 'Esa clase está cancelada.'; end if;
  if now() > inicio_clase(g, p_fecha) - make_interval(hours => c.horas_antelacion_baja) then raise exception 'Ya ha pasado el plazo.'; end if;
  select * into k from creditos where baja_id = b.id;
  if k.usado or exists (select 1 from recuperaciones r where r.credito_id = k.id and r.estado <> 'rechazada') then
    raise exception 'Ya has usado esa recuperación en otra clase.';
  end if;
  delete from bajas where id = b.id; -- borra también su crédito
end $$;

-- ---------- RGPD: consentimiento ----------
create table if not exists consentimientos (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  version text not null,
  aceptado_en timestamptz not null default now(),
  menor14 boolean not null default false,
  tutor text  -- nombre de madre/padre/tutor si es menor de 14
);
alter table consentimientos enable row level security;
drop policy if exists "propio" on consentimientos;
drop policy if exists "admin" on consentimientos;
create policy "propio" on consentimientos for select using (usuario_id = auth.uid());
create policy "admin" on consentimientos for select using (es_admin());
grant select on consentimientos to authenticated;

create or replace function aceptar_privacidad(p_version text, p_menor14 boolean, p_tutor text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_menor14 and length(trim(coalesce(p_tutor, ''))) < 3 then
    raise exception 'Si eres menor de 14 años, escribe el nombre de tu madre, padre o tutor.';
  end if;
  insert into consentimientos (usuario_id, version, menor14, tutor) values (auth.uid(), p_version, p_menor14, nullif(trim(p_tutor), ''))
    on conflict (usuario_id) do update set version = excluded.version, aceptado_en = now(), menor14 = excluded.menor14, tutor = excluded.tutor;
end $$;

-- ---------- Poder borrar profesores: sus grupos se quedan sin profesor (antes lo impedía) ----------
alter table grupos drop constraint if exists grupos_profe_id_fkey;
alter table grupos add constraint grupos_profe_id_fkey foreign key (profe_id) references usuarios(id) on delete set null;
alter table fichas drop constraint if exists fichas_actualizado_por_fkey;
alter table fichas add constraint fichas_actualizado_por_fkey foreign key (actualizado_por) references usuarios(id) on delete set null;

-- ---------- RGPD: borrar todos los datos de una persona ----------
-- Al borrar la cuenta se borra en cascada todo lo suyo (grupos, bajas, recuperaciones, fichas, notas, avisos...).
create or replace function admin_baja_persona(p_club uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); ids uuid[];
begin
  perform exigir_admin();
  select array_agg(id) into ids from usuarios where lower(email) = e and club_id = p_club;
  delete from mensajes where autor_id = any(ids);
  delete from anuncios where autor_id = any(ids);
  delete from invitaciones where lower(email) = e and club_id = p_club;
  delete from auth.users where id = any(ids);
end $$;

revoke all on function mi_rol, comparto_grupo, emails_visibles, admin_ajustes_club, deshacer_baja, aceptar_privacidad from public, anon;
grant execute on function mi_rol, comparto_grupo, emails_visibles, admin_ajustes_club, deshacer_baja, aceptar_privacidad to authenticated;

-- ---------- Borrar un club entero (solo administración, escribiendo su nombre) ----------
create or replace function admin_borrar_club(p_club uuid, p_confirmar_nombre text) returns void
language plpgsql security definer set search_path = public as $$
declare c clubs;
begin
  perform exigir_admin();
  select * into c from clubs where id = p_club;
  if c.id is null then raise exception 'Ese club no existe.'; end if;
  if trim(p_confirmar_nombre) <> c.nombre then raise exception 'Escribe el nombre exacto del club para confirmar.'; end if;
  -- Primero las cuentas de su gente (borra en cascada todo lo suyo), luego el club y todo lo que cuelga de él
  delete from auth.users where id in (select id from usuarios where club_id = p_club and rol <> 'admin');
  delete from invitaciones where club_id = p_club;
  delete from clubs where id = p_club;
end $$;
revoke all on function admin_borrar_club from public, anon;
grant execute on function admin_borrar_club to authenticated;
