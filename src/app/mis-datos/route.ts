import { NextResponse } from "next/server";
import { ampliarDatos, datos, mensajesDe } from "@/lib/repo";
import { yo } from "@/lib/sesion";

/** RGPD: descarga de todos tus datos en un archivo (derecho de acceso y portabilidad) */
export async function GET() {
  ampliarDatos("2000-01-01");
  const u = await yo({ sinPrivacidad: true });
  const datosPersona = { ...(await datos()).exportar(u.id), mensajes_chat: await mensajesDe(u.id) };
  return new NextResponse(JSON.stringify(datosPersona, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mis-datos-palaclass.json"`,
      "cache-control": "no-store",
    },
  });
}
