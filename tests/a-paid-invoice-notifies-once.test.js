"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const notice = require("../lib/sonara-invoice-paid-notice.cjs");

// A fake PostgREST that answers the two reads announcePayment makes.
//
// Built from a table of rows rather than a queue of responses, so a test that
// changes the order of the reads does not silently start asserting nothing.
function supabase({ invoices = [], payments = [], fail = null } = {}) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url) => {
      calls.push(url);
      const which = url.includes("customer_invoice_payments") ? "payments" : "invoices";
      if (fail === which) return { ok: false, status: 500 };
      const rows = which === "payments" ? payments : invoices;
      return { ok: true, json: async () => rows };
    }
  };
}

const DEPS = {
  supabaseUrl: "https://example.supabase.co",
  serviceRoleHeaders: () => ({ apikey: "k" }),
  getEnv: () => ""
};

const ORG = "11111111-1111-4111-8111-111111111111";
const INVOICE = "22222222-2222-4222-8222-222222222222";
const FIRST = "33333333-3333-4333-8333-333333333333";
const SECOND = "44444444-4444-4444-8444-444444444444";

function recorder() {
  const sent = [];
  return {
    sent,
    notify: async (_deps, message) => {
      sent.push(message);
      return { ok: true, considered: 2, sent: 2, removed: 0, failures: [] };
    }
  };
}

