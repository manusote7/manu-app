// Lógica de clases, bajas y recuperaciones sobre una "foto" de los datos del club.
// La foto viene de Supabase (src/lib/repo.ts) o, sin Supabase, de los datos de prueba en memoria.
import { diaSemana, inicioClase, iso, sumarDias, lunesDe } from "./fechas";

export type Rol = "alumno" | "profe" | "admin";
export interface Club {
  id: string; slug: string; codigo: string; nombre: string; horasBaja: number; diasCaducidad: number; maxAlumnos: number;
  color?: string; logo?: string; cancelarRecupera?: boolean;
  cuotaMensual?: number; cuotaAlta?: number; clienteDesde?: string; // solo los ve administración
}
export interface Nivel { id: string; clubId: string; nombre: string; orden: number }
export interface Anuncio { id: string; clubId: string; autorId?: string; texto: string; creado: string }
export interface AvisoApp { id: string; usuarioId: string; texto: string; enlace?: string; leido: boolean; creado: string }
export interface Mensaje { id: string; grupoId: string; autorId?: string; texto: string; creado: string }
export interface Usuario { id: string; clubId: string; nombre: string; rol: Rol; nivel?: string; email?: string; activo?: boolean }
export interface Ficha { lesiones: string; trabajado: string; aTrabajar: string; actualizado?: string }
/** Persona dada de alta que quizá aún no ha entrado nunca (solo la ve administración) */
export interface Invitacion { email: string; clubId: string; nombre: string; rol: Rol; nivel?: string; grupos: string[] }
export interface Grupo {
  id: string; clubId: string; nombre: string; nivel: string; profeId: string;
  dia: number; hora: string; duracion: number; pista: string; alumnos: string[];
  max?: number; // máximo de alumnos de este grupo (si no, el del club)
}
export interface Baja { id: string; alumnoId: string; grupoId: string; fecha: string }
export interface Credito { id: string; alumnoId: string; bajaId: string; caduca: string; usado: boolean }
export type Estado = "pendiente" | "aprobada" | "rechazada";
/** creditoId vacío: el profesor colocó al alumno sin gastar recuperación */
export interface Recuperacion { id: string; alumnoId: string; creditoId: string; grupoId: string; fecha: string; estado: Estado }

export interface Db {
  clubs: Club[]; usuarios: Usuario[]; grupos: Grupo[];
  sesiones: Record<string, string>; // `${grupoId}|${fecha}` -> contenido
  bajas: Baja[]; creditos: Credito[]; recuperaciones: Recuperacion[];
  fichas: Record<string, Ficha>; invitaciones: Invitacion[];
  asistencias: Record<string, boolean>;   // `${grupoId}|${fecha}|${alumnoId}`
  cancelaciones: Record<string, string>;  // `${grupoId}|${fecha}` -> motivo ("" si no hay)
  notasPrivadas: Record<string, string>;
  anuncios: Anuncio[]; avisos: AvisoApp[];
  niveles: Nivel[];
  plan: Record<string, string>;           // `${clubId}|${nivel}|${lunes}` -> contenidos de esa semana
  mensajes: Mensaje[];                    // solo en modo prueba (con Supabase se leen aparte)
}

/** Temporada de septiembre a junio: lunes de cada semana */
export function semanasTemporada(hoy: string): string[] {
  const [y, m] = hoy.split("-").map(Number);
  const ini = m >= 7 ? y : y - 1;
  const out: string[] = [];
  for (let f = lunesDe(`${ini}-09-01`); f <= `${ini + 1}-06-30`; f = sumarDias(f, 7)) out.push(f);
  return out;
}

/** Una clase concreta = grupo + fecha */
export interface Clase {
  grupo: Grupo; fecha: string; inicio: Date; contenido?: string;
  cancelada?: string;                   // motivo ("" si no hay) cuando la clase se ha cancelado
  asistencia: Record<string, boolean>;  // alumnoId -> ha venido (si se pasó lista)
  alumnos: Usuario[];          // quién viene (fijos sin baja + recuperaciones aprobadas)
  bajas: Usuario[];
  pendientes: Recuperacion[];
}

export type Consultas = ReturnType<typeof consultas>;

