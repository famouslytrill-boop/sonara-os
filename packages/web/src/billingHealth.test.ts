import { describe, expect, it } from "vitest";
import {
  createStripeBillingHealthSnapshot,
  getStripeTestModeChecklist
} from "./lib/billing-health/index.ts";

describe("Stripe billing health", () => {
  it("reports redacted test-mode setup status without exposing secrets", () => {
    const snapshot = createStripeBillingHealthSnapshot({
      secretKeyConfigured: true,
      publishableKeyConfigured: true,
      webhookSecretConfigured: true,
      priceIdsConfigured: false,
      webhookRouteReachable: false
    });

    expect(snapshot.secretKey.configured).toBe(true);
    expect(snapshot.priceIds.configured).toBe(false);
    expect(snapshot.webhookRoute.configured).toBe(false);
    expect(snapshot.readyForTestCheckout).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain("sk_");
    expect(JSON.stringify(snapshot)).not.toContain("whsec_");
    expect(snapshot.modeWarning).toContain("must not be mixed");
    expect(snapshot.payoutWarning).toContain("Stripe Dashboard");
  });

  it("defines the required Stripe test-mode walkthrough checklist", () => {
    expect(getStripeTestModeChecklist()).toEqual([
      "Stripe account created",
      "Business details completed",
      "Bank payout account connected in Stripe",
      "Products created",
      "Prices created",
      "Env vars added",
      "Webhook endpoint created",
      "Webhook secret added",
      "Test checkout completed",
      "Subscription record updated",
      "invoice.paid handled",
      "payment_failed handled",
      "Customer portal tested"
    ]);
  });
});
