import { NextResponse } from "next/server";
import { ampliarDatos, datos, mensajesDe } from "@/lib/repo";
import { yoAdmin } from "@/lib/sesion";

/** RGPD: administración descarga los datos de una persona para entregárselos */
export async function GET(req: Request) {
  ampliarDatos("2000-01-01");
  await yoAdmin();
  const q = new URL(req.url).searchParams;
  const club = q.get("club") ?? "", email = (q.get("email") ?? "").toLowerCase();
  const d = await datos();
  const p = d.personasDeClub(club).find((x) => x.email.toLowerCase() === email);
  if (!p) return new NextResponse("No encontrado", { status: 404 });
  const cuerpo = p.usuario
    ? { ...d.exportar(p.usuario.id), mensajes_chat: await mensajesDe(p.usuario.id) }
    : { persona: { nombre: p.nombre, email: p.email, rol: p.rol, nivel: p.nivel }, nota: "Dada de alta pero aún no ha entrado nunca." };
  return new NextResponse(JSON.stringify(cuerpo, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="datos-${email.replace(/[^a-z0-9]+/g, "-")}.json"`,
      "cache-control": "no-store",
    },
  });
}
