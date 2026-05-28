import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../../components/PublicShell";
import { growthSignalPatterns } from "../../../data/growth-signal-patterns";

export const metadata: Metadata = {
  title: "Growth Intelligence",
  description: "Ethical Growth Studio intelligence for planning campaigns, follow-up, reviews, and offers.",
};

export default function GrowthIntelligencePage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Growth Intelligence</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Plan growth without manipulation.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Growth Studio turns signals into explainable planning notes for offers, reviews, referrals, follow-up, and
          campaigns. It does not auto-send campaigns or guarantee growth.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2DD4BF] px-4 text-sm font-black text-[#07111F]" href="/growth-studio/content-signals">
            View content signals
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-black text-white" href="/growth-studio/recommendation-research">
            Recommendation research
          </Link>
        </div>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {growthSignalPatterns.map((pattern) => (
          <article key={pattern.title} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#99F6E4]">{pattern.category}</p>
            <h2 className="mt-3 text-xl font-black text-white">{pattern.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{pattern.recommendation}</p>
            <p className="mt-3 text-xs font-bold text-[#94A3B8]">{pattern.productFit}</p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
