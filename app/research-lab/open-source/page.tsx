import type { Metadata } from "next";
import { PublicShell } from "../../../components/PublicShell";
import { OpenSourceToolCard } from "../../../components/research/OpenSourceToolCard";
import { openSourceTools } from "../../../data/open-source-tools";

export const metadata: Metadata = {
  title: "Open Source Watchlist",
  description: "Governed open-source and external project intake candidates for SONARA Research Lab.",
};

export default function OpenSourceWatchlistPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Open Source Watchlist</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Research candidates, not blind dependencies.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          These records track external tools and public research references before anything is copied, installed,
          vendored, self-hosted, or shown as an integrated product feature.
        </p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {openSourceTools.map((tool) => (
          <OpenSourceToolCard key={tool.slug} tool={tool} />
        ))}
      </section>
    </PublicShell>
  );
}
