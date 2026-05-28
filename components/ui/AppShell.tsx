import Link from "next/link";
import { ReactNode } from "react";
import { BrandLogo } from "../brand/BrandLogo";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <header className="border-b border-white/10 bg-[#050B14]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo entitySlug="parent-company" size="sm" />
          <nav className="flex flex-wrap gap-2 text-sm font-bold">
            <Link className="rounded-xl border border-white/10 px-3 py-2 text-[#CBD5E1]" href="/app">
              App
            </Link>
            <Link className="rounded-xl border border-white/10 px-3 py-2 text-[#CBD5E1]" href="/app/settings">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-3xl font-black">{title}</h1>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
