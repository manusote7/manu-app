// Pantalla con datos por usuario: se genera en cada petición.
export const instant = false;

import Link from "next/link";
import type { Clase, Usuario, Recuperacion, Consultas } from "@/lib/datos";
import { datos } from "@/lib/repo";
import { fechaCorta, formatoLimite, horaFin, iso, letraDia, lunesDe, nombreDia, sumarDias, deIso } from "@/lib/fechas";
import { yo } from "@/lib/sesion";
import { cancelarClase, darBaja, guardarMax, guardarSesion, pasarLista, resolver } from "../acciones";
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
      <Cabecera u={u} titulo={esProfe ? "Mis clases" : "Mi semana"}>
        <div className="sem">
          <Link className="icono-btn" href={`/semana?d=${sumarDias(lunes, -7)}`} aria-label="Semana anterior"><Icono.atras /></Link>
          <span className="sem-rango">{fechaCorta(lunes)} – {fechaCorta(sumarDias(lunes, 6))}</span>
          <Link className="icono-btn" href={`/semana?d=${sumarDias(lunes, 7)}`} aria-label="Semana siguiente"><Icono.adelante /></Link>
        </div>
      </Cabecera>

      <div className="body">
        {esProfe ? <Solicitudes profeId={u.id} d={d} ruta={`/semana?d=${dia}`} /> : <Creditos alumnoId={u.id} d={d} />}
        <TablonResumen u={u} d={d} />
        <Dias
          inicial={dia}
          paneles={paneles}
          dias={fechas.map((f, i) => ({
            fecha: f, letra: letraDia(i + 1), num: deIso(f).getDate(), hoy: f === hoy, tiene: semana.some((c) => c.fecha === f),
          }))}
        />
      </div>
      <Nav rol={u.rol} activa="semana" />
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
          {rec.estado === "pendiente" && <p className="meta">Esperando a que {profe ?? "el profesor"} la apruebe.</p>}
        </div>
      </div>
    );
  }

  if (c.cancelada !== undefined) {
    return (
      <div className="clase">
        <Hora c={c} />
        <div className="card apagada">
          <div className="card-cab"><h3>{c.grupo.nombre}</h3><span className="pill gris">Cancelada</span></div>
          <p className="meta">{c.cancelada ? `Motivo: ${c.cancelada}` : "El club ha cancelado esta clase."}</p>
        </div>
      </div>
    );
  }
  const deBaja = c.bajas.some((b) => b.id === u.id);
  const vino = c.asistencia[u.id];
  const limite = d.limiteBaja(c);
  return (
    <div className="clase">
      <Hora c={c} />
      <div className={`card${pasada || deBaja ? " apagada" : ""}`}>
        <div className="card-cab">
          <h3>{c.grupo.nombre}</h3>
          {deBaja ? <span className="pill gris">De baja</span> : pasada ? <span className={`pill ${vino === false ? "warn" : "gris"}`}>{vino === false ? "No viniste" : vino ? "Asististe" : "Hecha"}</span> : <span className="pill nivel">{c.grupo.nivel}</span>}
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
  const max = d.maxDe(c.grupo);
  const fijos = new Set(c.grupo.alumnos);
  const ruta = `/semana?d=${c.fecha}`;
  const ahora = new Date();
  const empezada = c.inicio <= ahora;
  const listaPasada = c.alumnos.some((a) => a.id in c.asistencia);
  const ocultos = (
    <>
      <input type="hidden" name="grupo" value={c.grupo.id} />
      <input type="hidden" name="fecha" value={c.fecha} />
      <input type="hidden" name="ruta" value={ruta} />
    </>
  );

  if (c.cancelada !== undefined) {
    return (
      <div className="clase">
        <Hora c={c} />
        <div className="card apagada">
          <div className="card-cab"><h3>{c.grupo.nombre}</h3><span className="pill gris">Cancelada</span></div>
          {c.cancelada && <p className="meta">Motivo: {c.cancelada}</p>}
        </div>
      </div>
    );
  }

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
        {/* Pasar lista: se marcan los que han venido */}
        <form action={pasarLista} className="lista-asis">
          {ocultos}
          <input type="hidden" name="lista" value={c.alumnos.map((a) => a.id).join(",")} />
          <div className="alumnos">
            {c.alumnos.map((a) => (
              <label key={a.id} className={`chip asis${fijos.has(a.id) ? "" : " recupera"}`} title={fijos.has(a.id) ? undefined : "Viene a recuperar"}>
                <input type="checkbox" name="presente" value={a.id} defaultChecked={c.asistencia[a.id] ?? true} />
                <span className="ini">{iniciales(a.nombre)}</span>{a.nombre.split(" ")[0]}
              </label>
            ))}
            {c.bajas.map((a) => (
              <span key={a.id} className="chip baja" title="De baja"><span className="ini">{iniciales(a.nombre)}</span>{a.nombre.split(" ")[0]}</span>
            ))}
          </div>
          {c.alumnos.length > 0 && (empezada || c.fecha === iso(ahora)) && (
            <div className="acciones">
              <Boton className={listaPasada ? "btn" : "btn prim"}>{listaPasada ? "Actualizar lista" : "Pasar lista"}</Boton>
              <span className="meta">{listaPasada ? `Han venido ${Object.values(c.asistencia).filter(Boolean).length}` : "Desmarca a quien no venga"}</span>
            </div>
          )}
        </form>
        {c.contenido && <div className="sesion"><small>Sesión</small>{c.contenido}</div>}
        <details className="editar">
          <summary>{c.contenido ? "Editar sesión y plazas" : "+ Preparar sesión y plazas"}</summary>
          <form action={guardarSesion}>
            {ocultos}
            <textarea name="contenido" rows={3} defaultValue={c.contenido} placeholder="Ej. bandeja cruzada y salida de pared" aria-label="Contenido de la sesión" />
            <Boton className="btn prim">Guardar sesión</Boton>
          </form>
          <form action={guardarMax} className="fila" style={{ alignItems: "end", marginTop: 10 }}>
            {ocultos}
            <label className="meta" style={{ display: "grid", gap: 4 }}>Máximo de alumnos del grupo
              <input name="max" type="number" min="1" max="12" className="campo" defaultValue={max} />
            </label>
            <Boton className="btn">Guardar máximo</Boton>
          </form>
        </details>
        {!empezada && (
          <details className="editar">
            <summary style={{ color: "var(--mal)" }}>Cancelar esta clase</summary>
            <form action={cancelarClase}>
              {ocultos}
              <input name="motivo" className="campo" placeholder="Motivo (opcional), ej. lluvia" aria-label="Motivo" />
              <label className="meta" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="confirmar" value="si" /> Sí, cancelar la clase del {fechaCorta(c.fecha)} y avisar a los alumnos
              </label>
              <Boton className="btn peligro">Cancelar clase</Boton>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}

function TablonResumen({ u, d }: { u: Usuario; d: Consultas }) {
  const anuncios = d.anunciosDeClub(u.clubId);
  if (!anuncios.length && u.rol !== "profe") return null;
  const a = anuncios[0];
  return (
    <Link href="/tablon" className="card anuncio">
      <div className="card-cab"><span className="seccion">Tablón del club</span><span className="meta">{anuncios.length > 1 ? `Ver los ${anuncios.length} ›` : "Ver ›"}</span></div>
      {a ? <p className="anuncio-txt">{a.texto}</p> : <p className="meta">Publica avisos para todo el club.</p>}
    </Link>
  );
}
