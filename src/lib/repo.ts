// Punto único de acceso a los datos: Supabase si está configurado, si no los datos de prueba.
import { cache } from "react";
import { connection } from "next/server";
import { consultas, demo, memoria, type Club, type Db, type Estado, type Ficha, type Grupo, type Rol } from "./datos";
import { modoSupabase, sb } from "./supabase";

/** Lee todo lo del club del usuario conectado. Las reglas de seguridad de Supabase filtran por club. */
async function foto(): Promise<Db> {
  const s = await sb();
  const [clubs, usuarios, grupos, ga, sesiones, bajas, creditos, recs, fichas, invs, asis, canc, notas, anun, avs, nivs] = await Promise.all([
    s.from("clubs").select("*"),
    s.from("usuarios").select("*"),
    s.from("grupos").select("*"),
    s.from("grupo_alumnos").select("grupo_id, alumno_id"),
    s.from("sesiones").select("grupo_id, fecha, contenido"),
    s.from("bajas").select("id, alumno_id, grupo_id, fecha"),
    s.from("creditos").select("id, alumno_id, baja_id, caduca, usado"),
    s.from("recuperaciones").select("id, alumno_id, credito_id, grupo_id, fecha, estado"),
    // Estas dos pueden no existir aún (supabase/04_admin.sql): si fallan, se dejan vacías
    s.from("fichas").select("alumno_id, lesiones, trabajado, a_trabajar, actualizado_en"),
    s.from("invitaciones").select("email, club_id, nombre, rol, nivel, grupos"),
    // De supabase/05_club_vivo.sql (también opcionales)
    s.from("asistencias").select("grupo_id, fecha, alumno_id, presente"),
    s.from("cancelaciones").select("grupo_id, fecha, motivo"),
    s.from("notas_privadas").select("alumno_id, texto"),
    s.from("anuncios").select("id, club_id, autor_id, texto, creado_en").order("creado_en", { ascending: false }).limit(50),
    s.from("avisos").select("id, usuario_id, texto, enlace, leido, creado_en").order("creado_en", { ascending: false }).limit(30),
    s.from("niveles").select("id, club_id, nombre, orden"),
  ]);
  const error = [clubs, usuarios, grupos, ga, sesiones, bajas, creditos, recs].find((r) => r.error)?.error;
  if (error) throw new Error(`No se pudieron leer los datos: ${error.message}`);
  return {
    clubs: clubs.data!.map((c) => ({
      id: c.id, slug: c.slug, codigo: c.codigo_acceso ?? "", nombre: c.nombre,
      horasBaja: c.horas_antelacion_baja, diasCaducidad: c.dias_caducidad_recuperacion, maxAlumnos: c.max_alumnos_clase,
      color: c.color ?? undefined, logo: c.logo_url ?? undefined, cancelarRecupera: c.cancelar_da_recuperacion ?? true,
    })),
    usuarios: usuarios.data!.map((u) => ({ id: u.id, clubId: u.club_id ?? "", nombre: u.nombre, rol: u.rol, nivel: u.nivel ?? undefined, email: u.email, activo: u.activo !== false })),
    grupos: grupos.data!.map((g) => ({
      id: g.id, clubId: g.club_id, nombre: g.nombre, nivel: g.nivel, profeId: g.profe_id ?? "",
      dia: g.dia_semana, hora: String(g.hora_inicio).slice(0, 5), duracion: g.duracion_min, pista: g.pista ?? "", max: g.max_alumnos ?? undefined,
      alumnos: ga.data!.filter((x) => x.grupo_id === g.id).map((x) => x.alumno_id),
    })),
    sesiones: Object.fromEntries(sesiones.data!.filter((x) => x.contenido).map((x) => [`${x.grupo_id}|${x.fecha}`, x.contenido])),
    bajas: bajas.data!.map((b) => ({ id: b.id, alumnoId: b.alumno_id, grupoId: b.grupo_id, fecha: b.fecha })),
    creditos: creditos.data!.map((c) => ({ id: c.id, alumnoId: c.alumno_id, bajaId: c.baja_id, caduca: c.caduca, usado: c.usado })),
    recuperaciones: recs.data!.map((r) => ({
      id: r.id, alumnoId: r.alumno_id, creditoId: r.credito_id, grupoId: r.grupo_id, fecha: r.fecha, estado: r.estado as Estado,
    })),
    fichas: Object.fromEntries((fichas.data ?? []).map((f) => [f.alumno_id, {
      lesiones: f.lesiones, trabajado: f.trabajado, aTrabajar: f.a_trabajar, actualizado: f.actualizado_en,
    }])),
    asistencias: Object.fromEntries((asis.data ?? []).map((x) => [`${x.grupo_id}|${x.fecha}|${x.alumno_id}`, x.presente])),
    cancelaciones: Object.fromEntries((canc.data ?? []).map((x) => [`${x.grupo_id}|${x.fecha}`, x.motivo ?? ""])),
    notasPrivadas: Object.fromEntries((notas.data ?? []).map((x) => [x.alumno_id, x.texto])),
    anuncios: (anun.data ?? []).map((x) => ({ id: x.id, clubId: x.club_id, autorId: x.autor_id ?? undefined, texto: x.texto, creado: x.creado_en })),
    avisos: (avs.data ?? []).map((x) => ({ id: x.id, usuarioId: x.usuario_id, texto: x.texto, enlace: x.enlace ?? undefined, leido: x.leido, creado: x.creado_en })),
    niveles: (nivs.data ?? []).map((n) => ({ id: n.id, clubId: n.club_id, nombre: n.nombre, orden: n.orden })),
    invitaciones: (invs.data ?? []).map((i) => ({
      email: i.email, clubId: i.club_id ?? "", nombre: i.nombre, rol: i.rol, nivel: i.nivel ?? undefined, grupos: i.grupos ?? [],
    })),
  };
}

