import { isValidStripePriceEnvValue } from "../billing-health/stripe-test-mode-health.ts";

export type StripeCheckoutMode = "subscription" | "payment";
export type ProductCatalogProduct =
  | "SONARA Industries"
  | "Business Builder"
  | "Creator Studio"
  | "Growth Studio";

export type PricingCatalogItem = Readonly<{
  id: string;
  product: ProductCatalogProduct;
  name: string;
  displayPrice: string;
  description: string;
  mode: StripeCheckoutMode | "included" | "future_addon";
  stripeEnvVar?: string;
  stripeEnvAliases?: readonly string[];
  featureFlag?: string;
  publicVisible: boolean;
}>;

export type StripePriceReadiness = Readonly<{
  configured: boolean;
  valid: boolean;
  status: "included" | "ready" | "missing" | "invalid" | "future_flagged";
  label: string;
}>;

type CatalogConfigGlobal = typeof globalThis & {
  __SONARA_DEPLOYMENT_CONFIG__?: {
    stripePriceReadiness?: Record<string, { configured?: boolean; valid?: boolean }>;
  };
};

export const publicPricingCatalog: readonly PricingCatalogItem[] = Object.freeze([
  catalogItem(
    "included-plan",
    "SONARA Industries",
    "Free",
    "$0",
    "Included setup exploration. No Stripe checkout is used for this plan.",
    "included"
  ),
  catalogItem(
    "sonara-one-starter",
    "SONARA Industries",
    "SONARA One Starter",
    "$9/mo",
    "Starter launch workspace for simple setup and early operating records.",
    "subscription",
    "STRIPE_PRICE_STARTER",
    ["STRIPE_PRICE_SONARA_ONE_STARTER_MONTHLY"]
  ),
  catalogItem(
    "sonara-one-core",
    "SONARA Industries",
    "SONARA One Core",
    "$29/mo",
    "Core setup tools for proof, intake, booking preparation, and payment-link planning.",
    "subscription",
    "STRIPE_PRICE_CORE",
    ["STRIPE_PRICE_SONARA_ONE_CORE_MONTHLY"]
  ),
  catalogItem(
    "creator-studio-monthly",
    "Creator Studio",
    "Creator Studio",
    "$29/mo",
    "Creator asset, prompt/template, and release-campaign workspace for reviewed publishing workflows.",
    "subscription",
    "STRIPE_PRICE_CREATOR",
    ["STRIPE_PRICE_CREATOR_STUDIO_MONTHLY"]
  ),
  catalogItem(
    "sonara-one-growth",
    "SONARA Industries",
    "SONARA One Growth",
    "$59/mo",
    "Growth planning, customer follow-up drafts, offers, referrals, and review workflows.",
    "subscription",
    "STRIPE_PRICE_GROWTH"
  ),
  catalogItem(
    "sonara-one-pro",
    "SONARA Industries",
    "SONARA One Pro",
    "$99/mo",
    "Expanded operating support for stronger product, customer, and launch workflows.",
    "subscription",
    "STRIPE_PRICE_PRO"
  ),
  catalogItem(
    "sonara-one-agency-scale",
    "SONARA Industries",
    "SONARA One Agency/Scale",
    "$199/mo or custom",
    "Agency and scale planning for multi-client or larger workspace needs.",
    "subscription",
    "STRIPE_PRICE_AGENCY_SCALE"
  ),
  catalogItem(
    "profile-setup",
    "Business Builder",
    "Profile Setup",
    "$99 one-time",
    "One-time profile setup support with reviewed proof and launch notes.",
    "payment",
    "STRIPE_PRICE_SETUP_99"
  ),
  catalogItem(
    "business-launch-setup",
    "Business Builder",
    "Business Launch Setup",
    "$299 one-time",
    "One-time launch setup support for proof, intake, booking, and payment-link review.",
    "payment",
    "STRIPE_PRICE_SETUP_299"
  ),
  catalogItem(
    "premium-setup",
    "SONARA Industries",
    "Premium Setup",
    "$499 one-time",
    "One-time expanded setup support for more complex Business Builder, Creator Studio, or Growth Studio workflows.",
    "payment",
    "STRIPE_PRICE_SETUP_499"
  ),
  catalogItem(
    "complete-launch-setup",
    "Business Builder",
    "Complete Launch Setup",
    "$999 one-time",
    "One-time Business Builder launch setup for more complete public pages, intake, payment-link review, and admin handoff.",
    "payment",
    "STRIPE_PRICE_SETUP_999"
  )
]);

