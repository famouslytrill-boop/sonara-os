"use strict";

const assert = require("node:assert/strict");
const {
  LEDGER_TABLE,
  ENTRY_KINDS,
  balanceFrom,
  authoriseUsage,
  drawEntry,
} = require("../lib/sonara-usage-meter.cjs");
const { CAPABILITIES, quote } = require("../lib/sonara-paid-capabilities.cjs");

// lib/sonara-paid-capabilities.cjs has priced six capabilities that cost real
// money per use since it was written, each against a dated cost floor, and it
// charges nobody -- required by exactly two files, its own release check and its
// own test. A price list that sells nothing.
//
// lib/sonara-usage-meter.cjs is the decision half. What it must never do is let
// a GPU second, a carrier minute or an SMS out of the door unpaid, because that
// is money that cannot be recovered afterwards.
//
// These assertions are about money leaving, so they are written as refusals
// rather than as features.
function ledger(rows) {
  return { ok: true, rows };
}

const METERED = Object.keys(CAPABILITIES);

describe("a metered capability cannot run unpaid", () => {
  it("is measuring the real price list, not a stub", () => {
    assert.ok(METERED.length >= 6, `only ${METERED.length} priced capabilities found; this check has gone blind`);
    assert.equal(LEDGER_TABLE, "usage_credit_ledger");
    assert.ok(Object.keys(ENTRY_KINDS).length >= 3, "an entry-kind table this small cannot describe a ledger");
  });

  // The whole point. Every priced capability, not a sample -- a meter that
  // guards five of six is a meter with one free capability nobody notices.
  it("refuses every priced capability when the balance is empty", () => {
    for (const capability of METERED) {
      const decision = authoriseUsage({ capability, units: 10, history: ledger([]) });
      assert.equal(
        decision.allowed,
        false,
        `${capability} ran with no credit -- that is a real vendor bill nobody paid for`
      );
      assert.equal(decision.code, "insufficient_credit");
      assert.ok(decision.quote?.chargeMinor > 0, `${capability} should have a non-zero charge for 10 units`);
    }
  });

  it("refuses when the balance cannot be read, rather than running unpaid", () => {
    // The opposite trade from the agent breaker, which fails open. A refused
    // generation is retryable; a spent GPU second is not recoverable.
    for (const history of [null, undefined, { ok: false, rows: [] }, { ok: false }, [], { rows: [] }]) {
      const decision = authoriseUsage({ capability: "media_generation", units: 60, history });
      assert.equal(
        decision.allowed,
        false,
        `an unreadable balance (${JSON.stringify(history)}) must refuse, not spend money on an assumption`
      );
      assert.equal(decision.code, "balance_unreadable");
    }

    // A bare array carries no outcome and must not pass as a successful read.
    const bare = authoriseUsage({ capability: "media_generation", units: 60, history: [{ entry_kind: "grant", amount_minor: 10000 }] });
    assert.equal(bare.allowed, false, "a bare array has no ok flag and must not be trusted as a read that succeeded");
  });

  it("tells 'no credit' apart from 'could not check', because the customer does different things", () => {
    const broke = authoriseUsage({ capability: "telephony", units: 5, history: ledger([]) });
    const blind = authoriseUsage({ capability: "telephony", units: 5, history: { ok: false } });

    assert.notEqual(broke.code, blind.code, "these are different failures and must not share a code");
    assert.match(broke.reason, /credit/i);
    assert.match(blind.reason, /try again/i);
  });

  it("allows the work when the balance covers it, and says what is left", () => {
    const decision = authoriseUsage({
      capability: "media_generation",
      units: 120,
      history: ledger([{ entry_kind: "grant", amount_minor: 500 }]),
      idempotencyKey: "job-1",
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.drawMinor, quote("media_generation", 120).chargeMinor);
    assert.equal(decision.remainingMinor, 500 - decision.drawMinor);
  });

  it("refuses one minor unit short, because a threshold that bends is not one", () => {
    const priced = quote("media_generation", 120);
    const short = authoriseUsage({
      capability: "media_generation",
      units: 120,
      history: ledger([{ entry_kind: "grant", amount_minor: priced.chargeMinor - 1 }]),
    });
    assert.equal(short.allowed, false);

    const exact = authoriseUsage({
      capability: "media_generation",
      units: 120,
      history: ledger([{ entry_kind: "grant", amount_minor: priced.chargeMinor }]),
    });
    assert.equal(exact.allowed, true, "an exactly-sufficient balance must be enough");
  });

  it("charges nothing for zero usage, without refusing it", () => {
    // quote() treats "usage of zero" and "no usage supplied" as different
    // answers. A job that legitimately consumed nothing must not be refused for
    // having no credit.
    const decision = authoriseUsage({ capability: "telephony", units: 0, history: ledger([]) });
    assert.equal(decision.allowed, true);
    assert.equal(decision.drawMinor, 0);
    assert.equal(decision.code, "no_charge");
  });

  it("still refuses when usage was never supplied, which is not usage of zero", () => {
    for (const units of [null, undefined, ""]) {
      const decision = authoriseUsage({ capability: "telephony", units, history: ledger([{ entry_kind: "grant", amount_minor: 10000 }]) });
      assert.equal(decision.allowed, false, `units of ${JSON.stringify(units)} must not be read as zero`);
    }
  });

  it("does not treat an unpriced capability as a free one", () => {
    const decision = authoriseUsage({ capability: "something_nobody_priced", units: 10, history: ledger([{ entry_kind: "grant", amount_minor: 10000 }]) });
    assert.equal(decision.allowed, false, "an unpriced capability is unpriced, not free");
    assert.equal(decision.code, "unknown_capability");
  });

  describe("the ledger sums honestly", () => {
    it("adds grants and subtracts draws", () => {
      const balance = balanceFrom(ledger([
        { entry_kind: "grant", amount_minor: 1000 },
        { entry_kind: "draw", amount_minor: 250 },
        { entry_kind: "refund", amount_minor: 50 },
      ]));
      assert.equal(balance.ok, true);
      assert.equal(balance.balanceMinor, 800);
    });

    it("refuses to compute a balance it had to ignore a row to reach", () => {
      // Skipping an unrecognised row produces a number that looks
      // authoritative while being wrong, and nothing says so. That is the shape
      // of a silent overcharge.
      const balance = balanceFrom(ledger([
        { entry_kind: "grant", amount_minor: 1000 },
        { entry_kind: "mystery", amount_minor: 500 },
      ]));
      assert.equal(balance.ok, false);
      assert.equal(balance.code, "unknown_entry_kind");
      assert.equal(balance.balanceMinor, null, "a balance must not be reported alongside an error");
    });

    it("refuses a negative or unreadable amount rather than netting it off", () => {
      for (const amount of [-100, "abc", null, undefined, NaN]) {
        const balance = balanceFrom(ledger([{ entry_kind: "grant", amount_minor: amount }]));
        assert.equal(balance.ok, false, `amount ${String(amount)} must not be summed`);
      }
    });

    it("takes direction from the entry kind, not from the caller", () => {
      // A grant that debits or a draw that credits would be a silent accounting
      // error, so the sign is not the caller's to pass in.
      assert.equal(ENTRY_KINDS.grant.direction, 1);
      assert.equal(ENTRY_KINDS.draw.direction, -1);
      for (const [kind, entry] of Object.entries(ENTRY_KINDS)) {
        assert.ok(entry.direction === 1 || entry.direction === -1, `${kind} has no usable direction`);
      }
    });
  });

  describe("writing a draw", () => {
    it("refuses to write an entry belonging to no organization", () => {
      assert.throws(
        () => drawEntry({ capability: "telephony", units: 5, idempotencyKey: "k" }),
        /organizationId/,
        "an untenanted ledger row is money nobody is charged for"
      );
    });

    it("refuses to write without an idempotency key, because a retry would charge twice", () => {
      assert.throws(
        () => drawEntry({ capability: "telephony", units: 5, organizationId: "org-1" }),
        /idempotencyKey/
      );
    });

    it("records cost and margin alongside the charge", () => {
      const written = drawEntry({ capability: "telephony", units: 10, organizationId: "org-1", idempotencyKey: "k1" });
      assert.equal(written.ok, true);
      assert.equal(written.row.entry_kind, "draw");
      assert.equal(written.row.organization_id, "org-1");
      assert.equal(written.row.amount_minor, quote("telephony", 10).chargeMinor);
      assert.ok(written.row.margin_minor > 0, "a draw that records no margin cannot be reconciled against the cost floor");
      assert.equal(written.row.cost_minor, quote("telephony", 10).costMinor);
    });

    it("can draw less than was authorised", () => {
      // A video that failed at second three of a hundred should draw three.
      // Authorising and charging in one step would charge for the hundred.
      const authorised = authoriseUsage({
        capability: "media_generation",
        units: 100,
        history: ledger([{ entry_kind: "grant", amount_minor: 5000 }]),
        idempotencyKey: "k2",
      });
      const written = drawEntry({ capability: "media_generation", units: 3, organizationId: "org-1", idempotencyKey: "k2" });

      assert.equal(authorised.allowed, true);
      assert.ok(
        written.row.amount_minor <= authorised.drawMinor,
        "a draw must never exceed what was authorised"
      );
    });
  });
});
