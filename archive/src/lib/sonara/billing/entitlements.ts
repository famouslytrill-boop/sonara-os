export type BillingTier = "free" | "creator" | "pro" | "label";

export type BillingFeature =
  | "basic_prompt_builder"
  | "advanced_prompt_builder"
  | "runtime_target_engine"
  | "prompt_length_engine"
  | "slider_recommendations"
  | "authentic_writer_engine"
  | "lyric_structure_engine"
  | "sound_identity"
  | "metadata_rights_export"
  | "full_bundle_exports"
  | "obs_broadcast_kit"
  | "personal_vault_kit_export"
  | "brand_governance"
  | "review_room"
  | "label_workspace";

const tierOrder: BillingTier[] = ["free", "creator", "pro", "label"];

const tierFeatures: Record<BillingTier, BillingFeature[]> = {
  free: ["basic_prompt_builder"],
  creator: [
    "basic_prompt_builder",
    "advanced_prompt_builder",
    "runtime_target_engine",
    "prompt_length_engine",
    "slider_recommendations",
    "authentic_writer_engine",
    "lyric_structure_engine",
    "sound_identity",
  ],
  pro: [
    "basic_prompt_builder",
    "advanced_prompt_builder",
    "runtime_target_engine",
    "prompt_length_engine",
    "slider_recommendations",
    "authentic_writer_engine",
    "lyric_structure_engine",
    "sound_identity",
    "metadata_rights_export",
    "full_bundle_exports",
    "obs_broadcast_kit",
    "personal_vault_kit_export",
  ],
  label: [
    "basic_prompt_builder",
    "advanced_prompt_builder",
    "runtime_target_engine",
    "prompt_length_engine",
    "slider_recommendations",
    "authentic_writer_engine",
    "lyric_structure_engine",
    "sound_identity",
    "metadata_rights_export",
    "full_bundle_exports",
    "obs_broadcast_kit",
    "personal_vault_kit_export",
    "brand_governance",
    "review_room",
    "label_workspace",
  ],
};

export function normalizeTier(input: unknown): BillingTier {
  if (input === "creator" || input === "pro" || input === "label") {
    return input;
  }

  return "free";
}

export function getTierFeatures(tier: BillingTier) {
  return tierFeatures[tier];
}

export function hasEntitlement(tier: BillingTier, feature: BillingFeature) {
  return tierFeatures[tier].includes(feature);
}

export function getRequiredTierForFeature(feature: BillingFeature): BillingTier {
  for (const tier of tierOrder) {
    if (tierFeatures[tier].includes(feature)) {
      return tier;
    }
  }

  return "label";
}
