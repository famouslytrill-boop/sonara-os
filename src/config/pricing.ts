export type PricingTierId = "free" | "creator" | "pro" | "label";

export type PricingTier = {
  id: PricingTierId;
  name: string;
  price: number;
  interval: "month";
  stripePriceEnv?: string;
  features: string[];
};

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "SONARA OS™ Free",
    price: 0,
    interval: "month",
    features: [
      "Basic prompt builder",
      "Basic tutorial",
      "Limited project exports",
    ],
  },
  {
    id: "creator",
    name: "SONARA OS™ Creator",
    price: 9.99,
    interval: "month",
    stripePriceEnv: "STRIPE_CREATOR_MONTHLY_PRICE_ID",
    features: [
      "Advanced prompt builder",
      "Runtime Target",
      "Prompt Length",
      "External Generator Settings",
      "Authentic Writer Engine™",
      "Lyric Structure Engine™",
      "Sound Identity",
    ],
  },
  {
    id: "pro",
    name: "SONARA OS™ Pro",
    price: 19.99,
    interval: "month",
    stripePriceEnv: "STRIPE_PRO_MONTHLY_PRICE_ID",
    features: [
      "Full bundle exports",
      "Metadata + rights sheets",
      "Release readiness bundles",
      "OBS broadcast kit",
      "Personal Vault Kit Export",
    ],
  },
  {
    id: "label",
    name: "SONARA OS™ Label",
    price: 49.99,
    interval: "month",
    stripePriceEnv: "STRIPE_LABEL_MONTHLY_PRICE_ID",
    features: [
      "Brand governance",
      "Multi-project/catalog workflow",
      "Review room",
      "Advanced release planning",
    ],
  },
];

export function getPricingTier(id: string) {
  return pricingTiers.find((tier) => tier.id === id);
}

export function formatTierPrice(tier: PricingTier) {
  if (tier.price === 0) {
    return "$0";
  }

  return `$${tier.price.toFixed(2)}/mo`;
}
