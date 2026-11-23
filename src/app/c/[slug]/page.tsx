// Paso 2: la app de un club concreto. Este enlace es el que cada club da a sus alumnos.
export const instant = false;

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { clubPorSlug, usuariosDeClub } from "@/lib/datos";
import { entrar, cambiarClub, entrarClub } from "../../acciones";

export default async function EntrarPersona({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = clubPorSlug(slug);
  if (!club) notFound();
  const cookieClub = (await cookies()).get("club")?.value;
  const rol = { alumno: "Alumno", profe: "Profe", admin: "Admin" };
  // Sin el código de este club no se muestra nada de él
  if (cookieClub !== club.id) {
    return (
      <main className="app">
        <header className="top"><h1>{club.nombre}</h1></header>
        <div className="login">
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
  return (
    <main className="app">
      <header className="top"><h1>{club.nombre}</h1></header>
      <div className="login">
        <h2>¿Quién eres?</h2>
        <p className="meta">Versión de prueba: elige con quién entrar. Más adelante será con tu email.</p>
        <form action={entrar}>
          <input type="hidden" name="club" value={club.id} />
          {usuariosDeClub(club.id).map((u) => (
            <button key={u.id} name="uid" value={u.id} className="persona">
              <span>{u.nombre}</span>
              <span className="meta">{rol[u.rol]}{u.nivel ? ` · ${u.nivel}` : ""}</span>
            </button>
          ))}
        </form>
        <form action={cambiarClub}><button className="btn">No es mi club</button></form>
      </div>
    </main>
  );
}
