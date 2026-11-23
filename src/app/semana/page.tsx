// Pantalla con datos por usuario: se genera en cada petición.
export const instant = false;

import Link from "next/link";
import type { Clase, Usuario, Recuperacion, Consultas } from "@/lib/datos";
import { datos } from "@/lib/repo";
import { fechaCorta, formatoLimite, horaFin, iso, letraDia, lunesDe, nombreDia, sumarDias, deIso } from "@/lib/fechas";
import { yo } from "@/lib/sesion";
import { darBaja, guardarSesion, resolver } from "../acciones";
import { Aviso, Cabecera, Icono, Nav, Vacio, iniciales } from "../marco";
import { Boton, Dias } from "../cliente";

type SP = Promise<{ d?: string; ok?: string; error?: string }>;

export default async function MiSemana({ searchParams }: { searchParams: SP }) {
  const u = await yo();
  const d = await datos();
  const sp = await searchParams;
  const hoy = iso(new Date());
  const dia = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : hoy;
  const lunes = lunesDe(dia);
  const esProfe = u.rol === "profe";

  const misRecs = esProfe ? [] : d.recuperacionesAlumno(u.id, lunes);
  const semana = d
    .clasesSemana(lunes, (g) => (esProfe ? g.profeId === u.id : g.alumnos.includes(u.id) || misRecs.some((r) => r.grupoId === g.id)))
    .filter((c) => esProfe || c.grupo.alumnos.includes(u.id) || misRecs.some((r) => r.grupoId === c.grupo.id && r.fecha === c.fecha));

  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const paneles = Object.fromEntries(
    fechas.map((f) => {
      const delDia = semana.filter((c) => c.fecha === f);
      return [f, (
        <div className="body-dia" key={f} style={{ display: "grid", gap: 14 }}>
          <div className="dia-tit">
            <h2>{f === hoy ? "Hoy" : nombreDia(f).replace(/^./, (x) => x.toUpperCase())}, {fechaCorta(f)}</h2>
            {delDia.length > 0 && <span>{delDia.length === 1 ? "1 clase" : `${delDia.length} clases`}</span>}
          </div>
          {delDia.length === 0 && <Vacio titulo="Día libre" texto={esProfe ? "No das clases este día." : "No tienes clases este día."} />}
          {delDia.map((c) =>
            esProfe
              ? <ClaseProfe key={c.grupo.id} c={c} d={d} />
              : <ClaseAlumno key={c.grupo.id} c={c} u={u} d={d} recs={misRecs} hoy={hoy} />,
          )}
        </div>
      )];
    }),
  );

  return (
    <main className="app">
      <Aviso ok={sp.ok} error={sp.error} />
      <Cabecera titulo={esProfe ? "Mis clases" : "Mi semana"}>
        <div className="sem">
          <Link className="icono-btn" href={`/semana?d=${sumarDias(lunes, -7)}`} aria-label="Semana anterior"><Icono.atras /></Link>
          <span className="sem-rango">{fechaCorta(lunes)} – {fechaCorta(sumarDias(lunes, 6))}</span>
          <Link className="icono-btn" href={`/semana?d=${sumarDias(lunes, 7)}`} aria-label="Semana siguiente"><Icono.adelante /></Link>
        </div>
      </Cabecera>

      <div className="body">
        {esProfe ? <Solicitudes profeId={u.id} d={d} ruta={`/semana?d=${dia}`} /> : <Creditos alumnoId={u.id} d={d} />}
        <Dias
          inicial={dia}
          paneles={paneles}
          dias={fechas.map((f, i) => ({
            fecha: f, letra: letraDia(i + 1), num: deIso(f).getDate(), hoy: f === hoy, tiene: semana.some((c) => c.fecha === f),
          }))}
        />
      </div>
      <Nav alumno={!esProfe} activa="semana" />
    </main>
  );
}

function Hora({ c }: { c: Clase }) {
  return (
    <div className="hora"><b>{c.grupo.hora}</b><span>{horaFin(c.grupo.hora, c.grupo.duracion)}</span></div>
  );
}

function Datos({ c, profe }: { c: Clase; profe?: string }) {
  return (
    <div className="datos">
      {c.grupo.pista && <span><Icono.pista />{c.grupo.pista}</span>}
      {profe && <span><Icono.profe />{profe}</span>}
    </div>
  );
}

