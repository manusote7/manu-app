import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--f-display" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-body" });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP === "admin" ? "PalaClass Admin" : "PalaClass",
  description: "Clases, bajas y recuperaciones",
  applicationName: "PalaClass",
  appleWebApp: { capable: true, title: "PalaClass", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f6f9" }, { media: "(prefers-color-scheme: dark)", color: "#0a121b" }],
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
