import type { Metadata, Viewport } from "next";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { RegisterServiceWorker } from "../components/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "SONARA Industries",
  description: "Independent systems. Shared infrastructure. Stronger markets.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SONARA Industries",
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
  themeColor: "#07070A",
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
