import "./globals.css";
import type { Metadata, Viewport } from "next";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";

const siteUrl = "https://sonaraindustries.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "SONARA Industries",
  title: {
    default: "SONARA Industries | Creator, Operations, and Public Information Infrastructure",
    template: "%s | SONARA Industries",
  },
  description:
    "SONARA Industries builds focused software brands for music creation, restaurant operations, and verified local information systems.",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/brand/sonara/mark.svg",
    apple: "/brand/sonara/mark.svg",
  },
  appleWebApp: {
    capable: true,
    title: "SONARA Industries",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "SONARA Industries",
    title: "SONARA Industries | Creator, Operations, and Public Information Infrastructure",
    description:
      "Focused software brands for music creation, restaurant operations, and verified local information systems.",
    images: [
      {
        url: "/brand/sonara/og-image.svg",
        width: 1200,
        height: 630,
        alt: "SONARA Industries brand preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SONARA Industries | Creator, Operations, and Public Information Infrastructure",
    description:
      "Focused software brands for music creation, restaurant operations, and verified local information systems.",
    images: ["/brand/sonara/og-image.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7C3AED",
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
