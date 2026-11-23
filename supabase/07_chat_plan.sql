-- Ejecutar en el SQL Editor DESPUÉS de 06_niveles.sql.
-- Añade: colocar a un alumno en otra clase, chat de clase y plan de temporada por nivel.
-- (Las estadísticas y los recordatorios del día antes se calculan en la app: no necesitan tablas.)

-- ---------- Colocar a un alumno en una clase (lo hace el profesor) ----------
-- Si el alumno tiene una recuperación disponible se gasta; si no, se le coloca igualmente.
alter table recuperaciones alter column credito_id drop not null;

create or replace function colocar_alumno(p_grupo uuid, p_fecha date, p_alumno uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g grupos; a usuarios; cr uuid; pend uuid;
begin
  select * into g from grupos where id = p_grupo;
  if g.id is null or (g.profe_id is distinct from auth.uid() and not es_admin()) then raise exception 'Esa clase no es tuya.'; end if;
  select * into a from usuarios where id = p_alumno;
  if a.id is null or a.rol <> 'alumno' or a.club_id <> g.club_id or not a.activo then raise exception 'Ese alumno no es de este club.'; end if;
  if a.nivel is distinct from g.nivel then raise exception 'Ese alumno no es de este nivel.'; end if;
  if extract(isodow from p_fecha) <> g.dia_semana or inicio_clase(g, p_fecha) <= now() then raise exception 'Esa clase ya no está disponible.'; end if;
  if exists (select 1 from cancelaciones where grupo_id = p_grupo and fecha = p_fecha) then raise exception 'Esa clase está cancelada.'; end if;
  if exists (select 1 from grupo_alumnos where grupo_id = p_grupo and alumno_id = p_alumno) then raise exception 'Ese alumno ya es de este grupo.'; end if;
  if exists (select 1 from recuperaciones where grupo_id = p_grupo and fecha = p_fecha and alumno_id = p_alumno and estado = 'aprobada') then
    raise exception 'Ese alumno ya viene a esta clase.';
  end if;
  if ocupacion(p_grupo, p_fecha, false) >= max_grupo(p_grupo) then raise exception 'La clase ya está completa.'; end if;
  -- Si ya lo había pedido él, se aprueba esa solicitud
  select id into pend from recuperaciones where grupo_id = p_grupo and fecha = p_fecha and alumno_id = p_alumno and estado = 'pendiente';
  if pend is not null then
    update creditos set usado = true where id = (select credito_id from recuperaciones where id = pend);
    update recuperaciones set estado = 'aprobada' where id = pend;
    return;
  end if;
  select k.id into cr from creditos k
   where k.alumno_id = p_alumno and not k.usado and k.caduca >= p_fecha
     and not exists (select 1 from recuperaciones r where r.credito_id = k.id and r.estado <> 'rechazada')
   order by k.caduca limit 1;
  if cr is not null then update creditos set usado = true where id = cr; end if;
  insert into recuperaciones (club_id, alumno_id, credito_id, grupo_id, fecha, estado)
    values (g.club_id, p_alumno, cr, p_grupo, p_fecha, 'aprobada');
end $$;

-- Avisos de recuperaciones: ahora también cuando el profesor coloca a alguien
create or replace function avisos_recuperacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare g grupos; nombre text;
begin
  select * into g from grupos where id = new.grupo_id;
  select u.nombre into nombre from usuarios u where u.id = new.alumno_id;
  if tg_op = 'INSERT' and new.estado = 'pendiente' then
    perform avisar(g.profe_id, nombre || ' pide recuperar en ' || g.nombre || ' el ' || fecha_corta(new.fecha), '/semana?d=' || new.fecha);
  elsif tg_op = 'INSERT' and new.estado = 'aprobada' then
    perform avisar(new.alumno_id, 'Tu profesor te ha puesto en ' || g.nombre || ', ' || fecha_corta(new.fecha)
      || ' a las ' || to_char(g.hora_inicio, 'HH24:MI'), '/semana?d=' || new.fecha);
  elsif tg_op = 'UPDATE' and new.estado <> old.estado and new.estado in ('aprobada', 'rechazada') then
    perform avisar(new.alumno_id,
      case when new.estado = 'aprobada' then 'Te han aprobado la recuperación: ' else 'No hay plaza para tu recuperación: ' end
      || g.nombre || ', ' || fecha_corta(new.fecha) || ' a las ' || to_char(g.hora_inicio, 'HH24:MI'),
      '/semana?d=' || new.fecha);
  end if;
  return new;
end $$;

-- ---------- Chat de clase (uno por grupo: su profesor y sus alumnos) ----------
create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  autor_id uuid references usuarios(id) on delete set null,
  texto text not null,
  creado_en timestamptz not null default now()
);
create index if not exists mensajes_grupo on mensajes (grupo_id, creado_en desc);

