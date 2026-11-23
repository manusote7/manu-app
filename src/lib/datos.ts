// Capa de datos. De momento usa datos de demostración en memoria con las
// mismas tablas que supabase/schema.sql; se cambiará por Supabase sin tocar las pantallas.
import { diaSemana, inicioClase, iso, sumarDias, lunesDe } from "./fechas";

export type Rol = "alumno" | "profe" | "admin";
export interface Club { id: string; slug: string; codigo: string; nombre: string; horasBaja: number; diasCaducidad: number; maxAlumnos: number }
export interface Usuario { id: string; clubId: string; nombre: string; rol: Rol; nivel?: string }
export interface Grupo {
  id: string; clubId: string; nombre: string; nivel: string; profeId: string;
  dia: number; hora: string; duracion: number; pista: string; alumnos: string[];
}
export interface Baja { id: string; alumnoId: string; grupoId: string; fecha: string }
export interface Credito { id: string; alumnoId: string; bajaId: string; caduca: string; usado: boolean }
export type Estado = "pendiente" | "aprobada" | "rechazada";
export interface Recuperacion { id: string; alumnoId: string; creditoId: string; grupoId: string; fecha: string; estado: Estado }

interface Db {
  clubs: Club[]; usuarios: Usuario[]; grupos: Grupo[];
  sesiones: Record<string, string>; // `${grupoId}|${fecha}` -> contenido
  bajas: Baja[]; creditos: Credito[]; recuperaciones: Recuperacion[];
}

function semilla(): Db {
  const clubs: Club[] = [
    { id: "c1", slug: "norte", codigo: "NORTE24", nombre: "Club Pádel Norte", horasBaja: 6, diasCaducidad: 21, maxAlumnos: 4 },
    { id: "c2", slug: "sur", codigo: "SUR24", nombre: "Pádel Sur Academia", horasBaja: 24, diasCaducidad: 14, maxAlumnos: 4 },
  ];
  const u = (id: string, nombre: string, rol: Rol, nivel?: string, clubId = "c1"): Usuario => ({ id, clubId, nombre, rol, nivel });
  const usuarios = [
    u("p1", "Manu", "profe"), u("p2", "Sara", "profe"),
    u("a1", "Lucía Martín", "alumno", "Intermedio"), u("a2", "Pablo Ruiz", "alumno", "Intermedio"),
    u("a3", "Marta Gil", "alumno", "Intermedio"), u("a4", "Javi León", "alumno", "Intermedio"),
    u("a5", "Ana Sosa", "alumno", "Intermedio"), u("a6", "Diego Pérez", "alumno", "Intermedio"),
    u("a7", "Carla Díaz", "alumno", "Iniciación"), u("a8", "Hugo Vera", "alumno", "Iniciación"),
    u("a9", "Irene Ortiz", "alumno", "Avanzado"),
    u("s1", "Rocío", "profe", undefined, "c2"), u("s2", "Tomás Vega", "alumno", "Intermedio", "c2"),
    u("s3", "Nuria Cano", "alumno", "Intermedio", "c2"),
  ];
  const g = (id: string, nombre: string, nivel: string, profeId: string, dia: number, hora: string, pista: string, alumnos: string[], clubId = "c1"): Grupo =>
    ({ id, clubId, nombre, nivel, profeId, dia, hora, duracion: 60, pista, alumnos });
  const grupos = [
    g("g1", "Intermedio B", "Intermedio", "p1", 2, "18:00", "Pista 3", ["a1", "a2", "a3", "a4"]),
    g("g2", "Intermedio B", "Intermedio", "p1", 6, "10:00", "Pista 1", ["a1", "a2", "a3", "a4"]),
    g("g3", "Intermedio A", "Intermedio", "p2", 4, "19:30", "Pista 2", ["a5", "a6"]),
    g("g4", "Iniciación", "Iniciación", "p1", 2, "17:00", "Pista 3", ["a7", "a8"]),
    g("g5", "Avanzado", "Avanzado", "p1", 3, "20:00", "Pista 4", ["a9"]),
    g("g6", "Intermedio C", "Intermedio", "p2", 1, "19:00", "Pista 2", ["a5", "a6", "a3"]),
    g("h1", "Intermedio", "Intermedio", "s1", 2, "19:00", "Pista Central", ["s2", "s3"], "c2"),
  ];
  const lunes = lunesDe(iso(new Date()));
  return {
    clubs, usuarios, grupos,
    sesiones: { [`g1|${sumarDias(lunes, 1)}`]: "Bandeja cruzada y salida de pared" },
    bajas: [], creditos: [], recuperaciones: [],
  };
}

