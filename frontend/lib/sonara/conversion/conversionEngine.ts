import type { PricingTierId } from "../../../config/pricing";
import type { ConversionFeature, UpgradeNudge } from "./conversionTypes";

export const featureTierMap: Record<ConversionFeature, UpgradeNudge["recommendedTier"]> = {
  basic_prompt_builder: "free",
  advanced_prompt_builder: "starter",
  runtime_target_engine: "starter",
  slider_recommendations: "starter",
  authentic_writer_engine: "starter",
  sound_identity: "starter",
  sound_rights_exports: "core",
  metadata_rights_sheets: "core",
  full_bundle_exports: "growth",
  obs_broadcast_kit: "pro",
  vault_stack: "pro",
  brand_governance: "agency",
  review_room: "pro",
  label_workspace: "agency",
  marketplace_tools: "agency",
};

const tierRank: Record<UpgradeNudge["recommendedTier"], number> = { free: 0, starter: 1, core: 2, growth: 3, pro: 4, agency: 5 };

export function getUpgradeNudge(currentTier: PricingTierId, feature: ConversionFeature): UpgradeNudge {
  const recommendedTier = featureTierMap[feature];
  const currentRank = tierRank[currentTier as UpgradeNudge["recommendedTier"]] ?? -1;
  const allowed = currentRank >= tierRank[recommendedTier];

  return {
    feature,
    recommendedTier,
    allowed,
    message: allowed
      ? "Your current plan can use this workflow."
      : `Upgrade when you are ready for this workflow: ${recommendedTier}.`,
  };
}
