import { db } from "@/lib/datos";
import { entrar } from "./acciones";

export default function Entrar() {
  const rol = { alumno: "Alumno", profe: "Profe", admin: "Admin" };
  return (
    <main className="app">
      <div className="login">
        <h1>Entrar</h1>
        <p className="meta">Versión de prueba: elige con quién entrar. Más adelante será con tu email.</p>
        <form action={entrar}>
          {db.usuarios.map((u) => (
            <button key={u.id} name="uid" value={u.id}>
              <span>{u.nombre}</span>
              <span className="meta">{rol[u.rol]}{u.nivel ? ` · ${u.nivel}` : ""}</span>
            </button>
          ))}
        </form>
      </div>
    </main>
  );
}
