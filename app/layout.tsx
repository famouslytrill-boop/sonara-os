import type { Metadata, Viewport } from "next";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { RegisterServiceWorker } from "../components/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Umbrella Technologies",
  description: "Connected systems for creators, businesses, and communities.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Umbrella Technologies",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0F14",
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
