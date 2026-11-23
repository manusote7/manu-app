"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

/** Botón de formulario que muestra que está trabajando y no se puede pulsar dos veces. */
export function Boton({ children, className = "btn", name, value }: { children: React.ReactNode; className?: string; name?: string; value?: string }) {
  const { pending, data } = useFormStatus();
  const esEste = pending && (!name || data?.get(name) === value);
  return (
    <button className={className} name={name} value={value} disabled={pending} aria-busy={esEste}>
      {esEste && <span className="spin" aria-hidden />}
      {children}
    </button>
  );
}

export interface DiaInfo { fecha: string; letra: string; num: number; tiene: boolean; hoy: boolean }

/** Selector de día: cambia al instante, sin volver a cargar la página. */
export function Dias({ dias, inicial, paneles }: { dias: DiaInfo[]; inicial: string; paneles: Record<string, React.ReactNode> }) {
  const [sel, setSel] = useState(inicial);
  const elegir = (f: string) => {
    setSel(f);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("d", f);
      u.searchParams.delete("ok");
      u.searchParams.delete("error");
      window.history.replaceState(null, "", u);
    } catch {}
  };
  return (
    <>
      <div className="dias" role="tablist" aria-label="Días de la semana">
        {dias.map((d) => (
          <button key={d.fecha} role="tab" aria-selected={sel === d.fecha} onClick={() => elegir(d.fecha)}
            className={`dia${d.tiene ? " tiene" : ""}${d.hoy ? " hoy" : ""}`}>
            <small>{d.letra}</small><b>{d.num}</b><i />
          </button>
        ))}
      </div>
      <div className="dias-panel">{paneles[sel]}</div>
    </>
  );
}
