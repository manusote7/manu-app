export const instant = false;

import Link from "next/link";
import { datos } from "@/lib/repo";
import { adminActual } from "@/lib/sesion";
import EntrarAdmin from "./entrar/page";
import { guardarClub, salirAdmin } from "../acciones";
import { Aviso, Marca, Vacio } from "../marco";
import { Boton } from "../cliente";
import { CamposClub } from "./campos";
import { iso } from "@/lib/fechas";

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });

export default async function Admin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; enviado?: string }> }) {
  // Sin sesión se muestra el acceso aquí mismo (sin redirigir)
  if (!(await adminActual())) return <EntrarAdmin searchParams={searchParams} />;
  const d = await datos();
  const sp = await searchParams;
  const clubs = [...d.clubs].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const hoy = iso(new Date());
  const uso = Object.fromEntries(clubs.map((c) => [c.id, d.usoClub(c.id, hoy)]));
  const mensual = clubs.reduce((t, c) => t + (c.cuotaMensual ?? 0), 0);
  const altas = clubs.reduce((t, c) => t + (c.cuotaAlta ?? 0), 0);
  const activos = clubs.reduce((t, c) => t + uso[c.id].activos, 0);
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
        <p className="seccion">Tu negocio</p>
        <div className="cifras-grandes">
          <div><b>{euros(mensual)}</b><span>Al mes</span></div>
          <div><b>{euros(mensual * 12)}</b><span>Al año</span></div>
          <div><b>{euros(altas)}</b><span>Configuraciones cobradas</span></div>
          <div><b>{activos}</b><span>Alumnos activos en {clubs.length} clubs</span></div>
        </div>
        <p className="seccion">Clubs</p>
        {clubs.length === 0 && <Vacio titulo="Aún no hay clubs" texto="Crea el primero aquí abajo." />}
        {clubs.map((c) => {
          const personas = d.personasDeClub(c.id);
          return (
            <Link key={c.id} href={`/admin/club/${c.id}`} className="card">
              <div className="fila-club">
                <Marca club={c} />
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <h3>{c.nombre}</h3>
                  <span className="meta">Código <span className="codigo-club">{c.codigo}</span> · /c/{c.slug}</span>
                </div>
              </div>
              <div className="cifras">
                <span><b>{c.cuotaMensual !== undefined ? euros(c.cuotaMensual) : "–"}</b> al mes</span>
                <span><b>{uso[c.id].activos}</b> alumnos activos</span>
                <span><b>{personas.filter((p) => p.rol === "profe").length}</b> profesores</span>
                <span><b>{d.gruposDeClub(c.id).length}</b> grupos</span>
              </div>
              <span className="meta">
                Uso últimos 30 días: {uso[c.id].listas} listas pasadas · {uso[c.id].bajas} bajas · {uso[c.id].recs} recuperaciones · {uso[c.id].anuncios} anuncios
                {uso[c.id].sinEntrar > 0 ? ` · ${uso[c.id].sinEntrar} alumnos aún sin entrar` : ""}
                {c.clienteDesde ? ` · Cliente desde ${c.clienteDesde.split("-").reverse().join("/")}` : ""}
              </span>
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
