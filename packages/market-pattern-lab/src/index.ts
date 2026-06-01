export type MarketPatternCategory =
  | "landing_page_layout"
  | "pricing_model"
  | "onboarding_flow"
  | "dashboard_ux"
  | "admin_controls"
  | "paywall_placement"
  | "support_flow"
  | "trust_security_copy"
  | "agency_offer_packaging"
  | "conversion_cta_patterns"
  | "mobile_app_layout"
  | "notification_sound_ux";

export const marketPatternCategories: readonly MarketPatternCategory[] = Object.freeze([
  "landing_page_layout",
  "pricing_model",
  "onboarding_flow",
  "dashboard_ux",
  "admin_controls",
  "paywall_placement",
  "support_flow",
  "trust_security_copy",
  "agency_offer_packaging",
  "conversion_cta_patterns",
  "mobile_app_layout",
  "notification_sound_ux"
]);

export const marketPatternLabRules = Object.freeze([
  "Use public observation, user-provided screenshots, and lawful research only.",
  "Do not copy competitor code, protected copy, logos, brands, private areas, or paywalled material.",
  "Convert observations into original pattern notes before implementation."
]);

export function createMarketPatternChecklist(): readonly string[] {
  return Object.freeze([...marketPatternLabRules]);
}
