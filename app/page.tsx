import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { PublicShell } from "../components/PublicShell";
import { houseBrands } from "../lib/houseBrands";

const productCards = [houseBrands.trackfoundry, houseBrands.lineready, houseBrands.noticegrid];

export default function HomePage() {
  return (
    <PublicShell>
      <section className="grid gap-8 py-6 lg:grid-cols-[1fr_0.78fr] lg:items-center">
        <div>
          <BrandLogo entitySlug="parent-company" showTagline size="md" />
          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">
            Independent systems. Shared infrastructure. Stronger markets.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#C4BFD0]">
            SONARA Industries owns independent software companies. TrackFoundry, LineReady, and NoticeGrid each keep
            their own market, product surface, data boundary, and workflow while sharing infrastructure discipline.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#00E5FF] px-5 text-sm font-black text-[#0B0F14]" href="/trackfoundry">
              Explore TrackFoundry <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex min-h-12 items-center rounded-xl border border-[#1F2937] bg-[#111827] px-5 text-sm font-black text-white hover:border-[#00E5FF]" href="/trust">
              View trust model
            </Link>
          </div>
        </div>
        <div className="rounded-[2rem] border border-[#1F2937] bg-[#111827] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.38)]">
          <div className="grid gap-3">
            {productCards.map((brand) => (
              <Link key={brand.route} href={brand.route} className="rounded-2xl border border-[#1F2937] bg-[#0B0F14] p-4 transition hover:border-[#00E5FF]">
                <p className="text-sm font-black text-white">{brand.name}</p>
                <p className="mt-1 text-xs font-bold" style={{ color: brand.accent }}>
                  {brand.tagline}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {productCards.map((brand) => (
          <Link
            key={brand.route}
            href={brand.route}
            className="rounded-3xl border border-[#1F2937] bg-[#111827] p-5 transition hover:-translate-y-1 hover:border-[#00E5FF]"
          >
            <div className="h-1.5 rounded-full" style={{ background: brand.accent }} />
            <h2 className="mt-5 text-xl font-black text-white">{brand.name}</h2>
            <p className="mt-2 text-sm font-bold" style={{ color: brand.accent }}>
              {brand.tagline}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#C4BFD0]">{brand.category}</p>
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
