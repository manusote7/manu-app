export const instant = false;

import Link from "next/link";
import { datos } from "@/lib/repo";
import { adminActual } from "@/lib/sesion";
import EntrarAdmin from "./entrar/page";
import { guardarClub, salirAdmin } from "../acciones";
import { Aviso, Vacio, iniciales } from "../marco";
import { Boton } from "../cliente";
import { CamposClub } from "./campos";

export default async function Admin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; enviado?: string }> }) {
  // Sin sesión se muestra el acceso aquí mismo (sin redirigir)
  if (!(await adminActual())) return <EntrarAdmin searchParams={searchParams} />;
  const d = await datos();
  const sp = await searchParams;
  const clubs = [...d.clubs].sort((a, b) => a.nombre.localeCompare(b.nombre));
  return (
    <main className="app ancha">
      <Aviso ok={sp.ok} error={sp.error} />
      <header className="cab">
        <div className="cab-top">
          <span className="marca" aria-hidden>A</span>
          <div className="cab-txt"><span className="cab-club">Administración</span><h1>Clubs</h1></div>
          <form action={salirAdmin} className="cab-acc"><Boton className="btn">Salir</Boton></form>
        </div>
      </header>
      <div className="body" style={{ paddingBottom: 40 }}>
        {clubs.length === 0 && <Vacio titulo="Aún no hay clubs" texto="Crea el primero aquí abajo." />}
        {clubs.map((c) => {
          const personas = d.personasDeClub(c.id);
          return (
            <Link key={c.id} href={`/admin/club/${c.id}`} className="card">
              <div className="fila-club">
                <span className="marca" aria-hidden>{iniciales(c.nombre)}</span>
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <h3>{c.nombre}</h3>
                  <span className="meta">Código <span className="codigo-club">{c.codigo}</span> · /c/{c.slug}</span>
                </div>
              </div>
              <div className="cifras">
                <span><b>{d.gruposDeClub(c.id).length}</b> grupos</span>
                <span><b>{personas.filter((p) => p.rol === "profe").length}</b> profes</span>
                <span><b>{personas.filter((p) => p.rol === "alumno").length}</b> alumnos</span>
              </div>
            </Link>
          );
        })}
        <details className="bloque">
          <summary><b>+ Nuevo club</b></summary>
          <form action={guardarClub} className="form">
            <CamposClub />
            <Boton className="btn prim">Crear club</Boton>
          </form>
        </details>
      </div>
    </main>
  );
}
