import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { club, usuario, type Usuario } from "./datos";

// Dos pasos: primero el club (cookie "club"), luego la persona dentro de ese club (cookie "uid").
// El login de persona será con email (Supabase Auth); de momento se elige usuario.
export async function yo(): Promise<Usuario> {
  const c = await cookies();
  const clubId = c.get("club")?.value;
  const u = c.get("uid") ? usuario(c.get("uid")!.value) : undefined;
  if (!clubId) redirect("/");
  if (!u || u.clubId !== clubId) redirect(`/c/${club(clubId)?.slug ?? ""}`);
  return u;
}
