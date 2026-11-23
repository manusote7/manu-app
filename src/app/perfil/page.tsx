
import { yo, clubElegido } from "@/lib/sesion";
import { datos } from "@/lib/repo";
import { DIAS } from "../admin/campos";
import { salir, cambiarClub } from "../acciones";
import { Cabecera, Nav, iniciales } from "../marco";
import { Boton } from "../cliente";

export default async function Perfil() {
  const u = await yo();
  const club = await clubElegido();
  const d = await datos();
  const ficha = u.rol === "alumno" ? d.ficha(u.id) : undefined;
  const grupos = u.rol === "alumno" ? d.gruposDeAlumno(u.id) : d.gruposDeClub(u.clubId).filter((g) => g.profeId === u.id);
  const rol = { alumno: "Alumno", profe: "Profesor", admin: "Administración" }[u.rol];
  return (
    <main className="app">
      <Cabecera u={u} titulo="Perfil" />
      <div className="body">
        <div className="perfil">
          <span className="ini">{iniciales(u.nombre)}</span>
          <h2>{u.nombre}</h2>
          <span className="meta">{rol}{u.nivel ? ` · Nivel ${u.nivel}` : ""} · {club?.nombre}</span>
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
        <div className="lista">
          <form action={salir}><Boton className="">Cerrar sesión</Boton></form>
          <form action={cambiarClub}><Boton className="">Cambiar de club</Boton></form>
        </div>
      </div>
      <Nav rol={u.rol} activa="perfil" />
    </main>
  );
}
