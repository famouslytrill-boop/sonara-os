import Link from "next/link";
import { BRAND_ENTITIES } from "../../lib/brand/entities";
import { AppIcon } from "./AppIcon";
import { BrandColorSwatches } from "./BrandColorSwatches";
import { BrandLogo } from "./BrandLogo";
import { BrandUsageCard } from "./BrandUsageCard";
import { LogoMark } from "./LogoMark";

export function BrandArchitecture() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#332A40] bg-[#0B0F14] p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#00E5FF]">Brand Ecosystem</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white sm:text-5xl">
          One connected company family. Distinct products. Shared infrastructure.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#C4BFD0]">
          Adaptive identity, geometric simplicity, digital-first scalability, app-icon readiness, and clear color-coded hierarchy.
          Working brand names require legal review before final trademark use.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        {BRAND_ENTITIES.map((brand) => (
          <article key={brand.slug} className="rounded-3xl border border-[#332A40] bg-[#121018] p-5">
            <AppIcon entitySlug={brand.slug} />
            <h2 className="mt-4 text-xl font-black text-white">{brand.displayName}</h2>
            <p className="mt-1 text-sm font-bold" style={{ color: brand.primaryColor }}>
              {brand.tagline}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#C4BFD0]">{brand.description}</p>
            <Link href={brand.slug === "launchpad" ? "/brand" : `/dashboard/entities/${brand.slug}`} className="mt-4 inline-flex text-sm font-black text-[#00E5FF]">
              View surface
            </Link>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-[#332A40] bg-[#121018] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FFB020]">Logo Variants</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {BRAND_ENTITIES.map((brand) => (
            <div key={brand.slug} className="rounded-2xl border border-[#332A40] bg-[#0B0F14] p-4">
              <BrandLogo entitySlug={brand.slug} showTagline />
              <div className="mt-5 flex items-center gap-4">
                <LogoMark entitySlug={brand.slug} size="sm" variant="mark" />
                <LogoMark className="text-white" entitySlug={brand.slug} size="sm" variant="monochrome" />
                <LogoMark entitySlug={brand.slug} size="sm" variant="icon" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <BrandColorSwatches />
      <BrandUsageCard />

      <section className="rounded-3xl border border-[#FFB020]/40 bg-[#21190C] p-5">
        <p className="font-black text-[#FFB020]">Legal / Trademark Warning</p>
        <p className="mt-2 text-sm leading-6 text-white">
          These are working brand assets and naming directions. They do not establish trademark clearance, registration,
          domain availability, or legal approval. Run trademark/domain searches and consult a qualified attorney before launch.
        </p>
      </section>
    </div>
  );
}
