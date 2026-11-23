// Profe: ficha de un alumno.
export const instant = false;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { datos } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { guardarFicha } from "../../acciones";
import { Aviso, Icono, Nav, iniciales } from "../../marco";
import { Boton } from "../../cliente";
import { DIAS } from "../../admin/campos";

export default async function FichaAlumno({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await yo();
  if (u.rol !== "profe") redirect("/semana");
  const { id } = await params;
  const sp = await searchParams;
  const d = await datos();
  const al = d.usuario(id);
  if (!al || al.clubId !== u.clubId || al.rol !== "alumno") notFound();
  const f = d.ficha(id);
  const grupos = d.gruposDeAlumno(id);

  return (
    <main className="app">
      <Aviso ok={sp.ok} error={sp.error} />
      <header className="cab">
        <div className="cab-top">
          <Link href="/alumnos" className="icono-btn" aria-label="Volver a alumnos"><Icono.atras /></Link>
          <span className="ini" style={{ width: 40, height: 40 }}>{iniciales(al.nombre)}</span>
          <div className="cab-txt"><span className="cab-club">{al.nivel ?? "Sin nivel"}{al.activo === false ? " · Inactivo" : ""}</span><h1>{al.nombre}</h1></div>
        </div>
      </header>
      <div className="body">
        {f?.lesiones && <div className="aviso-lesion"><small>Lesiones y molestias</small><span className="texto-ficha">{f.lesiones}</span></div>}
        <div className="card">
          <p className="seccion">Grupos</p>
          {grupos.length === 0 ? <p className="meta">No está en ningún grupo.</p> : (
            <div className="alumnos">{grupos.map((g) => <span key={g.id} className="chip" style={{ paddingLeft: 10 }}>{g.nombre} · {DIAS[g.dia - 1].slice(0, 3)} {g.hora}</span>)}</div>
          )}
        </div>
        <form action={guardarFicha} className="card form">
          <input type="hidden" name="alumno" value={id} />
          <p className="seccion">Ficha</p>
          <label>Lesiones y molestias<textarea name="lesiones" rows={2} defaultValue={f?.lesiones} placeholder="Ej. molestias en el codo derecho" /></label>
          <label>Lo que ha trabajado<textarea name="trabajado" rows={3} defaultValue={f?.trabajado} placeholder="Ej. volea de derecha, globo" /></label>
          <label>Lo que tiene que trabajar<textarea name="aTrabajar" rows={3} defaultValue={f?.aTrabajar} placeholder="Ej. bandeja y salida de pared" /></label>
          <p className="meta">El alumno ve lo de arriba en su perfil. Lo de abajo solo lo ven los profesores.</p>
          <label>Notas privadas (solo profesores)<textarea name="privadas" rows={3} defaultValue={d.notasPrivadas(id)} placeholder="Ej. le cuesta la constancia; mejor emparejarlo con alguien de su nivel" /></label>
          {f?.actualizado && <p className="meta">Actualizada el {new Date(f.actualizado).toLocaleDateString("es-ES")}</p>}
          <div><Boton className="btn prim">Guardar ficha</Boton></div>
        </form>
      </div>
      <Nav rol="profe" activa="alumnos" />
    </main>
  );
}
