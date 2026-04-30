import type { Metadata, Viewport } from "next";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { RegisterServiceWorker } from "../components/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "SONARA Industries™",
  description: "Creator infrastructure for modern music.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SONARA OS™",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08070B",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RegisterServiceWorker />
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
