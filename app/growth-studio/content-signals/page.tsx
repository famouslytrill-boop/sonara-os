import type { Metadata } from "next";
import { PublicShell } from "../../../components/PublicShell";
import { growthSignalTaxonomy } from "../../../lib/growth/signal-taxonomy";

export const metadata: Metadata = {
  title: "Content Signals",
  description: "Allowed and blocked content signal uses for ethical Growth Studio planning.",
};

export default function ContentSignalsPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Content Signals</p>
        <h1 className="mt-3 text-4xl font-black text-white">Signals must explain, not manipulate.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          These signal categories support planning and education. They cannot be used for fake reviews, spam,
          discriminatory targeting, or hidden persuasion.
        </p>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {growthSignalTaxonomy.map((signal) => (
          <article key={signal.category} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <h2 className="text-xl font-black text-white">{signal.label}</h2>
            <p className="mt-3 text-sm leading-6 text-[#BBF7D0]">Allowed: {signal.allowedUse}</p>
            <p className="mt-3 text-sm leading-6 text-[#FECACA]">Blocked: {signal.blockedUse}</p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
