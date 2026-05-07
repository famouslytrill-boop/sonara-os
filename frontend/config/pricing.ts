export type PricingTierId = string;

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
  productName: "TrackFoundry" | "LineReady" | "NoticeGrid";
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
    id: "trackfoundry_starter",
    productName: "TrackFoundry",
    name: "Starter",
    monthlyPrice: 19,
    description: "For independent creators building repeatable song, prompt, and release-readiness workflows.",
    features: ["Artist DNA starter", "Catalog Vault basics", "Release Desk checklist", "Prompt Foundry exports"],
    stripePriceIdEnvMonthly: "STRIPE_TRACKFOUNDRY_STARTER_PRICE_ID",
  },
  {
    id: "trackfoundry_studio",
    productName: "TrackFoundry",
    name: "Studio",
    monthlyPrice: 49,
    description: "For studios, managers, and teams organizing releases, assets, transcripts, and market notes.",
    features: ["Artist DNA", "Catalog Vault", "Transcript Studio", "Market Pulse", "Team workflow"],
    stripePriceIdEnvMonthly: "STRIPE_TRACKFOUNDRY_STUDIO_PRICE_ID",
  },
  {
    id: "trackfoundry_label",
    productName: "TrackFoundry",
    name: "Label",
    monthlyPrice: 149,
    description: "For labels and release teams managing multiple artists, campaign assets, and approval checkpoints.",
    features: ["Multi-artist release desk", "Campaign assets", "Rights placeholders", "Review workflow", "Approval queue"],
    stripePriceIdEnvMonthly: "STRIPE_TRACKFOUNDRY_LABEL_PRICE_ID",
  },
  {
    id: "lineready_single_store",
    productName: "LineReady",
    name: "Single Store",
    monthlyPrice: 39,
    description: "For one restaurant, truck, or hospitality team that needs shift and cost clarity.",
    features: ["Labor Control", "Schedule Grid", "Recipe Costing", "Vendor Links", "Compliance Board"],
    stripePriceIdEnvMonthly: "STRIPE_LINEREADY_SINGLE_STORE_PRICE_ID",
  },
  {
    id: "lineready_operator",
    productName: "LineReady",
    name: "Operator",
    monthlyPrice: 89,
    description: "For hands-on operators coordinating schedules, menus, margins, vendors, and crew notes.",
    features: ["Shift placement", "Menu margin", "Crew Chat", "Repairs and servicing", "Forecast notes"],
    stripePriceIdEnvMonthly: "STRIPE_LINEREADY_OPERATOR_PRICE_ID",
  },
  {
    id: "lineready_group",
    productName: "LineReady",
    name: "Group",
    monthlyPrice: 199,
    description: "For growing restaurant groups that need shared standards across locations.",
    features: ["Multi-location workflow", "Role-based operations", "Transfer tracking", "Permit and certification tracking"],
    stripePriceIdEnvMonthly: "STRIPE_LINEREADY_GROUP_PRICE_ID",
  },
  {
    id: "noticegrid_community",
    productName: "NoticeGrid",
    name: "Community",
    monthlyPrice: 0,
    description: "For residents and small community pages following verified public information without the noise.",
    features: ["Verified Feeds", "Quiet Alerting", "Public information basics", "Source trust notes"],
  },
  {
    id: "noticegrid_organization",
    productName: "NoticeGrid",
    name: "Organization",
    monthlyPrice: 29,
    description: "For libraries, nonprofits, local businesses, schools, and organizations publishing approved notices.",
    features: ["Notice Builder", "Organization Pages", "Approval queue", "QR-ready public links"],
    stripePriceIdEnvMonthly: "STRIPE_NOTICEGRID_ORGANIZATION_PRICE_ID",
  },
  {
    id: "noticegrid_municipal",
    productName: "NoticeGrid",
    name: "Municipal",
    monthlyPrice: 149,
    description: "For civic-style teams that need source checks, digest workflows, and human-approved public notices.",
    features: ["Local Grid", "Source checks", "Digest preferences", "Weather + transit links", "Human approval gates"],
    stripePriceIdEnvMonthly: "STRIPE_NOTICEGRID_MUNICIPAL_PRICE_ID",
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
    name: "Shared Infrastructure Add-ons",
    priceLabel: "Future",
    description: "Future cross-product support for managed onboarding, observability, storage, and custom operating workflows.",
    status: "future",
  },
  {
    name: "Enterprise Standards Review",
    priceLabel: "Contact us",
    description: "Future security, compliance, deployment, and data-boundary planning for larger organizations.",
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
  const paidPriceEnvNames = pricingTiers
    .filter(isPaidTier)
    .map((tier) => tier.stripePriceIdEnvMonthly)
    .filter(Boolean);

  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      paidPriceEnvNames.every((envName) => (envName ? Boolean(process.env[envName]) : false)),
  );
}
