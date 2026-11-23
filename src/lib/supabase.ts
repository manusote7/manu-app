import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const CLAVE_SB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
/** Sin variables de Supabase la app funciona en modo prueba con datos en memoria. */
export const modoSupabase = Boolean(URL_SB && CLAVE_SB);

export async function sb() {
  const jar = await cookies();
  return createServerClient(URL_SB!, CLAVE_SB!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // En páginas no se pueden escribir cookies; el proxy ya renueva la sesión.
        }
      },
    },
  });
}
