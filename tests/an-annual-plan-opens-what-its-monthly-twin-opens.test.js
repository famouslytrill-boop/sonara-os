"use strict";

// An annual plan is the same product on a different billing period. If it opens
// less than its monthly twin, a customer has paid for ten months up front and
// been handed the free tier -- and the failure is silent, because nothing in
// checkout compares the two.
//
// This is not hypothetical in this repository. Before the entitlement map was
// keyed on plans that actually open a workspace, seven products advertised
// plans that would have answered a paying customer with a 402:
// lib/sonara-recommended-product-catalog.cjs carries the whole account. The
// annual plans were added by *deriving* every list from the monthly twin rather
// than repeating it, precisely so that shape of omission cannot recur.
//
// Derivation moves where the mistake can happen; it does not remove it. These
// cases assert the derivation actually held, and each was confirmed to fail when
// the derivation is broken -- see docs/SPRINT_LOG.md for what was broken and
// what each one said.

const assert = require("node:assert/strict");

const {
  STRIPE_PLANS,
  ANNUAL_TWINS,
  withAnnualTwins,
  offeredPlanKeys
} = require("../lib/sonara-stripe-plans.cjs");
const {
  PAID_ENTITLEMENT_KEYS,
  FEATURE_ENTITLEMENT_KEYS,
  SINGLE_WORKSPACE_PLANS
} = require("../lib/sonara-paid-access.cjs");
const { INCLUDED_LOCATIONS, INCLUDED_SCROLL_SITES } = require("../lib/sonara-plan-limits.cjs");

const annualKeys = Object.keys(ANNUAL_TWINS);

// Every list an annual plan has to appear in, named so a failure says which.
const ENTITLEMENT_LISTS = [
  ...Object.entries(PAID_ENTITLEMENT_KEYS).map(([name, keys]) => [`PAID_ENTITLEMENT_KEYS.${name}`, keys]),
  ...Object.entries(FEATURE_ENTITLEMENT_KEYS).map(([name, keys]) => [`FEATURE_ENTITLEMENT_KEYS.${name}`, keys]),
  ["SINGLE_WORKSPACE_PLANS", SINGLE_WORKSPACE_PLANS]
];

describe("an annual plan opens what its monthly twin opens", () => {
  it("has annual plans to check, so none of this passes on an empty list", () => {
    assert.ok(annualKeys.length >= 3, `only ${annualKeys.length} annual plans found; this check has gone blind`);
    assert.ok(ENTITLEMENT_LISTS.length >= 4, `only ${ENTITLEMENT_LISTS.length} entitlement lists found; this check has gone blind`);
  });

  it("names a monthly plan that exists, for every annual plan", () => {
    for (const [annual, monthly] of Object.entries(ANNUAL_TWINS)) {
      assert.ok(STRIPE_PLANS[monthly], `${annual} is billed annually against ${monthly}, which is not a plan`);
      assert.equal(STRIPE_PLANS[annual].mode, "subscription", `${annual} is not a subscription`);
    }
  });

  it("appears in every entitlement list its monthly twin appears in", () => {
    for (const [listName, keys] of ENTITLEMENT_LISTS) {
      const present = new Set(keys);
      for (const [annual, monthly] of Object.entries(ANNUAL_TWINS)) {
        if (!present.has(monthly)) continue;
        assert.ok(
          present.has(annual),
          `${listName} opens ${monthly} but not ${annual}. Somebody paying yearly for the same product is refused.`
        );
      }
    }
  });

  it("appears in no entitlement list its monthly twin is absent from", () => {
    // The other direction, and the one a hand-written list gets wrong in the
    // generous direction: an annual plan quietly opening more than the product
    // it is the annual form of.
    for (const [listName, keys] of ENTITLEMENT_LISTS) {
      const present = new Set(keys);
      for (const [annual, monthly] of Object.entries(ANNUAL_TWINS)) {
        if (present.has(annual) && !present.has(monthly)) {
          assert.fail(`${listName} opens ${annual} but not ${monthly}, so the annual plan sells more than the monthly one`);
        }
      }
    }
  });

  it("carries the same allowance as its twin, rather than falling back to free", () => {
    for (const [table, name] of [[INCLUDED_LOCATIONS, "INCLUDED_LOCATIONS"], [INCLUDED_SCROLL_SITES, "INCLUDED_SCROLL_SITES"]]) {
      for (const [annual, monthly] of Object.entries(ANNUAL_TWINS)) {
        if (!Object.prototype.hasOwnProperty.call(table, monthly)) continue;
        assert.ok(
          Object.prototype.hasOwnProperty.call(table, annual),
          `${name} has no entry for ${annual}, so it silently takes the free allowance`
        );
        assert.equal(table[annual], table[monthly], `${name}: ${annual} and ${monthly} allow different amounts`);
      }
    }
  });

  it("costs less per month than paying monthly, and says so honestly", () => {
    for (const [annual, monthly] of Object.entries(ANNUAL_TWINS)) {
      const yearly = STRIPE_PLANS[annual].amountCents;
      const twelveMonths = STRIPE_PLANS[monthly].amountCents * 12;
      assert.ok(Number.isFinite(yearly) && yearly > 0, `${annual} has no amount`);
      assert.ok(
        yearly < twelveMonths,
        `${annual} costs ${yearly} against ${twelveMonths} paid monthly, so the yearly plan is not cheaper`
      );
      // Two months free is what the plan copy promises. Anything deeper is a
      // discount nobody decided; anything shallower makes the copy untrue.
      assert.equal(
        yearly,
        STRIPE_PLANS[monthly].amountCents * 10,
        `${annual} is not ten months of ${monthly}, but its description promises two months free`
      );
      assert.match(STRIPE_PLANS[annual].description, /two months free/i, `${annual} does not say what the saving is`);
    }
  });

  it("stays off the pricing page until it can actually be bought", () => {
    const nothingBuyable = offeredPlanKeys(() => "disabled");
    for (const annual of annualKeys) {
      assert.ok(!nothingBuyable.includes(annual), `${annual} is shown on the ladder while it cannot be bought`);
    }
    // And the monthly plans are still there, so the page is not empty.
    assert.ok(nothingBuyable.includes("free"), "the ladder lost Free, so this assertion proves nothing about hiding");
    assert.ok(nothingBuyable.length >= 4, `only ${nothingBuyable.length} plans offered; the ladder has collapsed`);
  });

  it("appears once its price is configured", () => {
    const everythingBuyable = offeredPlanKeys(() => "enabled");
    for (const annual of annualKeys) {
      assert.ok(everythingBuyable.includes(annual), `${annual} is hidden even when it can be bought`);
    }
  });
});

describe("the expansion helper itself", () => {
  it("leaves a list with no annual twins alone", () => {
    assert.deepEqual(withAnnualTwins(["free"]), ["free"]);
  });

  it("puts each annual key directly after the monthly one it came from", () => {
    assert.deepEqual(withAnnualTwins(["team_monthly", "free"]), ["team_monthly", "team_annual", "free"]);
  });
});
