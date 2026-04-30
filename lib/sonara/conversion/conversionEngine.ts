import type { PricingTierId } from "../../../config/pricing";
import type { ConversionFeature, UpgradeNudge } from "./conversionTypes";

export const featureTierMap: Record<ConversionFeature, PricingTierId> = {
  basic_prompt_builder: "free",
  advanced_prompt_builder: "creator",
  runtime_target_engine: "creator",
  slider_recommendations: "creator",
  authentic_writer_engine: "creator",
  sound_identity: "creator",
  sound_rights_exports: "pro",
  metadata_rights_sheets: "pro",
  full_bundle_exports: "pro",
  obs_broadcast_kit: "pro",
  vault_stack: "pro",
  brand_governance: "label",
  review_room: "label",
  label_workspace: "label",
  marketplace_tools: "label",
};

const tierRank: Record<PricingTierId, number> = { free: 0, creator: 1, pro: 2, label: 3 };

export function getUpgradeNudge(currentTier: PricingTierId, feature: ConversionFeature): UpgradeNudge {
  const recommendedTier = featureTierMap[feature];
  const allowed = tierRank[currentTier] >= tierRank[recommendedTier];

  return {
    feature,
    recommendedTier,
    allowed,
    message: allowed
      ? "Your current plan can use this workflow."
      : `Upgrade to SONARA OS™ ${recommendedTier} when you are ready for this workflow.`,
  };
}
