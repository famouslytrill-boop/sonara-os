import Link from "next/link";
import { ReactNode } from "react";
import { BrandLogo } from "./brand/BrandLogo";
import { BrandLegalFooter } from "./BrandLegalFooter";

const publicNavItems = [
  { label: "Home", href: "/" },
  { label: "TrackFoundry", href: "/trackfoundry" },
  { label: "LineReady", href: "/lineready" },
  { label: "NoticeGrid", href: "/noticegrid" },
  { label: "Pricing", href: "/pricing" },
  { label: "Trust", href: "/trust" },
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B0F14] text-[#F9FAFB]">
      <header className="sticky top-0 z-40 border-b border-[#1F2937] bg-[#0B0F14]/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-[#F9FAFB]">
            <BrandLogo entitySlug="parent-company" size="sm" />
          </Link>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#1F2937] bg-[#111827] p-1 text-xs font-bold sm:flex">
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-[#C4BFD0] transition hover:bg-[#172033] hover:text-white sm:px-3"
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
