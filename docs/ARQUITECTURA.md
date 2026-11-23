# Arquitectura de Manu App

Guía para entender qué conecta con qué y arreglar cosas sin ayuda.

## 1. Piezas y quién hace qué

```
Móvil (app instalada / navegador)
   │  HTTPS
   ▼
Cloudflare Workers  ── ejecuta la web Next.js (adaptador OpenNext)
   │  (supabase-js, clave publishable + sesión del usuario en cookies)
   ▼
Supabase (Irlanda) ── Postgres + Auth (login por email) + reglas RLS
   ▲
GitHub Actions ── consulta diaria (para que no se pause) y copia semanal cifrada
```

- **Código**: GitHub `manusote7/manu-app`, rama `main`. Cada push a `main` despliega solo en Cloudflare (Workers Builds). Vercel sigue conectado mientras se termina la migración.
- **Next.js 16** (App Router, server components y server actions). No hay API propia: las páginas leen Supabase en el servidor y los formularios llaman a *server actions*.
- **Supabase** guarda todo. La web nunca usa la clave secreta (`service_role`): solo la clave *publishable*. La seguridad está en la base de datos (RLS + funciones).

## 2. Carpetas

| Ruta | Qué hay |
|---|---|
| `src/app/` | Pantallas (cada carpeta con `page.tsx` es una URL). |
| `src/app/acciones.ts` | Todas las *server actions* (lo que hacen los formularios). |
| `src/app/marco.tsx` | Cabecera, barra inferior (`Nav`), iconos, avisos. |
| `src/app/cliente.tsx` | Componentes de cliente: botón con estado, selector de días, refresco del chat, instalar app. |
| `src/app/personas.tsx` | Formularios de altas y ficha de gestión de personas (admin y profesores). |
| `src/app/codigo.tsx` | Pantalla para escribir el código de 6 cifras del email. |
| `src/app/estadisticas.tsx` | Bloque de estadísticas (profesores y admin). |
| `src/lib/datos.ts` | **Lógica de negocio pura**: tipos, `consultas(db)` (clases de la semana, bajas, recuperaciones, estadísticas…) y los datos de prueba en memoria. |
| `src/lib/repo.ts` | **Acceso a datos**: `foto()` lee todo lo del club en una sola tanda; `acciones` llama a las funciones SQL (o al modo prueba). |
| `src/lib/sesion.ts` | Quién está conectado: `clubElegido()`, `yo()`, `yoAdmin()`. |
| `src/lib/supabase.ts` | Cliente de Supabase en el servidor (lee/escribe cookies). |
| `src/lib/fechas.ts` | Utilidades de fechas (`YYYY-MM-DD`, lunes de la semana…). |
| `src/middleware.ts` | Se ejecuta en cada petición: renueva la sesión de Supabase. |
| `supabase/*.sql` | Esquema y funciones, en orden: `schema.sql`, `02`…`09`. |
| `src/lib/privacidad.ts`, `src/app/privacidad/` | Aviso de privacidad (versión) y su texto. |
| `docs/legal/` | Textos legales base (contrato de encargado, registro). Revisar con un abogado. |
| `.github/workflows/` | `supabase-despierto.yml` y `copia-seguridad.yml`. |
| `wrangler.jsonc`, `open-next.config.ts` | Configuración de Cloudflare. |

### Pantallas

| URL | Quién | Qué |
|---|---|---|
| `/` | todos | Código del club (paso 1). Enlace a administración. |
| `/c/[slug]` | todos | Email y código de 6 cifras (paso 2). |
| `/semana` | alumno, profesor | Semana con próxima clase, bajas, pasar lista, sesión, colocar alumno. |
| `/recuperar` | alumno | Clases donde recuperar. |
| `/chat`, `/chat/[grupo]` | alumno, profesor | Chat de cada grupo (se refresca cada 8 s). |
| `/alumnos`, `/alumnos/[id]` | profesor | Altas, grupos, nivel, ficha y notas privadas. |
| `/club`, `/plan`, `/estadisticas`, `/tablon` | profesor | Plan de temporada, estadísticas y tablón. |
| `/perfil`, `/avisos` | todos | Perfil con cifras; avisos (campana). |
| `/admin`, `/admin/club/[id]` | administración | Clubs, cuotas, reglas, niveles, grupos, personas, estadísticas. |
| `/bienvenida` | todos | La primera vez: aviso de privacidad y consentimiento (tutor si es menor de 14). |
| `/privacidad`, `/mis-datos` | todos | Aviso de privacidad; descarga de tus datos (JSON). |
| `/admin/datos` | administración | Descarga los datos de una persona (RGPD). |
| `/auth/confirm` | — | Destino del enlace del email (alternativa al código). |

