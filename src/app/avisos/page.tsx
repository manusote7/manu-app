// Avisos dentro de la app. Al abrir esta pantalla quedan como leídos.

import Link from "next/link";
import { acciones as a, datos } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { iso } from "@/lib/fechas";
import { Cabecera, Nav, Vacio } from "../marco";

const cuando = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

export default async function Avisos() {
  const u = await yo();
  const d = await datos();
  const avisos = d.avisosDe(u.id);
  const hoy = iso(new Date());
  const manana = d.clasesManana(u, hoy);
  if (avisos.some((x) => !x.leido)) await a.marcarLeidos(u.id);
  return (
    <main className="app">
      <Cabecera u={u} titulo="Avisos" />
      <div className="body">
        {manana.map((c) => (
          <Link key={c.grupo.id} href={`/semana?d=${c.fecha}`} className="card aviso-item nuevo recordatorio">
            <span><b>Mañana {u.rol === "profe" ? "das" : "tienes"} clase:</b> {c.grupo.nombre} a las {c.grupo.hora}{c.grupo.pista ? ` · ${c.grupo.pista}` : ""}</span>
            <span className="meta">Recordatorio</span>
          </Link>
        ))}
        {avisos.length === 0 && manana.length === 0 && <Vacio titulo="Sin avisos" texto="Aquí te avisaremos de recuperaciones, cancelaciones y anuncios." />}
        {avisos.map((x) => (
          <Link key={x.id} href={x.enlace ?? "/semana"} className={`card aviso-item${x.leido ? "" : " nuevo"}`}>
            <span>{x.texto}</span>
            <span className="meta">{cuando(x.creado)}</span>
          </Link>
        ))}
      </div>
      <Nav rol={u.rol} activa="semana" />
    </main>
  );
}