/** Una sola lectura por petición, compartida por todos los componentes de la página. */
export const datos = cache(async () => {
  await connection(); // siempre en el momento de la petición
  return consultas(modoSupabase ? await foto() : memoria);
});

async function rpc(nombre: string, args: Record<string, unknown>): Promise<string | null> {
  const { error } = await (await sb()).rpc(nombre, args);
  return error ? error.message : null;
}

export const acciones = {
  async clubPorCodigo(codigo: string): Promise<{ id: string; slug: string; nombre: string } | undefined> {
    if (!modoSupabase) return demo.clubPorCodigo(codigo);
    const { data } = await (await sb()).rpc("club_por_codigo", { p_codigo: codigo });
    return data?.[0];
  },
  darBaja: (uid: string, grupo: string, fecha: string) =>
    modoSupabase ? rpc("dar_baja", { p_grupo: grupo, p_fecha: fecha }) : Promise.resolve(demo.darBaja(uid, grupo, fecha)),
  pedirRecuperacion: (uid: string, grupo: string, fecha: string) =>
    modoSupabase ? rpc("pedir_recuperacion", { p_grupo: grupo, p_fecha: fecha }) : Promise.resolve(demo.pedirRecuperacion(uid, grupo, fecha)),
  resolver: (uid: string, rec: string, aprobar: boolean) =>
    modoSupabase ? rpc("resolver_recuperacion", { p_rec: rec, p_aprobar: aprobar }) : Promise.resolve(demo.resolverRecuperacion(uid, rec, aprobar)),
  guardarSesion: (uid: string, grupo: string, fecha: string, texto: string) =>
    modoSupabase ? rpc("guardar_sesion", { p_grupo: grupo, p_fecha: fecha, p_contenido: texto }) : Promise.resolve(demo.guardarSesion(uid, grupo, fecha, texto)),

  guardarFicha: (uid: string, alumno: string, f: Ficha) =>
    modoSupabase
      ? rpc("guardar_ficha", { p_alumno: alumno, p_lesiones: f.lesiones, p_trabajado: f.trabajado, p_a_trabajar: f.aTrabajar })
      : Promise.resolve(demo.guardarFicha(uid, alumno, f)),

  // --- Administración ---
  guardarClub: (id: string | null, c: Omit<Club, "id">) =>
    modoSupabase
      ? rpc("admin_guardar_club", { p_id: id, p_nombre: c.nombre, p_slug: c.slug, p_codigo: c.codigo, p_horas: c.horasBaja, p_dias: c.diasCaducidad, p_max: c.maxAlumnos })
      : Promise.resolve(demo.guardarClub(id, c)),
  guardarGrupo: (id: string | null, g: Omit<Grupo, "id" | "alumnos">) =>
    modoSupabase
      ? rpc("admin_guardar_grupo", { p_id: id, p_club: g.clubId, p_nombre: g.nombre, p_nivel: g.nivel, p_dia: g.dia, p_hora: g.hora, p_duracion: g.duracion, p_pista: g.pista, p_profe_email: g.profeId || null, p_max: g.max ?? null })
      : Promise.resolve(demo.guardarGrupo(id, g)),
  borrarGrupo: (id: string) => (modoSupabase ? rpc("admin_borrar_grupo", { p_id: id }) : Promise.resolve(demo.borrarGrupo(id))),
  alta: (club: string, email: string, nombre: string, rol: Rol, nivel?: string) =>
    modoSupabase
      ? rpc("admin_alta", { p_club: club, p_email: email, p_nombre: nombre, p_rol: rol, p_nivel: nivel ?? "" })
      : Promise.resolve(demo.alta(club, email, nombre, rol, nivel)),
  grupoAlumno: (grupo: string, email: string, dentro: boolean) =>
    modoSupabase
      ? rpc("admin_grupo_alumno", { p_grupo: grupo, p_email: email, p_dentro: dentro })
      : Promise.resolve(demo.grupoAlumno(grupo, email, dentro)),
  bajaPersona: (club: string, email: string) =>
    modoSupabase ? rpc("admin_baja_persona", { p_club: club, p_email: email }) : Promise.resolve(demo.bajaPersona(club, email)),
  cambiarActivo: (club: string, email: string, activo: boolean) =>
    modoSupabase
      ? rpc("cambiar_activo", { p_club: club, p_email: email, p_activo: activo })
      : Promise.resolve(demo.cambiarActivo(club, email, activo)),
  maxGrupo: (uid: string, grupo: string, max: number) =>
    modoSupabase ? rpc("profe_max_grupo", { p_grupo: grupo, p_max: max }) : Promise.resolve(demo.maxGrupo(uid, grupo, max)),

  // --- Club vivo ---
  marcarLeidos: (uid: string) => (modoSupabase ? rpc("marcar_avisos_leidos", {}) : Promise.resolve((demo.marcarLeidos(uid), null))),
  pasarLista: (uid: string, grupo: string, fecha: string, lista: string[], presentes: string[]) =>
    modoSupabase
      ? rpc("pasar_lista", { p_grupo: grupo, p_fecha: fecha, p_lista: lista, p_presentes: presentes })
      : Promise.resolve(demo.pasarLista(uid, grupo, fecha, lista, presentes)),
  cancelarClase: (uid: string, grupo: string, fecha: string, motivo: string) =>
    modoSupabase
      ? rpc("cancelar_clase", { p_grupo: grupo, p_fecha: fecha, p_motivo: motivo })
      : Promise.resolve(demo.cancelarClase(uid, grupo, fecha, motivo)),
  notasPrivadas: (uid: string, alumno: string, texto: string) =>
    modoSupabase ? rpc("guardar_notas_privadas", { p_alumno: alumno, p_texto: texto }) : Promise.resolve(demo.notasPrivadas(uid, alumno, texto)),
  publicarAnuncio: (uid: string, club: string, texto: string) =>
    modoSupabase ? rpc("publicar_anuncio", { p_club: club, p_texto: texto }) : Promise.resolve(demo.publicarAnuncio(uid, club, texto)),
  borrarAnuncio: (uid: string, id: string) =>
    modoSupabase ? rpc("borrar_anuncio", { p_id: id }) : Promise.resolve(demo.borrarAnuncio(uid, id)),
  marcaClub: (club: string, color: string, logo: string, cancelarRecupera: boolean) =>
    modoSupabase
      ? rpc("admin_marca_club", { p_club: club, p_color: color || null, p_logo: logo, p_cancelar_recupera: cancelarRecupera })
      : Promise.resolve(demo.marcaClub(club, color, logo, cancelarRecupera)),
  guardarNivel: (id: string | null, club: string, nombre: string, orden?: number) =>
    modoSupabase
      ? rpc("admin_guardar_nivel", { p_id: id, p_club: club, p_nombre: nombre, p_orden: orden ?? null })
      : Promise.resolve(demo.guardarNivel(id, club, nombre, orden)),
  borrarNivel: (id: string) => (modoSupabase ? rpc("admin_borrar_nivel", { p_id: id }) : Promise.resolve(demo.borrarNivel(id))),
};
