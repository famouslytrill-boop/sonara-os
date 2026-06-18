export type StripeCheckoutMode = "subscription" | "payment";

export type StripePlanConfig = Readonly<{
  slug: string;
  name: string;
  displayPrice: string;
  mode: StripeCheckoutMode | "included";
  primaryEnvVar?: string;
  envAliases?: readonly string[];
}>;

export const stripeLaunchPlans: readonly StripePlanConfig[] = Object.freeze([
  Object.freeze({
    slug: "included-plan",
    name: "Free",
    displayPrice: "$0",
    mode: "included"
  }),
  Object.freeze({
    slug: "sonara-one-starter",
    name: "SONARA One Starter",
    displayPrice: "$9/mo",
    mode: "subscription",
    primaryEnvVar: "STRIPE_PRICE_STARTER",
    envAliases: Object.freeze(["STRIPE_PRICE_SONARA_ONE_STARTER_MONTHLY"])
  }),
  Object.freeze({
    slug: "sonara-one-core",
    name: "SONARA One Core",
    displayPrice: "$29/mo",
    mode: "subscription",
    primaryEnvVar: "STRIPE_PRICE_CORE",
    envAliases: Object.freeze(["STRIPE_PRICE_SONARA_ONE_CORE_MONTHLY"])
  }),
  Object.freeze({
    slug: "creator-studio-monthly",
    name: "Creator Studio",
    displayPrice: "$29/mo",
    mode: "subscription",
    primaryEnvVar: "STRIPE_PRICE_CREATOR",
    envAliases: Object.freeze(["STRIPE_PRICE_CREATOR_STUDIO_MONTHLY"])
  }),
  Object.freeze({
    slug: "sonara-one-growth",
    name: "SONARA One Growth",
    displayPrice: "$59/mo",
    mode: "subscription",
    primaryEnvVar: "STRIPE_PRICE_GROWTH"
  }),
  Object.freeze({
    slug: "sonara-one-pro",
    name: "SONARA One Pro",
    displayPrice: "$99/mo",
    mode: "subscription",
    primaryEnvVar: "STRIPE_PRICE_PRO"
  }),
  Object.freeze({
    slug: "sonara-one-agency-scale",
    name: "SONARA One Agency/Scale",
    displayPrice: "$199/mo or custom",
    mode: "subscription",
    primaryEnvVar: "STRIPE_PRICE_AGENCY_SCALE"
  }),
  Object.freeze({
    slug: "profile-setup",
    name: "Profile Setup",
    displayPrice: "$99 one-time",
    mode: "payment",
    primaryEnvVar: "STRIPE_PRICE_SETUP_99"
  }),
  Object.freeze({
    slug: "business-launch-setup",
    name: "Business Launch Setup",
    displayPrice: "$299 one-time",
    mode: "payment",
    primaryEnvVar: "STRIPE_PRICE_SETUP_299"
  }),
  Object.freeze({
    slug: "premium-setup",
    name: "Premium Setup",
    displayPrice: "$499 one-time",
    mode: "payment",
    primaryEnvVar: "STRIPE_PRICE_SETUP_499"
  }),
  Object.freeze({
    slug: "complete-launch-setup",
    name: "Complete Launch Setup",
    displayPrice: "$999 one-time",
    mode: "payment",
    primaryEnvVar: "STRIPE_PRICE_SETUP_999"
  })
]);

export function getStripePlan(slug: string | undefined) {
  return stripeLaunchPlans.find((plan) => plan.slug === slug);
}

export function getStripePlanEnvVars(plan: StripePlanConfig) {
  return Object.freeze(
    [plan.primaryEnvVar, ...(plan.envAliases ?? [])].filter(Boolean) as string[]
  );
}
