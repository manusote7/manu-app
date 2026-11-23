// Paso 1: entrar al club con su código.

import { redirect } from "next/navigation";
import { clubElegido } from "@/lib/sesion";
import { modoSupabase } from "@/lib/supabase";
import { entrarClub } from "./acciones";
import { Boton } from "./cliente";

export default async function EntrarClub({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const club = await clubElegido();
  if (club && !error) redirect(`/c/${club.slug}`);
  return (
    <main className="app acceso">
      <div className="acceso-hero">
        <span className="marca" aria-hidden>P</span>
        <h1>Tus clases de pádel, en el bolsillo</h1>
        <p>Consulta tu semana, avisa si no puedes ir y recupera la clase en otro grupo.</p>
      </div>
      <div className="acceso-form">
        <form action={entrarClub} className="card">
          {error && <p className="mensaje" role="alert">{error}</p>}
          <label htmlFor="codigo">Código de tu club</label>
          <input id="codigo" name="codigo" className="campo codigo" autoComplete="off" autoCapitalize="characters"
            spellCheck={false} required placeholder="CÓDIGO" />
          <Boton className="btn prim grande">Continuar</Boton>
          <p className="meta">Te lo da tu club. Solo lo pedimos la primera vez.{modoSupabase ? "" : " Prueba: NORTE24 o SUR24."}</p>
        </form>
        <a href="/admin" className="enlace">Acceso de administración</a>
      </div>
    </main>
  );
}
