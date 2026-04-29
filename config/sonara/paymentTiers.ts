export type SonaraBillingTierId = "starter" | "creator" | "studio";

export const sonaraBillingTiers = [
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$9/mo",
    description: "For creators building songs, fingerprints, release plans, and export bundles.",
    features: ["Local Rules generation", "Song fingerprints", "Release-readiness checks", "ZIP exports"],
  },
  {
    id: "creator",
    name: "Creator",
    priceLabel: "$19/mo",
    description: "For artists and producers organizing deeper creator workflows and saved projects.",
    features: ["Saved project library", "Long Prompt Mode", "Runtime targets", "External generator settings"],
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
  starter: "STRIPE_PRICE_STARTER",
  creator: "STRIPE_PRICE_CREATOR",
  studio: "STRIPE_PRICE_STUDIO",
};
