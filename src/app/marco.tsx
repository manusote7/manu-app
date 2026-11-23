import Link from "next/link";
import { clubElegido } from "@/lib/sesion";

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const Icono = {
  semana: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>),
  recuperar: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /><path d="M12 8v4l3 2" /></svg>),
  perfil: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>),
  pista: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M5 12h14M12 7v10" /></svg>),
  profe: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>),
  reloj: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>),
  pelota: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M5 6.5c3 2 3 9 0 11M19 6.5c-3 2-3 9 0 11" /></svg>),
  grupo: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden><circle cx="9" cy="8.5" r="3.3" /><path d="M3 19.5a6 6 0 0 1 12 0" /><circle cx="17" cy="9.5" r="2.6" /><path d="M16 14.2a5 5 0 0 1 5.5 5" /></svg>),
  atras: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden width="20" height="20"><path d="M15 5l-7 7 7 7" /></svg>),
  adelante: () => (<svg viewBox="0 0 24 24" {...trazo} aria-hidden width="20" height="20"><path d="M9 5l7 7-7 7" /></svg>),
};

export function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export async function Cabecera({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  const club = await clubElegido();
  return (
    <header className="cab">
      <div className="cab-top">
        <span className="marca" aria-hidden>{iniciales(club?.nombre ?? "P")}</span>
        <div className="cab-txt">
          <span className="cab-club">{club?.nombre}</span>
          <h1>{titulo}</h1>
        </div>
      </div>
      {children}
    </header>
  );
}

/** Mensaje breve tras una acción: aparece arriba y se va solo. */
export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="toast err" role="alert">{error}</p>;
  if (ok) return <p className="toast" role="status">{ok}</p>;
  return null;
}

export function Nav({ rol, activa }: { rol: string; activa: "semana" | "recuperar" | "perfil" | "alumnos" }) {
  const items = [
    { k: "semana", t: "Semana", href: "/semana", I: Icono.semana },
    ...(rol === "alumno" ? [{ k: "recuperar", t: "Recuperar", href: "/recuperar", I: Icono.recuperar }] : []),
    ...(rol === "profe" ? [{ k: "alumnos", t: "Alumnos", href: "/alumnos", I: Icono.grupo }] : []),
    { k: "perfil", t: "Perfil", href: "/perfil", I: Icono.perfil },
  ];
  return (
    <nav className="nav" aria-label="Secciones">
      {items.map(({ k, t, href, I }) => (
        <Link key={k} href={href} aria-current={activa === k ? "page" : undefined}><I />{t}</Link>
      ))}
    </nav>
  );
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="vacio"><Icono.pelota /><b>{titulo}</b><span>{texto}</span></div>
  );
}
