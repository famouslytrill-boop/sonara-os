import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { PublicShell } from "../../components/PublicShell";

export const metadata: Metadata = {
  title: "Research Lab",
  description:
    "SONARA Research Lab tracks useful open-source tools, AI systems, creative software, and infrastructure patterns for governed product review.",
};

const reviewAreas = [
  "Open Source Watchlist",
  "Model Comparison Lab",
  "Creator Tool Library",
  "Growth Intelligence",
  "Multimodal Research",
  "License Review",
  "Human Review Required",
] as const;

const safetyRules = [
  "Research references are not automatically bundled, endorsed, or shipped.",
  "Every integration requires license, security, safety, maintenance, commercial-use, and product-fit review.",
  "Risky scraping, red-team, jailbreak, credential, surveillance, or non-commercial model-weight tools stay blocked until reviewed.",
] as const;

export default function ResearchLabPage() {
  return (
    <PublicShell>
      <section className="grid gap-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">SONARA Research Lab</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">
            Governed research. Safe product decisions.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#CBD5E1]">
            SONARA Research Lab tracks useful open-source tools, AI systems, creative software, and infrastructure
            patterns, then converts them into safe, governed product ideas.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/research-lab/open-source"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] px-5 text-sm font-black text-[#07111F] focus:outline-none focus:ring-2 focus:ring-[#A7F3D0]"
            >
              Open watchlist <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-black text-white hover:border-[#2DD4BF] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            >
              View pricing
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#07111F] p-5">
          <ShieldCheck className="text-[#2DD4BF]" size={28} />
          <h2 className="mt-4 text-2xl font-black text-white">No blind integrations.</h2>
          <div className="mt-4 grid gap-3">
            {safetyRules.map((rule) => (
              <p key={rule} className="flex gap-3 text-sm leading-6 text-[#CBD5E1]">
                <CheckCircle2 className="mt-1 shrink-0 text-[#2DD4BF]" size={16} />
                <span>{rule}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviewAreas.map((area) => (
          <article key={area} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <p className="text-lg font-black text-white">{area}</p>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">
              Status: governed research surface. References must be reviewed before production adoption.
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-3xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-6">
        <h2 className="text-2xl font-black text-white">Human review required</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#FDE68A]">
          This page is a public research overview, not a claim that external projects are installed, endorsed, connected,
          or safe for commercial use. Each candidate must pass license, security, safety, commercial-use, maintenance,
          and product-fit review.
        </p>
      </section>
    </PublicShell>
  );
}
