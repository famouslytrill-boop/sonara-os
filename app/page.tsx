import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AppIcon } from "../components/brand/AppIcon";
import { BrandLogo } from "../components/brand/BrandLogo";
import { PublicShell } from "../components/PublicShell";
import { BRAND_ENTITIES } from "../lib/brand/entities";

const productCopy = [
  "Connected systems for creators, businesses, and communities.",
  "Tools for artists and creators to build the world around their work.",
  "Cleaner daily operations for restaurants and small businesses.",
  "Useful local information organized in one place.",
  "The fastest path from idea to launch-ready infrastructure.",
];

export default function HomePage() {
  return (
    <PublicShell>
      <section className="grid gap-8 py-6 lg:grid-cols-[1fr_0.78fr] lg:items-center">
        <div>
          <BrandLogo entitySlug="parent-company" showTagline size="md" />
          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">
            Connected systems for creators, businesses, and communities.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#C4BFD0]">
            Umbrella Technologies is a working parent brand direction for a family of distinct, high-contrast,
            digital-first product systems. Each product keeps its own market, dashboard, data boundary, color, and workflow.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#00E5FF] px-5 text-sm font-black text-[#0B0F14]" href="/dashboard/entities">
              Open Entity Dashboard <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex min-h-12 items-center rounded-xl border border-[#1F2937] bg-[#111827] px-5 text-sm font-black text-white hover:border-[#00E5FF]" href="/brand">
              View Brand Ecosystem
            </Link>
          </div>
          <p className="mt-4 max-w-2xl text-xs font-bold leading-5 text-[#8F879C]">
            Working brand names require legal review before final trademark use. No trademark clearance or official partnership is claimed.
          </p>
        </div>
        <div className="rounded-[2rem] border border-[#1F2937] bg-[#111827] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.38)]">
          <div className="grid grid-cols-2 gap-3">
            {BRAND_ENTITIES.map((brand) => (
              <div key={brand.slug} className="rounded-2xl border border-[#1F2937] bg-[#0B0F14] p-4">
                <AppIcon entitySlug={brand.slug} />
                <p className="mt-3 text-sm font-black text-white">{brand.displayName}</p>
                <p className="mt-1 text-xs font-bold" style={{ color: brand.primaryColor }}>
                  {brand.tagline}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {BRAND_ENTITIES.map((brand, index) => (
          <Link
            key={brand.slug}
            href={brand.slug === "launchpad" ? "/brand" : `/dashboard/entities/${brand.slug}`}
            className="rounded-3xl border border-[#1F2937] bg-[#111827] p-5 transition hover:-translate-y-1 hover:border-[#00E5FF]"
          >
            <div className="h-1.5 rounded-full" style={{ background: brand.primaryColor }} />
            <h2 className="mt-5 text-xl font-black text-white">{brand.publicLabel}</h2>
            <p className="mt-2 text-sm font-bold" style={{ color: brand.primaryColor }}>
              {brand.tagline}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#C4BFD0]">{productCopy[index]}</p>
          </Link>
        ))}
      </section>

      <section className="mt-8 rounded-3xl border border-[#1F2937] bg-[#111827] p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 shrink-0 text-[#00E5FF]" size={22} />
          <div>
            <p className="text-xl font-black text-white">Shared infrastructure. Separate product boundaries.</p>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#C4BFD0]">
              Parent governance can share billing, security, infrastructure, audit logs, and deployment discipline.
              Product dashboards, customer data, entity operations, and workflows stay separated unless explicitly authorized.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
