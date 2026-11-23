// Plan de temporada: qué se trabaja cada semana en cada nivel. Lo preparan los profesores.
export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { datos } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { semanasTemporada } from "@/lib/datos";
import { fechaCorta, iso, lunesDe } from "@/lib/fechas";
import { guardarPlan } from "../acciones";
import { Aviso, Cabecera, Nav, Vacio } from "../marco";
import { Boton } from "../cliente";

export default async function Plan({ searchParams }: { searchParams: Promise<{ nivel?: string; ok?: string; error?: string }> }) {
  const u = await yo();
  if (u.rol !== "profe") redirect("/semana");
  const d = await datos();
  const sp = await searchParams;
  const niveles = d.nivelesDeClub(u.clubId).map((n) => n.nombre);
  const mios = d.gruposDeClub(u.clubId).filter((g) => g.profeId === u.id).map((g) => g.nivel);
  const nivel = sp.nivel && niveles.includes(sp.nivel) ? sp.nivel : (mios[0] ?? niveles[0]);
  const hoy = iso(new Date());
  const actual = lunesDe(hoy);
  const semanas = semanasTemporada(hoy);
  const ruta = `/plan?nivel=${encodeURIComponent(nivel ?? "")}`;
  const hechas = nivel ? semanas.filter((s) => d.planDe(u.clubId, nivel, s)).length : 0;

  return (
    <main className="app">
      <Aviso ok={sp.ok} error={sp.error} />
      <Cabecera u={u} titulo="Plan de temporada">
        {niveles.length > 0 && (
          <div className="checks" role="tablist" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
            {niveles.map((n) => (
              <Link key={n} className="btn" href={`/plan?nivel=${encodeURIComponent(n)}`} aria-current={n === nivel ? "page" : undefined}
                style={n === nivel ? { background: "var(--pista)", color: "#fff", borderColor: "var(--pista)", whiteSpace: "nowrap" } : { whiteSpace: "nowrap" }}>{n}</Link>
            ))}
          </div>
        )}
      </Cabecera>
      <div className="body">
        {!nivel && <Vacio titulo="Sin niveles" texto="Administración tiene que crear los niveles del club." />}
        {nivel && (
          <form action={guardarPlan} className="form plan-form">
            <input type="hidden" name="nivel" value={nivel} />
            <input type="hidden" name="ruta" value={ruta} />
            <p className="meta">Temporada {semanas[0].slice(0, 4)}-{semanas.at(-1)!.slice(0, 4)} · {hechas} de {semanas.length} semanas preparadas. Lo verán los alumnos de {nivel} en sus clases de cada semana.</p>
            {semanas.map((s, i) => (
              <label key={s} className={`plan-sem${s === actual ? " actual" : ""}${s < actual ? " pasada" : ""}`} id={s === actual ? "actual" : undefined}>
                <span><b>Semana {i + 1}</b> · {fechaCorta(s)}{s === actual ? " · esta semana" : ""}</span>
                <input type="hidden" name="semana" value={s} />
                <textarea name="texto" rows={2} defaultValue={d.planDe(u.clubId, nivel, s)} placeholder={i === 0 ? "Ej. Volea de derecha y posición en red" : ""} />
              </label>
            ))}
            <div className="guardar-fijo"><Boton className="btn prim">Guardar plan de {nivel}</Boton></div>
          </form>
        )}
      </div>
      <Nav rol={u.rol} activa="club" />
    </main>
  );
}
