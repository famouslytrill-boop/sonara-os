import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SONARA Industries Operating Systems",
  description: "Separate operating systems with shared security, billing, and infrastructure discipline."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

