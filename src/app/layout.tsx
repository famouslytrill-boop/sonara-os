import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SONARA Industries™ | SONARA OS™",
  description:
    "Creator infrastructure for modern music, release planning, rights-aware exports, and SONARA OS™ workflows.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RegisterServiceWorker />
        {children}
        <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 40 }}>
          <PWAInstallPrompt />
        </div>
      </body>
    </html>
  );
}
