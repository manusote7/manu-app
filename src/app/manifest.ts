import type { MetadataRoute } from "next";

// Hace la web instalable: icono en la pantalla de inicio y se abre a pantalla completa.
export default function manifest(): MetadataRoute.Manifest {
  const admin = process.env.NEXT_PUBLIC_APP === "admin";
  return {
    name: admin ? "Pádel · Administración" : "Escuela de pádel",
    short_name: admin ? "Admin pádel" : "Pádel",
    description: "Tus clases de pádel: semana, bajas, recuperaciones y chat del grupo.",
    start_url: admin ? "/admin" : "/semana",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f6f9",
    theme_color: "#123f6b",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
