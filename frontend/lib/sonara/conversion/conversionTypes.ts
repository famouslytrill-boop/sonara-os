export type ConversionFeature =
  | "basic_prompt_builder"
  | "advanced_prompt_builder"
  | "runtime_target_engine"
  | "slider_recommendations"
  | "authentic_writer_engine"
  | "sound_identity"
  | "sound_rights_exports"
  | "metadata_rights_sheets"
  | "full_bundle_exports"
  | "obs_broadcast_kit"
  | "vault_stack"
  | "brand_governance"
  | "review_room"
  | "label_workspace"
  | "marketplace_tools";

export type UpgradeNudge = {
  feature: ConversionFeature;
  recommendedTier: "free" | "creator" | "pro" | "label";
  message: string;
  allowed: boolean;
};
