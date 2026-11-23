// Paso 2: la app de un club concreto. Este enlace es el que cada club da a su gente.
export const instant = false;

import { clubElegido } from "@/lib/sesion";
import { datos } from "@/lib/repo";
import { modoSupabase } from "@/lib/supabase";
import { entrar, entrarEmail, cambiarClub, entrarClub } from "../../acciones";
import { Aviso } from "../../marco";

type SP = Promise<{ error?: string; enviado?: string }>;

export default async function EntrarPersona({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SP }) {
  const { slug } = await params;
  const { error, enviado } = await searchParams;
  const club = await clubElegido();

  // Sin el código de este club no se muestra nada de él
  if (club?.slug !== slug) {
    return (
      <main className="app">
        <header className="top"><h1>Entra en tu club</h1></header>
        <div className="login">
          <Aviso error={error} />
          <p className="meta">Escribe el código que te ha dado el club.</p>
          <form action={entrarClub}>
            <label htmlFor="codigo" className="meta">Código del club</label>
            <input id="codigo" name="codigo" className="campo" autoComplete="off" required />
            <button className="btn p">Entrar</button>
          </form>
        </div>
      </main>
    );
  }

  const rol = { alumno: "Alumno", profe: "Profe", admin: "Admin" };
  return (
    <main className="app">
      <header className="top"><h1>{club.nombre}</h1></header>
      <div className="login">
        <Aviso error={error} />
        {modoSupabase ? (
          enviado ? (
            <>
              <h2>Mira tu correo</h2>
              <p>Te hemos enviado un enlace a <b>{enviado}</b>. Ábrelo en este móvil para entrar.</p>
            </>
          ) : (
            <form action={entrarEmail}>
              <h2>Entra con tu email</h2>
              <label htmlFor="email" className="meta">El email que diste al club</label>
              <input id="email" name="email" type="email" className="campo email" autoComplete="email" required />
              <button className="btn p">Enviarme el enlace</button>
            </form>
          )
        ) : (
          <>
            <h2>¿Quién eres?</h2>
            <p className="meta">Versión de prueba: elige con quién entrar.</p>
            <form action={entrar}>
              {(await datos()).usuariosDeClub(club.id).map((u) => (
                <button key={u.id} name="uid" value={u.id} className="persona">
                  <span>{u.nombre}</span>
                  <span className="meta">{rol[u.rol]}{u.nivel ? ` · ${u.nivel}` : ""}</span>
                </button>
              ))}
            </form>
          </>
        )}
        <form action={cambiarClub}><button className="btn">No es mi club</button></form>
      </div>
    </main>
  );
}
