// Profe: sus alumnos, altas y grupos.

import Link from "next/link";
import { redirect } from "next/navigation";
import { datos } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { Aviso, Cabecera, Nav, Vacio } from "../marco";
import { FormAlta, PersonaGestion } from "../personas";
import { DIAS } from "../admin/campos";

export default async function Alumnos({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; ver?: string }> }) {
  const u = await yo();
  if (u.rol !== "profe") redirect("/semana");
  const d = await datos();
  const sp = await searchParams;
  const grupos = d.gruposDeClub(u.clubId);
  const misGrupos = new Set(grupos.filter((g) => g.profeId === u.id).map((g) => g.id));
  const todos = d.personasDeClub(u.clubId).filter((p) => p.rol === "alumno");
  const verTodos = sp.ver === "club";
  const lista = verTodos ? todos : todos.filter((p) => p.grupos.some((g) => misGrupos.has(g)) || !p.usuario || !p.activo);
  const activos = lista.filter((p) => p.activo);
  const inactivos = lista.filter((p) => !p.activo);
  const niveles = d.nivelesDeClub(u.clubId).map((n) => n.nombre);
  const ruta = `/alumnos${verTodos ? "?ver=club" : ""}`;

  return (
    <main className="app">
      <Aviso ok={sp.ok} error={sp.error} />
      <Cabecera u={u} titulo="Alumnos">
        <div className="checks" role="tablist">
          <Link className="btn" aria-current={!verTodos ? "page" : undefined} href="/alumnos" style={!verTodos ? { background: "var(--pista)", color: "#fff", borderColor: "var(--pista)" } : undefined}>Mis grupos</Link>
          <Link className="btn" aria-current={verTodos ? "page" : undefined} href="/alumnos?ver=club" style={verTodos ? { background: "var(--pista)", color: "#fff", borderColor: "var(--pista)" } : undefined}>Todo el club</Link>
        </div>
      </Cabecera>
      <div className="body">
        <FormAlta club={u.clubId} grupos={grupos} niveles={niveles} ruta={ruta} />
        {activos.length === 0 && <Vacio titulo="Sin alumnos todavía" texto="Da de alta a tus alumnos con su email." />}
        {!verTodos && grupos.filter((g) => misGrupos.has(g.id)).map((g) => {
          const suyos = activos.filter((p) => p.grupos.includes(g.id));
          return (
            <section key={g.id} className="grupo-sec">
              <div className="grupo-cab">
                <span style={{ display: "grid" }}><b>{g.nombre}</b><span className="meta">{DIAS[g.dia - 1]} {g.hora}{g.pista ? ` · ${g.pista}` : ""} · {g.nivel}</span></span>
                <span className={`pill ${suyos.length >= d.maxDe(g) ? "gris" : "ok"}`}>{suyos.length}/{d.maxDe(g)}</span>
              </div>
              {suyos.length === 0 && <p className="meta">Nadie en este grupo. Añade alumnos desde su ficha.</p>}
              {suyos.map((p) => <PersonaGestion key={p.email} p={p} club={u.clubId} grupos={grupos} ruta={ruta} conFicha niveles={niveles} />)}
            </section>
          );
        })}
        {!verTodos && activos.some((p) => !p.grupos.some((g) => misGrupos.has(g))) && <p className="seccion">Sin grupo o pendientes de entrar</p>}
        {(verTodos ? activos : activos.filter((p) => !p.grupos.some((g) => misGrupos.has(g))))
          .map((p) => <PersonaGestion key={p.email} p={p} club={u.clubId} grupos={grupos} ruta={ruta} conFicha niveles={niveles} />)}
        {inactivos.length > 0 && <p className="seccion">Inactivos</p>}
        {inactivos.map((p) => <PersonaGestion key={p.email} p={p} club={u.clubId} grupos={grupos} ruta={ruta} conFicha niveles={niveles} />)}
      </div>
      <Nav rol="profe" activa="alumnos" />
    </main>
  );
}
