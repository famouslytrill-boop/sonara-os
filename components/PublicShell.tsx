import Link from "next/link";
import { ReactNode } from "react";
import { BrandLegalFooter } from "./BrandLegalFooter";

const publicNavItems = [
  { label: "Home", href: "/" },
  { label: "Store", href: "/store" },
  { label: "Pricing", href: "/pricing" },
  { label: "Tutorial", href: "/tutorial" },
  { label: "Login", href: "/login" },
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07070A] text-[#F8FAFC]">
      <header className="sticky top-0 z-40 border-b border-[#2A2A35] bg-[#07070A]/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-black tracking-wide text-[#F8FAFC]">
            SONARA Industries™
          </Link>
          <div className="grid grid-cols-5 gap-1 rounded-lg border border-[#2A2A35] bg-[#111118] p-1 text-xs font-bold sm:flex">
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 items-center justify-center rounded-md px-2 text-[#A1A1AA] transition hover:bg-[#171720] hover:text-[#F8FAFC] sm:px-3"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      <BrandLegalFooter />
    </div>
  );
}
