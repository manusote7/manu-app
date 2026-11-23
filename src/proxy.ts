import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renueva la sesión de Supabase en cada petición para que no caduque.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let res = NextResponse.next({ request });
  if (!url || !key) return res;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        res = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // getClaims comprueba la sesión sin ir al servidor de Supabase si las claves son asimétricas
  await supabase.auth.getClaims();
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
