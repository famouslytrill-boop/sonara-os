"use strict";

const assert = require("node:assert/strict");
const paid = require("../lib/sonara-paid-capabilities.cjs");

describe("the capabilities that cost money", () => {
  it("prices all six of them", () => {
    // The population, asserted rather than assumed. docs/products/ lists six
    // capabilities with a marginal cost; a file that priced four of them would
    // leave two shipping at no price and nothing would say so.
    const names = Object.keys(paid.CAPABILITIES).sort();
    assert.deepEqual(names, [
      "game_engine_export",
      "live_streaming",
      "media_generation",
      "payment_terminal",
      "telephony",
      "three_d_processing"
    ]);
  });

  it("never sells a unit below what the unit costs", () => {
    const result = paid.verifyMargins();
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
    assert.ok(result.checked >= 6, "the margin check examined fewer than six capabilities");
  });

  it("gives every capability a unit, so nothing is priced per unbounded usage", () => {
    // Selling "video generation" by the month is selling an unbounded GPU bill
    // for a fixed price. The unit is what makes it a price rather than a hope.
    for (const [name, entry] of Object.entries(paid.CAPABILITIES)) {
      assert.ok(entry.unit, `${name} has no unit`);
      assert.ok(entry.label, `${name} has no label a customer could read`);
    }
  });

  it("makes every capability nameably unavailable, so none can become a launch dependency", () => {
    // The same rule scripts/verify-env.mjs enforces for variables. A capability
    // that requires nothing has nothing to mark it off, and would be reachable
    // by default on a deployment that cannot serve it.
    for (const [name, entry] of Object.entries(paid.CAPABILITIES)) {
      assert.ok(Array.isArray(entry.requires) && entry.requires.length, `${name} requires nothing`);
    }
  });

  describe("quoting", () => {
    it("refuses a capability nobody costed rather than inventing a price", () => {
      const answer = paid.quote("teleportation", 5);
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "unknown_capability");
    });

    it("separates 'no usage supplied' from 'usage of zero'", () => {
      // Number(null) is 0 and finite, which is how an unread meter becomes a
      // free invoice. The two have to arrive at different answers.
      assert.equal(paid.quote("media_generation", null).code, "no_usage");
      assert.equal(paid.quote("media_generation", undefined).code, "no_usage");
      assert.equal(paid.quote("media_generation", 0).ok, true);
      assert.equal(paid.quote("media_generation", 0).chargeMinor, 0);
    });

    it("refuses usage that is not a usable number", () => {
      assert.equal(paid.quote("media_generation", "lots").code, "bad_usage");
      assert.equal(paid.quote("media_generation", -5).code, "bad_usage");
      assert.equal(paid.quote("media_generation", Infinity).code, "bad_usage");
    });

    it("rounds a charge up, because rounding down loses money on every small job", () => {
      // One GPU-second at 0.25 minor units is a real unit of usage. Rounding it
      // to zero is free work, repeated.
      const answer = paid.quote("media_generation", 1);
      assert.equal(answer.chargeMinor, 1);
      assert.ok(answer.chargeMinor > 0);
    });

    it("reports the margin as arithmetic rather than as a belief", () => {
      const answer = paid.quote("live_streaming", 100);
      assert.equal(answer.chargeMinor, 400);
      assert.equal(answer.costMinor, 100);
      assert.equal(answer.marginMinor, 300);
    });

    it("prices the card reader at cost, deliberately", () => {
      const answer = paid.quote("payment_terminal", 1);
      assert.equal(answer.marginMinor, 0);
      // And the margin check must tolerate that rather than calling it a loss.
      assert.equal(paid.verifyMargins().ok, true);
    });
  });

  describe("availability", () => {
    it("says which variable is missing rather than only that it is off", () => {
      const answer = paid.availability("telephony", () => undefined);
      assert.equal(answer.ok, false);
      assert.equal(answer.status, "setup_required");
      assert.deepEqual(answer.missing, ["SONARA_TELEPHONY_PROVIDER_URL"]);
    });

    it("treats an empty string as missing, not as set", () => {
      const answer = paid.availability("telephony", () => "   ");
      assert.equal(answer.status, "setup_required");
    });

    it("reports configured only when everything it needs is present", () => {
      const answer = paid.availability("telephony", () => "https://provider.example");
      assert.equal(answer.ok, true);
      assert.equal(answer.status, "configured");
    });

    it("does not report a missing environment reader as 'setup required'", () => {
      // "We could not check" and "you have not set this up" send a person to
      // different places, so they must not share a status.
      const answer = paid.availability("telephony", null);
      assert.equal(answer.status, "unavailable");
      assert.notEqual(answer.status, "setup_required");
    });
  });

  describe("money is integers", () => {
    it("does not drift", () => {
      assert.equal(paid.money(0.1) + paid.money(0.2), paid.money(0.3));
    });

    it("rounds symmetrically, because Math.round does not", () => {
      // Math.round(2.5) is 3 and Math.round(-2.5) is -2. Asymmetric, which is
      // the wrong shape for a refund.
      assert.equal(paid.money(0.025), 3);
      assert.equal(paid.money(-0.025), -3);
    });

    it("refuses a value that is not a number rather than returning NaN", () => {
      assert.equal(paid.money("free"), null);
      assert.equal(paid.money(Infinity), null);
    });
  });
});