describe("a payment that settles an invoice", () => {
  const invoice = { id: INVOICE, invoice_number: "INV-7", total_cents: 5000, currency: "gbp" };

  it("sends invoice_paid when the last payment covers the total", async () => {
    const db = supabase({
      invoices: [invoice],
      payments: [{ id: FIRST, amount_cents: 2000 }, { id: SECOND, amount_cents: 3000 }]
    });
    const push = recorder();
    const result = await notice.announcePayment(
      DEPS,
      { organizationId: ORG, invoiceId: INVOICE, paymentId: SECOND },
      { fetchImpl: db.fetchImpl, notify: push.notify }
    );

    assert.equal(result.notified, true, result.reason);
    assert.equal(push.sent.length, 1);
    assert.equal(push.sent[0].topic, "invoice_paid");
    assert.equal(push.sent[0].organizationId, ORG);
    assert.match(push.sent[0].payload.body, /INV-7/);
    assert.equal(push.sent[0].payload.path, `/business-builder/owner/invoices/${INVOICE}`);
  });

  // The reason this is a transition rather than a state. Without it, every
  // later payment on a settled invoice announces it again, and a notification
  // that repeats is a notification people switch off.
  it("stays quiet when the invoice was already covered before this payment", async () => {
    const db = supabase({
      invoices: [invoice],
      payments: [{ id: FIRST, amount_cents: 5000 }, { id: SECOND, amount_cents: 1000 }]
    });
    const push = recorder();
    const result = await notice.announcePayment(
      DEPS,
      { organizationId: ORG, invoiceId: INVOICE, paymentId: SECOND },
      { fetchImpl: db.fetchImpl, notify: push.notify }
    );

    assert.equal(result.notified, false);
    assert.equal(result.reason, "already_settled");
    assert.equal(push.sent.length, 0);
  });

  it("stays quiet while money is still owed", async () => {
    const db = supabase({ invoices: [invoice], payments: [{ id: FIRST, amount_cents: 2000 }] });
    const push = recorder();
    const result = await notice.announcePayment(
      DEPS,
      { organizationId: ORG, invoiceId: INVOICE, paymentId: FIRST },
      { fetchImpl: db.fetchImpl, notify: push.notify }
    );

    assert.equal(result.notified, false);
    assert.equal(result.reason, "still_owed");
    assert.equal(push.sent.length, 0);
  });

  // An overpayment IS a payment, and the business owes the difference back.
  // Both halves are asserted: that it announces, and that it says so.
  it("announces an overpayment and names the amount owed back", async () => {
    const db = supabase({ invoices: [invoice], payments: [{ id: FIRST, amount_cents: 6000 }] });
    const push = recorder();
    const result = await notice.announcePayment(
      DEPS,
      { organizationId: ORG, invoiceId: INVOICE, paymentId: FIRST },
      { fetchImpl: db.fetchImpl, notify: push.notify }
    );

    assert.equal(result.notified, true, result.reason);
    assert.match(push.sent[0].payload.body, /owed back/);
    assert.match(push.sent[0].payload.body, /10\.00/);
  });

  // "unpriced": total_cents is null. Number(null) is 0 and finite, which would
  // make an invoice with no total read as settled by any payment at all --
  // exactly the absent-read-as-zero defect this repository keeps finding.
  it("never announces an invoice that has no total on it", async () => {
    const db = supabase({
      invoices: [{ id: INVOICE, invoice_number: "INV-8", total_cents: null, currency: "gbp" }],
      payments: [{ id: FIRST, amount_cents: 100 }]
    });
    const push = recorder();
    const result = await notice.announcePayment(
      DEPS,
      { organizationId: ORG, invoiceId: INVOICE, paymentId: FIRST },
      { fetchImpl: db.fetchImpl, notify: push.notify }
    );

    assert.equal(result.notified, false);
    assert.equal(result.reason, "still_owed");
    assert.equal(push.sent.length, 0);
  });

  describe("refusing rather than guessing", () => {
    for (const [name, broken, reason] of [
      ["the invoice cannot be read", { fail: "invoices" }, "invoice_unreadable"],
      ["the payments cannot be read", { fail: "payments" }, "payments_unreadable"]
    ]) {
      it(`says nothing when ${name}`, async () => {
        const db = supabase({ invoices: [invoice], payments: [{ id: FIRST, amount_cents: 9000 }], ...broken });
        const push = recorder();
        const result = await notice.announcePayment(
          DEPS,
          { organizationId: ORG, invoiceId: INVOICE, paymentId: FIRST },
          { fetchImpl: db.fetchImpl, notify: push.notify }
        );
        assert.equal(result.ok, false);
        assert.equal(result.reason, reason);
        assert.equal(push.sent.length, 0, "a failed read must not send");
      });
    }

    it("says nothing when the invoice belongs to another organization", async () => {
      const db = supabase({ invoices: [], payments: [{ id: FIRST, amount_cents: 9000 }] });
      const push = recorder();
      const result = await notice.announcePayment(
        DEPS,
        { organizationId: ORG, invoiceId: INVOICE, paymentId: FIRST },
        { fetchImpl: db.fetchImpl, notify: push.notify }
      );
      assert.equal(result.reason, "invoice_not_found");
      assert.equal(push.sent.length, 0);
    });

    // Without the inserted row's id there is no "before" to compare against,
    // and the choice is between sending possibly-again and not sending.
    it("says nothing when the payment that triggered it cannot be identified", async () => {
      const db = supabase({ invoices: [invoice], payments: [{ id: FIRST, amount_cents: 9000 }] });
      const push = recorder();
      const result = await notice.announcePayment(
        DEPS,
        { organizationId: ORG, invoiceId: INVOICE, paymentId: null },
        { fetchImpl: db.fetchImpl, notify: push.notify }
      );
      assert.equal(result.reason, "no_payment_id");
      assert.equal(push.sent.length, 0);
    });

    it("says nothing when the saved payment is not in the payments it read back", async () => {
      const db = supabase({ invoices: [invoice], payments: [{ id: FIRST, amount_cents: 9000 }] });
      const push = recorder();
      const result = await notice.announcePayment(
        DEPS,
        { organizationId: ORG, invoiceId: INVOICE, paymentId: SECOND },
        { fetchImpl: db.fetchImpl, notify: push.notify }
      );
      assert.equal(result.reason, "payment_not_listed");
      assert.equal(push.sent.length, 0);
    });
  });

  it("scopes both reads to the organization", async () => {
    const db = supabase({ invoices: [invoice], payments: [{ id: FIRST, amount_cents: 5000 }] });
    await notice.announcePayment(
      DEPS,
      { organizationId: ORG, invoiceId: INVOICE, paymentId: FIRST },
      { fetchImpl: db.fetchImpl, notify: recorder().notify }
    );
    assert.equal(db.calls.length, 2, "expected one invoice read and one payments read");
    for (const url of db.calls) {
      assert.match(url, new RegExp(`organization_id=eq\\.${ORG}`), `unscoped read: ${url}`);
    }
  });

  it("keeps a repeat about the same invoice from stacking on the lock screen", () => {
    const payload = notice.paidPayload(invoice, { status: "paid", totalCents: 5000, currency: "gbp", overpaidCents: 0 });
    assert.equal(payload.tag, `invoice-paid-${INVOICE}`);
    assert.ok(payload.title.length <= 80 && payload.body.length <= 240);
  });

  it("formats an amount even when the currency code is one Intl does not know", () => {
    // Intl.NumberFormat throws on an unrecognised currency. Inside a
    // notification path that is a notification nobody receives.
    assert.doesNotThrow(() => notice.money(1250, "zzz"));
    assert.match(notice.money(1250, "zzz"), /12\.50/);
  });
});

describe("the route that records a payment", () => {
  const source = fs.readFileSync(require.resolve("../routes/sonara-last9-routes.cjs"), "utf8");
  const code = source.replace(/^\s*\/\/.*$/gm, "");

  // This is the whole point of the change: notify() existed, was tested, was
  // reachable from a page, and nothing in the application ever called it.
  it("is the thing that actually calls the notification path", () => {
    assert.match(code, /announcePayment\(/, "the payment route must announce a settled invoice");
    assert.match(code, /require\("\.\.\/lib\/sonara-invoice-paid-notice\.cjs"\)/);
  });

  // Un-awaited, the fetch never leaves: this runs as a serverless function and
  // execution can be frozen the moment the response is written.
  it("awaits the announcement rather than firing and forgetting", () => {
    assert.match(code, /await announcePayment\(/);
  });

  it("passes the saved row's own id, not the request body", () => {
    assert.match(code, /paymentId: saved\?\.rows\?\.\[0\]\?\.id/);
  });
});
