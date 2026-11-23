// Tablón de anuncios del club: lo leen todos, publican profes y administración.
export const instant = false;

import { datos } from "@/lib/repo";
import { yo } from "@/lib/sesion";
import { borrarAnuncio, publicarAnuncio } from "../acciones";
import { Aviso, Cabecera, Nav, Vacio } from "../marco";
import { Boton } from "../cliente";

export default async function Tablon({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await yo();
  const d = await datos();
  const sp = await searchParams;
  const anuncios = d.anunciosDeClub(u.clubId);
  return (
    <main className="app">
      <Aviso ok={sp.ok} error={sp.error} />
      <Cabecera u={u} titulo="Tablón" />
      <div className="body">
        {u.rol === "profe" && (
          <form action={publicarAnuncio} className="card form">
            <input type="hidden" name="ruta" value="/tablon" />
            <label>Nuevo anuncio para todo el club
              <textarea name="texto" rows={3} required placeholder="Ej. El viernes 5 no hay clases por el torneo." />
            </label>
            <div><Boton className="btn prim">Publicar</Boton></div>
            <p className="meta">Todos los alumnos del club recibirán un aviso.</p>
          </form>
        )}
        {anuncios.length === 0 && <Vacio titulo="Nada en el tablón" texto="Aquí verás los anuncios del club." />}
        {anuncios.map((x) => (
          <div key={x.id} className="card">
            <p className="texto-ficha">{x.texto}</p>
            <div className="card-cab">
              <span className="meta">{d.usuario(x.autorId ?? "")?.nombre ?? "Club"} · {new Date(x.creado).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
              {x.autorId === u.id && (
                <form action={borrarAnuncio}>
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="ruta" value="/tablon" />
                  <Boton className="btn peligro">Borrar</Boton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
      <Nav rol={u.rol} activa="semana" />
    </main>
  );
}