export function consultas(db: Db) {
  const usuario = (id: string) => db.usuarios.find((u) => u.id === id);
  const club = (id: string) => db.clubs.find((c) => c.id === id)!;
  const grupo = (id: string) => db.grupos.find((x) => x.id === id);
  const maxDe = (g: Grupo) => g.max ?? club(g.clubId).maxAlumnos;
  const usuariosDeClub = (clubId: string) => db.usuarios.filter((u) => u.clubId === clubId);

  function clase(grupoId: string, fecha: string): Clase | undefined {
    const gr = grupo(grupoId);
    if (!gr || diaSemana(fecha) !== gr.dia) return;
    const bajasIds = db.bajas.filter((b) => b.grupoId === gr.id && b.fecha === fecha).map((b) => b.alumnoId);
    const recs = db.recuperaciones.filter((r) => r.grupoId === gr.id && r.fecha === fecha);
    const ids = [...gr.alumnos.filter((a) => !bajasIds.includes(a)), ...recs.filter((r) => r.estado === "aprobada").map((r) => r.alumnoId)];
    const persona = (i: string): Usuario => usuario(i) ?? { id: i, clubId: gr.clubId, nombre: "Alumno", rol: "alumno" };
    return {
      grupo: gr, fecha, inicio: inicioClase(fecha, gr.hora), contenido: db.sesiones[`${gr.id}|${fecha}`],
      cancelada: db.cancelaciones[`${gr.id}|${fecha}`],
      asistencia: Object.fromEntries(ids.filter((i) => `${gr.id}|${fecha}|${i}` in db.asistencias).map((i) => [i, db.asistencias[`${gr.id}|${fecha}|${i}`]])),
      alumnos: ids.map(persona), bajas: bajasIds.map(persona),
      pendientes: recs.filter((r) => r.estado === "pendiente"),
    };
  }

  function clasesSemana(lunes: string, filtro: (gr: Grupo) => boolean): Clase[] {
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

  const limiteBaja = (c: Clase) => new Date(+c.inicio - club(c.grupo.clubId).horasBaja * 3600_000);

  function creditosDisponibles(alumnoId: string, hoy = iso(new Date())): Credito[] {
    const usados = new Set(db.recuperaciones.filter((r) => r.estado !== "rechazada").map((r) => r.creditoId));
    return db.creditos.filter((c) => c.alumnoId === alumnoId && !c.usado && !usados.has(c.id) && c.caduca >= hoy);
  }

  /** Clases del mismo nivel, con plaza, antes de caducar el crédito y donde el alumno no está ya */
  function clasesParaRecuperar(alumnoId: string, ahora = new Date()): Clase[] {
    const al = usuario(alumnoId)!;
    const creds = creditosDisponibles(alumnoId);
    if (!creds.length) return [];
    const hasta = creds.map((c) => c.caduca).sort().at(-1)!;
    const out: Clase[] = [];
    for (let f = iso(ahora); f <= hasta; f = sumarDias(f, 1)) {
      for (const gr of db.grupos.filter((x) => x.clubId === al.clubId && x.nivel === al.nivel)) {
        const c = clase(gr.id, f);
        if (!c || c.cancelada !== undefined || c.inicio <= ahora || gr.alumnos.includes(alumnoId)) continue;
        if (c.alumnos.some((a) => a.id === alumnoId) || c.pendientes.some((p) => p.alumnoId === alumnoId)) continue;
        if (c.alumnos.length + c.pendientes.length >= maxDe(gr)) continue;
        out.push(c);
      }
    }
    return out;
  }

  const recuperacionesAlumno = (alumnoId: string, desde: string) =>
    db.recuperaciones.filter((r) => r.alumnoId === alumnoId && r.fecha >= desde && r.estado !== "rechazada");

  function pendientesProfe(profeId: string): Recuperacion[] {
    const mis = new Set(db.grupos.filter((x) => x.profeId === profeId).map((x) => x.id));
    return db.recuperaciones.filter((r) => r.estado === "pendiente" && mis.has(r.grupoId));
  }

  const ficha = (alumnoId: string): Ficha | undefined => db.fichas[alumnoId];
  /** Alumnos de los grupos de un profe, sin repetir */
  function alumnosDeProfe(profeId: string): Usuario[] {
    const ids = new Set(db.grupos.filter((g) => g.profeId === profeId).flatMap((g) => g.alumnos));
    return [...ids].map((i) => usuario(i)).filter((x): x is Usuario => !!x).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  const gruposDeAlumno = (alumnoId: string) => db.grupos.filter((g) => g.alumnos.includes(alumnoId));
  const gruposDeClub = (clubId: string) =>
    db.grupos.filter((g) => g.clubId === clubId).sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora));
  /** Todas las personas del club: las que ya han entrado y las dadas de alta que aún no */
  function personasDeClub(clubId: string) {
    const dentro = usuariosDeClub(clubId).map((u) => ({
      email: u.email ?? "", nombre: u.nombre, rol: u.rol, nivel: u.nivel, usuario: u, activo: u.activo !== false,
      grupos: u.rol === "profe" ? db.grupos.filter((g) => g.profeId === u.id).map((g) => g.id) : gruposDeAlumno(u.id).map((g) => g.id),
    }));
    const emails = new Set(dentro.map((p) => p.email.toLowerCase()));
    const pendientes = db.invitaciones
      .filter((i) => i.clubId === clubId && !emails.has(i.email.toLowerCase()))
      .map((i) => ({ ...i, usuario: undefined as Usuario | undefined, activo: true }));
    return [...dentro, ...pendientes].sort((a, b) => a.rol.localeCompare(b.rol) || a.nombre.localeCompare(b.nombre));
  }

  const planDe = (clubId: string, nivel: string, fecha: string) => db.plan[`${clubId}|${nivel}|${lunesDe(fecha)}`];

  /** Clases de mañana de alguien (las que da o a las que va), para recordárselas */
  function clasesManana(u: Usuario, hoy: string): Clase[] {
    const m = sumarDias(hoy, 1);
    return db.grupos
      .map((g) => clase(g.id, m))
      .filter((c): c is Clase => !!c && c.cancelada === undefined && (u.rol === "profe" ? c.grupo.profeId === u.id : c.alumnos.some((a) => a.id === u.id)))
      .sort((a, b) => a.grupo.hora.localeCompare(b.grupo.hora));
  }

  /** Alumnos que el profesor puede poner en esta clase: mismo nivel, activos y que no vengan ya */
  function candidatosColocar(c: Clase): (Usuario & { recupera: boolean })[] {
    if (c.alumnos.length >= maxDe(c.grupo)) return [];
    const dentro = new Set([...c.grupo.alumnos, ...c.alumnos.map((a) => a.id)]);
    return usuariosDeClub(c.grupo.clubId)
      .filter((u) => u.rol === "alumno" && u.activo !== false && u.nivel === c.grupo.nivel && !dentro.has(u.id))
      .map((u) => ({ ...u, recupera: creditosDisponibles(u.id).some((k) => k.caduca >= c.fecha) }))
      .sort((a, b) => Number(b.recupera) - Number(a.recupera) || a.nombre.localeCompare(b.nombre));
  }

  /** Números del club entre dos fechas (solo clases ya empezadas) */
  function estadisticas(clubId: string, desde: string, hasta: string, ahora = new Date()) {
    const grupos = db.grupos.filter((g) => g.clubId === clubId);
    const porGrupo = new Map(grupos.map((g) => [g.id, { grupo: g, clases: 0, plazas: 0, ocupadas: 0, bajas: 0, lista: 0, presentes: 0 }]));
    const porAlumno = new Map<string, { previstas: number; bajas: number; faltas: number }>();
    let canceladas = 0;
    for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
      for (const g of grupos) {
        const c = clase(g.id, f);
        if (!c || c.inicio > ahora) continue;
        if (c.cancelada !== undefined) { canceladas++; continue; }
        const s = porGrupo.get(g.id)!;
        s.clases++; s.plazas += maxDe(g); s.ocupadas += c.alumnos.length; s.bajas += c.bajas.length;
        const conLista = c.alumnos.filter((a) => a.id in c.asistencia);
        s.lista += conLista.length; s.presentes += conLista.filter((a) => c.asistencia[a.id]).length;
        for (const id of g.alumnos) {
          const a = porAlumno.get(id) ?? { previstas: 0, bajas: 0, faltas: 0 };
          a.previstas++;
          if (c.bajas.some((b) => b.id === id)) a.bajas++;
          else if (c.asistencia[id] === false) a.faltas++;
          porAlumno.set(id, a);
        }
      }
    }
    const filas = [...porGrupo.values()].filter((s) => s.clases > 0);
    const suma = (k: "clases" | "plazas" | "ocupadas" | "bajas" | "lista" | "presentes") => filas.reduce((t, s) => t + s[k], 0);
    const faltones = [...porAlumno.entries()]
      .map(([id, a]) => ({ alumno: usuario(id), ...a, pct: (a.bajas + a.faltas) / a.previstas }))
      .filter((x) => x.alumno && x.alumno.activo !== false && x.bajas + x.faltas >= 2 && x.pct >= 0.25)
      .sort((a, b) => b.pct - a.pct || b.bajas + b.faltas - (a.bajas + a.faltas));
    return {
      clases: suma("clases"), canceladas, bajas: suma("bajas"),
      ocupacion: suma("plazas") ? suma("ocupadas") / suma("plazas") : undefined,
      asistencia: suma("lista") ? suma("presentes") / suma("lista") : undefined,
      grupos: filas, faltones,
    };
  }

  /** Para el panel de negocio: cuánto se usa la app en un club en los últimos días */
  function usoClub(clubId: string, hoy: string, dias = 30) {
    const desde = sumarDias(hoy, -dias);
    const grupos = new Set(db.grupos.filter((g) => g.clubId === clubId).map((g) => g.id));
    const alumnos = usuariosDeClub(clubId).filter((u) => u.rol === "alumno");
    const pendientes = db.invitaciones.filter((i) => i.clubId === clubId && i.rol === "alumno" && !alumnos.some((a) => a.email?.toLowerCase() === i.email.toLowerCase())).length;
    const enRango = (f: string) => f >= desde && f <= hoy;
    const listas = new Set(Object.keys(db.asistencias).map((k) => k.split("|")).filter(([g, f]) => grupos.has(g) && enRango(f)).map(([g, f]) => `${g}|${f}`)).size;
    const bajas = db.bajas.filter((b) => grupos.has(b.grupoId) && enRango(b.fecha)).length;
    const recs = db.recuperaciones.filter((r) => grupos.has(r.grupoId) && enRango(r.fecha)).length;
    const anuncios = db.anuncios.filter((a) => a.clubId === clubId && enRango(a.creado.slice(0, 10))).length;
    return {
      activos: alumnos.filter((a) => a.activo !== false).length,
      inactivos: alumnos.filter((a) => a.activo === false).length,
      sinEntrar: pendientes, // dados de alta que aún no han entrado nunca
      profes: usuariosDeClub(clubId).filter((u) => u.rol === "profe").length,
      listas, bajas, recs, anuncios, total: listas + bajas + recs + anuncios,
    };
  }

  return {
    usoClub,
    planDe, clasesManana, candidatosColocar, estadisticas,
    /** Niveles del club en orden. Si el club aún no tiene lista, los que ya se usan. */
    nivelesDeClub(clubId: string): Nivel[] {
      const def = db.niveles.filter((n) => n.clubId === clubId).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
      if (def.length) return def;
      const usados = [...new Set([...db.grupos.filter((g) => g.clubId === clubId).map((g) => g.nivel), ...usuariosDeClub(clubId).map((u) => u.nivel ?? "")].filter(Boolean))].sort();
      return usados.map((nombre, i) => ({ id: "", clubId, nombre, orden: i + 1 }));
    },
    notasPrivadas: (alumnoId: string) => db.notasPrivadas[alumnoId] ?? "",
    anunciosDeClub: (clubId: string) => db.anuncios.filter((a) => a.clubId === clubId).sort((a, b) => b.creado.localeCompare(a.creado)),
    avisosDe: (usuarioId: string) => db.avisos.filter((a) => a.usuarioId === usuarioId).sort((a, b) => b.creado.localeCompare(a.creado)),
    clubs: db.clubs, maxDe, ficha, alumnosDeProfe, gruposDeAlumno, gruposDeClub, personasDeClub,
    usuario, club, grupo, usuariosDeClub, clase, clasesSemana, limiteBaja,
    creditosDisponibles, clasesParaRecuperar, recuperacionesAlumno, pendientesProfe,
  };
}

