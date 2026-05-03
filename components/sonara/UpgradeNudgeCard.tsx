import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { PricingTierId } from "../../config/pricing";
import { getUpgradeNudge } from "../../lib/sonara/conversion/conversionEngine";
import type { ConversionFeature } from "../../lib/sonara/conversion/conversionTypes";

export function UpgradeNudgeCard({
  currentTier = "free",
  feature = "full_bundle_exports",
}: {
  currentTier?: PricingTierId;
  feature?: ConversionFeature;
}) {
  const nudge = getUpgradeNudge(currentTier, feature);

  return (
    <article className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <Sparkles className="text-[#FFB454]" size={22} />
      <p className="mt-3 text-xs font-black uppercase text-[#FFB454]">Upgrade path</p>
      <h2 className="mt-1 text-xl font-black">SONARA OS™ {nudge.recommendedTier}</h2>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{nudge.message}</p>
      <Link href="/pricing" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#9B5CFF] px-4 text-sm font-bold text-white">
        View pricing
      </Link>
    </article>
  );
}
