import type { Metadata, Viewport } from "next";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { RegisterServiceWorker } from "../components/RegisterServiceWorker";
import "./globals.css";

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
  keywords: [
    "SONARA Industries",
    "TrackFoundry",
    "LineReady",
    "NoticeGrid",
    "software holding company",
    "shared infrastructure",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://sonaraindustries.com",
    siteName: "SONARA Industries",
    title: "SONARA Industries | Independent Systems",
    description:
      "Independent systems. Shared infrastructure. Stronger markets.",
  },
  twitter: {
    card: "summary",
    title: "SONARA Industries | Independent Systems",
    description:
      "Independent systems. Shared infrastructure. Stronger markets.",
  },
  appleWebApp: {
    capable: true,
    title: "SONARA Industries",
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
