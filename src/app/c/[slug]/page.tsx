// Paso 2: la app de un club concreto. Este enlace es el que cada club da a su gente.
export const instant = false;

import { redirect } from "next/navigation";
import { clubElegido, conectado } from "@/lib/sesion";
import { datos } from "@/lib/repo";
import { modoSupabase } from "@/lib/supabase";
import { entrar, entrarEmail, cambiarClub, entrarClub } from "../../acciones";
import { Boton } from "../../cliente";
import { iniciales } from "../../marco";

type SP = Promise<{ error?: string; enviado?: string }>;

export default async function EntrarPersona({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SP }) {
  const { slug } = await params;
  const { error, enviado } = await searchParams;
  const club = await clubElegido();
  const aviso = error && <p className="mensaje" role="alert">{error}</p>;

  // Sin el código de este club no se muestra nada de él
  if (club?.slug !== slug) {
    return (
      <main className="app acceso">
        <div className="acceso-hero"><span className="marca" aria-hidden>P</span><h1>Entra en tu club</h1></div>
        <div className="acceso-form">
          <form action={entrarClub} className="card">
            {aviso}
            <label htmlFor="codigo">Código de tu club</label>
            <input id="codigo" name="codigo" className="campo codigo" autoComplete="off" autoCapitalize="characters" spellCheck={false} required placeholder="CÓDIGO" />
            <Boton className="btn prim grande">Continuar</Boton>
          </form>
        </div>
      </main>
    );
  }

  if (!error && !enviado && (await conectado())) redirect("/semana");
  const rol = { alumno: "Alumno", profe: "Profe", admin: "Admin" };
  return (
    <main className="app acceso">
      <div className="acceso-hero">
        <span className="marca" aria-hidden>{iniciales(club.nombre)}</span>
        <h1>{club.nombre}</h1>
        <p>{enviado ? "Ya casi está." : "Entra para ver tus clases."}</p>
      </div>
      <div className="acceso-form">
        {modoSupabase ? (
          enviado ? (
            <div className="card">
              <h2 style={{ fontSize: "1.2rem" }}>Mira tu correo</h2>
              <p>Te hemos enviado un enlace a <b>{enviado}</b>. Ábrelo en este mismo móvil para entrar.</p>
              <p className="meta">Si no llega en un minuto, revisa la carpeta de spam.</p>
              <a className="btn grande" href={`/c/${club.slug}`}>Usar otro email</a>
            </div>
          ) : (
            <form action={entrarEmail} className="card">
              {aviso}
              <label htmlFor="email">Tu email</label>
              <input id="email" name="email" type="email" className="campo" autoComplete="email" inputMode="email" required placeholder="nombre@email.com" />
              <Boton className="btn prim grande">Enviarme el enlace</Boton>
              <p className="meta">Usa el email que diste al club. Sin contraseñas.</p>
            </form>
          )
        ) : (
          <form action={entrar} className="card">
            {aviso}
            <label>¿Quién eres? (versión de prueba)</label>
            {(await datos()).usuariosDeClub(club.id).map((u) => (
              <button key={u.id} name="uid" value={u.id} className="persona">
                <span className="ini">{iniciales(u.nombre)}</span>
                <span>{u.nombre}</span>
                <span className="meta">{rol[u.rol]}</span>
              </button>
            ))}
          </form>
        )}
        <form action={cambiarClub} style={{ display: "grid" }}><button className="enlace">No es mi club</button></form>
      </div>
    </main>
  );
}
