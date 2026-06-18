import { createServiceReadiness } from "./database-service.ts";

export function createSubscriptionServiceReadiness() {
  return createServiceReadiness("subscriptions", "stripe", "requires_env", [
    "Hosted Stripe Checkout or Customer Portal should handle sensitive payment flows.",
    "Subscription status must come from signed webhooks or Stripe Dashboard verification.",
    "Invalid price IDs keep checkout disabled."
  ]);
}
