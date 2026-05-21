import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "¿Qué cocino?",
  description:
    "Toma una foto de tus ingredientes y recibe una receta rápida sugerida por IA.",
  applicationName: "¿Qué cocino?",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "¿Qué cocino?",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="pt-safe pb-safe">{children}</body>
    </html>
  );
}
