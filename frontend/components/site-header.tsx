import Link from "next/link";
import { brandList, parentCompany } from "../lib/brand-registry";

const corporateLinks = [
  { label: "Websites", href: "/websites" },
  { label: "Pricing", href: "/pricing" },
  { label: "Security", href: "/security" },
  { label: "Research", href: "/research" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07070A]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="min-w-0">
          <span className="block text-sm font-black tracking-wide text-white">{parentCompany.name}</span>
          <span className="block text-xs text-slate-400">{parentCompany.tagline}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {corporateLinks.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white">
              {item.label}
            </Link>
          ))}
          {brandList.map((brand) => (
            <Link
              key={brand.key}
              href={`/${brand.key}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-200 transition hover:border-white/25 hover:text-white"
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
