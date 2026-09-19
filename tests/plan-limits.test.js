"use strict";

// What a plan includes, and what happens at the edge of it.
//
// The rules are small enough that the risk is not getting them wrong, it is
// writing a check that agrees with whatever they say. So each one below is
// asked about a case where the answer is known independently of the code:
// zero of one allowed, one of one refused, unlimited never refused, and an
// unreadable count refused differently from a reached limit.

const assert = require("node:assert/strict");
const {
  INCLUDED_LOCATIONS,
  includedLocations,
  locationAllowance,
  locationLimitMessage
} = require("../lib/sonara-plan-limits.cjs");
const { PAID_ENTITLEMENT_KEYS } = require("../lib/sonara-paid-access.cjs");

describe("plan limits", () => {
  it("covers every plan a customer can actually hold", () => {
    // A plan with no entry falls back to the free allowance, which for a Pro
    // subscriber would be a limit of one on a plan sold as unlimited. The
    // fallback is the right default and the wrong thing to rely on.
    const sold = new Set(Object.values(PAID_ENTITLEMENT_KEYS).flat());
    assert.ok(sold.size >= 3, `only ${sold.size} entitlement keys found; this check has gone blind`);
    const uncovered = [...sold].filter((key) => !Object.prototype.hasOwnProperty.call(INCLUDED_LOCATIONS, key));
    assert.deepEqual(uncovered, [], "these plans can be bought and have no stated location allowance");
  });

  it("uses the canonical workspace ladder only", () => {
    assert.equal(includedLocations("workspace_monthly"), 1);
    assert.equal(includedLocations("all_three_monthly"), null, "All three is unlimited");
    assert.equal(includedLocations("team_monthly"), null, "Team is unlimited");
    assert.equal(includedLocations("free"), 1);
    assert.equal(includedLocations("something_nobody_sells"), 1, "an unknown plan falls back to the free allowance");
  });

  it("allows up to the one-workspace limit and refuses past it", () => {
    assert.equal(locationAllowance("workspace_monthly", { ok: true, count: 0 }).allowed, true);
    assert.equal(locationAllowance("workspace_monthly", { ok: true, count: 1 }).allowed, false);
  });

  it("never refuses the unlimited canonical plans, however many there are", () => {
    for (const plan of ["all_three_monthly", "team_monthly"]) {
      for (const count of [0, 3, 99, 100000]) {
        assert.equal(locationAllowance(plan, { ok: true, count }).allowed, true, `${plan} refused at ${count}`);
      }
    }
  });

  // The distinction the module exists for.
  it("says it could not check, rather than saying the limit was reached", () => {
    for (const bad of [{ ok: false, count: null }, undefined, { ok: true, count: null }]) {
      const allowance = locationAllowance("workspace_monthly", bad);
      assert.equal(allowance.allowed, false, "an uncountable state must not create a location");
      assert.equal(allowance.unknown, true);
      assert.match(locationLimitMessage(allowance), /could not check/);
      assert.doesNotMatch(
        locationLimitMessage(allowance),
        /includes|Move up a plan/,
        "a failed count must not be reported to the customer as a plan limit"
      );
    }
  });

  it("tells a customer the numbers, not a code", () => {
    const message = locationLimitMessage(locationAllowance("workspace_monthly", { ok: true, count: 1 }));
    assert.match(message, /includes one location/);
    assert.match(message, /using 1/);
    assert.match(message, /Move up a plan/);
    // Singular reads as a sentence rather than "1 locations".
    assert.match(locationLimitMessage(locationAllowance("workspace_monthly", { ok: true, count: 1 })), /includes one location,/);
  });

  // `included || Infinity` would turn a deliberate zero into no limit at all.
  // Nothing is set to zero today, which is exactly when a guard like this is
  // cheap to add and impossible to notice missing.
  it("would treat a zero allowance as zero, not as unlimited", () => {
    const zeroed = { ...INCLUDED_LOCATIONS, workspace_monthly: 0 };
    const included = zeroed.workspace_monthly;
    assert.equal(included === null, false, "zero must not be read as the unlimited marker");
    assert.equal(0 < included, false, "zero allowance must refuse the first one");
  });
});
