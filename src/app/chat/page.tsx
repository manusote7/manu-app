// Chats de clase: uno por grupo, con su profesor y sus alumnos.
export const instant = false;

import Link from "next/link";
import { datos, mensajes } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { DIAS } from "../admin/campos";
import { misGruposChat } from "./grupos";
import { Cabecera, Nav, Vacio, Icono } from "../marco";

export default async function Chats() {
  const u = await yo();
  const d = await datos();
  const grupos = misGruposChat(d, u);
  const ultimos = await mensajes(grupos.map((g) => g.id), 200);
  return (
    <main className="app">
      <Cabecera u={u} titulo="Chat" />
      <div className="body">
        {grupos.length === 0 && <Vacio titulo="Sin chats" texto="Cuando estés en un grupo, aquí tendrás su chat." />}
        {grupos.length > 0 && (
          <div className="lista">
            {grupos.map((g) => {
              const m = ultimos.find((x) => x.grupoId === g.id);
              return (
                <Link key={g.id} href={`/chat/${g.id}`} className="chat-fila">
                  <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <b>{g.nombre}</b>
                    <span className="meta recorta">{m ? `${d.usuario(m.autorId ?? "")?.nombre.split(" ")[0] ?? "Alguien"}: ${m.texto}` : `${DIAS[g.dia - 1]} ${g.hora} · Aún no hay mensajes`}</span>
                  </span>
                  <Icono.adelante />
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <Nav rol={u.rol} activa="chat" />
    </main>
  );
}
