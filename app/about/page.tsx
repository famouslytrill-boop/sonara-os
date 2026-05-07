import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";
import { houseBrands } from "../../lib/houseBrands";

export const metadata: Metadata = {
  title: "About",
  description:
    "About SONARA Industries and its independent child companies.",
};

export default function AboutPage() {
  const brands = [houseBrands.trackfoundry, houseBrands.lineready, houseBrands.noticegrid];

  return (
    <PublicShell>
      <section className="rounded-3xl border border-[#1F2937] bg-[#111827] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#00E5FF]">
          About
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-white">
          SONARA Industries owns independent software companies.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#C4BFD0]">
          The parent company sets shared standards for infrastructure,
          security, billing discipline, approval workflows, and launch
          operations. Each child brand keeps its own audience, product surface,
          and market identity.
        </p>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {brands.map((brand) => (
          <Link
            className="rounded-3xl border border-[#1F2937] bg-[#111827] p-5 transition hover:-translate-y-0.5 hover:border-[#00E5FF]"
            href={brand.route}
            key={brand.route}
          >
            <h2 className="text-xl font-black text-white">{brand.name}</h2>
            <p className="mt-2 text-sm font-bold" style={{ color: brand.accent }}>
              {brand.tagline}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#C4BFD0]">{brand.category}</p>
          </Link>
        ))}
      </section>
    </PublicShell>
  );
}
