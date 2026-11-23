import Link from "next/link";
import type { Grupo, Persona } from "@/lib/datos";
import { altaPersona, cambiarActivo, cambiarNivel, gruposPersona } from "./acciones";
import { Boton } from "./cliente";
import { DIAS } from "./admin/campos";
import { iniciales } from "./marco";

const etiquetaGrupo = (g: Grupo) => `${g.nombre} · ${DIAS[g.dia - 1].slice(0, 3)} ${g.hora}`;

/** Ficha de gestión de una persona: grupos y si está activa. La usan administración y los profes. */
export function PersonaGestion({ p, club, grupos, ruta, conFicha, niveles = [] }: { p: Persona; club: string; grupos: Grupo[]; ruta: string; conFicha?: boolean; niveles?: string[] }) {
  const deSuNivel = grupos.filter((g) => !p.nivel || g.nivel === p.nivel);
  const resto = grupos.filter((g) => !deSuNivel.includes(g));
  const estado = !p.activo ? <span className="pill gris">Inactivo</span>
    : !p.usuario ? <span className="pill warn">Aún no ha entrado</span>
    : p.rol === "profe" ? <span className="pill nivel">Profe</span>
    : null;
  return (
    <details className="bloque">
      <summary>
        <span className="ini">{iniciales(p.nombre)}</span>
        <span style={{ display: "grid", minWidth: 0 }}>
          <b style={{ fontWeight: 600 }}>{p.nombre}</b>
          <span className="meta" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.rol === "alumno" ? `${p.nivel ?? "Sin nivel"} · ${p.grupos.length === 1 ? "1 grupo" : `${p.grupos.length} grupos`}` : p.email}
          </span>
        </span>
        {estado}
      </summary>
      <div className="contenido" style={{ display: "grid", gap: 12 }}>
        <span className="meta">{p.email}</span>
        {conFicha && p.usuario && <Link className="btn" href={`/alumnos/${p.usuario.id}`}>Ver ficha</Link>}
        {p.rol === "alumno" && p.activo && (
          <form action={cambiarNivel} className="fila" style={{ alignItems: "end" }}>
            <input type="hidden" name="club" value={club} />
            <input type="hidden" name="email" value={p.email} />
            <input type="hidden" name="nombre" value={p.nombre} />
            <input type="hidden" name="ruta" value={ruta} />
            <label className="meta" style={{ display: "grid", gap: 4 }}>Nivel
              <select name="nivel" className="campo" defaultValue={p.nivel ?? ""}>
                {!p.nivel && <option value="">Sin nivel</option>}
                {[...new Set([...(p.nivel ? [p.nivel] : []), ...niveles])].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <Boton className="btn">Cambiar nivel</Boton>
          </form>
        )}
        {p.rol === "alumno" && p.activo && (
          <form action={gruposPersona} className="form">
            <input type="hidden" name="club" value={club} />
            <input type="hidden" name="email" value={p.email} />
            <input type="hidden" name="ruta" value={ruta} />
            <input type="hidden" name="antes" value={p.grupos.join(",")} />
            <span className="meta">Grupos</span>
            <div className="checks">
              {[...deSuNivel, ...resto].map((g) => (
                <label key={g.id}><input type="checkbox" name="grupos" value={g.id} defaultChecked={p.grupos.includes(g.id)} />{etiquetaGrupo(g)}</label>
              ))}
              {grupos.length === 0 && <span className="meta">Este club aún no tiene grupos.</span>}
            </div>
            <div><Boton className="btn prim">Guardar grupos</Boton></div>
          </form>
        )}
        {p.rol === "alumno" && p.usuario && (
          <form action={cambiarActivo}>
            <input type="hidden" name="club" value={club} />
            <input type="hidden" name="email" value={p.email} />
            <input type="hidden" name="ruta" value={ruta} />
            <input type="hidden" name="activo" value={p.activo ? "0" : "1"} />
            <Boton className={p.activo ? "btn peligro" : "btn"}>{p.activo ? "Marcar como inactivo" : "Volver a activar"}</Boton>
            {p.activo && <p className="meta" style={{ marginTop: 6 }}>Sale de sus grupos y no podrá entrar. Su ficha se guarda.</p>}
          </form>
        )}
      </div>
    </details>
  );
}

/** Alta de una persona. Los profes solo pueden dar de alta alumnos. */
export function FormAlta({ club, grupos, niveles, ruta, puedeProfe }: { club: string; grupos: Grupo[]; niveles: string[]; ruta: string; puedeProfe?: boolean }) {
  return (
    <details className="bloque">
      <summary><b>+ Dar de alta {puedeProfe ? "a una persona" : "a un alumno"}</b></summary>
      <form action={altaPersona} className="form">
        <input type="hidden" name="club" value={club} />
        <input type="hidden" name="ruta" value={ruta} />
        <div className="fila">
          <label>Nombre<input name="nombre" className="campo" required placeholder="Lucía Martín" /></label>
          <label>Email<input name="email" type="email" className="campo" required placeholder="lucia@email.com" /></label>
        </div>
        <div className="fila">
          {puedeProfe && (
            <label>Rol
              <select name="rol" className="campo" defaultValue="alumno"><option value="alumno">Alumno</option><option value="profe">Profe</option></select>
            </label>
          )}
          <label>Nivel (alumnos)
            <select name="nivel" className="campo" defaultValue="">
              <option value="">Sin nivel</option>
              {niveles.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {grupos.length > 0 && (
          <>
            <span className="meta">Grupos (alumnos)</span>
            <div className="checks">
              {grupos.map((g) => <label key={g.id}><input type="checkbox" name="grupos" value={g.id} />{etiquetaGrupo(g)}</label>)}
            </div>
          </>
        )}
        <p className="meta">Entrará con este email: le llegará un enlace cuando lo escriba en la app.</p>
        <div><Boton className="btn prim">Dar de alta</Boton></div>
      </form>
    </details>
  );
}
