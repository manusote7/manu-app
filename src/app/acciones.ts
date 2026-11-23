"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as d from "@/lib/datos";
import { yo } from "@/lib/sesion";

const volver = (ruta: string, error: string | null, ok: string) => {
  revalidatePath("/", "layout");
  const q = new URLSearchParams(error ? { error } : { ok });
  redirect(`${ruta}${ruta.includes("?") ? "&" : "?"}${q}`);
};

const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function entrarClub(form: FormData) {
  const c = d.clubPorCodigo(String(form.get("codigo") ?? ""));
  if (!c) redirect("/?error=" + encodeURIComponent("Ese código no corresponde a ningún club."));
  const jar = await cookies();
  jar.set("club", c.id, opts);
  jar.delete("uid");
  redirect(`/c/${c.slug}`);
}

export async function entrar(form: FormData) {
  const u = d.usuario(String(form.get("uid")));
  const clubId = String(form.get("club"));
  // Nunca se entra en un club con un usuario de otro club
  if (!u || u.clubId !== clubId) redirect("/");
  const jar = await cookies();
  jar.set("club", clubId, opts);
  jar.set("uid", u.id, opts);
  redirect("/semana");
}

export async function salir() {
  const jar = await cookies();
  const slug = d.club(jar.get("club")?.value ?? "")?.slug;
  jar.delete("uid");
  redirect(slug ? `/c/${slug}` : "/");
}

export async function cambiarClub() {
  const jar = await cookies();
  jar.delete("club");
  jar.delete("uid");
  redirect("/");
}

export async function darBaja(form: FormData) {
  const u = await yo();
  const err = d.darBaja(u.id, String(form.get("grupo")), String(form.get("fecha")));
  volver(String(form.get("ruta") ?? "/semana"), err, "Baja hecha. Tienes una recuperación nueva.");
}

export async function pedirRecuperacion(form: FormData) {
  const u = await yo();
  const err = d.pedirRecuperacion(u.id, String(form.get("grupo")), String(form.get("fecha")));
  volver(err ? "/recuperar" : "/semana", err, "Solicitud enviada al profe.");
}

export async function resolver(form: FormData) {
  const u = await yo();
  const aprobar = form.get("aprobar") === "1";
  const err = d.resolverRecuperacion(u.id, String(form.get("rec")), aprobar);
  volver(String(form.get("ruta") ?? "/semana"), err, aprobar ? "Recuperación aprobada." : "Recuperación rechazada.");
}

export async function guardarSesion(form: FormData) {
  const u = await yo();
  const err = d.guardarSesion(u.id, String(form.get("grupo")), String(form.get("fecha")), String(form.get("contenido") ?? ""));
  volver(String(form.get("ruta") ?? "/semana"), err, "Sesión guardada.");
}
