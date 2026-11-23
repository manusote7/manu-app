import type { Club, Grupo } from "@/lib/datos";

/** Datos y reglas de un club. Las reglas son las que el club puede cambiar cuando quiera. */
export function CamposClub({ c }: { c?: Club }) {
  return (
    <>
      <label>Nombre del club<input name="nombre" className="campo" required defaultValue={c?.nombre} placeholder="Club Pádel Norte" /></label>
      <div className="fila">
        <label>Enlace de su app<input name="slug" className="campo" required defaultValue={c?.slug} placeholder="norte" /></label>
        <label>Código de acceso<input name="codigo" className="campo" required defaultValue={c?.codigo} placeholder="NORTE24" style={{ textTransform: "uppercase" }} /></label>
      </div>
      <div className="fila">
        <label>Baja: horas de antelación<input name="horas" type="number" min="0" className="campo" defaultValue={c?.horasBaja ?? 6} /></label>
        <label>Recuperación: días para usarla<input name="dias" type="number" min="1" className="campo" defaultValue={c?.diasCaducidad ?? 28} /></label>
        <label>Máximo por clase (por defecto)<input name="max" type="number" min="1" className="campo" defaultValue={c?.maxAlumnos ?? 4} /></label>
      </div>
    </>
  );
}

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** profes: email y nombre de los profes del club (también los que aún no han entrado) */
export function CamposGrupo({ g, profes, niveles, profeEmail }: { g?: Grupo; profes: { email: string; nombre: string }[]; niveles: string[]; profeEmail?: string }) {
  return (
    <>
      <div className="fila">
        <label>Nombre<input name="nombre" className="campo" required defaultValue={g?.nombre} placeholder="Intermedio B" /></label>
        <label>Nivel
          <select name="nivel" className="campo" required defaultValue={g?.nivel ?? ""}>
            <option value="" disabled>Elige nivel</option>
            {[...new Set([...(g?.nivel ? [g.nivel] : []), ...niveles])].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="fila">
        <label>Día
          <select name="dia" className="campo" defaultValue={g?.dia ?? 1}>
            {DIAS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </label>
        <label>Hora<input name="hora" type="time" className="campo" required defaultValue={g?.hora ?? "18:00"} /></label>
        <label>Minutos<input name="duracion" type="number" min="15" step="15" className="campo" defaultValue={g?.duracion ?? 60} /></label>
        <label>Máx. alumnos<input name="max" type="number" min="1" className="campo" defaultValue={g?.max} placeholder="Del club" /></label>
      </div>
      <div className="fila">
        <label>Pista<input name="pista" className="campo" defaultValue={g?.pista} placeholder="Pista 3" /></label>
        <label>Profe
          <select name="profe" className="campo" defaultValue={profeEmail ?? ""}>
            <option value="">Sin asignar</option>
            {profes.map((p) => <option key={p.email} value={p.email}>{p.nombre}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}
