import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--f-display" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-body" });

export const metadata: Metadata = { title: "Escuela de pádel", description: "Clases, bajas y recuperaciones" };
export const viewport: Viewport = { themeColor: "#123F6B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
