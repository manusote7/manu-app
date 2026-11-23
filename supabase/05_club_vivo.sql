-- Ejecutar en el SQL Editor DESPUÉS de 04_admin.sql.
-- Añade: pasar lista, cancelar clases, notas privadas, marca del club, tablón de anuncios y avisos en la app.

-- ---------- Marca y reglas del club ----------
alter table clubs add column if not exists color text;            -- color principal, ej. #123F6B
alter table clubs add column if not exists cancelar_da_recuperacion boolean not null default true;

create or replace function admin_marca_club(p_club uuid, p_color text, p_logo text, p_cancelar_recupera boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  if p_color is not null and p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'El color tiene que ser como #123F6B.'; end if;
  update clubs set color = nullif(p_color, ''), logo_url = nullif(trim(p_logo), ''), cancelar_da_recuperacion = p_cancelar_recupera
   where id = p_club;
end $$;

-- ---------- Avisos dentro de la app ----------
create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  texto text not null,
  enlace text,
  leido boolean not null default false,
  creado_en timestamptz not null default now()
);
create index if not exists avisos_usuario on avisos (usuario_id, creado_en desc);
alter table avisos enable row level security;
create policy "propios" on avisos for select using (usuario_id = auth.uid());
grant select on avisos to authenticated;

create or replace function avisar(p_usuario uuid, p_texto text, p_enlace text) returns void
language sql security definer set search_path = public as $$
  insert into avisos (usuario_id, texto, enlace) select p_usuario, p_texto, p_enlace where p_usuario is not null
$$;

create or replace function marcar_avisos_leidos() returns void
language sql security definer set search_path = public as $$
  update avisos set leido = true where usuario_id = auth.uid() and not leido
$$;

create or replace function fecha_corta(d date) returns text language sql immutable as $$
  select (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from d)::int]
         || ' ' || extract(day from d)::int
$$;

-- Avisos automáticos de recuperaciones
create or replace function avisos_recuperacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare g grupos; nombre text;
begin
  select * into g from grupos where id = new.grupo_id;
  select u.nombre into nombre from usuarios u where u.id = new.alumno_id;
  if tg_op = 'INSERT' then
    perform avisar(g.profe_id, nombre || ' pide recuperar en ' || g.nombre || ' el ' || fecha_corta(new.fecha), '/semana?d=' || new.fecha);
  elsif new.estado <> old.estado and new.estado in ('aprobada', 'rechazada') then
    perform avisar(new.alumno_id,
      case when new.estado = 'aprobada' then 'Te han aprobado la recuperación: ' else 'No hay plaza para tu recuperación: ' end
      || g.nombre || ', ' || fecha_corta(new.fecha) || ' a las ' || to_char(g.hora_inicio, 'HH24:MI'),
      '/semana?d=' || new.fecha);
  end if;
  return new;
end $$;
drop trigger if exists al_cambiar_recuperacion on recuperaciones;
create trigger al_cambiar_recuperacion after insert or update on recuperaciones
  for each row execute function avisos_recuperacion();

-- ---------- Pasar lista ----------
create table if not exists asistencias (
  grupo_id uuid not null references grupos(id) on delete cascade,
  fecha date not null,
  alumno_id uuid not null references usuarios(id) on delete cascade,
  presente boolean not null,
  primary key (grupo_id, fecha, alumno_id)
);
alter table asistencias enable row level security;
create policy "club propio" on asistencias for select
  using (exists (select 1 from grupos g where g.id = grupo_id and g.club_id = mi_club()));
create policy "admin" on asistencias for select using (es_admin());
grant select on asistencias to authenticated;

-- p_presentes: los que han venido; el resto de la lista queda como ausente
create or replace function pasar_lista(p_grupo uuid, p_fecha date, p_lista uuid[], p_presentes uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from grupos where id = p_grupo and profe_id = auth.uid()) then
    raise exception 'Esa clase no es tuya.';
  end if;
  insert into asistencias (grupo_id, fecha, alumno_id, presente)
    select p_grupo, p_fecha, a, a = any(p_presentes) from unnest(p_lista) a
  on conflict (grupo_id, fecha, alumno_id) do update set presente = excluded.presente;
end $$;

-- ---------- Cancelar una clase ----------
create table if not exists cancelaciones (
  grupo_id uuid not null references grupos(id) on delete cascade,
  fecha date not null,
  motivo text,
  creado_en timestamptz not null default now(),
  primary key (grupo_id, fecha)
);
alter table cancelaciones enable row level security;
create policy "club propio" on cancelaciones for select
  using (exists (select 1 from grupos g where g.id = grupo_id and g.club_id = mi_club()));
create policy "admin" on cancelaciones for select using (es_admin());
grant select on cancelaciones to authenticated;

