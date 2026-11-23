-- Club de prueba. Antes de ejecutarlo, cambia los 3 emails de abajo por emails reales tuyos
-- (con Gmail sirve tu_email+profe@gmail.com, tu_email+alumno@gmail.com, etc.).
with c as (
  insert into clubs (slug, codigo_acceso, nombre)
  values ('prueba', 'PRUEBA', 'Club de prueba')
  returning id
), g as (
  insert into grupos (club_id, nombre, nivel, dia_semana, hora_inicio, pista)
  select c.id, x.nombre, 'Intermedio', x.dia, x.hora::time, x.pista from c,
    (values ('Intermedio B', 2, '18:00', 'Pista 3'),
            ('Intermedio B', 6, '10:00', 'Pista 1'),
            ('Intermedio A', 4, '19:30', 'Pista 2')) as x(nombre, dia, hora, pista)
  returning id, nombre
)
insert into invitaciones (club_id, email, nombre, rol, nivel, grupos)
select c.id, i.email, i.nombre, i.rol::rol, i.nivel,
       (select array_agg(g.id) from g where g.nombre = any(i.grupos))
from c, (values
  ('CAMBIA+profe@gmail.com',   'Profe de prueba',  'profe',  null,         array['Intermedio B','Intermedio A']),
  ('CAMBIA+alumno@gmail.com',  'Alumno de prueba', 'alumno', 'Intermedio', array['Intermedio B']),
  ('CAMBIA+alumno2@gmail.com', 'Otra alumna',      'alumno', 'Intermedio', array['Intermedio A'])
) as i(email, nombre, rol, nivel, grupos);
