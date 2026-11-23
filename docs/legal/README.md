# Textos legales base (RGPD)

> **Importante:** son textos base redactados para que PalaClass cumpla el RGPD y la LOPDGDD. Antes de firmar con clubs,
> conviene que los revise un abogado o asesor de protección de datos.

| Archivo | Para qué |
|---|---|
| `contrato-encargado.md` | Contrato entre el club (responsable) y PalaClass (encargado del tratamiento), art. 28 RGPD. Se firma con cada club. |
| `registro-actividades.md` | Registro de actividades de tratamiento que PalaClass lleva como encargado (art. 30.2 RGPD). |

El aviso de privacidad que ven alumnos y profesores está en la app: `src/app/privacidad/texto.tsx` (pantalla `/privacidad`).
Si se cambia de forma importante, sube `VERSION_PRIVACIDAD` en `src/lib/privacidad.ts` y todos lo volverán a aceptar.

## Qué hace la app para cumplir

- **Consentimiento**: la primera vez que alguien entra ve el aviso y lo acepta (`/bienvenida`). Se guarda versión y fecha
  (tabla `consentimientos`). Menores de 14: se pide el nombre de madre/padre/tutor (art. 7 LOPDGDD).
- **Datos de salud** (lesiones en la ficha): categoría especial (art. 9 RGPD). Se piden con consentimiento expreso y solo los ven los profesores del club.
- **Minimización**: cada alumno ve solo lo suyo y el nombre de sus compañeros de grupo y profesores. Los emails solo los ven profesores del club y administración.
- **Acceso y portabilidad**: "Descargar mis datos" en Perfil (`/mis-datos`) y, para administración, en cada persona.
- **Supresión**: administración → club → persona → "Borrar todos sus datos". Borrar un club borra todo lo suyo.
- **Ubicación**: Supabase en la UE (Irlanda). Subencargados: Supabase (BD), Cloudflare (web), Brevo (emails).
- **Seguridad**: RLS en todas las tablas, escrituras solo por funciones con permisos, copias cifradas.
