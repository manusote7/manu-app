
import { modoSupabase } from "@/lib/supabase";
import { entrarEmail, entrarAdminPrueba } from "../../acciones";
import { Boton } from "../../cliente";
import { EntrarConCodigo } from "../../codigo";

export default async function EntrarAdmin({ searchParams }: { searchParams: Promise<{ error?: string; enviado?: string }> }) {
  const { error, enviado } = await searchParams;
  return (
    <main className="app acceso">
      <div className="acceso-hero">
        <span className="marca" aria-hidden>A</span>
        <h1>Administración</h1>
        <p>Gestiona todos los clubs: grupos, reglas y altas.</p>
      </div>
      <div className="acceso-form">
        {!modoSupabase ? (
          <form action={entrarAdminPrueba} className="card">
            <p>Versión de prueba.</p>
            <Boton className="btn prim grande">Entrar como administración</Boton>
          </form>
        ) : enviado ? (
          <EntrarConCodigo email={enviado} admin error={error} otroEmail="/admin" />
        ) : (
          <form action={entrarEmail} className="card">
            {error && <p className="mensaje" role="alert">{error}</p>}
            <input type="hidden" name="admin" value="1" />
            <label htmlFor="email">Email de administración</label>
            <input id="email" name="email" type="email" className="campo" autoComplete="email" required />
            <Boton className="btn prim grande">Enviarme el código</Boton>
          </form>
        )}
      </div>
    </main>
  );
}
