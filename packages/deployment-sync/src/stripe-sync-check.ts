import type { DeploymentSyncContext, StripeSyncStatus } from "./types.ts";
import { isEnvConfigured } from "./env-validator.ts";
import { makeFinding, summarizeStatus } from "./sync-utils.ts";

const stripePriceKeys = Object.freeze([
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_CORE",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_AGENCY",
  "STRIPE_PRICE_SETUP_99",
  "STRIPE_PRICE_SETUP_299",
  "STRIPE_PRICE_SETUP_499"
]);

export function checkStripeSync(context: DeploymentSyncContext = {}): StripeSyncStatus {
  const env = context.env ?? {};
  const allPricesConfigured = stripePriceKeys.every((key) => isEnvConfigured(env, key));
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
      allPricesConfigured ? "configured" : "needs_review",
      "high",
      "stripe.price_ids",
      "Pricing page and checkout must map to env-driven Stripe price IDs."
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
      ownerPayoutPathDocumented: true
    })
  });
}