const g = globalThis as unknown as { __db?: Db };
export const db: Db = (g.__db ??= semilla());

let n = 0;
const nuevoId = (p: string) => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

export const usuario = (id: string) => db.usuarios.find((u) => u.id === id);
export const club = (id: string) => db.clubs.find((c) => c.id === id)!;  // puede ser undefined si el id no existe
export const clubPorSlug = (slug: string) => db.clubs.find((c) => c.slug === slug);
export const clubPorCodigo = (codigo: string) => db.clubs.find((c) => c.codigo.toUpperCase() === codigo.trim().toUpperCase());
export const usuariosDeClub = (clubId: string) => db.usuarios.filter((u) => u.clubId === clubId);
export const grupo = (id: string) => db.grupos.find((x) => x.id === id);

/** Una clase concreta = grupo + fecha */
export interface Clase {
  grupo: Grupo; fecha: string; inicio: Date; contenido?: string;
  alumnos: Usuario[];          // quién viene (fijos sin baja + recuperaciones aprobadas)
  bajas: Usuario[];
  pendientes: Recuperacion[];
}

export function clase(grupoId: string, fecha: string): Clase | undefined {
  const gr = grupo(grupoId);
  if (!gr || diaSemana(fecha) !== gr.dia) return;
  const bajasIds = db.bajas.filter((b) => b.grupoId === gr.id && b.fecha === fecha).map((b) => b.alumnoId);
  const recs = db.recuperaciones.filter((r) => r.grupoId === gr.id && r.fecha === fecha);
  const ids = [...gr.alumnos.filter((a) => !bajasIds.includes(a)), ...recs.filter((r) => r.estado === "aprobada").map((r) => r.alumnoId)];
  return {
    grupo: gr, fecha, inicio: inicioClase(fecha, gr.hora), contenido: db.sesiones[`${gr.id}|${fecha}`],
    alumnos: ids.map((i) => usuario(i)!), bajas: bajasIds.map((i) => usuario(i)!),
    pendientes: recs.filter((r) => r.estado === "pendiente"),
  };
}

export function clasesSemana(lunes: string, filtro: (gr: Grupo) => boolean): Clase[] {
  const out: Clase[] = [];
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i);
    for (const gr of db.grupos.filter(filtro)) {
      const c = clase(gr.id, f);
      if (c) out.push(c);
    }
  }
  return out.sort((a, b) => +a.inicio - +b.inicio);
}

export function limiteBaja(c: Clase): Date {
  const h = club(c.grupo.clubId).horasBaja;
  return new Date(+c.inicio - h * 3600_000);
}

export function creditosDisponibles(alumnoId: string, hoy = iso(new Date())): Credito[] {
  const usados = new Set(db.recuperaciones.filter((r) => r.estado !== "rechazada").map((r) => r.creditoId));
  return db.creditos.filter((c) => c.alumnoId === alumnoId && !c.usado && !usados.has(c.id) && c.caduca >= hoy);
}

