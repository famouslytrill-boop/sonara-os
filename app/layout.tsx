import type { Metadata, Viewport } from "next";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { RegisterServiceWorker } from "../components/RegisterServiceWorker";
import "./globals.css";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://sonaraindustries.com"
).replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "SONARA Industries",
  title: {
    default: "SONARA Industries",
    template: "%s | SONARA Industries",
  },
  description: "Technology infrastructure for Business Builder, Creator Studio, and Growth Studio.",
  manifest: "/manifest.webmanifest",
  keywords: [
    "SONARA Industries",
    "Business Builder",
    "Creator Studio",
    "Growth Studio",
    "SONARA One",
    "business software",
    "creator software",
    "growth software",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "SONARA Industries",
    title: "SONARA Industries",
    description: "Technology infrastructure for Business Builder, Creator Studio, and Growth Studio.",
    images: ["/brand/sonara-og.svg"],
  },
  twitter: {
    card: "summary",
    title: "SONARA Industries",
    description: "Technology infrastructure for Business Builder, Creator Studio, and Growth Studio.",
    images: ["/brand/sonara-og.svg"],
  },
  appleWebApp: {
    capable: true,
    title: "SONARA Industries",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-icon.svg",
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/sonara-icon-16.svg", sizes: "16x16", type: "image/svg+xml" },
      { url: "/icons/sonara-icon-32.svg", sizes: "32x32", type: "image/svg+xml" },
      { url: "/icons/sonara-icon-48.svg", sizes: "48x48", type: "image/svg+xml" },
    ],
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
