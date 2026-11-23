"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { acciones as a, datos } from "@/lib/repo";
import { clubElegido, yo, yoAdmin } from "@/lib/sesion";
import type { Rol } from "@/lib/datos";
import { modoSupabase, sb } from "@/lib/supabase";

const volver = (ruta: string, error: string | null, ok: string) => {
  revalidatePath("/", "layout");
  const q = new URLSearchParams(error ? { error } : { ok });
  const [base, ancla] = ruta.split("#");
  redirect(`${base}${base.includes("?") ? "&" : "?"}${q}${ancla ? `#${ancla}` : ""}`);
};

const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function entrarClub(form: FormData) {
  revalidatePath("/", "layout");
  const c = await a.clubPorCodigo(String(form.get("codigo") ?? ""));
  if (!c) redirect("/?error=" + encodeURIComponent("Ese código no corresponde a ningún club."));
  const jar = await cookies();
  jar.set("club", JSON.stringify({ id: c.id, slug: c.slug, nombre: c.nombre }), opts);
  jar.delete("uid");
  if (modoSupabase) await (await sb()).auth.signOut();
  redirect(`/c/${c.slug}`);
}

/** Modo prueba: entrar eligiendo usuario */
export async function entrar(form: FormData) {
  const club = await clubElegido();
  const u = (await datos()).usuario(String(form.get("uid")));
  if (!club || !u || u.clubId !== club.id) redirect("/");
  (await cookies()).set("uid", u.id, opts);
  revalidatePath("/", "layout");
  redirect("/semana");
}

/** Con Supabase: te enviamos un enlace al email para entrar */
export async function entrarEmail(form: FormData) {
  const admin = form.get("admin") === "1";
  const club = admin ? undefined : await clubElegido();
  if (!admin && !club) redirect("/");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const h = await headers();
  const origen = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { error } = await (await sb()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origen}/auth/confirm${admin ? "?next=/admin" : ""}` },
  });
  const ruta = admin ? "/admin" : `/c/${club!.slug}`;
  if (error) {
    const msg = /database error|dado de alta/i.test(error.message)
      ? "Ese email no está dado de alta en el club. Pídeselo a tu club."
      : /rate limit|seconds/i.test(error.message)
        ? "Has pedido varios enlaces seguidos. Espera un minuto y vuelve a probar."
        : "No se pudo enviar el email. Vuelve a probar.";
    redirect(`${ruta}?error=${encodeURIComponent(msg)}`);
  }
  redirect(`${ruta}?enviado=${encodeURIComponent(email)}`);
}

export async function salir() {
  revalidatePath("/", "layout");
  const club = await clubElegido();
  (await cookies()).delete("uid");
  if (modoSupabase) await (await sb()).auth.signOut();
  redirect(club ? `/c/${club.slug}` : "/");
}

export async function cambiarClub() {
  revalidatePath("/", "layout");
  const jar = await cookies();
  jar.delete("club");
  jar.delete("uid");
  if (modoSupabase) await (await sb()).auth.signOut();
  redirect("/");
}

export async function darBaja(form: FormData) {
  const u = await yo();
  const err = await a.darBaja(u.id, String(form.get("grupo")), String(form.get("fecha")));
  volver(String(form.get("ruta") ?? "/semana"), err, "Baja hecha. Tienes una recuperación nueva.");
}

export async function pedirRecuperacion(form: FormData) {
  const u = await yo();
  const err = await a.pedirRecuperacion(u.id, String(form.get("grupo")), String(form.get("fecha")));
  volver(err ? "/recuperar" : "/semana", err, "Solicitud enviada al profesor.");
}

export async function resolver(form: FormData) {
  const u = await yo();
  const aprobar = form.get("aprobar") === "1";
  const err = await a.resolver(u.id, String(form.get("rec")), aprobar);
  volver(String(form.get("ruta") ?? "/semana"), err, aprobar ? "Recuperación aprobada." : "Recuperación rechazada.");
}

export async function guardarSesion(form: FormData) {
  const u = await yo();
  const err = await a.guardarSesion(u.id, String(form.get("grupo")), String(form.get("fecha")), String(form.get("contenido") ?? ""));
  volver(String(form.get("ruta") ?? "/semana"), err, "Sesión guardada.");
}

// ---------- Profe ----------

export async function guardarFicha(form: FormData) {
  const u = await yo();
  const alumno = String(form.get("alumno"));
  const t = (k: string) => String(form.get(k) ?? "").trim();
  let err = await a.guardarFicha(u.id, alumno, { lesiones: t("lesiones"), trabajado: t("trabajado"), aTrabajar: t("aTrabajar") });
  err ??= await a.notasPrivadas(u.id, alumno, t("privadas"));
  volver(`/alumnos/${alumno}`, err, "Ficha guardada.");
}

// ---------- Administración ----------

/** Modo prueba: entrar como administración sin email */
export async function entrarAdminPrueba() {
  (await cookies()).set("uid", "ad", opts);
  revalidatePath("/", "layout"); // olvida pantallas guardadas de antes de entrar
  redirect("/admin");
}

export async function salirAdmin() {
  revalidatePath("/", "layout");
  (await cookies()).delete("uid");
  if (modoSupabase) await (await sb()).auth.signOut();
  redirect("/admin");
}

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, def: number) => {
  const n = parseInt(txt(f, k), 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};

export async function guardarClub(form: FormData) {
  await yoAdmin();
  const id = txt(form, "id") || null;
  const c = {
    nombre: txt(form, "nombre"),
    slug: txt(form, "slug").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    codigo: txt(form, "codigo").toUpperCase().replace(/\s+/g, ""),
    horasBaja: num(form, "horas", 6), diasCaducidad: num(form, "dias", 28), maxAlumnos: Math.max(1, num(form, "max", 4)),
  };
  const err = !c.nombre || !c.slug || !c.codigo ? "Rellena nombre, enlace y código." : await a.guardarClub(id, c);
  volver(id ? `/admin/club/${id}` : "/admin", err, id ? "Club guardado." : "Club creado. Ábrelo para añadir grupos y personas.");
}

export async function guardarGrupo(form: FormData) {
  await yoAdmin();
  const club = txt(form, "club");
  const id = txt(form, "id") || null;
  const hora = txt(form, "hora");
  const g = {
    clubId: club, nombre: txt(form, "nombre"), nivel: txt(form, "nivel"), dia: num(form, "dia", 1),
    hora, duracion: num(form, "duracion", 60), pista: txt(form, "pista"), profeId: txt(form, "profe"),
    max: txt(form, "max") ? Math.max(1, num(form, "max", 4)) : undefined,
  };
  const err = !g.nombre || !g.nivel || !/^\d{2}:\d{2}$/.test(hora) ? "Rellena nombre, nivel y hora." : await a.guardarGrupo(id, g);
  volver(`/admin/club/${club}#grupos`, err, id ? "Grupo guardado." : "Grupo creado.");
}

export async function borrarGrupo(form: FormData) {
  await yoAdmin();
  const err = await a.borrarGrupo(txt(form, "id"));
  volver(`/admin/club/${txt(form, "club")}#grupos`, err, "Grupo borrado.");
}

/** Administración, o un profe activo del mismo club (solo para alumnos) */
async function gestor(club: string): Promise<{ admin: boolean }> {
  const id = modoSupabase
    ? (await (await sb()).auth.getClaims()).data?.claims?.sub
    : (await cookies()).get("uid")?.value;
  const u = id ? (await datos()).usuario(id) : undefined;
  if (u?.rol === "admin") return { admin: true };
  if (u?.rol === "profe" && u.clubId === club && u.activo !== false) return { admin: false };
  redirect("/");
}

const rutaGestion = (form: FormData, club: string) => txt(form, "ruta") || `/admin/club/${club}#personas`;

export async function altaPersona(form: FormData) {
  const club = txt(form, "club");
  const { admin } = await gestor(club);
  const email = txt(form, "email").toLowerCase();
  const rol = (admin && txt(form, "rol") === "profe" ? "profe" : "alumno") as Rol;
  let err = !email.includes("@") || !txt(form, "nombre") ? "Pon un nombre y un email válido." : null;
  err ??= await a.alta(club, email, txt(form, "nombre"), rol, rol === "alumno" ? txt(form, "nivel") : undefined);
  if (!err && rol === "alumno") {
    for (const g of form.getAll("grupos")) err ??= await a.grupoAlumno(String(g), email, true);
  }
  volver(rutaGestion(form, club), err, rol === "profe" ? "Profesor dado de alta." : "Alumno dado de alta. Ya puede entrar con su email.");
}

export async function gruposPersona(form: FormData) {
  const club = txt(form, "club");
  await gestor(club);
  const email = txt(form, "email");
  const antes = new Set(String(form.get("antes") ?? "").split(",").filter(Boolean));
  const ahora = new Set(form.getAll("grupos").map(String));
  let err: string | null = null;
  for (const g of ahora) if (!antes.has(g)) err ??= await a.grupoAlumno(g, email, true);
  for (const g of antes) if (!ahora.has(g)) err ??= await a.grupoAlumno(g, email, false);
  volver(rutaGestion(form, club), err, "Grupos actualizados.");
}

export async function bajaPersona(form: FormData) {
  await yoAdmin();
  const club = txt(form, "club");
  if (txt(form, "confirmar") !== "si") volver(`/admin/club/${club}#personas`, "Marca la casilla para confirmar.", "");
  const err = await a.bajaPersona(club, txt(form, "email"));
  volver(`/admin/club/${club}#personas`, err, "Persona quitada del club.");
}

export async function cambiarActivo(form: FormData) {
  const club = txt(form, "club");
  await gestor(club);
  const activo = txt(form, "activo") === "1";
  const err = await a.cambiarActivo(club, txt(form, "email"), activo);
  volver(rutaGestion(form, club), err, activo ? "Alumno activado. Ponle en sus grupos." : "Alumno marcado como inactivo.");
}

export async function guardarMax(form: FormData) {
  const u = await yo();
  const err = await a.maxGrupo(u.id, txt(form, "grupo"), num(form, "max", 4));
  volver(txt(form, "ruta") || "/semana", err, "Máximo de alumnos guardado.");
}

/** El profe (o administración) cambia el nivel de un alumno */
export async function cambiarNivel(form: FormData) {
  const club = txt(form, "club");
  await gestor(club);
  const nivel = txt(form, "nivel");
  const err = nivel ? await a.alta(club, txt(form, "email"), txt(form, "nombre"), "alumno", nivel) : "Escribe un nivel.";
  volver(rutaGestion(form, club), err, `Nivel cambiado a ${nivel}.`);
}

// ---------- Club vivo ----------

/** Quien está conectado: administración o alguien del club */
async function quien() {
  const id = modoSupabase
    ? (await (await sb()).auth.getClaims()).data?.claims?.sub
    : (await cookies()).get("uid")?.value;
  const u = id ? (await datos()).usuario(id) : undefined;
  if (!u) redirect("/");
  return u;
}

export async function pasarLista(form: FormData) {
  const u = await yo();
  const lista = String(form.get("lista") ?? "").split(",").filter(Boolean);
  const presentes = form.getAll("presente").map(String);
  const err = await a.pasarLista(u.id, txt(form, "grupo"), txt(form, "fecha"), lista, presentes);
  volver(txt(form, "ruta") || "/semana", err, `Lista guardada: ${presentes.length} de ${lista.length}.`);
}

export async function cancelarClase(form: FormData) {
  const u = await quien();
  const ruta = txt(form, "ruta") || "/semana";
  if (txt(form, "confirmar") !== "si") volver(ruta, "Marca la casilla para confirmar la cancelación.", "");
  const err = await a.cancelarClase(u.id, txt(form, "grupo"), txt(form, "fecha"), txt(form, "motivo"));
  volver(ruta, err, "Clase cancelada. Hemos avisado a los alumnos.");
}

export async function publicarAnuncio(form: FormData) {
  const u = await quien();
  const club = u.rol === "admin" ? txt(form, "club") : u.clubId;
  const err = await a.publicarAnuncio(u.id, club, txt(form, "texto"));
  volver(txt(form, "ruta") || "/semana", err, "Anuncio publicado.");
}

export async function borrarAnuncio(form: FormData) {
  const u = await quien();
  const err = await a.borrarAnuncio(u.id, txt(form, "id"));
  volver(txt(form, "ruta") || "/semana", err, "Anuncio borrado.");
}

export async function marcaClub(form: FormData) {
  await yoAdmin();
  const club = txt(form, "club");
  const err = await a.marcaClub(club, txt(form, "color"), txt(form, "logo"), form.get("recupera") === "on");
  volver(`/admin/club/${club}`, err, "Marca y reglas guardadas.");
}

export async function guardarNivel(form: FormData) {
  await yoAdmin();
  const club = txt(form, "club");
  const orden = txt(form, "orden") ? num(form, "orden", 1) : undefined;
  const err = await a.guardarNivel(txt(form, "id") || null, club, txt(form, "nombre"), orden);
  volver(`/admin/club/${club}#niveles`, err, "Nivel guardado.");
}

/** Sube o baja un nivel en la lista intercambiando su orden con el vecino */
export async function moverNivel(form: FormData) {
  await yoAdmin();
  const club = txt(form, "club");
  const lista = (await datos()).nivelesDeClub(club);
  const i = lista.findIndex((n) => n.id === txt(form, "id"));
  const j = i + (txt(form, "dir") === "arriba" ? -1 : 1);
  let err: string | null = null;
  if (i >= 0 && j >= 0 && j < lista.length) {
    lista.forEach((n, k) => (n.orden = k + 1));
    [lista[i].orden, lista[j].orden] = [lista[j].orden, lista[i].orden];
    for (const n of lista) err ??= await a.guardarNivel(n.id, club, n.nombre, n.orden);
  }
  volver(`/admin/club/${club}#niveles`, err, "Orden guardado.");
}

export async function borrarNivel(form: FormData) {
  await yoAdmin();
  const club = txt(form, "club");
  const err = await a.borrarNivel(txt(form, "id"));
  volver(`/admin/club/${club}#niveles`, err, "Nivel borrado.");
}

// ---------- Colocar alumno, chat, plan y cuotas ----------

export async function colocarAlumno(form: FormData) {
  const u = await quien();
  const err = txt(form, "alumno")
    ? await a.colocarAlumno(u.id, txt(form, "grupo"), txt(form, "fecha"), txt(form, "alumno"))
    : "Elige un alumno.";
  volver(txt(form, "ruta") || "/semana", err, "Alumno puesto en la clase. Le hemos avisado.");
}

export async function enviarMensaje(form: FormData) {
  const u = await quien();
  const grupo = txt(form, "grupo");
  const err = await a.enviarMensaje(u.id, grupo, txt(form, "texto"));
  revalidatePath("/", "layout");
  redirect(`/chat/${grupo}${err ? `?error=${encodeURIComponent(err)}` : ""}#fin`);
}

export async function borrarMensaje(form: FormData) {
  const u = await quien();
  const grupo = txt(form, "grupo");
  const err = await a.borrarMensaje(u.id, txt(form, "id"));
  volver(`/chat/${grupo}`, err, "Mensaje borrado.");
}

export async function guardarPlan(form: FormData) {
  const u = await quien();
  const club = u.rol === "admin" ? txt(form, "club") : u.clubId;
  const nivel = txt(form, "nivel");
  const semanas = form.getAll("semana").map(String);
  const textos = form.getAll("texto").map(String);
  const err = nivel ? await a.guardarPlan(u.id, club, nivel, semanas, textos) : "Elige un nivel.";
  volver(txt(form, "ruta") || `/plan?nivel=${encodeURIComponent(nivel)}`, err, "Plan guardado.");
}

export async function cuotaClub(form: FormData) {
  await yoAdmin();
  const club = txt(form, "club");
  const dinero = (k: string) => {
    const v = parseFloat(txt(form, k).replace(",", "."));
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  const err = await a.cuotaClub(club, dinero("mensual"), dinero("alta"), txt(form, "desde") || undefined);
  volver(`/admin/club/${club}`, err, "Cuota guardada.");
}