/** Clases del mismo nivel, con plaza, antes de caducar el crédito y donde el alumno no está ya */
export function clasesParaRecuperar(alumnoId: string, ahora = new Date()): Clase[] {
  const al = usuario(alumnoId)!;
  const creds = creditosDisponibles(alumnoId);
  if (!creds.length) return [];
  const hasta = creds.map((c) => c.caduca).sort().at(-1)!;
  const max = club(al.clubId).maxAlumnos;
  const out: Clase[] = [];
  for (let f = iso(ahora); f <= hasta; f = sumarDias(f, 1)) {
    for (const gr of db.grupos.filter((x) => x.clubId === al.clubId && x.nivel === al.nivel)) {
      const c = clase(gr.id, f);
      if (!c || c.inicio <= ahora) continue;
      if (c.alumnos.some((a) => a.id === alumnoId) || c.pendientes.some((p) => p.alumnoId === alumnoId)) continue;
      if (gr.alumnos.includes(alumnoId)) continue;
      if (c.alumnos.length + c.pendientes.length >= max) continue;
      out.push(c);
    }
  }
  return out;
}

// ---------- Acciones ----------

export function darBaja(alumnoId: string, grupoId: string, fecha: string, ahora = new Date()): string | null {
  const c = clase(grupoId, fecha);
  if (!c || !c.grupo.alumnos.includes(alumnoId)) return "No estás en esa clase.";
  if (c.bajas.some((b) => b.id === alumnoId)) return "Ya te diste de baja.";
  if (ahora > limiteBaja(c)) return "El plazo para darte de baja ya pasó.";
  const baja: Baja = { id: nuevoId("b"), alumnoId, grupoId, fecha };
  db.bajas.push(baja);
  const dias = club(c.grupo.clubId).diasCaducidad;
  db.creditos.push({ id: nuevoId("cr"), alumnoId, bajaId: baja.id, caduca: sumarDias(fecha, dias), usado: false });
  return null;
}

export function pedirRecuperacion(alumnoId: string, grupoId: string, fecha: string): string | null {
  const ok = clasesParaRecuperar(alumnoId).some((c) => c.grupo.id === grupoId && c.fecha === fecha);
  if (!ok) return "Esa clase ya no está disponible.";
  const cred = creditosDisponibles(alumnoId).filter((c) => c.caduca >= fecha).sort((a, b) => a.caduca.localeCompare(b.caduca))[0];
  if (!cred) return "Tu recuperación caduca antes de esa fecha.";
  db.recuperaciones.push({ id: nuevoId("r"), alumnoId, creditoId: cred.id, grupoId, fecha, estado: "pendiente" });
  return null;
}

export function resolverRecuperacion(profeId: string, recId: string, aprobar: boolean): string | null {
  const r = db.recuperaciones.find((x) => x.id === recId);
  if (!r || r.estado !== "pendiente") return "La solicitud ya no está pendiente.";
  const gr = grupo(r.grupoId)!;
  if (gr.profeId !== profeId) return "Esa clase no es tuya.";
  if (aprobar) {
    const c = clase(r.grupoId, r.fecha)!;
    if (c.alumnos.length >= club(gr.clubId).maxAlumnos) return "La clase ya está completa.";
    db.creditos.find((c) => c.id === r.creditoId)!.usado = true;
  }
  r.estado = aprobar ? "aprobada" : "rechazada";
  return null;
}

export function recuperacionesAlumno(alumnoId: string, desde: string): Recuperacion[] {
  return db.recuperaciones.filter((r) => r.alumnoId === alumnoId && r.fecha >= desde && r.estado !== "rechazada");
}

export function pendientesProfe(profeId: string): Recuperacion[] {
  const mis = new Set(db.grupos.filter((x) => x.profeId === profeId).map((x) => x.id));
  return db.recuperaciones.filter((r) => r.estado === "pendiente" && mis.has(r.grupoId));
}

export function guardarSesion(profeId: string, grupoId: string, fecha: string, contenido: string): string | null {
  const gr = grupo(grupoId);
  if (!gr || gr.profeId !== profeId) return "Esa clase no es tuya.";
  db.sesiones[`${grupoId}|${fecha}`] = contenido.trim();
  return null;
}