## 3. Cómo fluye una pantalla

1. La página llama a `yo()` (quién eres) y a `datos()`.
2. `datos()` (en `repo.ts`) hace `foto()`: unas 18 consultas en paralelo a Supabase. RLS hace que solo vuelva lo de tu club.
3. `consultas(foto)` (en `datos.ts`) calcula todo en memoria: clases de la semana, quién viene, plazas, etc.
4. Un formulario llama a una *server action* de `acciones.ts` → `repo.acciones.X` → función SQL (`rpc`) → `volver()` redirige con `?ok=` o `?error=` (el mensaje verde/rojo de arriba).

**Modo prueba**: si faltan las variables de Supabase, todo funciona con datos en memoria (`memoria` en `datos.ts`) y se entra eligiendo persona. Útil para probar en local sin tocar datos reales.

## 4. Login

1. `/` → el código del club (`club_por_codigo`) se guarda en la cookie `club`.
2. `/c/[slug]` → `signInWithOtp(email)`. Supabase solo deja entrar a emails de la tabla `invitaciones` (si no está, el trigger falla y sale "no está dado de alta").
3. Llega un email con **código de 6 cifras** (y enlace). Con el código, `verifyOtp` crea la sesión en la propia app instalada. El enlace (`/auth/confirm`) abre el navegador y la sesión queda en el navegador, no en la app instalada: por eso se usa el código.
4. La primera vez que alguien entra, el trigger `crear_usuario_invitado` crea su fila en `usuarios`, le pone en sus grupos (alumno) o le asigna sus grupos (profesor).
5. `middleware.ts` renueva la sesión en cada petición. `yo()` lee el usuario con `getClaims()`.
6. Administración entra en `/admin` con su email (en `invitaciones` con rol `admin` y sin club).

## 5. Base de datos (Supabase)

Tablas principales:

- `clubs` (reglas: horas de antelación de baja, días de caducidad, máximo por clase, color, logo, zona horaria).
- `usuarios` (id = `auth.users.id`, club, rol `alumno|profe|admin`, nivel, activo).
- `invitaciones` (quién puede entrar; email único).
- `niveles`, `grupos` (día, hora, pista, profesor, máximo), `grupo_alumnos`.
- Clases concretas = grupo + fecha (no hay tabla de clases): `sesiones` (contenido), `bajas`, `creditos` (recuperaciones disponibles), `recuperaciones` (pendiente/aprobada/rechazada), `asistencias`, `cancelaciones`.
- `fichas`, `notas_privadas` (solo profesores), `anuncios`, `avisos`, `mensajes` (chat), `plan_semanas`, `club_cuotas` (solo admin).

Seguridad:

- **RLS** en todas las tablas. Lectura: `club_id = mi_club()` (tu club) o `es_admin()`. `mi_club()` y `mi_rol()` devuelven nada si la cuenta está inactiva. El chat solo lo leen los del grupo (`es_del_grupo`).
- **Privacidad entre alumnos** (`09`): un alumno ve de `usuarios` solo a sí mismo, a los profesores y a sus compañeros de grupo; asistencias y recuperaciones solo las suyas. La columna `email` no se puede leer: los emails salen de `emails_visibles()` (tú, profesores de tu club, administración).
- **Fechas**: `foto()` lee bajas, asistencias, etc. de las últimas 6 semanas. Las pantallas de estadísticas y el perfil llaman antes a `ampliarDatos(desde)`.
- **Chat**: el móvil pregunta a Supabase cada 6 s si hay mensajes nuevos (`ChatVivo` en `cliente.tsx`) y solo entonces recarga.
- **Escrituras solo con funciones SQL** `security definer` que comprueban permisos: `dar_baja`, `pedir_recuperacion`, `resolver_recuperacion`, `pasar_lista`, `cancelar_clase`, `colocar_alumno`, `enviar_mensaje`, `guardar_plan`, `admin_*`… Desde la web no se puede hacer `insert/update` directo.
- Los mensajes de error que ves en la app son los `raise exception` de esas funciones.

