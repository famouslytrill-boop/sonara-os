"use strict";

// The Business Builder setup package is quoted, not sold through checkout.
//
// It used to carry a live Stripe price of $197.00 while advertising no amount
// at all: the pricing page said "One-time", the button said "Start checkout",
// and the first number a customer saw was on Stripe's page after they had
// committed. It is done-for-you work whose scope varies, so a fixed self-serve
// price was the wrong shape for it regardless.
//
// The plan is still in STRIPE_PLANS rather than deleted, because it is an
// entitlement key -- anyone already granted the package keeps their access.
// What these tests pin is that it cannot be *bought* self-serve, and that it
// cannot drift back into checkout without somebody deciding to.

const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../server");
const { STRIPE_PLANS } = app;
const { createModuleCrud } = require("../lib/sonara-module-crud.cjs");
const { createBilling } = require("../lib/sonara-billing.cjs");

const QUOTED = "business_builder_one_time";

function billing() {
  return createBilling({
    STRIPE_PLANS,
    getEnv: () => "",
    getPublicAppUrl: () => "https://app.example.com",
    getSafeAbsoluteUrl: (value, fallback) => value || fallback,
    getSupabaseServerConfig: () => ({ ok: false }),
    supabaseHeaders: () => ({}),
    safeCountTable: async () => 0,
    formatMetric: (label, value) => `${label}: ${value}`,
    insertActivityEvent: async () => undefined
  });
}

describe("quoted work is not sold through checkout", () => {
  it("declares no Stripe price, so there is nothing to charge", () => {
    const config = STRIPE_PLANS[QUOTED];
    assert.equal(config.quoted, true);
    assert.equal(config.env, undefined, "a quoted plan must not name a price environment variable");
    assert.equal(config.mode, undefined, "a quoted plan has no Stripe checkout mode");
    assert.equal(config.amountCents, null);
  });

  it("is still a real plan, so an existing entitlement keeps working", () => {
    // Deleting the key would silently revoke access for anyone already granted
    // the package. Nobody holds it today, but that is a fact about now.
    assert.ok(Object.prototype.hasOwnProperty.call(STRIPE_PLANS, QUOTED));
    assert.equal(billing().isValidPlan(QUOTED), true);
    assert.ok(billing().getPaidEntitlementKeys("business_builder").includes(QUOTED));
  });

  it("is refused by checkout rather than charged", async () => {
    const json = await request(app)
      .post("/api/checkout/session")
      .set("accept", "application/json")
      .send({ plan: QUOTED });
    assert.equal(json.status, 400);
    assert.equal(json.body.code, "quoted_plan");
    assert.doesNotMatch(JSON.stringify(json.body), /price_|sk_/, "no Stripe identifier may appear in the refusal");
  });

  it("sends a browser somewhere it can actually ask", async () => {
    // Refusing with a code is correct for an API client and useless to a person
    // who just clicked a button.
    const form = await request(app)
      .post("/api/checkout/session")
      .set("accept", "text/html")
      .type("form")
      .send("plan=business_builder_setup");
    assert.equal(form.status, 303);
    assert.match(form.headers.location, /^\/contact/);
  });

  it("offers a quote on the pricing page, not a charge", async () => {
    const response = await request(app).get("/pricing").set("accept", "text/html");
    assert.equal(response.status, 200);
    assert.match(response.text, /Ask for a quote/);
    assert.doesNotMatch(
      response.text,
      new RegExp(`value="${QUOTED}"`),
      "a quoted plan must not appear as a checkout form value"
    );
  });

  it("reports its checkout state as quoted, not enabled", async () => {
    // The readiness branch for "no price environment variable" was written for
    // the free plan and returns checkout: "enabled". A quoted plan hitting that
    // branch would report itself as sellable.
    const response = await request(app).get("/api/readiness").set("accept", "application/json");
    assert.equal(response.status, 200);
    assert.equal(response.body.checkoutPlans[QUOTED].checkout, "quoted");
    assert.equal(response.body.checkoutPlans[QUOTED].env, undefined, "a quoted plan reports no missing env var");
  });

  it("does not count as an unconfigured plan holding back launch readiness", async () => {
    const response = await request(app).get("/api/readiness").set("accept", "application/json");
    const stripeMissing = response.body.missing?.stripe || [];
    assert.ok(
      !stripeMissing.some((name) => /BUSINESS_BUILDER_ONE_TIME/.test(String(name))),
      "a quoted plan must not report a missing price variable, or setup looks incomplete forever"
    );
  });
});
