"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { createBrowserClient } from "@supabase/ssr";

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

/** Vuelve a pedir la pantalla cada pocos segundos mientras está a la vista (para el chat). */
export function Refrescar({ cada = 8 }: { cada?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, cada * 1000);
    return () => clearInterval(t);
  }, [router, cada]);
  return null;
}

/** Chat ligero: pregunta a Supabase desde el móvil si hay mensajes nuevos (consulta mínima, no pasa por
 *  Cloudflare) y solo entonces recarga la pantalla. Sin Supabase (modo prueba) recarga cada 15 s. */
export function ChatVivo({ grupo, ultimo, cada = 6 }: { grupo: string; ultimo: string; cada?: number }) {
  const router = useRouter();
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const s = url && clave ? createBrowserClient(url, clave) : null;
    let ocupado = false;
    const mirar = async () => {
      if (document.visibilityState !== "visible" || ocupado) return;
      if (!s) return router.refresh();
      ocupado = true;
      try {
        let q = s.from("mensajes").select("id").eq("grupo_id", grupo).limit(1);
        if (ultimo) q = q.gt("creado_en", ultimo);
        const { data } = await q;
        if (data?.length) router.refresh();
      } finally { ocupado = false; }
    };
    const t = setInterval(mirar, (s ? cada : 15) * 1000);
    document.addEventListener("visibilitychange", mirar);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", mirar); };
  }, [router, grupo, ultimo, cada]);
  return null;
}

/** Al abrir el chat, baja hasta el último mensaje. */
export function AlFinal() {
  useEffect(() => { document.getElementById("fin")?.scrollIntoView({ block: "end" }); }, []);
  return null;
}

type AvisoInstalar = Event & { prompt: () => Promise<void> };

/** Tarjeta para instalar la app en el móvil (no sale si ya está instalada). */
export function Instalar() {
  const [modo, setModo] = useState<"oculto" | "ios" | "android" | "boton">("oculto");
  const [ev, setEv] = useState<AvisoInstalar | null>(null);
  useEffect(() => {
    const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (instalada) return;
    const ua = navigator.userAgent;
    const t = setTimeout(() => setModo(/iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "oculto"), 0);
    const f = (e: Event) => { e.preventDefault(); setEv(e as AvisoInstalar); setModo("boton"); };
    window.addEventListener("beforeinstallprompt", f);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", f); };
  }, []);
  if (modo === "oculto") return null;
  return (
    <div className="card instalar">
      <div className="card-cab"><b>Instala la app en tu móvil</b><img src="/icon-192.png" alt="" width={36} height={36} /></div>
      {modo === "boton" && <button className="btn prim" onClick={() => ev?.prompt()}>Instalar</button>}
      {modo === "ios" && <p className="meta">En Safari, toca <b>Compartir</b> (el cuadrado con la flecha) y luego <b>Añadir a pantalla de inicio</b>.</p>}
      {modo === "android" && <p className="meta">En Chrome, toca el menú <b>⋮</b> y luego <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</p>}
    </div>
  );
}
