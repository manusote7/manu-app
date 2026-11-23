import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Usuario } from "./datos";
import { datos } from "./repo";
import { modoSupabase, sb } from "./supabase";

export interface ClubElegido { id: string; slug: string; nombre: string }

/** Paso 1 del acceso: el club guardado en este dispositivo. */
export async function clubElegido(): Promise<ClubElegido | undefined> {
  try {
    const v = (await cookies()).get("club")?.value;
    return v ? (JSON.parse(v) as ClubElegido) : undefined;
  } catch {
    return undefined;
  }
}

/** Paso 2: la persona conectada, que tiene que ser de ese club. */
export async function yo(): Promise<Usuario> {
  const club = await clubElegido();
  if (!club) redirect("/");
  let id: string | undefined;
  if (modoSupabase) {
    id = (await (await sb()).auth.getClaims()).data?.claims?.sub;
  } else {
    id = (await cookies()).get("uid")?.value;
  }
  if (!id) redirect(`/c/${club.slug}`);
  const u = (await datos()).usuario(id);
  if (!u || u.clubId !== club.id) {
    redirect(`/c/${club.slug}?error=${encodeURIComponent("Tu cuenta no pertenece a este club.")}`);
  }
  return u;
}

/** ¿Hay alguien conectado en este dispositivo? (sin redirigir) */
export async function conectado(): Promise<boolean> {
  if (modoSupabase) return Boolean((await (await sb()).auth.getClaims()).data?.claims?.sub);
  return Boolean((await cookies()).get("uid")?.value);
}
