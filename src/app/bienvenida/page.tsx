import { redirect } from "next/navigation";
import { datos } from "@/lib/repo";
import { clubElegido, yo } from "@/lib/sesion";
import { aceptarPrivacidad } from "../acciones";
import { Aviso } from "../marco";
import { Boton } from "../cliente";
import { TextoPrivacidad } from "../privacidad/texto";

/** La primera vez que alguien entra: aviso de privacidad y consentimiento (RGPD) */
export default async function Bienvenida({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await yo({ sinPrivacidad: true });
  if ((await datos()).haAceptado(u.id)) redirect("/semana");
  const club = await clubElegido();
  const { error } = await searchParams;
  return (
    <main className="app">
      <Aviso error={error} />
      <header className="cab"><div className="cab-top"><div className="cab-txt"><span className="cab-club">{club?.nombre}</span><h1>Hola, {u.nombre.split(" ")[0]}</h1></div></div></header>
      <div className="body">
        <p className="meta">Antes de empezar, lee cómo cuidamos tus datos.</p>
        <details className="bloque"><summary><b>Aviso de privacidad</b><span className="meta">Toca para leerlo</span></summary>
          <div className="contenido"><TextoPrivacidad club={club?.nombre} /></div>
        </details>
        <form action={aceptarPrivacidad} className="form card">
          <label className="check"><input type="checkbox" name="acepto" required />
            He leído el aviso de privacidad y acepto que el club use mis datos para organizar las clases, incluidas las notas
            sobre lesiones o molestias que yo cuente a mi profesor.</label>
          {u.rol === "alumno" && (
            <details className="menor">
              <summary className="meta">¿Tienes menos de 14 años?</summary>
              <label className="check"><input type="checkbox" name="menor14" />Sí, tengo menos de 14 años</label>
              <label>Nombre de tu madre, padre o tutor (da el consentimiento por ti)
                <input name="tutor" className="campo" placeholder="Nombre y apellidos" /></label>
            </details>
          )}
          <Boton className="btn prim">Aceptar y entrar</Boton>
        </form>
      </div>
    </main>
  );
}
