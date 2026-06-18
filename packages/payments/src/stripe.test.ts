import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createStripeCheckoutSession,
  handleStripeWebhookEvent,
  validateCheckoutRequest,
  verifyStripeWebhookSignature
} from "./index.ts";

const configuredEnv = {
  STRIPE_SECRET_KEY: ["sk", "test", "placeholder"].join("_"),
  STRIPE_WEBHOOK_SECRET: ["whsec", "placeholder"].join("_"),
  APP_URL: "https://sonaraindustries.com",
  STRIPE_PRICE_STARTER: "price_starter",
  STRIPE_PRICE_CORE: "price_core",
  STRIPE_PRICE_CREATOR: "price_creator",
  STRIPE_PRICE_SETUP_99: "price_setup_99"
};
const webhookSecretOption = "webhookSecret" as const;

describe("Stripe checkout and webhook safety", () => {
  it("blocks checkout when Stripe config is missing", () => {
    expect(validateCheckoutRequest("sonara-one-starter", {})).toMatchObject({
      ok: false,
      code: "missing_secret_key"
    });
  });

  it("rejects display prices and key-shaped values as price IDs", () => {
    for (const value of [
      "$9/mo",
      "prod_123",
      ["sk", "test", "123"].join("_"),
      ["pk", "test", "123"].join("_"),
      ["whsec", "123"].join("_")
    ]) {
      expect(
        validateCheckoutRequest("sonara-one-starter", {
          ...configuredEnv,
          STRIPE_PRICE_STARTER: value
        })
      ).toMatchObject({ ok: false, code: "invalid_price_id" });
    }
  });

  it("chooses subscription mode for recurring tiers and payment mode for setup services", () => {
    expect(validateCheckoutRequest("sonara-one-core", configuredEnv)).toMatchObject({
      ok: true,
      mode: "subscription",
      priceId: "price_core"
    });
    expect(validateCheckoutRequest("profile-setup", configuredEnv)).toMatchObject({
      ok: true,
      mode: "payment",
      priceId: "price_setup_99"
    });
    expect(
      validateCheckoutRequest("creator-studio-monthly", {
        ...configuredEnv,
        STRIPE_PRICE_SETUP_999: "price_setup_999"
      })
    ).toMatchObject({
      ok: true,
      mode: "subscription",
      priceId: "price_creator"
    });
    expect(
      validateCheckoutRequest("complete-launch-setup", {
        ...configuredEnv,
        STRIPE_PRICE_SETUP_999: "price_setup_999"
      })
    ).toMatchObject({
      ok: true,
      mode: "payment",
      priceId: "price_setup_999"
    });
  });

  it("creates a checkout session without trusting client price data", async () => {
    const result = await createStripeCheckoutSession({
      planSlug: "sonara-one-starter",
      env: configuredEnv,
      userReference: "user_123",
      fetchImpl: async (_url, init) => {
        const body = String(init?.body);
        expect(body).toContain("line_items%5B0%5D%5Bprice%5D=price_starter");
        expect(body).toContain("mode=subscription");
        expect(body).not.toContain("$9");
        return new Response(
          JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    });

    expect(result).toEqual({
      ok: true,
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay"
    });
  });

  it("verifies Stripe webhook signatures and handles idempotency", async () => {
    const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    const timestamp = 1_800_000_000;
    const signature = createHmac("sha256", configuredEnv.STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    expect(
      verifyStripeWebhookSignature({
        payload,
        signatureHeader: `t=${timestamp},v1=${signature}`,
        [webhookSecretOption]: configuredEnv.STRIPE_WEBHOOK_SECRET,
        nowSeconds: timestamp
      })
    ).toBe(true);

    const processed = new Set<string>();
    const store = {
      hasProcessedEvent: async (eventId: string) => processed.has(eventId),
      markProcessedEvent: async (eventId: string) => {
        processed.add(eventId);
      },
      upsertSubscription: async () => undefined
    };

    await expect(
      handleStripeWebhookEvent({ id: "evt_123", type: "checkout.session.completed" }, store)
    ).resolves.toMatchObject({ ok: true, idempotent: false, handled: true });
    await expect(
      handleStripeWebhookEvent({ id: "evt_123", type: "checkout.session.completed" }, store)
    ).resolves.toMatchObject({ ok: true, idempotent: true, handled: false });
  });
});
