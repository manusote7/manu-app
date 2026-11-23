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

export async function entrar(form: FormData) {
  (await cookies()).set("uid", String(form.get("uid")), { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/semana");
}

export async function salir() {
  (await cookies()).delete("uid");
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