// ---------- Datos de prueba en memoria (modo sin Supabase) ----------

function semilla(): Db {
  const clubs: Club[] = [
    { id: "c1", slug: "norte", codigo: "NORTE24", nombre: "Club Pádel Norte", horasBaja: 6, diasCaducidad: 21, maxAlumnos: 4, cuotaMensual: 49, cuotaAlta: 150, clienteDesde: "2026-10-01" },
    { id: "c2", slug: "sur", codigo: "SUR24", nombre: "Pádel Sur Academia", horasBaja: 24, diasCaducidad: 14, maxAlumnos: 4 },
  ];
  const u = (id: string, nombre: string, rol: Rol, nivel?: string, clubId = "c1"): Usuario =>
    ({ id, clubId, nombre, rol, nivel, email: `${nombre.split(" ")[0].toLowerCase()}@ejemplo.com` });
  const usuarios = [
    u("ad", "Administración", "admin", undefined, ""),
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
    fichas: { a1: { lesiones: "Molestias en el codo derecho", trabajado: "Volea de derecha", aTrabajar: "Bandeja y salida de pared" } },
    niveles: ["Iniciación", "Intermedio", "Avanzado"].map((nombre, i) => ({ id: `n${i}`, clubId: "c1", nombre, orden: i + 1 })),
    invitaciones: [], asistencias: {}, cancelaciones: {}, notasPrivadas: {}, avisos: [], mensajes: [],
    plan: { [`c1|Intermedio|${lunes}`]: "Bandeja y víbora: preparación y golpeo" },
    anuncios: [{ id: "an1", clubId: "c1", autorId: "p1", texto: "El sábado 28 hay torneo social: las clases de esa mañana se mantienen.", creado: new Date().toISOString() }],
  };
}

