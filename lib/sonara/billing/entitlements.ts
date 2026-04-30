import type { PricingTierId } from "../../../config/pricing";

export type Entitlement =
  | "basic_prompt_builder"
  | "advanced_prompt_builder"
  | "runtime_target_engine"
  | "slider_recommendations"
  | "sound_rights_exports"
  | "full_bundle_exports"
  | "vault_tools"
  | "label_workspace"
  | "brand_governance"
  | "store_products";

export const entitlementsByTier: Record<PricingTierId, Entitlement[]> = {
  free: ["basic_prompt_builder"],
  creator: ["basic_prompt_builder", "advanced_prompt_builder", "runtime_target_engine", "slider_recommendations"],
  pro: [
    "basic_prompt_builder",
    "advanced_prompt_builder",
    "runtime_target_engine",
    "slider_recommendations",
    "sound_rights_exports",
    "full_bundle_exports",
    "vault_tools",
  ],
  label: [
    "basic_prompt_builder",
    "advanced_prompt_builder",
    "runtime_target_engine",
    "slider_recommendations",
    "sound_rights_exports",
    "full_bundle_exports",
    "vault_tools",
    "label_workspace",
    "brand_governance",
    "store_products",
  ],
};

export function hasEntitlement(tierId: PricingTierId, entitlement: Entitlement) {
  return entitlementsByTier[tierId].includes(entitlement);
}