create or replace function es_del_grupo(p_grupo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from grupo_alumnos ga join usuarios u on u.id = ga.alumno_id
                  where ga.grupo_id = p_grupo and ga.alumno_id = auth.uid() and u.activo)
      or exists (select 1 from grupos where id = p_grupo and profe_id = auth.uid())
$$;

alter table mensajes enable row level security;
drop policy if exists "del grupo" on mensajes;
create policy "del grupo" on mensajes for select using (es_del_grupo(grupo_id) or es_admin());
grant select on mensajes to authenticated;

create or replace function enviar_mensaje(p_grupo uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (es_del_grupo(p_grupo) or es_admin()) then raise exception 'No eres de este grupo.'; end if;
  if length(trim(p_texto)) = 0 then raise exception 'Escribe un mensaje.'; end if;
  if length(p_texto) > 1000 then raise exception 'El mensaje es demasiado largo.'; end if;
  insert into mensajes (grupo_id, autor_id, texto) values (p_grupo, auth.uid(), trim(p_texto));
end $$;

create or replace function borrar_mensaje(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from mensajes m where m.id = p_id
    and (m.autor_id = auth.uid() or es_admin() or exists (select 1 from grupos g where g.id = m.grupo_id and g.profe_id = auth.uid()));
end $$;

-- ---------- Plan de temporada: contenidos de cada semana por nivel ----------
create table if not exists plan_semanas (
  club_id uuid not null references clubs(id) on delete cascade,
  nivel text not null,
  semana date not null, -- lunes de la semana
  contenido text not null,
  primary key (club_id, nivel, semana)
);
alter table plan_semanas enable row level security;
drop policy if exists "club propio" on plan_semanas;
drop policy if exists "admin" on plan_semanas;
create policy "club propio" on plan_semanas for select using (club_id = mi_club());
create policy "admin" on plan_semanas for select using (es_admin());
grant select on plan_semanas to authenticated;

-- Guarda varias semanas a la vez; un texto vacío borra esa semana
create or replace function guardar_plan(p_club uuid, p_nivel text, p_semanas date[], p_textos text[]) returns void
language plpgsql security definer set search_path = public as $$
declare i int;
begin
  if not (es_admin() or exists (select 1 from usuarios where id = auth.uid() and club_id = p_club and rol = 'profe' and activo)) then
    raise exception 'Solo los profesores del club pueden editar el plan.';
  end if;
  if coalesce(array_length(p_semanas, 1), 0) <> coalesce(array_length(p_textos, 1), 0) then raise exception 'Datos del plan incompletos.'; end if;
  for i in 1 .. coalesce(array_length(p_semanas, 1), 0) loop
    if length(trim(p_textos[i])) = 0 then
      delete from plan_semanas where club_id = p_club and nivel = p_nivel and semana = p_semanas[i];
    else
      insert into plan_semanas (club_id, nivel, semana, contenido) values (p_club, p_nivel, p_semanas[i], trim(p_textos[i]))
        on conflict (club_id, nivel, semana) do update set contenido = excluded.contenido;
    end if;
  end loop;
end $$;

-- Al renombrar un nivel, su plan pasa al nombre nuevo
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
      update plan_semanas set nivel = n where club_id = p_club and nivel = antes;
    end if;
  end if;
end $$;

revoke all on function colocar_alumno, es_del_grupo, enviar_mensaje, borrar_mensaje, guardar_plan from public, anon;
grant execute on function colocar_alumno, es_del_grupo, enviar_mensaje, borrar_mensaje, guardar_plan to authenticated;

-- ---------- Panel de negocio de administración: lo que paga cada club ----------
-- Tabla aparte para que solo la vea administración (los clubs no ven sus cuotas por la API)
create table if not exists club_cuotas (
  club_id uuid primary key references clubs(id) on delete cascade,
  mensual numeric(8,2),
  alta numeric(8,2),
  cliente_desde date
);
alter table club_cuotas enable row level security;
drop policy if exists "admin" on club_cuotas;
create policy "admin" on club_cuotas for select using (es_admin());
grant select on club_cuotas to authenticated;

create or replace function admin_cuota_club(p_club uuid, p_mensual numeric, p_alta numeric, p_desde date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  insert into club_cuotas (club_id, mensual, alta, cliente_desde) values (p_club, p_mensual, p_alta, p_desde)
    on conflict (club_id) do update set mensual = excluded.mensual, alta = excluded.alta, cliente_desde = excluded.cliente_desde;
end $$;
revoke all on function admin_cuota_club from public, anon;
grant execute on function admin_cuota_club to authenticated;
