// Pantalla con datos por usuario: se genera en cada petición.

import { datos } from "@/lib/repo";
import { fechaCorta, horaFin, nombreDia } from "@/lib/fechas";
import { yo } from "@/lib/sesion";
import { pedirRecuperacion } from "../acciones";
import { Aviso, Cabecera, Icono, Nav, Vacio } from "../marco";
import { Boton } from "../cliente";

export default async function Recuperar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await yo();
  const d = await datos();
  const { error } = await searchParams;
  const creditos = d.creditosDisponibles(u.id);
  const clases = d.clasesParaRecuperar(u.id);
  return (
    <main className="app">
      <Aviso error={error} />
      <Cabecera u={u} titulo="Recuperar clase" />
      <div className="body">
        {creditos.length === 0 ? (
          <Vacio titulo="No tienes clases por recuperar" texto="Cuando avises de que no puedes ir a una clase a tiempo, podrás recuperarla aquí." />
        ) : (
          <>
            <p className="meta">
              Clases de nivel {u.nivel} con plaza libre. Tienes {creditos.length === 1 ? "1 recuperación" : `${creditos.length} recuperaciones`};
              {d.club(u.clubId).recuperacionAutomatica ? "si hay hueco, la plaza es tuya al momento." : "el profesor confirma tu plaza."}
            </p>
            {clases.length === 0 && <Vacio titulo="Ahora no hay plazas libres" texto="Vuelve a mirar en unos días." />}
            {clases.map((c) => {
              const libres = d.maxDe(c.grupo) - c.alumnos.length - c.pendientes.length;
              return (
                <form key={c.grupo.id + c.fecha} action={pedirRecuperacion} className="clase">
                  <input type="hidden" name="grupo" value={c.grupo.id} />
                  <input type="hidden" name="fecha" value={c.fecha} />
                  <div className="hora"><b>{c.grupo.hora}</b><span>{horaFin(c.grupo.hora, c.grupo.duracion)}</span></div>
                  <div className="card">
                    <div className="card-cab">
                      <h3>{nombreDia(c.fecha).replace(/^./, (x) => x.toUpperCase())} {fechaCorta(c.fecha)}</h3>
                      <span className="pill ok">{libres === 1 ? "1 plaza" : `${libres} plazas`}</span>
                    </div>
                    <div className="datos">
                      <span>{c.grupo.nombre}</span>
                      {c.grupo.pista && <span><Icono.pista />{c.grupo.pista}</span>}
                      <span><Icono.profe />{d.usuario(c.grupo.profeId)?.nombre ?? "Profesor"}</span>
                    </div>
                    <div className="acciones"><Boton className="btn prim">Pedir esta clase</Boton></div>
                  </div>
                </form>
              );
            })}
          </>
        )}
      </div>
      <Nav rol="alumno" activa="recuperar" />
    </main>
  );
}
