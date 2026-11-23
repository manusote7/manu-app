// Pantalla con datos por usuario: se genera en cada petición.
export const instant = false;

import Link from "next/link";
import { datos } from "@/lib/repo";
import { fechaCorta, horaFin, nombreDia } from "@/lib/fechas";
import { yo } from "@/lib/sesion";
import { pedirRecuperacion } from "../acciones";
import { Aviso, Cabecera, Nav } from "../marco";

export default async function Recuperar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const d = await datos();
  const u = await yo();
  const { error } = await searchParams;
  const clases = d.clasesParaRecuperar(u.id);
  const max = d.club(u.clubId).maxAlumnos;
  return (
    <main className="app">
      <Cabecera u={u} titulo="Recuperar una clase">
        <Link href="/semana" className="meta" style={{ color: "#fff" }}>‹ Volver a mi semana</Link>
      </Cabecera>
      <div className="body">
        <Aviso error={error} />
        <p className="meta">Clases de nivel {u.nivel} con plaza libre. El profe tiene que aprobarlo.</p>
        {clases.length === 0 && <p className="vacio">Ahora mismo no hay clases con plaza.</p>}
        {clases.map((c) => (
          <form key={c.grupo.id + c.fecha} action={pedirRecuperacion} className="cls">
            <input type="hidden" name="grupo" value={c.grupo.id} />
            <input type="hidden" name="fecha" value={c.fecha} />
            <div className="row">
              <span className="time">{c.grupo.hora}–{horaFin(c.grupo.hora, c.grupo.duracion)}</span>
              <span className="lvl">{c.grupo.nombre}</span>
            </div>
            <p className="meta">{nombreDia(c.fecha)} {fechaCorta(c.fecha)} · {c.grupo.pista} · Prof. {d.usuario(c.grupo.profeId)?.nombre} · {max - c.alumnos.length - c.pendientes.length} plaza(s)</p>
            <div><button className="btn p">Pedir esta clase</button></div>
          </form>
        ))}
      </div>
      <Nav u={u} activa="semana" />
    </main>
  );
}
