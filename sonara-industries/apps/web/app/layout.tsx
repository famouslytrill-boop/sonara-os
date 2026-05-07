import "./globals.css";
import type { Metadata, Viewport } from "next";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";

export const metadata: Metadata = {
  metadataBase: new URL("https://sonaraindustries.com"),
  applicationName: "SONARA Industries",
  title: {
    default: "SONARA Industries | Independent Systems",
    template: "%s | SONARA Industries",
  },
  description:
    "SONARA Industries owns independent software companies with shared security, billing, and infrastructure discipline.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "SONARA Industries",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    url: "https://sonaraindustries.com",
    siteName: "SONARA Industries",
    title: "SONARA Industries | Independent Systems",
    description:
      "Independent systems. Shared infrastructure. Stronger markets.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070913",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterServiceWorker />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
