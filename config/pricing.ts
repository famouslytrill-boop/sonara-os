export type PricingTierId = "free" | "creator" | "pro" | "label";

export type StoreProductId =
  | "prompt_pack_export"
  | "release_readiness_bundle"
  | "metadata_rights_sheet_export"
  | "full_project_bundle"
  | "creator_brand_kit"
  | "obs_broadcast_kit_export"
  | "personal_vault_kit_export"
  | "marketplace_listing_builder"
  | "genre_pack_metadata_bundle"
  | "vault_stack_export";

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

export type FuturePricingTier = {
  name: string;
  priceLabel: string;
  description: string;
  status: "contact_us" | "future";
};

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "SONARA OS™ Free",
    monthlyPrice: 0,
    description: "Start projects, build basic prompts, and explore local-rules release planning.",
    features: ["Basic prompt builder", "Tutorial", "Limited exports", "Local Rules provider"],
  },
  {
    id: "creator",
    name: "SONARA OS™ Creator",
    monthlyPrice: 9.99,
    yearlyPrice: 99,
    description: "For creators who want stronger song systems and repeatable release workflows.",
    features: ["Advanced prompt system", "Runtime Target Engine", "External Generator Settings", "Authentic Writer Engine", "Sound Identity"],
    stripePriceIdEnvMonthly: "STRIPE_CREATOR_MONTHLY_PRICE_ID",
  },
  {
    id: "pro",
    name: "SONARA OS™ Pro",
    monthlyPrice: 19.99,
    yearlyPrice: 199,
    description: "For artists and producers exporting full release bundles and rights-aware packs.",
    features: ["Full bundle exports", "Metadata + rights sheets", "Sound rights exports", "Release packs", "OBS Broadcast Kit", "Vault Stack"],
    stripePriceIdEnvMonthly: "STRIPE_PRO_MONTHLY_PRICE_ID",
  },
  {
    id: "label",
    name: "SONARA OS™ Label",
    monthlyPrice: 49.99,
    yearlyPrice: 499,
    description: "For labels, studios, and teams managing multiple creator systems.",
    features: ["Multi-project workspace", "Brand governance", "Review Room", "Label tools", "Store product workflow"],
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
    id: "metadata_rights_sheet_export",
    name: "Metadata + Rights Sheet Export",
    description: "Release metadata, explicitness label, attribution requirements, and rights notes.",
    status: "coming_soon",
  },
  {
    id: "full_project_bundle",
    name: "Full Project Bundle",
    description: "Fingerprint, release plan, runtime target, prompts, and export manifest.",
    status: "coming_soon",
  },
  {
    id: "creator_brand_kit",
    name: "Creator Brand Kit",
    description: "A brand-planning kit for artist identity, content direction, and launch assets.",
    status: "coming_soon",
  },
  {
    id: "obs_broadcast_kit_export",
    name: "OBS Broadcast Kit Export",
    description: "OBS-ready broadcast plan, scenes, routing notes, overlays, and premiere checklist.",
    status: "coming_soon",
  },
  {
    id: "personal_vault_kit_export",
    name: "Personal Vault Kit Export",
    description: "Organize, classify, verify, and export user-owned or rights-cleared Vault assets.",
    status: "coming_soon",
  },
  {
    id: "marketplace_listing_builder",
    name: "Marketplace Listing Builder",
    description: "Structured listing copy and readiness checks for creator digital assets. Public marketplace launch is delayed.",
    status: "coming_soon",
  },
  {
    id: "genre_pack_metadata_bundle",
    name: "Genre Pack Metadata Bundle",
    description: "All-genre metadata templates and rights-safe packaging notes without third-party file resale.",
    status: "coming_soon",
  },
  {
    id: "vault_stack_export",
    name: "Vault Stack Export",
    description: "A personal Vault stack manifest with rights classifications, included files, and support notes.",
    status: "coming_soon",
  },
];

export const futurePricingTiers: FuturePricingTier[] = [
  {
    name: "SONARA OS™ Studio",
    priceLabel: "$99/mo future",
    description: "Future team seats, deeper marketplace tools, and advanced supervised automation.",
    status: "future",
  },
  {
    name: "SONARA OS™ Enterprise",
    priceLabel: "Contact us",
    description: "Future custom workspace, compliance, onboarding, and private infrastructure planning.",
    status: "contact_us",
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
