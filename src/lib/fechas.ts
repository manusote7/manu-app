// Fechas como "YYYY-MM-DD" en hora local del servidor.
export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function deIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function sumarDias(s: string, n: number): string {
  const d = deIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** 1 = lunes … 7 = domingo */
export function diaSemana(s: string): number {
  const w = deIso(s).getDay();
  return w === 0 ? 7 : w;
}

export function lunesDe(s: string): string {
  return sumarDias(s, 1 - diaSemana(s));
}

export function inicioClase(fecha: string, hora: string): Date {
  const [h, m] = hora.split(":").map(Number);
  const d = deIso(fecha);
  d.setHours(h, m, 0, 0);
  return d;
}

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const letraDia = (n: number) => "LMXJVSD"[n - 1];
export const nombreDia = (s: string) => DIAS[diaSemana(s) - 1];
export const fechaCorta = (s: string) => `${deIso(s).getDate()} ${MESES[deIso(s).getMonth()]}`;

export function horaFin(hora: string, min: number): string {
  const [h, m] = hora.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function formatoLimite(d: Date, hoy: string): string {
  const dia = iso(d);
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (dia === hoy) return `hoy ${hh}`;
  if (dia === sumarDias(hoy, 1)) return `mañana ${hh}`;
  return `${nombreDia(dia)} ${fechaCorta(dia)} ${hh}`;
}
