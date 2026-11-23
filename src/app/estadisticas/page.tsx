export const instant = false;

import { redirect } from "next/navigation";
import { datos } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { Cabecera, Nav } from "../marco";
import { Estadisticas } from "../estadisticas";

export default async function Stats({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const u = await yo();
  if (u.rol !== "profe") redirect("/semana");
  const d = await datos();
  const sp = await searchParams;
  return (
    <main className="app">
      <Cabecera u={u} titulo="Estadísticas del club" />
      <div className="body"><Estadisticas d={d} clubId={u.clubId} periodo={sp.p} base="/estadisticas" /></div>
      <Nav rol={u.rol} activa="club" />
    </main>
  );
}
