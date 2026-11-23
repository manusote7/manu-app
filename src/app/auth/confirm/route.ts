import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import { clubElegido } from "@/lib/sesion";

// Aquí llega el enlace del email de acceso.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const s = await sb();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await s.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await s.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("sin código") };
  const next = url.searchParams.get("next") === "/admin" ? "/admin" : "/semana";
  if (!error) return NextResponse.redirect(new URL(next, url));
  const club = await clubElegido();
  const msg = encodeURIComponent("El enlace ha caducado o ya se usó. Pide otro.");
  return NextResponse.redirect(new URL(club ? `/c/${club.slug}?error=${msg}` : "/", url));
}
