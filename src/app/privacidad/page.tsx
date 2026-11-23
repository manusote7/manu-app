import Link from "next/link";
import { clubElegido } from "@/lib/sesion";
import { Icono } from "../marco";
import { TextoPrivacidad } from "./texto";
import { VERSION_PRIVACIDAD } from "@/lib/privacidad";

export default async function Privacidad() {
  const club = await clubElegido();
  return (
    <main className="app">
      <header className="cab">
        <div className="cab-top">
          <Link href="/perfil" className="icono-btn" aria-label="Volver"><Icono.atras /></Link>
          <div className="cab-txt"><span className="cab-club">PalaClass · versión {VERSION_PRIVACIDAD}</span><h1>Privacidad</h1></div>
        </div>
      </header>
      <div className="body"><TextoPrivacidad club={club?.nombre} /></div>
    </main>
  );
}
