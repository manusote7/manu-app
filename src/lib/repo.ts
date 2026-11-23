// Punto único de acceso a los datos: Supabase si está configurado, si no los datos de prueba.
import { cache } from "react";
import { connection } from "next/server";
import { consultas, demo, memoria, type Db, type Estado } from "./datos";
import { modoSupabase, sb } from "./supabase";

/** Lee todo lo del club del usuario conectado. Las reglas de seguridad de Supabase filtran por club. */
async function foto(): Promise<Db> {
  const s = await sb();
  const [clubs, usuarios, grupos, ga, sesiones, bajas, creditos, recs] = await Promise.all([
    s.from("clubs").select("id, slug, nombre, horas_antelacion_baja, dias_caducidad_recuperacion, max_alumnos_clase"),
    s.from("usuarios").select("id, club_id, nombre, rol, nivel"),
    s.from("grupos").select("id, club_id, nombre, nivel, profe_id, dia_semana, hora_inicio, duracion_min, pista"),
    s.from("grupo_alumnos").select("grupo_id, alumno_id"),
    s.from("sesiones").select("grupo_id, fecha, contenido"),
    s.from("bajas").select("id, alumno_id, grupo_id, fecha"),
    s.from("creditos").select("id, alumno_id, baja_id, caduca, usado"),
    s.from("recuperaciones").select("id, alumno_id, credito_id, grupo_id, fecha, estado"),
  ]);
  const error = [clubs, usuarios, grupos, ga, sesiones, bajas, creditos, recs].find((r) => r.error)?.error;
  if (error) throw new Error(`No se pudieron leer los datos: ${error.message}`);
  return {
    clubs: clubs.data!.map((c) => ({
      id: c.id, slug: c.slug, codigo: "", nombre: c.nombre,
      horasBaja: c.horas_antelacion_baja, diasCaducidad: c.dias_caducidad_recuperacion, maxAlumnos: c.max_alumnos_clase,
    })),
    usuarios: usuarios.data!.map((u) => ({ id: u.id, clubId: u.club_id, nombre: u.nombre, rol: u.rol, nivel: u.nivel ?? undefined })),
    grupos: grupos.data!.map((g) => ({
      id: g.id, clubId: g.club_id, nombre: g.nombre, nivel: g.nivel, profeId: g.profe_id ?? "",
      dia: g.dia_semana, hora: String(g.hora_inicio).slice(0, 5), duracion: g.duracion_min, pista: g.pista ?? "",
      alumnos: ga.data!.filter((x) => x.grupo_id === g.id).map((x) => x.alumno_id),
    })),
    sesiones: Object.fromEntries(sesiones.data!.filter((x) => x.contenido).map((x) => [`${x.grupo_id}|${x.fecha}`, x.contenido])),
    bajas: bajas.data!.map((b) => ({ id: b.id, alumnoId: b.alumno_id, grupoId: b.grupo_id, fecha: b.fecha })),
    creditos: creditos.data!.map((c) => ({ id: c.id, alumnoId: c.alumno_id, bajaId: c.baja_id, caduca: c.caduca, usado: c.usado })),
    recuperaciones: recs.data!.map((r) => ({
      id: r.id, alumnoId: r.alumno_id, creditoId: r.credito_id, grupoId: r.grupo_id, fecha: r.fecha, estado: r.estado as Estado,
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
};
