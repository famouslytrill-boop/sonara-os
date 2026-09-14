"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createReadiness } = require("../lib/sonara-readiness.cjs");
const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");

function makeReadiness(extraEnv = {}) {
  const restrictedPrefix = ["rk", "live", ""].join("_");
  const env = {
    STRIPE_SECRET_KEY: `${restrictedPrefix}notarealkeyforreadiness`,
    STRIPE_WEBHOOK_SECRET: "whsec_notarealsecretforreadiness",
    STRIPE_PRICE_WORKSPACE_MONTHLY: "price_workspace123",
    STRIPE_PRICE_ALL_THREE_MONTHLY: "price_allthree123",
    STRIPE_PRICE_TEAM_MONTHLY: "price_team123",
    ...extraEnv
  };

  const getEnv = (names) => {
    const candidates = Array.isArray(names) ? names : [names];
    for (const name of candidates) {
      const value = env[name];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return "";
  };

  return createReadiness({
    getEnv,
    isPlaceholderValue: () => false,
    isEmailLike: (value) => String(value || "").includes("@"),
    isPlaceholderEmail: () => false,
    splitList: (value) => String(value || "").split(",").map((part) => part.trim()).filter(Boolean),
    STRIPE_PLANS,
    getLegalPagesStatus: () => "published_with_disclaimer"
  });
}

describe("Stripe readiness follows the active pricing ladder", () => {
  it("accepts a syntactically valid restricted Stripe API key", () => {
    const readiness = makeReadiness();
    const payload = readiness.getReadiness();
    const stripeAdminItem = readiness.getAdminEnvReadiness().find((item) => item.key === "STRIPE_SECRET_KEY");

    assert.equal(readiness.getStripeSecretStatus().status, "configured");
    assert.equal(payload.services.stripe, "configured");
    assert.equal(payload.services.checkout, "enabled");
    assert.equal(stripeAdminItem?.status, "configured");
    assert.deepEqual(payload.invalid.stripe, []);
  });

  it("defers missing legacy prices after their configured replacements are buyable", () => {
    const payload = makeReadiness().getReadiness();

    for (const legacy of ["starter_monthly", "core_monthly", "pro_monthly"]) {
      const status = payload.checkoutPlans[legacy];
      assert.equal(status.checkout, "setup_required", `${legacy} itself must not pretend to be buyable`);
      assert.equal(status.reason, "missing", `${legacy} still has a genuinely absent legacy price`);
      assert.ok(
        payload.deferred.stripe.includes(status.env),
        `${legacy} is superseded by a buyable plan and should be deferred rather than blocking readiness`
      );
      assert.equal(
        payload.missing.stripe.includes(status.env),
        false,
        `${legacy} must not be reported as required after the replacement ladder opens`
      );
    }

    assert.equal(payload.checkoutPlans.workspace_monthly.checkout, "enabled");
    assert.equal(payload.checkoutPlans.all_three_monthly.checkout, "enabled");
    assert.equal(payload.checkoutPlans.team_monthly.checkout, "enabled");
  });

  it("still rejects a malformed Stripe API key", () => {
    const readiness = makeReadiness({ STRIPE_SECRET_KEY: "not-a-stripe-key" });
    const payload = readiness.getReadiness();

    assert.equal(readiness.getStripeSecretStatus().status, "invalid_prefix");
    assert.equal(payload.services.stripe, "invalid");
    assert.equal(payload.services.checkout, "setup_required");
    assert.ok(payload.invalid.stripe.some((item) => item.env === "STRIPE_SECRET_KEY"));
  });

  it("keeps the post-deploy verifier tied to offeredPlanKeys instead of a retired hard-coded ladder", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "verify-production-product-catalog.mjs"),
      "utf8"
    );

    assert.match(source, /offeredPlanKeys\(\(plan\) => readiness\.checkoutPlans\?\.\[plan\]\?\.checkout\)/);
    assert.doesNotMatch(
      source,
      /\["starter_monthly",\s*"core_monthly",\s*"pro_monthly"\]/,
      "the deploy gate has hard-coded the superseded depth ladder again"
    );
    assert.match(source, /enabledPaidPlans\.length > 0/);
  });
});
