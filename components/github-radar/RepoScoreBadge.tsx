export function RepoScoreBadge({ score }: { score: number }) {
  return <span className="rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">{score}/100</span>;
}
