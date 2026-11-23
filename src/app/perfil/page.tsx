
import { yo, clubElegido } from "@/lib/sesion";
import { datos } from "@/lib/repo";
import { DIAS } from "../admin/campos";
import { iso, lunesDe } from "@/lib/fechas";
import { semanasTemporada } from "@/lib/datos";
import { salir, cambiarClub } from "../acciones";
import { Cabecera, Nav, iniciales } from "../marco";
import { Boton, Instalar } from "../cliente";

export default async function Perfil() {
  const u = await yo();
  const club = await clubElegido();
  const d = await datos();
  const ficha = u.rol === "alumno" ? d.ficha(u.id) : undefined;
  const grupos = u.rol === "alumno" ? d.gruposDeAlumno(u.id) : d.gruposDeClub(u.clubId).filter((g) => g.profeId === u.id);
  const rol = { alumno: "Alumno", profe: "Profesor", admin: "Administración" }[u.rol];
  const hoy = iso(new Date());
  const r = u.rol === "alumno" ? d.resumenAlumno(u.id, semanasTemporada(hoy)[0], hoy) : undefined;
  const fueron = r ? r.previstas - r.bajas - r.faltas : 0;
  const cifras = r
    ? [
        { v: r.previstas ? `${Math.round((fueron / r.previstas) * 100)}%` : "–", t: "Asistencia esta temporada" },
        { v: fueron + r.recuperadas, t: "Clases hechas" },
        { v: r.recuperadas, t: "Recuperadas" },
        { v: d.creditosDisponibles(u.id).length, t: "Por recuperar" },
      ]
    : [
        { v: grupos.length, t: "Grupos" },
        { v: d.alumnosDeProfe(u.id).length, t: "Alumnos" },
        { v: d.clasesSemana(lunesDe(hoy), (g) => g.profeId === u.id).filter((c) => c.cancelada === undefined).length, t: "Clases esta semana" },
        { v: d.pendientesProfe(u.id).length, t: "Solicitudes" },
      ];
  return (
    <main className="app">
      <Cabecera u={u} titulo="Perfil" />
      <div className="body">
        <div className="perfil">
          <span className="ini">{iniciales(u.nombre)}</span>
          <h2>{u.nombre}</h2>
          <span className="meta">{rol}{u.nivel ? ` · Nivel ${u.nivel}` : ""} · {club?.nombre}</span>
        </div>
        <div className="cifras-grandes">
          {cifras.map((c) => <div key={c.t}><b>{c.v}</b><span>{c.t}</span></div>)}
        </div>
        {grupos.length > 0 && (
          <div className="card">
            <p className="seccion">{u.rol === "alumno" ? "Tus grupos" : "Tus grupos fijos"}</p>
            {grupos.map((g) => (
              <div key={g.id} className="card-cab">
                <span>{g.nombre}</span><span className="meta">{DIAS[g.dia - 1]} {g.hora}{g.pista ? ` · ${g.pista}` : ""}</span>
              </div>
            ))}
          </div>
        )}
        {ficha && (ficha.trabajado || ficha.aTrabajar) && (
          <div className="card">
            <p className="seccion">Tu evolución</p>
            {ficha.trabajado && <div className="sesion"><small>Has trabajado</small><span className="texto-ficha">{ficha.trabajado}</span></div>}
            {ficha.aTrabajar && <div className="sesion" style={{ background: "var(--pelota-suave)" }}><small style={{ color: "inherit" }}>Te toca trabajar</small><span className="texto-ficha">{ficha.aTrabajar}</span></div>}
          </div>
        )}
        <Instalar />
        <div className="lista">
          <form action={salir}><Boton className="">Cerrar sesión</Boton></form>
          <form action={cambiarClub}><Boton className="">Cambiar de club</Boton></form>
        </div>
      </div>
      <Nav rol={u.rol} activa="perfil" />
    </main>
  );
}
