export type PricingTierId = "free" | "creator" | "pro" | "label";

export type StoreProductId =
  | "prompt_pack_export"
  | "release_readiness_bundle"
  | "sound_pack_license_export"
  | "full_project_bundle"
  | "vault_demo_kit"
  | "creator_brand_kit";

export type PricingTier = {
  id: PricingTierId;
  name: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  description: string;
  features: string[];
  stripePriceIdEnvMonthly?: string;
  stripePriceIdEnvYearly?: string;
};

export type StoreProduct = {
  id: StoreProductId;
  name: string;
  description: string;
  status: "coming_soon" | "checkout_ready";
};

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "SONARA OS™ Free",
    monthlyPrice: 0,
    description: "Start projects, build basic prompts, and explore local-rules release planning.",
    features: ["Basic prompt builder", "Song fingerprint starter", "Release-readiness preview", "Local Rules provider"],
  },
  {
    id: "creator",
    name: "SONARA OS™ Creator",
    monthlyPrice: 9.99,
    yearlyPrice: 99,
    description: "For creators who want stronger song systems and repeatable release workflows.",
    features: ["Advanced prompt builder", "Runtime Target Engine", "External Generator Settings", "Saved project workflow"],
    stripePriceIdEnvMonthly: "STRIPE_CREATOR_MONTHLY_PRICE_ID",
  },
  {
    id: "pro",
    name: "SONARA OS™ Pro",
    monthlyPrice: 19.99,
    yearlyPrice: 199,
    description: "For artists and producers exporting full release bundles and rights-aware packs.",
    features: ["Full bundle exports", "Sound rights exports", "Release pack builder", "Vault workflow tools"],
    stripePriceIdEnvMonthly: "STRIPE_PRO_MONTHLY_PRICE_ID",
  },
  {
    id: "label",
    name: "SONARA OS™ Label",
    monthlyPrice: 49.99,
    yearlyPrice: 499,
    description: "For labels, studios, and teams managing multiple creator systems.",
    features: ["Label workspace", "Brand governance", "Multi-project planning", "Store product workflow"],
    stripePriceIdEnvMonthly: "STRIPE_LABEL_MONTHLY_PRICE_ID",
  },
];

export const storeProducts: StoreProduct[] = [
  {
    id: "prompt_pack_export",
    name: "Prompt Pack Export",
    description: "A structured prompt pack export for repeatable creator workflows.",
    status: "coming_soon",
  },
  {
    id: "release_readiness_bundle",
    name: "Release Readiness Bundle",
    description: "A launch-prep bundle with readiness notes, release plan, and checklist.",
    status: "coming_soon",
  },
  {
    id: "sound_pack_license_export",
    name: "Sound Pack License Sheet + Export",
    description: "Rights-aware sound pack documentation and license-sheet export.",
    status: "coming_soon",
  },
  {
    id: "full_project_bundle",
    name: "Full Project Bundle",
    description: "Fingerprint, release plan, runtime target, prompts, and export manifest.",
    status: "coming_soon",
  },
  {
    id: "vault_demo_kit",
    name: "Vault Demo Kit",
    description: "A neutral demo kit for testing store, vault, and export workflows.",
    status: "coming_soon",
  },
  {
    id: "creator_brand_kit",
    name: "Creator Brand Kit",
    description: "A brand-planning kit for artist identity, content direction, and launch assets.",
    status: "coming_soon",
  },
];

export function getPricingTier(tierId: string) {
  return pricingTiers.find((tier) => tier.id === tierId);
}

export function getStripeMonthlyPriceEnv(tier: PricingTier) {
  return tier.stripePriceIdEnvMonthly;
}

export function isPaidTier(tier: PricingTier) {
  return tier.monthlyPrice > 0;
}

export function areStripeSubscriptionsConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID &&
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID &&
      process.env.STRIPE_LABEL_MONTHLY_PRICE_ID,
  );
}
