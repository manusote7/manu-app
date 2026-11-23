-- Esquema base multi-club. Cada fila lleva club_id para separar clubs.

create table clubs (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  color text,
  -- Reglas editables por club (o por la administradora)
  horas_antelacion_baja int not null default 6,
  dias_caducidad_recuperacion int not null default 21,
  max_alumnos_clase int not null default 4,
  creado_en timestamptz not null default now()
);

create type rol as enum ('alumno', 'profe', 'admin');

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  club_id uuid references clubs(id) on delete cascade, -- null para la administradora global
  nombre text not null,
  email text not null,
  rol rol not null,
  nivel text -- solo alumnos
);

create table grupos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  nombre text not null,
  nivel text not null,
  profe_id uuid references usuarios(id),
  dia_semana int not null check (dia_semana between 1 and 7), -- 1 = lunes
  hora_inicio time not null,
  duracion_min int not null default 60,
  pista text
);

create table grupo_alumnos (
  grupo_id uuid references grupos(id) on delete cascade,
  alumno_id uuid references usuarios(id) on delete cascade,
  primary key (grupo_id, alumno_id)
);

-- Contenido de una clase concreta (grupo + fecha)
create table sesiones (
  grupo_id uuid references grupos(id) on delete cascade,
  fecha date not null,
  contenido text,
  primary key (grupo_id, fecha)
);

create table bajas (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  alumno_id uuid not null references usuarios(id) on delete cascade,
  grupo_id uuid not null references grupos(id) on delete cascade,
  fecha date not null,
  creado_en timestamptz not null default now(),
  unique (alumno_id, grupo_id, fecha)
);

-- Cada baja a tiempo genera un crédito de recuperación
create table creditos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  alumno_id uuid not null references usuarios(id) on delete cascade,
  baja_id uuid not null references bajas(id) on delete cascade,
  caduca date not null,
  usado boolean not null default false
);

create type estado_recuperacion as enum ('pendiente', 'aprobada', 'rechazada');

create table recuperaciones (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  alumno_id uuid not null references usuarios(id) on delete cascade,
  credito_id uuid not null references creditos(id) on delete cascade,
  grupo_id uuid not null references grupos(id) on delete cascade,
  fecha date not null,
  estado estado_recuperacion not null default 'pendiente',
  creado_en timestamptz not null default now()
);

-- Seguridad por filas: cada usuario solo ve los datos de su club.
alter table clubs enable row level security;
alter table usuarios enable row level security;
alter table grupos enable row level security;
alter table grupo_alumnos enable row level security;
alter table sesiones enable row level security;
alter table bajas enable row level security;
alter table creditos enable row level security;
alter table recuperaciones enable row level security;

create function mi_club() returns uuid language sql stable security definer as
  $$ select club_id from usuarios where id = auth.uid() $$;

create policy "club propio" on clubs for select using (id = mi_club());
create policy "club propio" on usuarios for select using (club_id = mi_club());
create policy "club propio" on grupos for select using (club_id = mi_club());
create policy "club propio" on grupo_alumnos for select
  using (exists (select 1 from grupos g where g.id = grupo_id and g.club_id = mi_club()));
create policy "club propio" on sesiones for select
  using (exists (select 1 from grupos g where g.id = grupo_id and g.club_id = mi_club()));
create policy "club propio" on bajas for select using (club_id = mi_club());
create policy "club propio" on creditos for select using (club_id = mi_club());
create policy "club propio" on recuperaciones for select using (club_id = mi_club());
-- Las escrituras pasan por funciones del servidor que validan plazos y plazas.
