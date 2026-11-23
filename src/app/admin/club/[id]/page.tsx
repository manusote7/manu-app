export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { datos } from "@/lib/repo";
import { yoAdmin } from "@/lib/sesion";
import { cuotaClub, guardarClub, guardarGrupo, borrarGrupo, marcaClub, publicarAnuncio, guardarNivel, moverNivel, borrarNivel } from "../../../acciones";
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
  const listaNiveles = d.nivelesDeClub(id);
  const niveles = listaNiveles.map((n) => n.nombre);
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
      <nav className="pestanas" aria-label="Secciones del club">
        <Link href={`/admin/club/${id}/estadisticas`}>Estadísticas</Link><a href="#niveles">Niveles</a><a href="#grupos">Grupos</a><a href="#personas">Personas</a>
      </nav>
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
          <summary><b>Cuota</b><span className="meta">{club.cuotaMensual !== undefined ? `${club.cuotaMensual} €/mes` : "Sin cuota"} · solo la ves tú</span></summary>
          <form action={cuotaClub} className="form">
            <input type="hidden" name="club" value={id} />
            <div className="fila">
              <label>Cuota mensual (€)<input name="mensual" inputMode="decimal" className="campo" defaultValue={club.cuotaMensual} placeholder="49" /></label>
              <label>Configuración (€, una vez)<input name="alta" inputMode="decimal" className="campo" defaultValue={club.cuotaAlta} placeholder="150" /></label>
              <label>Cliente desde<input name="desde" type="date" className="campo" defaultValue={club.clienteDesde} /></label>
            </div>
            <div><Boton className="btn prim">Guardar cuota</Boton></div>
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
              Si un profesor cancela una clase, cada alumno recibe una recuperación
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

        <div className="tit-seccion" id="niveles"><h2>Niveles</h2><span className="meta">Los profesores eligen de esta lista</span></div>
        <div className="lista">
          {listaNiveles.map((n, i) => {
            const usos = grupos.filter((g) => g.nivel === n.nombre).length + alumnos.filter((a) => a.nivel === n.nombre).length;
            return (
              <div key={n.id || n.nombre} className="nivel-fila">
                <span className="nivel-num">{i + 1}</span>
                <form action={guardarNivel} className="nivel-nombre">
                  <input type="hidden" name="club" value={id} />
                  <input type="hidden" name="id" value={n.id} />
                  <input name="nombre" className="campo" defaultValue={n.nombre} aria-label={`Nombre del nivel ${i + 1}`} required />
                  <Boton className="btn">Guardar</Boton>
                </form>
                <span className="meta" title="Grupos y alumnos con este nivel">{usos}</span>
                {n.id && (
                  <div className="nivel-acc">
                    {(["arriba", "abajo"] as const).map((dir) => (
                      <form key={dir} action={moverNivel}>
                        <input type="hidden" name="club" value={id} /><input type="hidden" name="id" value={n.id} /><input type="hidden" name="dir" value={dir} />
                        <button className="icono-btn" disabled={dir === "arriba" ? i === 0 : i === listaNiveles.length - 1} aria-label={dir === "arriba" ? "Subir" : "Bajar"}>{dir === "arriba" ? "↑" : "↓"}</button>
                      </form>
                    ))}
                    <form action={borrarNivel}>
                      <input type="hidden" name="club" value={id} /><input type="hidden" name="id" value={n.id} />
                      <button className="icono-btn" disabled={usos > 0} aria-label="Borrar nivel" title={usos > 0 ? "Tiene grupos o alumnos" : "Borrar"}>×</button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
          <form action={guardarNivel} className="nivel-fila">
            <input type="hidden" name="club" value={id} />
            <span className="nivel-num">+</span>
            <div className="nivel-nombre">
              <input name="nombre" className="campo" placeholder="Nuevo nivel, ej. Iniciación 2" aria-label="Nuevo nivel" required />
              <Boton className="btn prim">Añadir</Boton>
            </div>
          </form>
        </div>

        <div className="tit-seccion" id="grupos"><h2>Grupos</h2><span className="meta">{grupos.length}</span></div>
        {grupos.map((g) => (
          <details key={g.id} className="bloque">
            <summary>
              <span style={{ display: "grid" }}>
                <b style={{ fontWeight: 600 }}>{g.nombre}</b>
                <span className="meta">{DIAS[g.dia - 1]} {g.hora} · {g.pista || "Sin pista"} · {profes.find((p) => p.email === emailProfe(g))?.nombre ?? "Sin profesor"}</span>
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

        <div className="tit-seccion" id="personas"><h2>Personas</h2><span className="meta">{profes.length} profesores · {alumnos.length} alumnos</span></div>
        <FormAlta club={id} grupos={grupos} niveles={niveles} ruta={ruta} puedeProfe />
        {personas.map((p) => <PersonaGestion key={p.email} p={p} club={id} grupos={grupos} ruta={ruta} niveles={niveles} />)}
      </div>
    </main>
  );
}