export const futureProductCatalog: readonly PricingCatalogItem[] = Object.freeze([
  futureItem(
    "business-builder-monthly",
    "Business Builder",
    "Business Builder Monthly",
    "Future plan",
    "Future product-specific monthly plan. Hidden until pricing and feature flag review pass.",
    "STRIPE_PRICE_BUSINESS_BUILDER_MONTHLY"
  ),
  futureItem(
    "business-builder-onetime",
    "Business Builder",
    "Business Builder One-time Setup",
    "Future setup",
    "Future product-specific setup purchase. Hidden until reviewed.",
    "STRIPE_PRICE_BUSINESS_BUILDER_ONETIME"
  ),
  futureItem(
    "creator-studio-monthly",
    "Creator Studio",
    "Creator Studio Monthly",
    "Future plan",
    "Future Creator Studio monthly plan with asset and template libraries.",
    "STRIPE_PRICE_CREATOR_STUDIO_MONTHLY"
  ),
  futureItem(
    "growth-studio-monthly",
    "Growth Studio",
    "Growth Studio Monthly",
    "Future plan",
    "Future Growth Studio monthly plan with campaign memory and tactics.",
    "STRIPE_PRICE_GROWTH_STUDIO_MONTHLY"
  ),
  futureItem(
    "restaurant-pack-addon",
    "Business Builder",
    "Restaurant Growth Pack Add-on",
    "Future add-on",
    "Future restaurant growth add-on. Hidden unless the restaurant pack flag is enabled.",
    "STRIPE_PRICE_RESTAURANT_PACK_ADDON",
    "NEXT_PUBLIC_ENABLE_RESTAURANT_PACK"
  ),
  futureItem(
    "restaurant-ai-receptionist-addon",
    "Business Builder",
    "Restaurant AI Receptionist Add-on",
    "Future add-on",
    "Future receptionist planning add-on. Live phone answering remains disabled.",
    "STRIPE_PRICE_RESTAURANT_AI_RECEPTIONIST_ADDON",
    "NEXT_PUBLIC_ENABLE_RESTAURANT_AI_RECEPTIONIST"
  ),
  futureItem(
    "growth-outreach-addon",
    "Growth Studio",
    "Growth Outreach Add-on",
    "Future add-on",
    "Future advanced outreach add-on. SMS, calling, and voicemail remain consent-gated and disabled.",
    "STRIPE_PRICE_GROWTH_OUTREACH_ADDON"
  )
]);

export const requiredPublicStripePriceEnvVars = Object.freeze(
  publicPricingCatalog
    .map((item) => item.stripeEnvVar)
    .filter((value): value is string => Boolean(value))
);

export function getPricingReadiness(item: PricingCatalogItem): StripePriceReadiness {
  if (item.mode === "included") {
    return readiness(true, true, "included", "Included");
  }
  if (!item.publicVisible) {
    return readiness(false, false, "future_flagged", "Future flagged");
  }
  const envVar = item.stripeEnvVar;
  if (!envVar) {
    return readiness(false, false, "missing", "Payment setup required");
  }
  const readinessInputs = getCatalogItemEnvVars(item)
    .map((key) => getInjectedPriceReadiness(key))
    .filter((value): value is { configured?: boolean; valid?: boolean } => Boolean(value));
  const readyInput = readinessInputs.find((injected) => injected.valid);
  if (readyInput) {
    return readiness(true, true, "ready", "Price configured");
  }
  const injected = readinessInputs.find((input) => input.configured) ?? readinessInputs[0];
  if (injected) {
    if (injected.valid) {
      return readiness(true, true, "ready", "Price configured");
    }
    return readiness(
      Boolean(injected.configured),
      false,
      injected.configured ? "invalid" : "missing",
      injected.configured ? "Invalid price ID" : "Payment setup required"
    );
  }
  return readiness(false, false, "missing", "Payment setup required");
}

export function validateCatalogPriceValues(
  values: Readonly<Record<string, string | undefined>>
): Record<string, StripePriceReadiness> {
  return Object.fromEntries(
    requiredPublicStripePriceEnvVars.map((key) => [
      key,
      isValidStripePriceEnvValue(values[key]) ||
      getCatalogItemEnvVars(publicPricingCatalog.find((item) => item.stripeEnvVar === key))
        .filter((alias) => alias !== key)
        .some((alias) => isValidStripePriceEnvValue(values[alias]))
        ? readiness(true, true, "ready", "Price configured")
        : readiness(
            Boolean(values[key]?.trim()),
            false,
            values[key]?.trim() ? "invalid" : "missing",
            values[key]?.trim() ? "Invalid price ID" : "Payment setup required"
          )
    ])
  );
}

function getCatalogItemEnvVars(item: PricingCatalogItem | undefined) {
  if (!item?.stripeEnvVar) {
    return Object.freeze([]);
  }
  return Object.freeze([item.stripeEnvVar, ...(item.stripeEnvAliases ?? [])]);
}

function getInjectedPriceReadiness(
  envVar: string
): { configured?: boolean; valid?: boolean } | null {
  return (
    (globalThis as CatalogConfigGlobal).__SONARA_DEPLOYMENT_CONFIG__?.stripePriceReadiness?.[
      envVar
    ] ?? null
  );
}

function catalogItem(
  id: string,
  product: ProductCatalogProduct,
  name: string,
  displayPrice: string,
  description: string,
  mode: PricingCatalogItem["mode"],
  stripeEnvVar?: string,
  stripeEnvAliases?: readonly string[]
): PricingCatalogItem {
  return Object.freeze({
    id,
    product,
    name,
    displayPrice,
    description,
    mode,
    stripeEnvVar,
    stripeEnvAliases,
    publicVisible: true
  });
}

function futureItem(
  id: string,
  product: ProductCatalogProduct,
  name: string,
  displayPrice: string,
  description: string,
  stripeEnvVar: string,
  featureFlag?: string
): PricingCatalogItem {
  return Object.freeze({
    id,
    product,
    name,
    displayPrice,
    description,
    mode: "future_addon",
    stripeEnvVar,
    featureFlag,
    publicVisible: false
  });
}

function readiness(
  configured: boolean,
  valid: boolean,
  status: StripePriceReadiness["status"],
  label: string
): StripePriceReadiness {
  return Object.freeze({ configured, valid, status, label });
}
