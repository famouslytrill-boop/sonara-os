"use strict";

// What is still owed, and the four ways that number lies.
//
// The product has known an invoice's total since customer_invoices landed and
// has never known its balance, so a business that took a deposit showed its
// customer the whole figure again. Every assertion here is about a figure a
// customer reads and acts on, which is why the failure directions are tested
// as hard as the happy path.
//
// The four lies, each with a test:
//
//   an unread payments table rendering as "nothing has been paid"
//   a payment with no amount counted as a payment of zero
//   an overpayment clamped to zero and rendered as "paid in full"
//   a payment attached to no invoice silently dropped

const assert = require("node:assert/strict");
const { STATUSES, totalPaid, settle, byInvoice, describe: describeSettlement } = require("../lib/sonara-invoice-settlement.cjs");

const money = (cents, currency) => `${String(currency).toUpperCase()} ${(Number(cents) / 100).toFixed(2)}`;
const INVOICE = { id: "inv-1", total_cents: 144000, currency: "gbp" };

describe("what is still owed on an invoice", () => {
  it("names every status it can return, so none is outside these tests", () => {
    assert.deepEqual([...STATUSES].sort(), ["outstanding", "overpaid", "paid", "part_paid", "unknown", "unpriced"].sort());
  });

  describe("adding up what came in", () => {
    it("adds the amounts", () => {
      assert.deepEqual(totalPaid([{ amount_cents: 1000 }, { amount_cents: 2500 }]), { cents: 3500, unreadable: 0 });
    });

    it("counts a payment with no amount as unreadable, never as zero", () => {
      // A payment of an unknown amount is not a payment of nothing, and
      // treating it as nothing shows a customer a balance that is too high.
      const result = totalPaid([{ amount_cents: 1000 }, { amount_cents: null }, { amount_cents: "" }]);
      assert.equal(result.cents, 1000);
      assert.equal(result.unreadable, 2);
    });

    it("keeps a zero payment as a real zero", () => {
      assert.deepEqual(totalPaid([{ amount_cents: 0 }]), { cents: 0, unreadable: 0 });
    });
  });

  describe("when nothing has been paid", () => {
    it("says the whole total is owed", () => {
      const result = settle({ invoice: INVOICE, payments: [] });
      assert.equal(result.status, "outstanding");
      assert.equal(result.outstandingCents, 144000);
      assert.equal(result.paidCents, 0);
      assert.equal(result.certain, true);
    });
  });

  describe("when the payments could not be read", () => {
    it("refuses to say what is owed", () => {
      const result = settle({ invoice: INVOICE, payments: [], paymentsRead: false });
      assert.equal(result.status, "unknown");
      assert.equal(result.outstandingCents, null, "an unread payments table rendered as a balance");
      assert.equal(result.paidCents, null, "and as nothing having been paid");
      assert.equal(result.certain, false);
      assert.match(result.note, /could not check/i);
    });

    it("still reports the total, which it does know", () => {
      assert.equal(settle({ invoice: INVOICE, payments: [], paymentsRead: false }).totalCents, 144000);
    });

    it("reads differently from an invoice nobody has paid", () => {
      const unread = settle({ invoice: INVOICE, payments: [], paymentsRead: false });
      const unpaid = settle({ invoice: INVOICE, payments: [] });
      assert.notEqual(unread.status, unpaid.status, "'no answer' and 'nobody has paid' render identically");
      assert.notEqual(describeSettlement(unread, money), describeSettlement(unpaid, money));
    });
  });

  describe("when some has been paid", () => {
    it("subtracts it", () => {
      const result = settle({ invoice: INVOICE, payments: [{ amount_cents: 44000 }] });
      assert.equal(result.status, "part_paid");
      assert.equal(result.outstandingCents, 100000);
      assert.match(describeSettlement(result, money), /GBP 440\.00 received, GBP 1000\.00 still owed/);
    });

    it("settles exactly at the total", () => {
      const result = settle({ invoice: INVOICE, payments: [{ amount_cents: 100000 }, { amount_cents: 44000 }] });
      assert.equal(result.status, "paid");
      assert.equal(result.outstandingCents, 0);
      assert.equal(describeSettlement(result, money), "Paid in full.");
    });
  });

  describe("when too much has been paid", () => {
    it("says so rather than clamping it to settled", () => {
      // chase-drafts clamps this away on purpose -- an overpaid invoice is not
      // one to chase. On a statement it is a refund somebody owes, and an
      // invoice rendering as "paid" is how it stays unnoticed.
      const result = settle({ invoice: INVOICE, payments: [{ amount_cents: 150000 }] });
      assert.equal(result.status, "overpaid");
      assert.equal(result.overpaidCents, 6000);
      assert.equal(result.outstandingCents, 0);
      assert.match(describeSettlement(result, money), /Overpaid by GBP 60\.00.*owes this back/);
    });
  });

  describe("when a payment has no amount on it", () => {
    it("does not claim the figure is certain", () => {
      const result = settle({ invoice: INVOICE, payments: [{ amount_cents: 44000 }, { amount_cents: null }] });
      assert.equal(result.certain, false);
      assert.match(result.note, /no amount recorded/);
      // The balance is still shown, because it is a real upper bound. It is the
      // confidence that changes, not the arithmetic.
      assert.equal(result.outstandingCents, 100000);
    });

    it("does not say paid in full without qualifying it", () => {
      const result = settle({ invoice: INVOICE, payments: [{ amount_cents: 144000 }, { amount_cents: null }] });
      assert.equal(result.status, "paid");
      assert.notEqual(describeSettlement(result, money), "Paid in full.", "an unqualified 'paid in full' on a figure that is not certain");
      assert.match(describeSettlement(result, money), /no amount recorded/);
    });
  });

  describe("when the invoice has no total", () => {
    it("works out no balance rather than treating it as free", () => {
      for (const total of [null, undefined, "", "later"]) {
        const result = settle({ invoice: { id: "x", total_cents: total }, payments: [] });
        assert.equal(result.status, "unpriced", `${JSON.stringify(total)} was treated as a total`);
        assert.equal(result.outstandingCents, null);
      }
      // Zero is a real total, and an invoice for nothing is settled.
      assert.equal(settle({ invoice: { id: "x", total_cents: 0 }, payments: [] }).status, "paid");
    });
  });

  describe("grouping payments", () => {
    it("puts each payment against its invoice", () => {
      const { map } = byInvoice([
        { invoice_id: "a", amount_cents: 100 },
        { invoice_id: "b", amount_cents: 200 },
        { invoice_id: "a", amount_cents: 300 }
      ]);
      assert.equal(map.get("a").length, 2);
      assert.equal(map.get("b").length, 1);
    });

    it("reports a payment attached to nothing rather than dropping it", () => {
      // Money the business has that no invoice knows about. Silently ignoring
      // it is how a reconciliation goes wrong in the direction nobody notices.
      const { map, unattached } = byInvoice([{ invoice_id: null, amount_cents: 500 }, { invoice_id: "a", amount_cents: 100 }]);
      assert.equal(unattached.length, 1);
      assert.equal(map.size, 1);
    });
  });
});
