export function TrustBadge({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">
      {label}
      {detail ? <span className="ml-2 font-bold text-[#CBD5E1]">{detail}</span> : null}
    </div>
  );
}
