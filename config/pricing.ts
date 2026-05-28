export type PricingTierId = "free" | "starter" | "core" | "growth" | "pro" | "agency";

export type PricingTier = {
  id: PricingTierId;
  productName: "SONARA One";
  name: string;
  monthlyPrice: number | null;
  priceLabel: string;
  description: string;
  features: string[];
  stripePriceIdEnvMonthly?: string;
};

export type FuturePricingTier = {
  name: string;
  priceLabel: string;
  description: string;
  status: "contact_us" | "future";
};

export type StoreProductId = "profile_setup" | "business_launch_setup" | "premium_setup" | "launch_documents";

export type StoreProduct = {
  id: StoreProductId;
  name: string;
  description: string;
  status: "checkout_ready" | "setup_required" | "coming_soon";
};

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    productName: "SONARA One",
    name: "Free",
    monthlyPrice: 0,
    priceLabel: "$0",
    description: "For early setup, product exploration, and basic launch planning.",
    features: ["Product path selection", "Setup checklist", "Public page previews", "Setup-required billing state"],
  },
  {
    id: "starter",
    productName: "SONARA One",
    name: "Starter",
    monthlyPrice: 9,
    priceLabel: "$9/mo",
    description: "For individuals testing a real business, creator, or growth workflow.",
    features: [
      "More records than Free",
      "Basic dashboard",
      "Basic booking/payment link organization",
      "Basic creator, business, and growth templates",
    ],
    stripePriceIdEnvMonthly: "STRIPE_PRICE_STARTER",
  },
  {
    id: "core",
    productName: "SONARA One",
    name: "Core",
    monthlyPrice: 29,
    priceLabel: "$29/mo",
    description: "For a working small business or creator workspace with daily operating records.",
    features: ["Files & Records", "Offer builder", "Review request drafts", "Launch readiness warnings"],
    stripePriceIdEnvMonthly: "STRIPE_PRICE_CORE",
  },
  {
    id: "growth",
    productName: "SONARA One",
    name: "Growth",
    monthlyPrice: 59,
    priceLabel: "$59/mo",
    description: "For campaign planning, customer follow-up, reviews, referrals, and growth systems.",
    features: ["Growth Studio access", "Campaign drafts", "Referral builder", "Recommendation transparency"],
    stripePriceIdEnvMonthly: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "pro",
    productName: "SONARA One",
    name: "Pro",
    monthlyPrice: 99,
    priceLabel: "$99/mo",
    description: "For teams that need stronger admin, approval, security, and operating controls.",
    features: ["Owner approval queue", "Audit-ready workflows", "Advanced setup checks", "Priority support path"],
    stripePriceIdEnvMonthly: "STRIPE_PRICE_PRO",
  },
  {
    id: "agency",
    productName: "SONARA One",
    name: "Agency/Scale",
    monthlyPrice: 199,
    priceLabel: "$199/mo or custom",
    description: "For agencies and operators managing multiple workspaces after review.",
    features: ["Multi-workspace planning", "Admin controls", "Client setup workflows", "Custom onboarding review"],
    stripePriceIdEnvMonthly: "STRIPE_PRICE_AGENCY",
  },
];

export const setupServices = [
  { name: "Profile Setup", price: "$99", env: "STRIPE_PRICE_SETUP_99" },
  { name: "Business Launch Setup", price: "$299", env: "STRIPE_PRICE_SETUP_299" },
  { name: "Premium Setup", price: "$499", env: "STRIPE_PRICE_SETUP_499" },
] as const;

export const storeProducts: StoreProduct[] = [
  {
    id: "profile_setup",
    name: "Profile Setup",
    description: "One-time setup help for a clean Business Builder, Creator Studio, or Growth Studio profile.",
    status: "setup_required",
  },
  {
    id: "business_launch_setup",
    name: "Business Launch Setup",
    description: "A guided setup bundle for profile, payment link, booking link, offer, and review readiness.",
    status: "setup_required",
  },
  {
    id: "premium_setup",
    name: "Premium Setup",
    description: "Higher-touch setup for operators who need launch structure, trust checks, and handoff notes.",
    status: "setup_required",
  },
  {
    id: "launch_documents",
    name: "Launch Documents",
    description: "Template-based operational documents and checklists prepared for owner review.",
    status: "coming_soon",
  },
];

export const futurePricingTiers: FuturePricingTier[] = [
  {
    name: "Agency Mode",
    priceLabel: "Future",
    description: "Expanded agency dashboards and client workspaces after billing, legal, and support review.",
    status: "future",
  },
  {
    name: "Provider Pass-through",
    priceLabel: "Usage-based if enabled",
    description: "SMS, email, AI, storage, or provider costs may be passed through only when clearly disclosed.",
    status: "future",
  },
];

export function getPricingTier(tierId: string) {
  return pricingTiers.find((tier) => tier.id === tierId);
}

export function getStripeMonthlyPriceEnv(tier: PricingTier) {
  return tier.stripePriceIdEnvMonthly;
}

export function isPaidTier(tier: PricingTier) {
  return (tier.monthlyPrice ?? 0) > 0;
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
