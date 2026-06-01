import type { LicenseGateStatus } from "../../data/license-policies";

const tone: Record<LicenseGateStatus, string> = {
  Allowed: "border-[#22C55E]/35 bg-[#22C55E]/10 text-[#BBF7D0]",
  "Review Required": "border-[#FACC15]/35 bg-[#FACC15]/10 text-[#FEF08A]",
  Restricted: "border-[#FB923C]/35 bg-[#FB923C]/10 text-[#FED7AA]",
  Blocked: "border-[#EF4444]/35 bg-[#EF4444]/10 text-[#FECACA]",
  "Reference Only": "border-white/15 bg-white/[0.05] text-[#E2E8F0]",
};

export function LicenseRiskBadge({ status }: { status: LicenseGateStatus }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone[status]}`}>{status}</span>;
}
