export function PermissionStatusBadge({ status }: { status: string }) {
  return <span className="rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">{status}</span>;
}
