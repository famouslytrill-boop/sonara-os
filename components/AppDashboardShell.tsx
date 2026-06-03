import Link from "next/link";
import { ReactNode } from "react";
import { BrandLogo } from "./brand/BrandLogo";

const appNav = [
  ["Dashboard", "/app/dashboard"],
  ["Business", "/app/business-builder"],
  ["Creator", "/app/creator-studio"],
  ["Growth", "/app/growth-studio"],
  ["Customers", "/app/customers"],
  ["Bookings", "/app/bookings"],
  ["Payments", "/app/payments"],
  ["Files", "/app/files"],
  ["Reviews", "/app/reviews"],
  ["Campaigns", "/app/campaigns"],
  ["Research", "/app/research"],
  ["Settings", "/app/settings"],
] as const;

export function AppDashboardShell({ children, title = "SONARA One" }: { children: ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-[#050B14] p-4 lg:w-72 lg:border-b-0 lg:border-r">
          <BrandLogo entitySlug="parent-company" size="sm" />
          <nav className="mt-5 grid grid-cols-2 gap-2 text-sm lg:grid-cols-1">
            {appNav.map(([label, href]) => (
              <Link
                className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3 font-bold text-[#CBD5E1] hover:border-[#2DD4BF] hover:text-white"
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">
          <header className="border-b border-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2DD4BF]">Protected app shell</p>
            <h1 className="mt-2 text-3xl font-black">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#CBD5E1]">
              Private app routes require Supabase Auth. Records, billing, support, and admin actions unlock only when
              workspace membership, RLS, provider keys, and server-side role checks are configured.
            </p>
          </header>
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
