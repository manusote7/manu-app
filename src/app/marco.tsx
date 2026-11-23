import Link from "next/link";
import type { Usuario } from "@/lib/datos";
import { club } from "@/lib/datos";
import { salir } from "./acciones";

export function Cabecera({ u, titulo, children }: { u: Usuario; titulo: string; children?: React.ReactNode }) {
  return (
    <header className="top">
      <div className="club">
        <span>{club(u.clubId).nombre}</span>
        <form action={salir}><span>{u.nombre} · </span><button>Salir</button></form>
      </div>
      <h1>{titulo}</h1>
      {children}
    </header>
  );
}

export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="msg err" role="alert">{error}</p>;
  if (ok) return <p className="msg" role="status">{ok}</p>;
  return null;
}

export function Nav({ u, activa }: { u: Usuario; activa: string }) {
  const items = [
    { k: "semana", t: "Semana", href: "/semana" },
    { k: "chat", t: "Chat" },
    { k: "fichas", t: u.rol === "alumno" ? "Mi ficha" : "Alumnos" },
    { k: "perfil", t: "Perfil" },
  ];
  return (
    <nav className="nav">
      {items.map((i) =>
        i.href ? (
          <Link key={i.k} href={i.href} className={activa === i.k ? "a" : ""}>{i.t}</Link>
        ) : (
          <span key={i.k} className="off" title="Próximamente">{i.t}</span>
        ),
      )}
    </nav>
  );
}
