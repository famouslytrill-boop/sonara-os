export type SonaraBillingTierId = "starter" | "pro_artist" | "studio";
export type SonaraKitId =
  | "starter_prompt_pack"
  | "visual_identity_prompt_pack"
  | "ar_market_audit_kit"
  | "release_planner_kit"
  | "artist_os_pro_kit"
  | "album_builder_system"
  | "local_business_marketing_kit"
  | "revenue_pathway_blueprint";

export const sonaraBillingTiers = [
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$9/mo",
    description: "For creators building songs, fingerprints, release plans, and export bundles.",
    features: ["Local Rules generation", "Song fingerprints", "Release-readiness checks", "ZIP exports"],
  },
  {
    id: "pro_artist",
    name: "Pro Artist",
    priceLabel: "$19/mo",
    description: "For artists and producers organizing deeper creator workflows and saved projects.",
    features: ["Saved project library", "Artist OS", "Content Studio", "Revenue pathway planning"],
  },
  {
    id: "studio",
    name: "Studio",
    priceLabel: "$49/mo",
    description: "For studios running repeatable release workflows with team operating discipline.",
    features: ["Studio workflow", "Brand governance", "Business principles layer", "Priority export systems"],
  },
] as const;

export const stripePriceEnvByTier: Record<SonaraBillingTierId, string> = {
  starter: "STRIPE_PRICE_STARTER_MONTHLY",
  pro_artist: "STRIPE_PRICE_PRO_ARTIST_MONTHLY",
  studio: "STRIPE_PRICE_STUDIO_MONTHLY",
};

export const sonaraStripeKits = [
  {
    id: "starter_prompt_pack",
    name: "Starter Prompt Pack",
    priceLabel: "One-time",
    description: "A focused prompt vault for first songs, content angles, and release planning.",
  },
  {
    id: "visual_identity_prompt_pack",
    name: "Visual Identity Prompt Pack",
    priceLabel: "One-time",
    description: "Prompts for cover art direction, campaign visuals, and creator brand systems.",
  },
  {
    id: "ar_market_audit_kit",
    name: "A&R Market Audit Kit",
    priceLabel: "One-time",
    description: "A readiness and market-position review kit for songs, offers, and campaigns.",
  },
  {
    id: "release_planner_kit",
    name: "Release Planner Kit",
    priceLabel: "One-time",
    description: "A practical rollout system for dates, assets, content, and release checkpoints.",
  },
  {
    id: "artist_os_pro_kit",
    name: "Artist OS Pro Kit",
    priceLabel: "One-time",
    description: "A deeper operating kit for artist positioning, catalogs, offers, and workflows.",
  },
  {
    id: "album_builder_system",
    name: "Album Builder System",
    priceLabel: "One-time",
    description: "A structured system for album identity, sequencing, themes, and rollout logic.",
  },
  {
    id: "local_business_marketing_kit",
    name: "Local Business Marketing Kit",
    priceLabel: "One-time",
    description: "Campaign prompts and operating templates for local business marketing work.",
  },
  {
    id: "revenue_pathway_blueprint",
    name: "Revenue Pathway Blueprint",
    priceLabel: "One-time",
    description: "A planning blueprint for practical creator, service, and digital product paths.",
  },
] as const;

export const stripePriceEnvByKit: Record<SonaraKitId, string> = {
  starter_prompt_pack: "STRIPE_PRICE_STARTER_PROMPT_PACK",
  visual_identity_prompt_pack: "STRIPE_PRICE_VISUAL_IDENTITY_PROMPT_PACK",
  ar_market_audit_kit: "STRIPE_PRICE_AR_MARKET_AUDIT_KIT",
  release_planner_kit: "STRIPE_PRICE_RELEASE_PLANNER_KIT",
  artist_os_pro_kit: "STRIPE_PRICE_ARTIST_OS_PRO_KIT",
  album_builder_system: "STRIPE_PRICE_ALBUM_BUILDER_SYSTEM",
  local_business_marketing_kit: "STRIPE_PRICE_LOCAL_BUSINESS_MARKETING_KIT",
  revenue_pathway_blueprint: "STRIPE_PRICE_REVENUE_PATHWAY_BLUEPRINT",
};
