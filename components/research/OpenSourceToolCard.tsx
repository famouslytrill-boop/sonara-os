import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { openSourceToolStatuses, type OpenSourceToolRecord } from "../../data/open-source-tools";

const riskTone: Record<OpenSourceToolRecord["licenseRisk"], string> = {
  low: "border-[#22C55E]/35 bg-[#22C55E]/10 text-[#BBF7D0]",
  medium: "border-[#FACC15]/35 bg-[#FACC15]/10 text-[#FEF08A]",
  high: "border-[#FB923C]/35 bg-[#FB923C]/10 text-[#FED7AA]",
  critical: "border-[#EF4444]/35 bg-[#EF4444]/10 text-[#FECACA]",
  unknown: "border-white/15 bg-white/[0.05] text-[#E2E8F0]",
};

export function OpenSourceToolCard({ tool }: { tool: OpenSourceToolRecord }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${riskTone[tool.licenseRisk]}`}>
          License risk: {tool.licenseRisk}
        </span>
        <span className="rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">
          {openSourceToolStatuses[tool.integrationStatus]}
        </span>
      </div>
      <h2 className="mt-4 text-xl font-black text-white">{tool.name}</h2>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{tool.notes}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tool.productFit.slice(0, 3).map((fit) => (
          <span key={fit} className="rounded-full border border-white/10 bg-[#081827] px-3 py-1 text-xs font-bold text-[#CBD5E1]">
            {fit}
          </span>
        ))}
      </div>
      <Link
        href={`/research-lab/open-source/${tool.slug}`}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-black text-white hover:border-[#2DD4BF] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
      >
        Review candidate <ArrowRight size={16} />
      </Link>
    </article>
  );
}
