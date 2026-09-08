"use strict";

// A plan the pricing page deliberately does not show yet, reported as a
// misconfiguration, failing every pull request.
//
// The three annual plans carry `hiddenUntilBuyable` in
// lib/sonara-stripe-plans.cjs: `offeredPlanKeys` keeps them off /pricing
// entirely until their Stripe prices exist, so a customer never sees a card
// they cannot buy. docs/owner/PRICE-CUTOVER-RUNBOOK.md names staging the
// monthly ladder first, yearly later, as pathway B -- supported, and costing
// one extra deploy.
//
// lib/sonara-readiness.cjs put every unset plan price into `missing.stripe`,
// which was right while every plan was meant to be buyable. And
// scripts/smoke-live-routes.mjs fails when `missing.stripe` is non-empty.
//
// So the moment the owner set the three monthly variables on 8 September 2026 --
// taking exactly the pathway the runbook offered -- production connectivity went
// red on every pull request, naming three prices nobody had promised to create:
//
//     Production connectivity smoke failed with 1 issue(s):
//     - /api/readiness: stripe reports missing configuration
//
//     missing.stripe: [STRIPE_PRICE_WORKSPACE_ANNUAL,
//                      STRIPE_PRICE_ALL_THREE_ANNUAL,
//                      STRIPE_PRICE_TEAM_ANNUAL]
//
// The deployment was fine. The classification was wrong: a variable nobody is
// waiting for is deferred, not missing -- the same shape as googleOAuth, which
// has read "deferred" in that file for months.
//
// It is reported in its own bucket rather than dropped, because "nobody is
// waiting for this" and "nobody has noticed this" are different facts and the
// owner needs to see both. A fix that simply stopped counting them would be
// this codebase's recurring defect: a signal that reports success by measuring
// less.

const assert = require("node:assert/strict");

const { createReadiness } = require("../lib/sonara-readiness.cjs");
const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");

// getStripeSecretStatus requires an sk_live_ / sk_test_ prefix, so this fixture
// has to carry one. It is assembled rather than written out: the first version
// wrote the live-mode prefix as a literal and GitHub push protection blocked the
// push, reading it as a Stripe API key. It was a string of zeroes and no secret
// at all -- and push protection was still right. A repository that contains
// things shaped like live credentials teaches every reader and every scanner to
// wave the shape through, which is the habit that lets a real one past.
// AGENTS.md says do not commit secrets; the unblock link was not used.
const TEST_MODE_PREFIX = ["sk", "test", ""].join("_");

// A plan whose price variable is set, and one whose is not, under our control.
function readinessWith(setEnv) {
  const env = {
    STRIPE_SECRET_KEY: `${TEST_MODE_PREFIX}notarealkeyforafixture`,
    STRIPE_WEBHOOK_SECRET: "whsec_notarealsecretforafixture",
    ...setEnv
  };
  return createReadiness({
    getEnv: (name) => env[name],
    isPlaceholderValue: () => false,
    isEmailLike: () => true,
    isPlaceholderEmail: () => false,
    splitList: (value) => String(value || "").split(",").map((part) => part.trim()).filter(Boolean),
    STRIPE_PLANS,
    getLegalPagesStatus: () => ({ status: "published_with_disclaimer" })
  }).getReadiness();
}

const hiddenPlans = Object.entries(STRIPE_PLANS).filter(([, plan]) => plan.hiddenUntilBuyable);
const shownPaidPlans = Object.entries(STRIPE_PLANS).filter(
  ([key, plan]) => !plan.hiddenUntilBuyable && plan.env && key !== "free"
);

describe("a price nobody promised is deferred, not missing", () => {
  it("has hidden-until-buyable plans and shown ones to tell apart", () => {
    // Shape 1: if either set were empty every assertion below would hold by
    // describing nothing.
    assert.ok(hiddenPlans.length >= 1, "no plan carries hiddenUntilBuyable; this check has gone blind");
    assert.ok(shownPaidPlans.length >= 1, "no shown paid plan found; the negative case below proves nothing");
  });

  it("does not call an unset hidden plan's price missing", () => {
    const readiness = readinessWith({});
    const hiddenEnvs = hiddenPlans.map(([, plan]) => plan.env).filter(Boolean);
    for (const env of hiddenEnvs) {
      assert.ok(
        !readiness.missing.stripe.includes(env),
        `${env} belongs to a plan the page does not show yet and is still reported as missing. ` +
          "That is what turned production connectivity red on every pull request."
      );
    }
  });

  it("reports it as deferred instead of dropping it", () => {
    const readiness = readinessWith({});
    const hiddenEnvs = hiddenPlans.map(([, plan]) => plan.env).filter(Boolean);
    for (const env of hiddenEnvs) {
      assert.ok(
        readiness.deferred?.stripe?.includes(env),
        `${env} is neither missing nor deferred, so it has vanished from readiness entirely. ` +
          "The owner still needs to see that it is unset."
      );
    }
  });

  it("still calls a shown plan's unset price missing", () => {
    // The guarantee that must not be weakened. Nothing about deferring the
    // hidden plans may excuse a plan the page actually offers.
    const readiness = readinessWith({});
    const shownEnvs = shownPaidPlans.map(([, plan]) => plan.env).filter(Boolean);
    const reported = shownEnvs.filter((env) => readiness.missing.stripe.includes(env));
    assert.ok(
      reported.length >= 1,
      `no shown paid plan's unset price is reported missing (checked ${shownEnvs.length}); ` +
        "the deferral has swallowed the real signal too"
    );
  });

  it("keeps the smoke check reading missing rather than deferred", () => {
    // If the smoke check ever starts failing on `deferred`, this whole
    // distinction stops meaning anything and pathway B breaks again.
    const fs = require("node:fs");
    const path = require("node:path");
    const smoke = fs.readFileSync(path.join(__dirname, "..", "scripts", "smoke-live-routes.mjs"), "utf8");
    assert.match(smoke, /payload\?\.missing\?\.\[service\]/, "the smoke check no longer reads missing[service]");
    assert.doesNotMatch(
      smoke,
      /payload\?\.deferred/,
      "the smoke check now fails on deferred configuration, which is the state pathway B is supposed to be allowed to sit in"
    );
  });
});
