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
    <div className="min-h-screen overflow-x-hidden bg-[#08070B] text-[#F9FAFB]">
      <header className="sticky top-0 z-40 border-b border-[#332A40] bg-[#08070B]/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-black tracking-wide text-[#F9FAFB]">
            SONARA Industries™
          </Link>
          <div className="grid grid-cols-5 gap-1 rounded-lg border border-[#332A40] bg-[#121018] p-1 text-xs font-bold sm:flex">
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 items-center justify-center rounded-md px-2 text-[#C4BFD0] transition hover:bg-[#211B2D] hover:text-[#F9FAFB] sm:px-3"
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
