"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { acciones as a, datos } from "@/lib/repo";
import { clubElegido, yo } from "@/lib/sesion";
import { modoSupabase, sb } from "@/lib/supabase";

const volver = (ruta: string, error: string | null, ok: string) => {
  revalidatePath("/", "layout");
  const q = new URLSearchParams(error ? { error } : { ok });
  redirect(`${ruta}${ruta.includes("?") ? "&" : "?"}${q}`);
};

const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function entrarClub(form: FormData) {
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
  redirect("/semana");
}

/** Con Supabase: te enviamos un enlace al email para entrar */
export async function entrarEmail(form: FormData) {
  const club = await clubElegido();
  if (!club) redirect("/");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const h = await headers();
  const origen = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { error } = await (await sb()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origen}/auth/confirm` },
  });
  const ruta = `/c/${club.slug}`;
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
  const club = await clubElegido();
  (await cookies()).delete("uid");
  if (modoSupabase) await (await sb()).auth.signOut();
  redirect(club ? `/c/${club.slug}` : "/");
}

export async function cambiarClub() {
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
  volver(err ? "/recuperar" : "/semana", err, "Solicitud enviada al profe.");
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
