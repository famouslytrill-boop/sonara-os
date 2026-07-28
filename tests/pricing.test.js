"use strict";

// The pricing page is the one screen where being wrong costs money and trust.
//
// The displayed price is a string written by hand; the amount actually charged
// comes from a Stripe Price object named by an environment variable. Nothing
// connects them, so the page could advertise $15 while Stripe charged $19 and
// no check would notice. amountCents was added so at least the two halves of
// the config have to agree, and these tests hold that line.
//
// This cannot verify Stripe itself -- that needs a live API call. See
// docs/pricing/2026-07-28-COMPETITOR-PRICING.md for the amounts each Stripe
// Price has to be created at.

const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../server");
const PLANS = app.STRIPE_PLANS;

describe("pricing", () => {
  let page;

  before(async () => {
    const response = await request(app).get("/pricing").set("accept", "text/html");
    assert.equal(response.status, 200);
    page = response.text;
  });

  it("shows the plans we intend to sell", () => {
    for (const [name, price] of [["Free", "$0"], ["Starter", "$5/mo"], ["Core", "$15/mo"], ["Pro", "$29/mo"]]) {
      assert.ok(page.includes(`${name} - ${price}`), `the pricing page must offer ${name} at ${price}`);
    }
  });

  it("exposes the plan table so the amounts can be checked", () => {
    assert.ok(PLANS && typeof PLANS === "object", "server must export STRIPE_PLANS or these checks silently pass");
  });

  it("never advertises a price the config does not hold", () => {
    for (const [plan, config] of Object.entries(PLANS)) {
      if (config.amountCents === null || config.amountCents === undefined) continue;
      const dollars = config.amountCents / 100;
      const expected = config.amountCents === 0 ? "$0" : `$${dollars}/mo`;
      assert.equal(
        config.price,
        expected,
        `${plan} shows "${config.price}" but amountCents says ${config.amountCents}`
      );
    }
  });

  it("stays below the competitor entry plans the page claims to beat", () => {
    // docs/pricing/2026-07-28-COMPETITOR-PRICING.md, surveyed July 2026. The
    // page claims Pro beats a ~$77 stack; if a price rises past the cheapest
    // single competitor the claim stops being true and this fails first.
    const CHEAPEST_COMPETITOR_ENTRY_CENTS = 900; // Brevo Starter
    assert.ok(
      PLANS.starter_monthly.amountCents < CHEAPEST_COMPETITOR_ENTRY_CENTS,
      "Starter must undercut the cheapest competitor entry plan, or the pricing page claim is false"
    );
    assert.ok(
      PLANS.pro_monthly.amountCents < 7700,
      "Pro must stay well under the ~$77 competitor stack the page compares against"
    );
  });

  it("does not promise anything about future pricing", () => {
    // A price guarantee is a commitment the business has not made, and
    // AGENTS.md keeps policy statements under owner approval.
    for (const phrase of ["price lock", "locked in", "price will never", "guaranteed price", "forever"]) {
      assert.ok(!page.toLowerCase().includes(phrase), `the pricing page must not promise "${phrase}"`);
    }
  });

  it("dates its competitor comparison instead of stating it as a standing fact", () => {
    assert.match(page, /July 2026/, "the competitor comparison must carry the date it was surveyed");
  });

  it("does not offer checkout on a plan that has no price configured", async () => {
    // Selling a plan whose Stripe price is missing takes money for nothing.
    const response = await request(app).get("/pricing").set("accept", "text/html");
    const hasCheckoutButton = /<button type="submit">Start checkout<\/button>/.test(response.text);
    const stripeConfigured = /You can check out on any plan that is set up/.test(response.text);
    if (!stripeConfigured) {
      assert.equal(hasCheckoutButton, false, "checkout must not be offered while payments are unconfigured");
    }
  });
});
