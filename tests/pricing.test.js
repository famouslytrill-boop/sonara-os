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
const fs = require("node:fs");
const path = require("node:path");
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
    for (const [name, price] of [["Free", "$0"], ["Starter", "$7/mo"], ["Core", "$19/mo"], ["Pro", "$39/mo"]]) {
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
      // The suffix is the billing period, not decoration. This asserted "/mo"
      // for every plan until annual billing arrived on 5 September 2026, which
      // made it impossible for a yearly price to be written correctly: the only
      // string it accepted for $190 a year was "$190/mo". A period a customer
      // is charged on is exactly the thing a price string must not get wrong.
      const period = config.billedAnnually ? "/yr" : "/mo";
      const expected = config.amountCents === 0 ? "$0" : `$${dollars}${period}`;
      assert.equal(
        config.price,
        expected,
        `${plan} shows "${config.price}" but amountCents says ${config.amountCents}`
      );
    }
  });

  it("stays below the competitor entry plans the page claims to beat", () => {
    // docs/pricing/2026-09-05-PRICING-STRATEGY.md, re-surveyed 5 September 2026.
    // If a price rises past the cheapest single competitor the claim stops
    // being true and this fails first.
    //
    // The stack bound was pinned at 7700 for "~$77". That figure was corrected
    // to $87 on 12 August -- it had compared Jobber's ANNUAL price against
    // Podia's MONTHLY one, which is not a stack anybody is quoted -- and this
    // test was never moved with it. A bound nobody updates when its source is
    // corrected is a bound that stops meaning anything, so it now carries the
    // arithmetic rather than a remembered total.
    const CHEAPEST_COMPETITOR_ENTRY_CENTS = 900; // Brevo Starter, $9
    const COMPETITOR_STACK_CENTS = 4900 + 4900 + 900; // Jobber Core + Podia Mover + Brevo Starter, monthly
    assert.equal(COMPETITOR_STACK_CENTS, 10700, "the stack arithmetic no longer comes to the $107 the pricing doc states");
    assert.ok(
      PLANS.starter_monthly.amountCents < CHEAPEST_COMPETITOR_ENTRY_CENTS,
      "Starter must undercut the cheapest competitor entry plan, or the pricing page claim is false"
    );
    for (const key of ["pro_monthly", "all_three_monthly"]) {
      assert.ok(
        PLANS[key].amountCents < COMPETITOR_STACK_CENTS,
        `${key} must stay under the $107 competitor stack the page compares against`
      );
    }
    // A yearly plan is compared against a year of the stack, not a month of it.
    for (const [key, config] of Object.entries(PLANS)) {
      if (!config.billedAnnually) continue;
      assert.ok(
        config.amountCents < COMPETITOR_STACK_CENTS * 12,
        `${key} costs more per year than the competitor stack does`
      );
    }

  });

  it("does not promise anything about future pricing", () => {
    // A price guarantee is a commitment the business has not made, and
    // AGENTS.md keeps policy statements under owner approval.
    for (const phrase of ["price lock", "locked in", "price will never", "guaranteed price", "forever"]) {
      assert.ok(!page.toLowerCase().includes(phrase), `the pricing page must not promise "${phrase}"`);
    }
  });

  it("dates its competitor comparison instead of stating it as a standing fact", () => {
    // The month is read from the audit rather than pinned here. This said
    // "July 2026", so re-surveying the market -- which is the thing that keeps
    // the claim true -- broke the test that exists to keep it honest. What
    // matters is that a date is carried and that it is the date of the research
    // the page is quoting, not which month that happens to be.
    const audit = fs.readFileSync(path.join(__dirname, "..", "docs", "market", "2026-08-12-MARKET-AUDIT.md"), "utf8");
    const surveyed = audit.match(/Researched (\d+ [A-Z][a-z]+ \d{4})/)?.[1];
    assert.ok(surveyed, "the audit does not state when it was researched");
    const month = surveyed.replace(/^\d+ /, "");
    assert.ok(page.includes(month), `the competitor comparison must carry the date it was surveyed (${month})`);
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
