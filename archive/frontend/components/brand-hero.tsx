import Link from "next/link";
import type { BrandDefinition } from "../lib/brand-registry";

export function BrandHero({
  brand,
  eyebrow,
  title,
  description,
}: {
  brand?: BrandDefinition;
  eyebrow: string;
  title: string;
  description: string;
}) {
  const accent = brand?.theme.accent ?? "#8B5CF6";
  const accent2 = brand?.theme.accent2 ?? "#22D3EE";

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/10 p-6 text-white shadow-2xl sm:p-8"
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), radial-gradient(circle at top right, ${accent}44, transparent 34%), radial-gradient(circle at bottom left, ${accent2}33, transparent 32%), #0A0A0F`,
      }}
    >
      <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: accent2 }}>
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{description}</p>
      {brand ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/${brand.key}/app`} className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-black text-white" style={{ background: accent }}>
            Open app preview
          </Link>
          <Link href={`/${brand.key}/features`} className="inline-flex min-h-11 items-center rounded-lg border border-white/15 bg-black/25 px-4 text-sm font-black text-white">
            Explore features
          </Link>
        </div>
      ) : null}
    </section>
  );
}
