// Profesor: cosas de todo el club (plan de temporada, estadísticas y tablón).

import Link from "next/link";
import { redirect } from "next/navigation";
import { datos } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { iso, sumarDias } from "@/lib/fechas";
import { Cabecera, Icono, Nav } from "../marco";

export default async function Club() {
  const u = await yo();
  if (u.rol !== "profe") redirect("/semana");
  const d = await datos();
  const hoy = iso(new Date());
  const e = d.estadisticas(u.clubId, sumarDias(hoy, -28), hoy);
  const items = [
    { href: "/plan#actual", t: "Plan de temporada", s: "Qué toca trabajar cada semana en cada nivel" },
    { href: "/estadisticas", t: "Estadísticas", s: `Últimas 4 semanas: asistencia ${e.asistencia === undefined ? "–" : Math.round(e.asistencia * 100) + "%"} · ${e.bajas} bajas` },
    { href: "/tablon", t: "Tablón", s: `${d.anunciosDeClub(u.clubId).length} anuncios` },
  ];
  return (
    <main className="app">
      <Cabecera u={u} titulo="Club" />
      <div className="body">
        <div className="lista">
          {items.map((x) => (
            <Link key={x.href} href={x.href} className="chat-fila">
              <span style={{ display: "grid", gap: 2 }}><b>{x.t}</b><span className="meta">{x.s}</span></span>
              <Icono.adelante />
            </Link>
          ))}
        </div>
      </div>
      <Nav rol={u.rol} activa="club" />
    </main>
  );
}
