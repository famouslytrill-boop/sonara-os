import { isValidStripePriceId as isValidStripePriceIdValue } from "./stripe-price-validation.ts";

export const paymentLaunchPolicy = Object.freeze({
  packageStatus: "setup_mode",
  usesHostedCheckout: true,
  storesRawCardData: false,
  storesCvv: false,
  marketplacePayoutsEnabled: false,
  refundsRequireOwnerApproval: true,
  payoutChangesBlockedForAutomation: true
});

export const requiredStripePriceEnvVars = Object.freeze([
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_CORE",
  "STRIPE_PRICE_CREATOR",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_AGENCY_SCALE",
  "STRIPE_PRICE_SETUP_99",
  "STRIPE_PRICE_SETUP_299",
  "STRIPE_PRICE_SETUP_499",
  "STRIPE_PRICE_SETUP_999"
]);

export function validateStripeEnvShape(env: Readonly<Record<string, string | undefined>>) {
  const invalidPriceEnvVars = requiredStripePriceEnvVars.filter(
    (key) => Boolean(env[key]?.trim()) && !isValidStripePriceIdValue(env[key])
  );
  return Object.freeze({
    secretKeyConfigured: Boolean(env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    publishableKeyConfigured: Boolean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    priceIdsConfigured: requiredStripePriceEnvVars.every((key) =>
      isValidStripePriceIdValue(env[key])
    ),
    invalidPriceEnvVars: Object.freeze(invalidPriceEnvVars),
    safeForClient:
      !env.STRIPE_SECRET_KEY?.startsWith("NEXT_PUBLIC_") &&
      !env.STRIPE_WEBHOOK_SECRET?.startsWith("NEXT_PUBLIC_")
  });
}

export { isValidStripePriceId } from "./stripe-price-validation.ts";
export * from "./stripe-catalog.ts";
export * from "./stripe-checkout.ts";
export * from "./stripe-webhook.ts";
