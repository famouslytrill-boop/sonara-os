export function LicenseRiskBadge({ risk }: { risk: string }) {
  return <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-black text-[#CBD5E1]">{risk.replaceAll("_", " ")}</span>;
}
