import "./globals.css";
import type { Metadata } from "next";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "SONARA Industries Operating Systems",
  description: "Separate operating systems with shared security, billing, and infrastructure discipline."
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
