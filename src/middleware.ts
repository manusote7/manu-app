import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// middleware.ts (y no proxy.ts) porque Cloudflare/OpenNext solo soporta bien el middleware de tipo edge.
// Renueva la sesión de Supabase en cada petición para que no caduque.
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let res = NextResponse.next({ request });
  // Al abrir los avisos, el recordatorio de las clases de mañana queda visto por hoy
  const visto = (r: NextResponse) => {
    if (request.nextUrl.pathname === "/avisos") {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      r.cookies.set("rec_visto", `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, { path: "/", maxAge: 60 * 60 * 48, sameSite: "lax" });
    }
    return r;
  };
  if (!url || !key) return visto(res);
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
  return visto(res);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