function ClaseAlumno({ c, u, d, recs, hoy }: { c: Clase; u: Usuario; d: Consultas; recs: Recuperacion[]; hoy: string }) {
  const profe = d.usuario(c.grupo.profeId)?.nombre;
  const rec = recs.find((r) => r.grupoId === c.grupo.id && r.fecha === c.fecha);
  const ahora = new Date();
  const pasada = c.inicio <= ahora;
  const ruta = `/semana?d=${c.fecha}`;

  if (rec) {
    return (
      <div className="clase">
        <Hora c={c} />
        <div className={`card${rec.estado === "pendiente" ? " punteada" : ""}`}>
          <div className="card-cab">
            <h3>{c.grupo.nombre}</h3>
            {rec.estado === "pendiente"
              ? <span className="pill warn">Pendiente</span>
              : <span className="pill ok">Recuperación</span>}
          </div>
          <Datos c={c} profe={profe} />
          {rec.estado === "pendiente" && <p className="meta">Esperando a que {profe ?? "el profe"} la apruebe.</p>}
        </div>
      </div>
    );
  }

  const deBaja = c.bajas.some((b) => b.id === u.id);
  const limite = d.limiteBaja(c);
  return (
    <div className="clase">
      <Hora c={c} />
      <div className={`card${pasada || deBaja ? " apagada" : ""}`}>
        <div className="card-cab">
          <h3>{c.grupo.nombre}</h3>
          {deBaja ? <span className="pill gris">De baja</span> : pasada ? <span className="pill gris">Hecha</span> : <span className="pill nivel">{c.grupo.nivel}</span>}
        </div>
        <Datos c={c} profe={profe} />
        {c.contenido && <div className="sesion"><small>Qué vais a trabajar</small>{c.contenido}</div>}
        {!deBaja && !pasada && (
          ahora <= limite ? (
            <form action={darBaja} className="acciones">
              <input type="hidden" name="grupo" value={c.grupo.id} />
              <input type="hidden" name="fecha" value={c.fecha} />
              <input type="hidden" name="ruta" value={ruta} />
              <Boton className="btn peligro">No puedo ir</Boton>
              <span className="meta">Avisa hasta {formatoLimite(limite, hoy)}</span>
            </form>
          ) : (
            <div className="acciones"><span className="meta">Ya no se puede avisar de una baja</span></div>
          )
        )}
      </div>
    </div>
  );
}

function Creditos({ alumnoId, d }: { alumnoId: string; d: Consultas }) {
  const cr = d.creditosDisponibles(alumnoId);
  if (!cr.length) return null;
  const primero = cr.map((c) => c.caduca).sort()[0];
  return (
    <div className="banner pelota">
      <div>
        <b>{cr.length === 1 ? "Tienes 1 clase por recuperar" : `Tienes ${cr.length} clases por recuperar`}</b>
        <p className="meta" style={{ color: "inherit", opacity: .75 }}>Úsala antes del {fechaCorta(primero)}.</p>
      </div>
      <Link className="btn" href="/recuperar">Elegir clase</Link>
    </div>
  );
}

function Solicitudes({ profeId, d, ruta }: { profeId: string; d: Consultas; ruta: string }) {
  const p = d.pendientesProfe(profeId);
  if (!p.length) return null;
  return (
    <>
      <p className="seccion">Solicitudes de recuperación</p>
      {p.map((r) => {
        const g = d.grupo(r.grupoId)!;
        const nombre = d.usuario(r.alumnoId)?.nombre ?? "Alumno";
        return (
          <form action={resolver} className="banner solicitud" key={r.id}>
            <span className="ini">{iniciales(nombre)}</span>
            <div>
              <b>{nombre}</b>
              <p className="meta">Quiere venir a {g.nombre}, {nombreDia(r.fecha)} {fechaCorta(r.fecha)} · {g.hora}</p>
            </div>
            <input type="hidden" name="rec" value={r.id} />
            <input type="hidden" name="ruta" value={ruta} />
            <div className="btns">
              <Boton className="btn" name="aprobar" value="0">Rechazar</Boton>
              <Boton className="btn ok" name="aprobar" value="1">Aprobar</Boton>
            </div>
          </form>
        );
      })}
    </>
  );
}

function ClaseProfe({ c, d }: { c: Clase; d: Consultas }) {
  const max = d.club(c.grupo.clubId).maxAlumnos;
  const fijos = new Set(c.grupo.alumnos);
  const ruta = `/semana?d=${c.fecha}`;
  return (
    <div className="clase">
      <Hora c={c} />
      <div className="card">
        <div className="card-cab">
          <h3>{c.grupo.nombre}</h3>
          <span className="plazas" aria-label={`${c.alumnos.length} de ${max} plazas`}>
            {Array.from({ length: max }, (_, i) => <i key={i} className={i < c.alumnos.length ? "llena" : ""} />)}
            &nbsp;{c.alumnos.length}/{max}
          </span>
        </div>
        <Datos c={c} />
        <div className="alumnos">
          {c.alumnos.map((a) => (
            <span key={a.id} className={`chip${fijos.has(a.id) ? "" : " recupera"}`} title={fijos.has(a.id) ? undefined : "Viene a recuperar"}>
              <span className="ini">{iniciales(a.nombre)}</span>{a.nombre.split(" ")[0]}
            </span>
          ))}
          {c.bajas.map((a) => (
            <span key={a.id} className="chip baja" title="De baja"><span className="ini">{iniciales(a.nombre)}</span>{a.nombre.split(" ")[0]}</span>
          ))}
        </div>
        {c.contenido && <div className="sesion"><small>Sesión</small>{c.contenido}</div>}
        <details className="editar">
          <summary>{c.contenido ? "Editar sesión" : "+ Preparar sesión"}</summary>
          <form action={guardarSesion}>
            <input type="hidden" name="grupo" value={c.grupo.id} />
            <input type="hidden" name="fecha" value={c.fecha} />
            <input type="hidden" name="ruta" value={ruta} />
            <textarea name="contenido" rows={3} defaultValue={c.contenido} placeholder="Ej. bandeja cruzada y salida de pared" aria-label="Contenido de la sesión" />
            <Boton className="btn prim">Guardar sesión</Boton>
          </form>
        </details>
      </div>
    </div>
  );
}
