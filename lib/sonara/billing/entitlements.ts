import type { PricingTierId } from "../../../config/pricing";

export type Entitlement =
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
  | "vault_tools"
  | "vault_stack"
  | "review_room"
  | "label_workspace"
  | "brand_governance"
  | "store_products"
  | "marketplace_tools";

export const entitlementsByTier: Record<PricingTierId, Entitlement[]> = {
  free: ["basic_prompt_builder"],
  creator: ["basic_prompt_builder", "advanced_prompt_builder", "runtime_target_engine", "slider_recommendations", "authentic_writer_engine", "sound_identity"],
  pro: [
    "basic_prompt_builder",
    "advanced_prompt_builder",
    "runtime_target_engine",
    "slider_recommendations",
    "sound_rights_exports",
    "metadata_rights_sheets",
    "full_bundle_exports",
    "obs_broadcast_kit",
    "vault_tools",
    "vault_stack",
  ],
  label: [
    "basic_prompt_builder",
    "advanced_prompt_builder",
    "runtime_target_engine",
    "slider_recommendations",
    "sound_rights_exports",
    "metadata_rights_sheets",
    "full_bundle_exports",
    "obs_broadcast_kit",
    "vault_tools",
    "vault_stack",
    "review_room",
    "label_workspace",
    "brand_governance",
    "store_products",
    "marketplace_tools",
  ],
};

export function hasEntitlement(tierId: PricingTierId, entitlement: Entitlement) {
  return entitlementsByTier[tierId].includes(entitlement);
}