Para cambiar el esquema: crea `supabase/NN_algo.sql` (idempotente, con `if not exists` / `create or replace`) y ejecútalo en Supabase → SQL Editor.

## 6. Despliegue

### Dos apps, un mismo código y una misma base de datos

- **App de alumnos y profesores**: Worker `manu-app` (`wrangler.jsonc`). Las rutas `/admin…` devuelven 404.
- **App de administración**: Worker `manu-admin` (`wrangler.admin.jsonc`, `NEXT_PUBLIC_APP=admin`). Solo sirve `/admin…` y `/auth/…`; el resto redirige a `/admin`.
- Lo decide `src/middleware.ts` según `NEXT_PUBLIC_APP` (se fija al compilar). Las dos usan la misma Supabase.
- Build admin: `NEXT_PUBLIC_APP=admin npx opennextjs-cloudflare build -c wrangler.admin.jsonc`; deploy: `npx opennextjs-cloudflare deploy -c wrangler.admin.jsonc`.

### Cloudflare (principal)

- Workers & Pages → `manu-app` → conectado a GitHub. Build: `npx opennextjs-cloudflare build`; deploy: `npx opennextjs-cloudflare deploy`.
- Variables en `wrangler.jsonc` (`vars`) y como *build variables*: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (públicas).
- Límites del plan gratis: 100.000 peticiones/día y 10 ms de CPU por petición. Si aparece el error 1102 es que una página tarda demasiado en CPU.
- Probar en local igual que en Cloudflare: `npm run cf:preview`.
- Limitaciones del adaptador: no usar `cacheComponents` ni `proxy.ts` (se usa `middleware.ts`, tipo edge).

### Supabase → Authentication

- URL Configuration: *Site URL* y *Redirect URLs* deben incluir la dirección de la web (`https://…workers.dev/**`).
- Emails: las plantillas *Magic Link* y *Confirm signup* deben incluir `{{ .Token }}` (el código de 6 cifras).

## 7. GitHub Actions

- `supabase-despierto.yml`: cada día llama a `club_por_codigo` para que el proyecto gratis no se pause tras 7 días.
- `copia-seguridad.yml`: cada domingo hace `pg_dump` (esquemas `public` y `auth`), lo cifra con `BACKUP_PASSWORD` y lo guarda 90 días como artefacto. Necesita los secretos `SUPABASE_DB_URL` (cadena *Session pooler*) y `BACKUP_PASSWORD`.
- Restaurar: descargar el artefacto → `gpg -d archivo.dump.gpg > copia.dump` → `pg_restore --no-owner -d "<url>" copia.dump`.
- Los flujos programados se pueden lanzar a mano en Actions → *Run workflow*.

## 8. Trabajar en local

```bash
npm install
# .env.local (no se sube a git):
# NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
npm run dev            # http://localhost:3000
# sin .env.local → modo prueba (códigos NORTE24 / SUR24)
npx tsc --noEmit       # comprobar tipos
npm run cf:preview     # probar como en Cloudflare
```

## 9. Fallos habituales

| Síntoma | Dónde mirar |
|---|---|
| "Ese email no está dado de alta" | Tabla `invitaciones` (el email debe estar ahí, en minúsculas). |
| No llega el email | Supabase → Authentication → Logs. El SMTP gratis de Supabase envía pocos emails por hora: para muchos usuarios, configura un SMTP propio (Authentication → Emails → SMTP). |
| El código dice "incorrecto o caducado" | Usar el último email; caduca en 1 hora. Plantilla con `{{ .Token }}`. |
| Error 500 / 1102 en Cloudflare | Cloudflare → Workers → `manu-app` → Logs (Observability). |
| Algo no se guarda | El mensaje rojo viene de la función SQL; búscalo en `supabase/*.sql`. |
| Datos que no se ven | RLS: comprueba `club_id` del usuario y la política de esa tabla. |
| Supabase en pausa | Dashboard → *Restore project*; mira si `supabase-despierto` está activo en Actions. |
| Cambié el SQL y la app falla | Revisa que `repo.ts` (`foto()`) lee las columnas con el nombre nuevo. |
