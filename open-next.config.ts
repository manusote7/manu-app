// Configuración para publicar en Cloudflare Workers (plan gratis, uso comercial permitido).
// Todas las pantallas son dinámicas, así que no hace falta caché incremental (R2).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
