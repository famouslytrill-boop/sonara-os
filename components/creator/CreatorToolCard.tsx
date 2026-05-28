import type { CreatorToolRecord } from "../../data/creator-tools";

const statusLabels: Record<CreatorToolRecord["status"], string> = {
  external_reference: "External reference",
  research_only: "Research only",
  needs_license_review: "Needs license review",
  blocked_until_review: "Blocked until review",
};

export function CreatorToolCard({ tool }: { tool: CreatorToolRecord }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#99F6E4]">{tool.category}</p>
      <h2 className="mt-3 text-xl font-black text-white">{tool.name}</h2>
      <p className="mt-3 rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">
        {statusLabels[tool.status]}
      </p>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{tool.useCase}</p>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{tool.notes}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tool.productFit.map((fit) => (
          <span key={fit} className="rounded-full border border-white/10 bg-[#081827] px-3 py-1 text-xs font-bold text-[#CBD5E1]">
            {fit}
          </span>
        ))}
      </div>
    </article>
  );
}
