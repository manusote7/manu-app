// Pantalla con datos por usuario: se genera en cada petición.
export const instant = false;

import Link from "next/link";
import type { Clase, Usuario, Recuperacion } from "@/lib/datos";
import { datos } from "@/lib/repo";
import { fechaCorta, formatoLimite, horaFin, iso, letraDia, lunesDe, nombreDia, sumarDias, deIso } from "@/lib/fechas";
import { yo } from "@/lib/sesion";
import { darBaja, guardarSesion, resolver } from "../acciones";
import { Aviso, Cabecera, Nav } from "../marco";

type SP = Promise<{ d?: string; ok?: string; error?: string }>;

export default async function MiSemana({ searchParams }: { searchParams: SP }) {
  const d = await datos();
  const u = await yo();
  const sp = await searchParams;
  const hoy = iso(new Date());
  const dia = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : hoy;
  const lunes = lunesDe(dia);
  const ruta = `/semana?d=${dia}`;

  const esProfe = u.rol === "profe";
  const misRecs = esProfe ? [] : d.recuperacionesAlumno(u.id, lunes);
  const clases = esProfe
    ? d.clasesSemana(lunes, (g) => g.profeId === u.id)
    : d.clasesSemana(lunes, (g) => g.alumnos.includes(u.id) || misRecs.some((r) => r.grupoId === g.id));
  const delAlumno = (c: Clase) =>
    esProfe || c.grupo.alumnos.includes(u.id) || misRecs.some((r) => r.grupoId === c.grupo.id && r.fecha === c.fecha);
  const semana = clases.filter(delAlumno);
  const delDia = semana.filter((c) => c.fecha === dia);

  return (
    <main className="app">
      <Cabecera u={u} titulo="Mi semana">
        <div className="semnav">
          <Link href={`/semana?d=${sumarDias(lunes, -7)}`}>‹ Anterior</Link>
          <span>{fechaCorta(lunes)} – {fechaCorta(sumarDias(lunes, 6))}</span>
          <Link href={`/semana?d=${sumarDias(lunes, 7)}`}>Siguiente ›</Link>
        </div>
        <div className="days">
          {Array.from({ length: 7 }, (_, i) => {
            const f = sumarDias(lunes, i);
            const cls = ["d", f === dia && "on", f === hoy && "hoy", semana.some((c) => c.fecha === f) && "has"].filter(Boolean).join(" ");
            return (
              <Link key={f} href={`/semana?d=${f}`} className={cls} aria-current={f === dia ? "date" : undefined}>
                {letraDia(i + 1)}<b>{deIso(f).getDate()}</b><i />
              </Link>
            );
          })}
        </div>
      </Cabecera>

      <div className="body">
        <Aviso ok={sp.ok} error={sp.error} />
        {esProfe ? <Pendientes profeId={u.id} ruta={ruta} /> : <Creditos alumnoId={u.id} />}
        <p className="daylbl">{nombreDia(dia)} {fechaCorta(dia)}{esProfe && delDia.length ? ` · ${delDia.length} clases` : ""}</p>
        {delDia.length === 0 && <p className="vacio">No tienes clases este día.</p>}
        {delDia.map((c) =>
          esProfe ? <ClaseProfe key={c.grupo.id} c={c} ruta={ruta} /> : <ClaseAlumno key={c.grupo.id} c={c} u={u} recs={misRecs} hoy={hoy} ruta={ruta} />,
        )}
      </div>
      <Nav u={u} activa="semana" />
    </main>
  );
}

function Cuando({ c }: { c: Clase }) {
  return <span className="time">{c.grupo.hora}–{horaFin(c.grupo.hora, c.grupo.duracion)}</span>;
}

