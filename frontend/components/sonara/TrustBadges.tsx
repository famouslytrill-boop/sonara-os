import { ShieldCheck } from "lucide-react";

const badges = [
  "OpenAI optional",
  "Unknown sound rights blocked",
  "Payments through Stripe on web",
  "Private projects are not public demos",
  "SONARA marks use ™",
] as const;

export function TrustBadges() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {badges.map((badge) => (
        <div key={badge} className="rounded-lg border border-[#332A40] bg-[#191522] p-3 text-sm font-bold text-[#F9FAFB]">
          <ShieldCheck className="mb-2 text-[#22C55E]" size={18} />
          {badge}
        </div>
      ))}
    </div>
  );
}
