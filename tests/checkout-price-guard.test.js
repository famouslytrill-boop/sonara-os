"use strict";

// Checkout refuses to sell at a price the page did not show.
//
// The price id reaches checkout from an environment variable. Nothing
// confirmed that the price behind it charges what the pricing page says, so
// setting STRIPE_PRICE_STARTER_MONTHLY to the wrong id would have advertised $7
// and billed whatever that price happened to be. The account still holds
// retired prices at $9.99, $19.99 and $49.99, so a wrong id is not a
// hypothetical -- it is one paste away.
//
// scripts/verify-stripe-env.mjs already compared these. It skips whenever
// STRIPE_SECRET_KEY is absent, which is every CI run and every local run, so
// the comparison had never executed anywhere. That is the failure worth naming:
// not a missing check, a check that reports [SKIP] and is counted as passing.
//
// The comparison now also happens at checkout, where the key is always present
// because the call to Stripe cannot be made without it.

const assert = require("node:assert/strict");
const { createBilling } = require("../lib/sonara-billing.cjs");

const PLANS = {
  starter_monthly: { name: "Starter", price: "$7/mo", amountCents: 700, mode: "subscription", env: "STRIPE_PRICE_STARTER_MONTHLY" },
  free: { name: "Free", price: "$0", amountCents: 0, mode: undefined, env: undefined },
  quoted: { name: "Setup", price: "We quote you", amountCents: null, quoted: true, mode: undefined, env: undefined }
};

function build() {
  return createBilling({
    STRIPE_PLANS: PLANS,
    getEnv: (name) => (name === "STRIPE_SECRET_KEY" ? "sk_live_test" : ""),
    getPublicAppUrl: () => "https://sonaraindustries.com",
    getSafeAbsoluteUrl: (value, fallback) => value || fallback,
    getSupabaseServerConfig: () => ({ ok: false }),
    supabaseHeaders: () => ({}),
    safeCountTable: async () => ({ ok: true, count: 0 }),
    formatMetric: (value) => String(value),
    insertActivityEvent: async () => ({ ok: true })
  });
}

function stripePriceResponse(price) {
  return { ok: true, status: 200, json: async () => price };
}

describe("checkout will not sell at a price the page never showed", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("allows a price that charges what the page advertises", async () => {
    global.fetch = async () => stripePriceResponse({ id: "price_ok", unit_amount: 700, currency: "usd", active: true });
    const result = await build().assertPriceMatchesAdvertised("starter_monthly", "price_ok");
    assert.equal(result.ok, true);
  });

  it("refuses a price that charges more than the page advertises", async () => {
    // The $9.99 retired price against a plan advertising $7.
    global.fetch = async () => stripePriceResponse({ id: "price_stale", unit_amount: 999, currency: "usd", active: true });
    const result = await build().assertPriceMatchesAdvertised("starter_monthly", "price_stale");
    assert.equal(result.ok, false);
    assert.equal(result.code, "price_mismatch");
    assert.equal(result.charges, 999);
    assert.equal(result.advertised, 700);
  });

  it("refuses an archived price", async () => {
    global.fetch = async () => stripePriceResponse({ id: "price_old", unit_amount: 700, currency: "usd", active: false });
    const result = await build().assertPriceMatchesAdvertised("starter_monthly", "price_old");
    assert.equal(result.ok, false);
    assert.equal(result.code, "price_archived");
  });

  // Added after reading the live account. Archiving a product in Stripe does
  // not flip its prices' active flag, so all three retired plans read
  // active: true and only the product says otherwise:
  //
  //   price_1TS4jf ($9.99)  active: true  product prod_UQwcES2WvMoNqT active: false
  //   price_1TS4l7 ($19.99) active: true  product prod_UQweXvXZN6R2lI active: false
  //   price_1TS4lc ($49.99) active: true  product prod_UQwekSKHXBZLVV active: false
  //
  // The archived-price check above cannot see that shape. Stripe refuses these
  // at session creation either way, so this is not the difference between
  // selling and not selling -- it is the difference between refusing here with
  // a reason and letting Stripe reject in front of the customer.
  it("asks Stripe for the product, not just the price", async () => {
    let requested = "";
    global.fetch = async (url) => {
      requested = String(url);
      return stripePriceResponse({ id: "price_ok", unit_amount: 700, currency: "usd", active: true, product: { active: true } });
    };
    await build().assertPriceMatchesAdvertised("starter_monthly", "price_ok");
    assert.match(requested, /expand\[\]=product/, "the product is not expanded, so an archived product cannot be seen");
  });

  it("refuses a live price whose product is archived", async () => {
    global.fetch = async () =>
      stripePriceResponse({ id: "price_stale", unit_amount: 700, currency: "usd", active: true, product: { active: false } });
    const result = await build().assertPriceMatchesAdvertised("starter_monthly", "price_stale");
    assert.equal(result.ok, false, "a price on an archived product was allowed through to checkout");
    assert.equal(result.code, "price_product_archived");
  });

  it("treats a bare product id as unknown rather than archived", async () => {
    // Without expand, or on an older API version, `product` is a string.
    // Unknown must not become a refusal to sell a valid plan.
    global.fetch = async () =>
      stripePriceResponse({ id: "price_ok", unit_amount: 700, currency: "usd", active: true, product: "prod_something" });
    const result = await build().assertPriceMatchesAdvertised("starter_monthly", "price_ok");
    assert.equal(result.ok, true, "a string product id was treated as an archived product");
  });

  it("refuses when Stripe will not say what the price is", async () => {
    // Selling blind is worse than not selling.
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const result = await build().assertPriceMatchesAdvertised("starter_monthly", "price_missing");
    assert.equal(result.ok, false);
    assert.equal(result.code, "price_unreadable");
  });

  it("refuses when the call to Stripe fails outright", async () => {
    global.fetch = async () => {
      throw new Error("network down");
    };
    const result = await build().assertPriceMatchesAdvertised("starter_monthly", "price_x");
    assert.equal(result.ok, false);
    assert.equal(result.code, "price_unreadable");
  });

  it("does not block a plan that advertises no amount", async () => {
    // A quoted plan has no advertised figure to compare against, and never
    // reaches checkout anyway -- it is turned away earlier.
    let called = false;
    global.fetch = async () => {
      called = true;
      return stripePriceResponse({ unit_amount: 19700, active: true });
    };
    const result = await build().assertPriceMatchesAdvertised("quoted", "price_quoted");
    assert.equal(result.ok, true);
    assert.equal(called, false, "a plan with no advertised amount should not need a Stripe lookup");
  });

  it("stops the checkout session being created at all when the price is wrong", async () => {
    // The point is that no session exists, not that a bad one is cleaned up.
    const calls = [];
    global.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("/v1/prices/")) return stripePriceResponse({ unit_amount: 4999, currency: "usd", active: true });
      return stripePriceResponse({ url: "https://checkout.stripe.com/should-not-happen" });
    };
    const session = await build().createStripeCheckoutSession({ get: () => "" }, "starter_monthly", "price_stale", "org", { id: "user" }, "cus_1");
    assert.equal(session.ok, false);
    assert.equal(session.code, "price_mismatch");
    assert.equal(
      calls.some((url) => url.includes("/v1/checkout/sessions")),
      false,
      "a checkout session was created despite the price not matching"
    );
  });
});
