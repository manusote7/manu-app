import { entrarCodigo } from "./acciones";
import { Boton } from "./cliente";

/** Tras pedir el email: se entra con el código (o con el enlace, si se abre en el mismo navegador) */
export function EntrarConCodigo({ email, admin, error, otroEmail }: { email: string; admin?: boolean; error?: string; otroEmail: string }) {
  return (
    <form action={entrarCodigo} className="card">
      {error && <p className="mensaje" role="alert">{error}</p>}
      <h2 style={{ fontSize: "1.2rem" }}>Mira tu correo</h2>
      <p>Hemos enviado un código a <b>{email}</b>. Escríbelo aquí:</p>
      <input type="hidden" name="email" value={email} />
      {admin && <input type="hidden" name="admin" value="1" />}
      <input name="codigo" className="campo codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,10}" maxLength={10}
        required placeholder="123456" aria-label="Código del email" autoFocus />
      <Boton className="btn prim grande">Entrar</Boton>
      <p className="meta">Si no llega en un minuto, mira en spam. Si abres el enlace del email en el navegador, también entras ahí.</p>
      <a className="btn grande" href={otroEmail}>Usar otro email</a>
    </form>
  );
}
