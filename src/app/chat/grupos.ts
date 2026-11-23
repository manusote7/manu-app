import type { Consultas, Usuario } from "@/lib/datos";

/** Grupos cuyo chat ve alguien: los que da (profesor) o a los que va (alumno) */
export const misGruposChat = (d: Consultas, u: Usuario) =>
  u.rol === "profe" ? d.gruposDeClub(u.clubId).filter((g) => g.profeId === u.id) : d.gruposDeAlumno(u.id);
