export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { datos } from "@/lib/repo";
import { yoAdmin } from "@/lib/sesion";
import { guardarClub, guardarGrupo, borrarGrupo, marcaClub, publicarAnuncio } from "../../../acciones";
import { Aviso, EstiloClub, Icono, Marca } from "../../../marco";
import { Boton } from "../../../cliente";
import { CamposClub, CamposGrupo, DIAS } from "../../campos";
import { FormAlta, PersonaGestion } from "../../../personas";

export default async function ClubAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await yoAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const d = await datos();
  const club = d.clubs.find((c) => c.id === id);
  if (!club) notFound();
  const grupos = d.gruposDeClub(id);
  const personas = d.personasDeClub(id);
  const profes = personas.filter((p) => p.rol === "profe");
  const alumnos = personas.filter((p) => p.rol === "alumno");
  const niveles = [...new Set([...grupos.map((g) => g.nivel), ...alumnos.map((a) => a.nivel ?? "")].filter(Boolean))].sort();
  const emailProfe = (g: { profeId: string; id: string }) =>
    profes.find((p) => p.usuario?.id === g.profeId)?.email ?? profes.find((p) => !p.usuario && p.grupos.includes(g.id))?.email;
  const ruta = `/admin/club/${id}#personas`;

  return (
    <main className="app ancha">
      <Aviso ok={sp.ok} error={sp.error} />
      <EstiloClub club={club} />
      <header className="cab">
        <div className="cab-top">
          <Link href="/admin" className="icono-btn" aria-label="Volver a clubs"><Icono.atras /></Link>
          <Marca club={club} />
          <div className="cab-txt"><span className="cab-club">Código <span className="codigo-club">{club.codigo}</span></span><h1>{club.nombre}</h1></div>
        </div>
      </header>
      <div className="body" style={{ paddingBottom: 40 }}>
        <details className="bloque">
          <summary><b>Datos y reglas del club</b><span className="meta">Baja {club.horasBaja} h antes · recuperar en {club.diasCaducidad} días</span></summary>
          <form action={guardarClub} className="form">
            <input type="hidden" name="id" value={club.id} />
            <CamposClub c={club} />
            <div><Boton className="btn prim">Guardar</Boton></div>
          </form>
        </details>

        <details className="bloque">
          <summary><b>Logo, color y cancelaciones</b></summary>
          <form action={marcaClub} className="form">
            <input type="hidden" name="club" value={id} />
            <div className="fila">
              <label>Color principal<input name="color" type="color" className="campo" style={{ height: 46, padding: 4 }} defaultValue={club.color ?? "#123f6b"} /></label>
              <label>Logo (enlace a la imagen)<input name="logo" type="url" className="campo" defaultValue={club.logo} placeholder="https://…/logo.png" /></label>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--fg)", fontWeight: 500 }}>
              <input type="checkbox" name="recupera" defaultChecked={club.cancelarRecupera !== false} />
              Si un profe cancela una clase, cada alumno recibe una recuperación
            </label>
            <div><Boton className="btn prim">Guardar</Boton></div>
          </form>
        </details>

        <details className="bloque">
          <summary><b>Publicar en el tablón</b><span className="meta">{d.anunciosDeClub(id).length} anuncios</span></summary>
          <form action={publicarAnuncio} className="form">
            <input type="hidden" name="club" value={id} />
            <input type="hidden" name="ruta" value={`/admin/club/${id}`} />
            <textarea name="texto" rows={3} required placeholder="Anuncio para todo el club" aria-label="Anuncio" />
            <div><Boton className="btn prim">Publicar</Boton></div>
          </form>
        </details>

        <div className="tit-seccion" id="grupos"><h2>Grupos</h2><span className="meta">{grupos.length}</span></div>
        {grupos.map((g) => (
          <details key={g.id} className="bloque">
            <summary>
              <span style={{ display: "grid" }}>
                <b style={{ fontWeight: 600 }}>{g.nombre}</b>
                <span className="meta">{DIAS[g.dia - 1]} {g.hora} · {g.pista || "Sin pista"} · {profes.find((p) => p.email === emailProfe(g))?.nombre ?? "Sin profe"}</span>
              </span>
              <span className="pill nivel">{g.alumnos.length}/{d.maxDe(g)}</span>
            </summary>
            <form action={guardarGrupo} className="form">
              <input type="hidden" name="club" value={id} />
              <input type="hidden" name="id" value={g.id} />
              <CamposGrupo g={g} profes={profes} niveles={niveles} profeEmail={emailProfe(g)} />
              <div className="btns" style={{ display: "flex", gap: 8 }}>
                <Boton className="btn prim">Guardar grupo</Boton>
              </div>
            </form>
            <form action={borrarGrupo} className="contenido">
              <input type="hidden" name="club" value={id} />
              <input type="hidden" name="id" value={g.id} />
              <Boton className="btn peligro">Borrar grupo</Boton>
            </form>
          </details>
        ))}
        <details className="bloque">
          <summary><b>+ Nuevo grupo</b></summary>
          <form action={guardarGrupo} className="form">
            <input type="hidden" name="club" value={id} />
            <CamposGrupo profes={profes} niveles={niveles} />
            <div><Boton className="btn prim">Crear grupo</Boton></div>
          </form>
        </details>

        <div className="tit-seccion" id="personas"><h2>Personas</h2><span className="meta">{profes.length} profes · {alumnos.length} alumnos</span></div>
        <FormAlta club={id} grupos={grupos} niveles={niveles} ruta={ruta} puedeProfe />
        {personas.map((p) => <PersonaGestion key={p.email} p={p} club={id} grupos={grupos} ruta={ruta} niveles={niveles} />)}
      </div>
    </main>
  );
}
