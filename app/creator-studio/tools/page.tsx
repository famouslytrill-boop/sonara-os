import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../../components/PublicShell";
import { CreatorToolCard } from "../../../components/creator/CreatorToolCard";
import { creatorTools } from "../../../data/creator-tools";

export const metadata: Metadata = {
  title: "Creator Tool Library",
  description: "External creator workflow references for Creator Studio, all review-gated before integration.",
};

const categories = [
  ["Animation", "/creator-studio/tools/animation"],
  ["Open Source", "/creator-studio/tools/open-source"],
  ["Video", "/creator-studio/tools/video"],
  ["Design", "/creator-studio/tools/design"],
  ["AI Agents", "/creator-studio/tools/ai-agents"],
] as const;

export default function CreatorToolsPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Creator Tool Library</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Useful tools, documented safely.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Creator Studio tracks external animation, design, video, open-source, and AI builder references as research
          and setup notes. SONARA does not imply native hosting, ownership, endorsement, or license clearance.
        </p>
      </section>
      <nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {categories.map(([label, href]) => (
          <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-[#081827] p-4 text-sm font-black text-white">
            {label}
          </Link>
        ))}
      </nav>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {creatorTools.map((tool) => (
          <CreatorToolCard key={tool.slug} tool={tool} />
        ))}
      </section>
    </PublicShell>
  );
}
