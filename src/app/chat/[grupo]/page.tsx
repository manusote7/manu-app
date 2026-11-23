export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { datos, mensajes } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { borrarMensaje, enviarMensaje } from "../../acciones";
import { Aviso, Icono, Nav, iniciales } from "../../marco";
import { AlFinal, Boton, Refrescar } from "../../cliente";
import { misGruposChat } from "../grupos";

const hora = (s: string) => {
  const f = new Date(s);
  const hoy = new Date().toDateString() === f.toDateString();
  return hoy
    ? f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Atlantic/Canary" })
    : f.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Atlantic/Canary" });
};

export default async function ChatGrupo({ params, searchParams }: { params: Promise<{ grupo: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await yo();
  const d = await datos();
  const { grupo } = await params;
  const sp = await searchParams;
  const g = misGruposChat(d, u).find((x) => x.id === grupo);
  if (!g) notFound();
  const lista = (await mensajes([g.id], 150)).reverse();
  const esProfe = g.profeId === u.id;
  return (
    <main className="app">
      <Aviso ok={sp.ok} error={sp.error} />
      <Refrescar cada={8} />
      <AlFinal />
      <header className="cab">
        <div className="cab-top">
          <Link href="/chat" className="icono-btn" aria-label="Volver a los chats"><Icono.atras /></Link>
          <div className="cab-txt"><span className="cab-club">{d.usuario(g.profeId)?.nombre ?? "Sin profesor"} · {g.alumnos.length} alumnos</span><h1>{g.nombre}</h1></div>
        </div>
      </header>
      <div className="body chat">
        {lista.length === 0 && <p className="meta" style={{ textAlign: "center", padding: 24 }}>Escribe el primer mensaje del grupo.</p>}
        {lista.map((m) => {
          const mio = m.autorId === u.id;
          const autor = d.usuario(m.autorId ?? "");
          return (
            <div key={m.id} className={`msj${mio ? " mio" : ""}`}>
              {!mio && <span className="ini" title={autor?.nombre}>{iniciales(autor?.nombre ?? "?")}</span>}
              <div className="burbuja">
                {!mio && <b>{autor?.nombre ?? "Alguien"}{autor?.rol === "profe" ? " · Profesor" : ""}</b>}
                <span className="texto-ficha">{m.texto}</span>
                <span className="meta">{hora(m.creado)}</span>
              </div>
              {(mio || esProfe) && (
                <form action={borrarMensaje}>
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="grupo" value={g.id} />
                  <button className="icono-btn borrar-msj" aria-label="Borrar mensaje">×</button>
                </form>
              )}
            </div>
          );
        })}
        <div id="fin" />
      </div>
      <form action={enviarMensaje} className="chat-envio">
        <input type="hidden" name="grupo" value={g.id} />
        <textarea name="texto" rows={1} required maxLength={1000} placeholder="Escribe al grupo…" aria-label="Mensaje" />
        <Boton className="btn prim">Enviar</Boton>
      </form>
      <Nav rol={u.rol} activa="chat" />
    </main>
  );
}
