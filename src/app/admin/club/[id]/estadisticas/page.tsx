
import Link from "next/link";
import { notFound } from "next/navigation";
import { datos } from "@/lib/repo";
import { yoAdmin } from "@/lib/sesion";
import { Icono } from "../../../../marco";
import { Estadisticas } from "../../../../estadisticas";

export default async function StatsAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  await yoAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const d = await datos();
  const club = d.clubs.find((c) => c.id === id);
  if (!club) notFound();
  return (
    <main className="app ancha">
      <header className="cab">
        <div className="cab-top">
          <Link href={`/admin/club/${id}`} className="icono-btn" aria-label="Volver al club"><Icono.atras /></Link>
          <div className="cab-txt"><span className="cab-club">{club.nombre}</span><h1>Estadísticas</h1></div>
        </div>
      </header>
      <div className="body" style={{ paddingBottom: 40 }}>
        <Estadisticas d={d} clubId={id} periodo={sp.p} base={`/admin/club/${id}/estadisticas`} />
      </div>
    </main>
  );
}
