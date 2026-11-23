import Link from "next/link";
import type { Consultas } from "@/lib/datos";
import { semanasTemporada } from "@/lib/datos";
import { iso, sumarDias } from "@/lib/fechas";
import { DIAS } from "./admin/campos";

const PERIODOS = { "4": "4 semanas", "12": "12 semanas", temporada: "Temporada" } as const;
type Periodo = keyof typeof PERIODOS;
const pct = (v?: number) => (v === undefined ? "–" : `${Math.round(v * 100)}%`);

/** Asistencia, bajas, ocupación y alumnos que faltan mucho */
export function Estadisticas({ d, clubId, periodo, base }: { d: Consultas; clubId: string; periodo?: string; base: string }) {
  const p: Periodo = periodo && periodo in PERIODOS ? (periodo as Periodo) : "4";
  const hoy = iso(new Date());
  const desde = p === "temporada" ? semanasTemporada(hoy)[0] : sumarDias(hoy, -7 * Number(p));
  const e = d.estadisticas(clubId, desde, hoy);
  const sep = base.includes("?") ? "&" : "?";
  return (
    <>
      <div className="checks" role="tablist">
        {(Object.keys(PERIODOS) as Periodo[]).map((k) => (
          <Link key={k} className="btn" href={`${base}${sep}p=${k}`} aria-current={k === p ? "page" : undefined}
            style={k === p ? { background: "var(--pista)", color: "#fff", borderColor: "var(--pista)" } : undefined}>{PERIODOS[k]}</Link>
        ))}
      </div>
      <div className="cifras-grandes">
        <div><b>{pct(e.asistencia)}</b><span>Asistencia</span></div>
        <div><b>{pct(e.ocupacion)}</b><span>Ocupación</span></div>
        <div><b>{e.bajas}</b><span>Bajas avisadas</span></div>
        <div><b>{e.clases}</b><span>Clases dadas{e.canceladas ? ` · ${e.canceladas} canceladas` : ""}</span></div>
      </div>
      {e.asistencia === undefined && e.clases > 0 && <p className="meta">La asistencia sale cuando los profesores pasan lista.</p>}

      <p className="seccion">Alumnos que faltan mucho</p>
      {e.faltones.length === 0
        ? <p className="meta">Nadie falta a más de 1 de cada 4 clases. ¡Bien!</p>
        : (
          <div className="lista">
            {e.faltones.slice(0, 15).map((x) => (
              <div key={x.alumno!.id} className="stat-fila">
                <span style={{ display: "grid" }}><b style={{ fontWeight: 600 }}>{x.alumno!.nombre}</b><span className="meta">{x.alumno!.nivel ?? ""}</span></span>
                <span className="meta" style={{ textAlign: "right" }}>
                  <b style={{ color: "var(--mal)" }}>{pct(x.pct)}</b> sin venir<br />{x.bajas} bajas · {x.faltas} faltas de {x.previstas}
                </span>
              </div>
            ))}
          </div>
        )}

      <p className="seccion">Por grupo</p>
      {e.grupos.length === 0 && <p className="meta">Aún no hay clases en este periodo.</p>}
      {e.grupos.length > 0 && (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Grupo</th><th>Clases</th><th>Ocupación</th><th>Asistencia</th><th>Bajas</th></tr></thead>
            <tbody>
              {e.grupos.map((s) => (
                <tr key={s.grupo.id}>
                  <td><b>{s.grupo.nombre}</b><br /><span className="meta">{DIAS[s.grupo.dia - 1].slice(0, 3)} {s.grupo.hora} · {d.usuario(s.grupo.profeId)?.nombre ?? "Sin profesor"}</span></td>
                  <td>{s.clases}</td>
                  <td>{pct(s.plazas ? s.ocupadas / s.plazas : undefined)}</td>
                  <td>{pct(s.lista ? s.presentes / s.lista : undefined)}</td>
                  <td>{s.bajas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
