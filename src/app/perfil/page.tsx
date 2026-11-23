export const instant = false;

import { yo, clubElegido } from "@/lib/sesion";
import { salir, cambiarClub } from "../acciones";
import { Cabecera, Nav, iniciales } from "../marco";
import { Boton } from "../cliente";

export default async function Perfil() {
  const u = await yo();
  const club = await clubElegido();
  const rol = { alumno: "Alumno", profe: "Profe", admin: "Administración" }[u.rol];
  return (
    <main className="app">
      <Cabecera titulo="Perfil" />
      <div className="body">
        <div className="perfil">
          <span className="ini">{iniciales(u.nombre)}</span>
          <h2>{u.nombre}</h2>
          <span className="meta">{rol}{u.nivel ? ` · Nivel ${u.nivel}` : ""} · {club?.nombre}</span>
        </div>
        <div className="lista">
          <form action={salir}><Boton className="">Cerrar sesión</Boton></form>
          <form action={cambiarClub}><Boton className="">Cambiar de club</Boton></form>
        </div>
      </div>
      <Nav alumno={u.rol === "alumno"} activa="perfil" />
    </main>
  );
}
