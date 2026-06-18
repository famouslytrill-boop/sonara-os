import type { DeploymentSyncContext, StripeSyncStatus } from "./types.ts";
import { getStripePriceEnvValidation, isEnvConfigured } from "./env-validator.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

const stripePriceKeys = Object.freeze([
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

export function checkStripeSync(context: DeploymentSyncContext = {}): StripeSyncStatus {
  const env = context.env ?? {};
  const priceValidation = stripePriceKeys.map((key) => ({
    key,
    result: getStripePriceEnvValidation(env[key])
  }));
  const allPricesConfigured = priceValidation.every(({ result }) => result.valid);
  const invalidPrices = priceValidation.filter(({ result }) => result.configured && !result.valid);
  const missingPrices = priceValidation.filter(({ result }) => !result.configured);
  const findings = [
    makeFinding(
      "stripe",
      isEnvConfigured(env, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") ? "configured" : "not_configured",
      "medium",
      "stripe.publishable_key",
      "Stripe publishable key may be public but must match the Stripe mode being tested."
    ),
    makeFinding(
      "stripe",
      isEnvConfigured(env, "STRIPE_SECRET_KEY") ? "configured" : "not_configured",
      "high",
      "stripe.secret_key",
      "Stripe secret key must remain server-side and redacted."
    ),
    makeFinding(
      "stripe",
      isEnvConfigured(env, "STRIPE_WEBHOOK_SECRET") ? "configured" : "not_configured",
      "high",
      "stripe.webhook_secret",
      "Stripe webhook secret must be server-side and signature verification must be used."
    ),
    makeFinding(
      "stripe",
      allPricesConfigured ? "configured" : invalidPrices.length > 0 ? "failed" : "needs_review",
      "high",
      "stripe.price_ids",
      allPricesConfigured
        ? "Pricing page and checkout map to valid-looking price_ IDs."
        : invalidPrices.length > 0
          ? `Invalid Stripe price env values: ${invalidPrices.map(({ key }) => key).join(", ")}. Values must start with price_ and must not be dollar amounts, product IDs, keys, webhook secrets, or /mo display text.`
          : `Missing Stripe price env values: ${missingPrices.map(({ key }) => key).join(", ")}. Checkout must stay disabled until every required value starts with price_.`
    ),
    makeFinding(
      "stripe",
      "needs_review",
      "high",
      "stripe.owner_confirmation",
      "Refunds, price changes, payout settings, and marketplace/Connect work require Owner Confirmation Lock."
    )
  ];
  return Object.freeze({
    provider: "stripe",
    ...summarizeStatus(findings),
    findings: Object.freeze(findings),
    metadata: Object.freeze({
      rawCardDataStored: false,
      marketplaceConnectDefault: false,
      ownerPayoutPathDocumented: true,
      checkedPriceEnvVars: stripePriceKeys,
      invalidPriceEnvVars: invalidPrices.map(({ key }) => key)
    })
  });
}