-- Avisa a los alumnos y, si el club lo tiene así, les da una recuperación a cada uno
create or replace function cancelar_clase(p_grupo uuid, p_fecha date, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare g grupos; c clubs; a uuid; b uuid;
begin
  select * into g from grupos where id = p_grupo;
  select * into c from clubs where id = g.club_id;
  if g.profe_id is distinct from auth.uid() and not es_admin() then raise exception 'Esa clase no es tuya.'; end if;
  if extract(isodow from p_fecha) <> g.dia_semana then raise exception 'Ese día no hay clase.'; end if;
  insert into cancelaciones (grupo_id, fecha, motivo) values (p_grupo, p_fecha, nullif(trim(p_motivo), ''));
  for a in
    select alumno_id from grupo_alumnos where grupo_id = p_grupo
      and alumno_id not in (select alumno_id from bajas where grupo_id = p_grupo and fecha = p_fecha)
    union select alumno_id from recuperaciones where grupo_id = p_grupo and fecha = p_fecha and estado = 'aprobada'
  loop
    b := null;
    if c.cancelar_da_recuperacion then
      insert into bajas (club_id, alumno_id, grupo_id, fecha) values (g.club_id, a, p_grupo, p_fecha)
        on conflict (alumno_id, grupo_id, fecha) do nothing returning id into b;
      if b is not null then
        insert into creditos (club_id, alumno_id, baja_id, caduca) values (g.club_id, a, b, p_fecha + c.dias_caducidad_recuperacion);
      end if;
    end if;
    perform avisar(a, 'Se cancela ' || g.nombre || ' del ' || fecha_corta(p_fecha)
      || case when c.cancelar_da_recuperacion then '. Tienes una recuperación.' else '.' end
      || coalesce(' Motivo: ' || nullif(trim(p_motivo), ''), ''), '/semana?d=' || p_fecha);
  end loop;
  -- Las recuperaciones pedidas para ese día quedan rechazadas (y su crédito libre)
  update recuperaciones set estado = 'rechazada' where grupo_id = p_grupo and fecha = p_fecha and estado = 'pendiente';
end $$;

-- ---------- Notas privadas del profe (el alumno no las ve) ----------
create table if not exists notas_privadas (
  alumno_id uuid primary key references usuarios(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  texto text not null default ''
);
alter table notas_privadas enable row level security;
create policy "profes del club" on notas_privadas for select using (
  club_id = mi_club() and exists (select 1 from usuarios where id = auth.uid() and rol = 'profe'));
create policy "admin" on notas_privadas for select using (es_admin());
grant select on notas_privadas to authenticated;

create or replace function guardar_notas_privadas(p_alumno uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select club_id into c from usuarios where id = p_alumno and rol = 'alumno';
  if c is null or not exists (select 1 from usuarios where id = auth.uid() and club_id = c and rol = 'profe') then
    raise exception 'Solo los profes del club pueden editar la ficha.';
  end if;
  insert into notas_privadas (alumno_id, club_id, texto) values (p_alumno, c, trim(p_texto))
    on conflict (alumno_id) do update set texto = excluded.texto;
end $$;

-- ---------- Tablón de anuncios del club ----------
create table if not exists anuncios (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  autor_id uuid references usuarios(id) on delete set null,
  texto text not null,
  creado_en timestamptz not null default now()
);
alter table anuncios enable row level security;
create policy "club propio" on anuncios for select using (club_id = mi_club());
create policy "admin" on anuncios for select using (es_admin());
grant select on anuncios to authenticated;

create or replace function publicar_anuncio(p_club uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  if not (es_admin() or exists (select 1 from usuarios where id = auth.uid() and club_id = p_club and rol = 'profe')) then
    raise exception 'Solo profes y administración pueden publicar.';
  end if;
  if length(trim(p_texto)) = 0 then raise exception 'Escribe el anuncio.'; end if;
  insert into anuncios (club_id, autor_id, texto) values (p_club, auth.uid(), trim(p_texto));
  for a in select id from usuarios where club_id = p_club and activo and id <> auth.uid() loop
    perform avisar(a, 'Nuevo anuncio: ' || left(trim(p_texto), 80), '/semana');
  end loop;
end $$;

create or replace function borrar_anuncio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from anuncios where id = p_id and (autor_id = auth.uid() or es_admin());
end $$;

revoke all on function admin_marca_club, avisar, marcar_avisos_leidos, avisos_recuperacion, pasar_lista, cancelar_clase,
  guardar_notas_privadas, publicar_anuncio, borrar_anuncio from public, anon;
grant execute on function admin_marca_club, marcar_avisos_leidos, pasar_lista, cancelar_clase,
  guardar_notas_privadas, publicar_anuncio, borrar_anuncio to authenticated;
