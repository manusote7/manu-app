import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { usuario, type Usuario } from "./datos";

// Acceso de demostración: se elige usuario. Se sustituirá por login con email (Supabase Auth).
export async function yo(): Promise<Usuario> {
  const id = (await cookies()).get("uid")?.value;
  const u = id ? usuario(id) : undefined;
  if (!u) redirect("/");
  return u;
}