const gl = globalThis as unknown as { __db?: Db };
export const memoria: Db = (gl.__db ??= semilla());
memoria.fichas ??= {};
memoria.invitaciones ??= [];
memoria.niveles ??= [];
memoria.plan ??= {}; memoria.mensajes ??= [];
memoria.asistencias ??= {}; memoria.cancelaciones ??= {}; memoria.notasPrivadas ??= {}; memoria.anuncios ??= []; memoria.avisos ??= [];

let n = 0;
const nuevoId = (p: string) => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

export const demo = {
  clubPorCodigo: (codigo: string) => memoria.clubs.find((c) => c.codigo.toUpperCase() === codigo.trim().toUpperCase()),

  darBaja(alumnoId: string, grupoId: string, fecha: string, ahora = new Date()): string | null {
    const q = consultas(memoria);
    const c = q.clase(grupoId, fecha);
    if (!c || !c.grupo.alumnos.includes(alumnoId)) return "No estás en esa clase.";
    if (c.bajas.some((b) => b.id === alumnoId)) return "Ya te diste de baja.";
    if (ahora > q.limiteBaja(c)) return "El plazo para darte de baja ya pasó.";
    const baja: Baja = { id: nuevoId("b"), alumnoId, grupoId, fecha };
    memoria.bajas.push(baja);
    const dias = q.club(c.grupo.clubId).diasCaducidad;
    memoria.creditos.push({ id: nuevoId("cr"), alumnoId, bajaId: baja.id, caduca: sumarDias(fecha, dias), usado: false });
    return null;
  },

  pedirRecuperacion(alumnoId: string, grupoId: string, fecha: string): string | null {
    const q = consultas(memoria);
    const ok = q.clasesParaRecuperar(alumnoId).some((c) => c.grupo.id === grupoId && c.fecha === fecha);
    if (!ok) return "Esa clase ya no está disponible.";
    const cred = q.creditosDisponibles(alumnoId).filter((c) => c.caduca >= fecha).sort((a, b) => a.caduca.localeCompare(b.caduca))[0];
    if (!cred) return "No tienes recuperaciones disponibles para esa fecha.";
    memoria.recuperaciones.push({ id: nuevoId("r"), alumnoId, creditoId: cred.id, grupoId, fecha, estado: "pendiente" });
    const gr = q.grupo(grupoId)!;
    this.avisar(gr.profeId, `${q.usuario(alumnoId)?.nombre} pide recuperar en ${gr.nombre} el ${fecha}`, `/semana?d=${fecha}`);
    return null;
  },

  resolverRecuperacion(profeId: string, recId: string, aprobar: boolean): string | null {
    const q = consultas(memoria);
    const r = memoria.recuperaciones.find((x) => x.id === recId);
    if (!r || r.estado !== "pendiente") return "La solicitud ya no está pendiente.";
    const gr = q.grupo(r.grupoId)!;
    if (gr.profeId !== profeId) return "Esa clase no es tuya.";
    if (aprobar) {
      if (q.clase(r.grupoId, r.fecha)!.alumnos.length >= q.maxDe(gr)) return "La clase ya está completa.";
      memoria.creditos.find((c) => c.id === r.creditoId)!.usado = true;
    }
    r.estado = aprobar ? "aprobada" : "rechazada";
    this.avisar(r.alumnoId, `${aprobar ? "Te han aprobado la recuperación" : "No hay plaza para tu recuperación"}: ${gr.nombre}, ${r.fecha} a las ${gr.hora}`, `/semana?d=${r.fecha}`);
    return null;
  },

  guardarSesion(profeId: string, grupoId: string, fecha: string, contenido: string): string | null {
    const gr = consultas(memoria).grupo(grupoId);
    if (!gr || gr.profeId !== profeId) return "Esa clase no es tuya.";
    memoria.sesiones[`${grupoId}|${fecha}`] = contenido.trim();
    return null;
  },

  // --- Administración (modo prueba) ---
  guardarClub(id: string | null, c: Omit<Club, "id">): string | null {
    const otro = memoria.clubs.find((x) => x.id !== id && (x.slug === c.slug || x.codigo === c.codigo));
    if (otro) return "Ya hay un club con ese enlace o código.";
    if (id) Object.assign(memoria.clubs.find((x) => x.id === id)!, c);
    else memoria.clubs.push({ id: nuevoId("c"), ...c });
    return null;
  },
  guardarGrupo(id: string | null, g: Omit<Grupo, "id" | "alumnos">): string | null {
    // En el formulario el profe viene por email
    g = { ...g, profeId: memoria.usuarios.find((u) => u.email && u.email === g.profeId && u.clubId === g.clubId)?.id ?? "" };
    if (id) Object.assign(memoria.grupos.find((x) => x.id === id)!, g);
    else memoria.grupos.push({ id: nuevoId("g"), alumnos: [], ...g });
    return null;
  },
  borrarGrupo(id: string): string | null {
    memoria.grupos = memoria.grupos.filter((g) => g.id !== id);
    return null;
  },
  alta(clubId: string, email: string, nombre: string, rol: Rol, nivel?: string): string | null {
    const e = email.trim().toLowerCase();
    const u = memoria.usuarios.find((x) => x.email?.toLowerCase() === e);
    if (u && u.clubId !== clubId) return "Ese email ya está dado de alta en otro club.";
    if (u) Object.assign(u, { nombre, rol, nivel: nivel || undefined });
    else memoria.usuarios.push({ id: nuevoId("u"), clubId, email: e, nombre, rol, nivel: nivel || undefined });
    return null;
  },
  grupoAlumno(grupoId: string, email: string, dentro: boolean): string | null {
    const g = memoria.grupos.find((x) => x.id === grupoId);
    const u = memoria.usuarios.find((x) => x.email?.toLowerCase() === email.toLowerCase() && x.clubId === g?.clubId);
    if (!g || !u) return "No encontrado.";
    g.alumnos = dentro ? [...new Set([...g.alumnos, u.id])] : g.alumnos.filter((a) => a !== u.id);
    return null;
  },
  bajaPersona(clubId: string, email: string): string | null {
    const u = memoria.usuarios.find((x) => x.email?.toLowerCase() === email.toLowerCase() && x.clubId === clubId);
    if (!u) return "No encontrado.";
    memoria.usuarios = memoria.usuarios.filter((x) => x !== u);
    memoria.grupos.forEach((g) => { g.alumnos = g.alumnos.filter((a) => a !== u.id); if (g.profeId === u.id) g.profeId = ""; });
    return null;
  },
  guardarFicha(profeId: string, alumnoId: string, f: Ficha): string | null {
    const p = memoria.usuarios.find((x) => x.id === profeId);
    const a = memoria.usuarios.find((x) => x.id === alumnoId);
    if (!p || !a || p.rol !== "profe" || p.clubId !== a.clubId) return "Solo los profesores del club pueden editar la ficha.";
    memoria.fichas[alumnoId] = { ...f, actualizado: new Date().toISOString() };
    return null;
  },
  cambiarActivo(clubId: string, email: string, activo: boolean): string | null {
    const u = memoria.usuarios.find((x) => x.email?.toLowerCase() === email.toLowerCase() && x.clubId === clubId);
    if (!u) return "No encontrado.";
    u.activo = activo;
    if (!activo) memoria.grupos.forEach((g) => { g.alumnos = g.alumnos.filter((a) => a !== u.id); });
    return null;
  },
  maxGrupo(profeId: string, grupoId: string, max: number): string | null {
    const g = memoria.grupos.find((x) => x.id === grupoId);
    if (!g || g.profeId !== profeId) return "Esa clase no es tuya.";
    g.max = Math.max(1, max);
    return null;
  },
  // --- Club vivo (modo prueba) ---
  avisar(usuarioId: string | undefined, texto: string, enlace?: string) {
    if (usuarioId) memoria.avisos.push({ id: nuevoId("av"), usuarioId, texto, enlace, leido: false, creado: new Date().toISOString() });
  },
  marcarLeidos(usuarioId: string) {
    memoria.avisos.forEach((a) => { if (a.usuarioId === usuarioId) a.leido = true; });
  },
  pasarLista(profeId: string, grupoId: string, fecha: string, lista: string[], presentes: string[]): string | null {
    const g = memoria.grupos.find((x) => x.id === grupoId);
    if (!g || g.profeId !== profeId) return "Esa clase no es tuya.";
    for (const a of lista) memoria.asistencias[`${grupoId}|${fecha}|${a}`] = presentes.includes(a);
    return null;
  },
  cancelarClase(uid: string, grupoId: string, fecha: string, motivo: string): string | null {
    const q = consultas(memoria);
    const c = q.clase(grupoId, fecha);
    const yo = q.usuario(uid);
    if (!c || (c.grupo.profeId !== uid && yo?.rol !== "admin")) return "Esa clase no es tuya.";
    if (c.cancelada !== undefined) return "Esa clase ya está cancelada.";
    memoria.cancelaciones[`${grupoId}|${fecha}`] = motivo.trim();
    const club = q.club(c.grupo.clubId);
    const recupera = club.cancelarRecupera !== false;
    for (const a of c.alumnos) {
      if (recupera && c.grupo.alumnos.includes(a.id)) {
        const b = { id: nuevoId("b"), alumnoId: a.id, grupoId, fecha };
        memoria.bajas.push(b);
        memoria.creditos.push({ id: nuevoId("cr"), alumnoId: a.id, bajaId: b.id, caduca: sumarDias(fecha, club.diasCaducidad), usado: false });
      }
      this.avisar(a.id, `Se cancela ${c.grupo.nombre} del ${fecha}${recupera ? ". Tienes una recuperación." : "."}${motivo.trim() ? ` Motivo: ${motivo.trim()}` : ""}`, `/semana?d=${fecha}`);
    }
    memoria.recuperaciones.forEach((r) => { if (r.grupoId === grupoId && r.fecha === fecha && r.estado === "pendiente") r.estado = "rechazada"; });
    return null;
  },
  notasPrivadas(profeId: string, alumnoId: string, texto: string): string | null {
    const p = memoria.usuarios.find((x) => x.id === profeId);
    const a = memoria.usuarios.find((x) => x.id === alumnoId);
    if (!p || !a || p.rol !== "profe" || p.clubId !== a.clubId) return "Solo los profesores del club pueden editar la ficha.";
    memoria.notasPrivadas[alumnoId] = texto.trim();
    return null;
  },
  publicarAnuncio(uid: string, clubId: string, texto: string): string | null {
    const u = memoria.usuarios.find((x) => x.id === uid);
    if (!u || !(u.rol === "admin" || (u.rol === "profe" && u.clubId === clubId))) return "Solo profesores y administración pueden publicar.";
    if (!texto.trim()) return "Escribe el anuncio.";
    memoria.anuncios.push({ id: nuevoId("an"), clubId, autorId: uid, texto: texto.trim(), creado: new Date().toISOString() });
    memoria.usuarios.filter((x) => x.clubId === clubId && x.id !== uid && x.activo !== false)
      .forEach((x) => this.avisar(x.id, `Nuevo anuncio: ${texto.trim().slice(0, 80)}`, "/semana"));
    return null;
  },
  borrarAnuncio(uid: string, id: string): string | null {
    const u = memoria.usuarios.find((x) => x.id === uid);
    memoria.anuncios = memoria.anuncios.filter((a) => !(a.id === id && (a.autorId === uid || u?.rol === "admin")));
    return null;
  },
  marcaClub(clubId: string, color: string, logo: string, cancelarRecupera: boolean): string | null {
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return "El color tiene que ser como #123F6B.";
    Object.assign(memoria.clubs.find((c) => c.id === clubId)!, { color: color || undefined, logo: logo.trim() || undefined, cancelarRecupera });
    return null;
  },
  guardarNivel(id: string | null, clubId: string, nombre: string, orden?: number): string | null {
    const n = nombre.trim();
    if (!n) return "Escribe el nombre del nivel.";
    if (memoria.niveles.some((x) => x.clubId === clubId && x.nombre === n && x.id !== id)) return "Ese nivel ya existe.";
    if (!id) {
      const max = Math.max(0, ...memoria.niveles.filter((x) => x.clubId === clubId).map((x) => x.orden));
      memoria.niveles.push({ id: nuevoId("n"), clubId, nombre: n, orden: orden ?? max + 1 });
      return null;
    }
    const v = memoria.niveles.find((x) => x.id === id)!;
    const antes = v.nombre;
    Object.assign(v, { nombre: n, orden: orden ?? v.orden });
    memoria.grupos.forEach((g) => { if (g.clubId === clubId && g.nivel === antes) g.nivel = n; });
    memoria.usuarios.forEach((u) => { if (u.clubId === clubId && u.nivel === antes) u.nivel = n; });
    for (const k of Object.keys(memoria.plan)) {
      const [c, nv, sem] = k.split("|");
      if (c === clubId && nv === antes) { memoria.plan[`${c}|${n}|${sem}`] = memoria.plan[k]; delete memoria.plan[k]; }
    }
    return null;
  },
  colocarAlumno(uid: string, grupoId: string, fecha: string, alumnoId: string): string | null {
    const q = consultas(memoria);
    const c = q.clase(grupoId, fecha);
    if (!c || (c.grupo.profeId !== uid && q.usuario(uid)?.rol !== "admin")) return "Esa clase no es tuya.";
    if (c.cancelada !== undefined) return "Esa clase está cancelada.";
    if (c.inicio <= new Date()) return "Esa clase ya no está disponible.";
    if (!q.candidatosColocar(c).some((a) => a.id === alumnoId)) return "Ese alumno no se puede poner en esta clase.";
    const pend = memoria.recuperaciones.find((r) => r.grupoId === grupoId && r.fecha === fecha && r.alumnoId === alumnoId && r.estado === "pendiente");
    const cred = pend ? memoria.creditos.find((k) => k.id === pend.creditoId) : q.creditosDisponibles(alumnoId).filter((k) => k.caduca >= fecha).sort((a, b) => a.caduca.localeCompare(b.caduca))[0];
    if (cred) cred.usado = true;
    if (pend) pend.estado = "aprobada";
    else memoria.recuperaciones.push({ id: nuevoId("r"), alumnoId, creditoId: cred?.id ?? "", grupoId, fecha, estado: "aprobada" });
    this.avisar(alumnoId, `Tu profesor te ha puesto en ${c.grupo.nombre}, ${fecha} a las ${c.grupo.hora}`, `/semana?d=${fecha}`);
    return null;
  },
  enviarMensaje(uid: string, grupoId: string, texto: string): string | null {
    const g = memoria.grupos.find((x) => x.id === grupoId);
    const u = memoria.usuarios.find((x) => x.id === uid);
    if (!g || !u || !(u.rol === "admin" || g.profeId === uid || (g.alumnos.includes(uid) && u.activo !== false))) return "No eres de este grupo.";
    if (!texto.trim()) return "Escribe un mensaje.";
    if (texto.length > 1000) return "El mensaje es demasiado largo.";
    memoria.mensajes.push({ id: nuevoId("m"), grupoId, autorId: uid, texto: texto.trim(), creado: new Date().toISOString() });
    return null;
  },
  borrarMensaje(uid: string, id: string): string | null {
    const m = memoria.mensajes.find((x) => x.id === id);
    const g = m && memoria.grupos.find((x) => x.id === m.grupoId);
    if (m && (m.autorId === uid || g?.profeId === uid || memoria.usuarios.find((x) => x.id === uid)?.rol === "admin"))
      memoria.mensajes = memoria.mensajes.filter((x) => x !== m);
    return null;
  },
  guardarPlan(uid: string, clubId: string, nivel: string, semanas: string[], textos: string[]): string | null {
    const u = memoria.usuarios.find((x) => x.id === uid);
    if (!u || !(u.rol === "admin" || (u.rol === "profe" && u.clubId === clubId))) return "Solo los profesores del club pueden editar el plan.";
    semanas.forEach((s, i) => {
      const k = `${clubId}|${nivel}|${s}`;
      if (textos[i]?.trim()) memoria.plan[k] = textos[i].trim();
      else delete memoria.plan[k];
    });
    return null;
  },
  cuotaClub(clubId: string, mensual?: number, alta?: number, desde?: string): string | null {
    Object.assign(memoria.clubs.find((c) => c.id === clubId)!, { cuotaMensual: mensual, cuotaAlta: alta, clienteDesde: desde });
    return null;
  },
  borrarNivel(id: string): string | null {
    const v = memoria.niveles.find((x) => x.id === id);
    if (!v) return null;
    if (memoria.grupos.some((g) => g.clubId === v.clubId && g.nivel === v.nombre) || memoria.usuarios.some((u) => u.clubId === v.clubId && u.nivel === v.nombre))
      return "Ese nivel tiene grupos o alumnos. Cámbialos de nivel antes de borrarlo.";
    memoria.niveles = memoria.niveles.filter((x) => x.id !== id);
    return null;
  },
};

export type Persona = ReturnType<Consultas["personasDeClub"]>[number];
