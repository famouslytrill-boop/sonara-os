export type ProviderRisk = "allowed" | "review_required" | "restricted" | "blocked" | "reference_only";

export type ProviderRegistryRecord = {
  name: string;
  slug: string;
  category: string;
  productFit: string[];
  status: "not_configured" | "configured_by_env" | "reference_only" | "blocked";
  risk: ProviderRisk;
  requiredEnv: string[];
  publicEnv: string[];
  serverOnlyEnv: string[];
  safetyNotes: string[];
  humanReviewRequired: boolean;
};

export const providerRegistry: ProviderRegistryRecord[] = [
  {
    name: "Supabase",
    slug: "supabase",
    category: "database and auth",
    productFit: ["Shared Infrastructure", "Business Builder", "Creator Studio", "Growth Studio"],
    status: "configured_by_env",
    risk: "review_required",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    publicEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    serverOnlyEnv: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_PASSWORD"],
    safetyNotes: ["Service role stays server-only.", "RLS is required for tenant records."],
    humanReviewRequired: true,
  },
  {
    name: "Stripe",
    slug: "stripe",
    category: "payments and billing",
    productFit: ["Billing & Entitlements", "Proof-to-Payment"],
    status: "not_configured",
    risk: "review_required",
    requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    publicEnv: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    serverOnlyEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    safetyNotes: ["Use Checkout or hosted portal.", "Never store raw card data or CVV."],
    humanReviewRequired: true,
  },
  {
    name: "OpenRouter or model providers",
    slug: "model-providers",
    category: "AI provider gateway",
    productFit: ["AI Governance", "Research Lab", "Creator Studio"],
    status: "not_configured",
    risk: "restricted",
    requiredEnv: ["OPENROUTER_API_KEY"],
    publicEnv: [],
    serverOnlyEnv: ["OPENROUTER_API_KEY"],
    safetyNotes: [
      "Provider calls must go through server-side gateway policy.",
      "Unsafe red-team presets are not exposed to normal users.",
    ],
    humanReviewRequired: true,
  },
  {
    name: "GitHub",
    slug: "github",
    category: "repository intelligence",
    productFit: ["Research Lab", "GitHub Opportunity Radar", "Admin Command Center"],
    status: "not_configured",
    risk: "review_required",
    requiredEnv: ["GITHUB_TOKEN"],
    publicEnv: [],
    serverOnlyEnv: ["GITHUB_TOKEN"],
    safetyNotes: ["Token is optional and server-only.", "Manual registry mode remains available without token."],
    humanReviewRequired: true,
  },
  {
    name: "Resend or selected outbound email provider",
    slug: "email-provider",
    category: "support email",
    productFit: ["Customer Success", "Support"],
    status: "not_configured",
    risk: "review_required",
    requiredEnv: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    publicEnv: ["NEXT_PUBLIC_SUPPORT_CONTACT_LABEL"],
    serverOnlyEnv: ["RESEND_API_KEY"],
    safetyNotes: [
      "Forms validate without provider.",
      "Outbound email must degrade safely if provider env is missing.",
    ],
    humanReviewRequired: true,
  },
  {
    name: "PostHog-style product analytics",
    slug: "analytics-provider",
    category: "analytics",
    productFit: ["Growth Studio", "Shared Infrastructure"],
    status: "reference_only",
    risk: "restricted",
    requiredEnv: [],
    publicEnv: [],
    serverOnlyEnv: [],
    safetyNotes: [
      "Session replay remains disabled unless privacy review approves it.",
      "No hidden tracking or sensitive customer data capture.",
    ],
    humanReviewRequired: true,
  },
];

export function findProvider(slug: string) {
  return providerRegistry.find((provider) => provider.slug === slug);
}
