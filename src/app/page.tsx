// Paso 1: entrar al club con su código.
export const instant = false;

import { entrarClub } from "./acciones";

export default async function EntrarClub({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="app">
      <div className="login">
        <h1>Entra en tu club</h1>
        <p className="meta">Escribe el código que te ha dado tu club. Solo hace falta la primera vez.</p>
        {error && <p className="msg err" role="alert">{error}</p>}
        <form action={entrarClub}>
          <label htmlFor="codigo" className="meta">Código del club</label>
          <input id="codigo" name="codigo" className="campo" autoComplete="off" autoCapitalize="characters" required placeholder="Ej. NORTE24" />
          <button className="btn p">Entrar</button>
        </form>
        <p className="meta">Prueba: NORTE24 o SUR24.</p>
      </div>
    </main>
  );
}