async function ClaseAlumno({ c, u, recs, hoy, ruta }: { c: Clase; u: Usuario; recs: Recuperacion[]; hoy: string; ruta: string }) {
  const d = await datos();
  const profe = d.usuario(c.grupo.profeId)?.nombre;
  const rec = recs.find((r) => r.grupoId === c.grupo.id && r.fecha === c.fecha);
  const ahora = new Date();
  const pasada = c.inicio <= ahora;
  if (rec) {
    return (
      <div className={`cls ${rec.estado === "pendiente" ? "pend" : ""}`}>
        <div className="row"><Cuando c={c} /><span className="lvl">{c.grupo.nombre}</span></div>
        <p className="meta">Recuperación · {c.grupo.pista} · Prof. {profe}</p>
        <span className={`st ${rec.estado === "aprobada" ? "ok" : ""}`}>
          {rec.estado === "pendiente" ? "Esperando aprobación del profe" : "Aprobada, te esperan"}
        </span>
      </div>
    );
  }
  const deBaja = c.bajas.some((b) => b.id === u.id);
  const limite = d.limiteBaja(c);
  return (
    <div className={`cls ${pasada || deBaja ? "pasada" : ""}`}>
      <div className="row"><Cuando c={c} /><span className="lvl">{c.grupo.nombre}</span></div>
      <p className="meta">{c.grupo.pista} · Prof. {profe} · {c.alumnos.length} alumnos</p>
      {c.contenido && <p className="ses">Hoy: {c.contenido}</p>}
      {deBaja ? (
        <span className="st">Te diste de baja en esta clase</span>
      ) : pasada ? null : ahora <= limite ? (
        <form action={darBaja} className="btns">
          <input type="hidden" name="grupo" value={c.grupo.id} />
          <input type="hidden" name="fecha" value={c.fecha} />
          <input type="hidden" name="ruta" value={ruta} />
          <button className="btn">Darme de baja</button>
          <span className="meta">hasta {formatoLimite(limite, hoy)}</span>
        </form>
      ) : (
        <span className="meta">Ya no se puede dar de baja</span>
      )}
    </div>
  );
}

async function Creditos({ alumnoId }: { alumnoId: string }) {
  const d = await datos();
  const cr = d.creditosDisponibles(alumnoId);
  if (!cr.length) return null;
  const primero = cr.map((c) => c.caduca).sort()[0];
  return (
    <div className="alert">
      <span>Tienes {cr.length === 1 ? "1 recuperación disponible" : `${cr.length} recuperaciones disponibles`} (la primera caduca el {fechaCorta(primero)}).</span>
      <div><Link className="btn" href="/recuperar">Buscar clase</Link></div>
    </div>
  );
}

async function Pendientes({ profeId, ruta }: { profeId: string; ruta: string }) {
  const d = await datos();
  const p = d.pendientesProfe(profeId);
  return p.map((r) => {
    const g = d.grupo(r.grupoId)!;
    return (
      <div className="alert" key={r.id}>
        <span><b>{d.usuario(r.alumnoId)?.nombre}</b> pide recuperar en {g.nombre}, {nombreDia(r.fecha)} {fechaCorta(r.fecha)} a las {g.hora}.</span>
        <form action={resolver} className="btns">
          <input type="hidden" name="rec" value={r.id} />
          <input type="hidden" name="ruta" value={ruta} />
          <button className="btn ok" name="aprobar" value="1">Aprobar</button>
          <button className="btn" name="aprobar" value="0">Rechazar</button>
        </form>
      </div>
    );
  });
}

async function ClaseProfe({ c, ruta }: { c: Clase; ruta: string }) {
  const d = await datos();
  const max = d.club(c.grupo.clubId).maxAlumnos;
  const fijos = new Set(c.grupo.alumnos);
  return (
    <div className="cls">
      <div className="row"><Cuando c={c} /><span className="lvl">{c.grupo.nombre}</span><span className="cnt">{c.alumnos.length}/{max}</span></div>
      <div className="bar"><span style={{ width: `${Math.min(100, (c.alumnos.length / max) * 100)}%` }} /></div>
      <p className="meta">{c.grupo.pista}{c.bajas.length ? ` · Baja: ${c.bajas.map((b) => b.nombre).join(", ")}` : ""}</p>
      <ul className="al">
        {c.alumnos.map((a) => <li key={a.id}>{a.nombre}{fijos.has(a.id) ? "" : " (recupera)"}</li>)}
      </ul>
      {c.contenido && <p className="ses">Sesión: {c.contenido}</p>}
      <details>
        <summary>{c.contenido ? "Editar sesión" : "Preparar sesión"}</summary>
        <form action={guardarSesion}>
          <input type="hidden" name="grupo" value={c.grupo.id} />
          <input type="hidden" name="fecha" value={c.fecha} />
          <input type="hidden" name="ruta" value={ruta} />
          <textarea name="contenido" rows={3} defaultValue={c.contenido} placeholder="Qué vais a trabajar en esta clase" aria-label="Contenido de la sesión" />
          <button className="btn p">Guardar</button>
        </form>
      </details>
    </div>
  );
}
