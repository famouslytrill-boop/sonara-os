"use strict";

// The decisions behind a storefront order being paid, and checked against Stripe.
//
// lib/sonara-merchant-payments.cjs decides whether an order can be paid, what a
// Stripe event means for it, and how the shop's orders compare with Stripe's own
// record. Each decision is asked here with the input that would make it wrong.
// tests/a-storefront-order-is-paid-on-the-shops-account.test.js drives the same
// chain through the real server, a signed webhook and the tenant guard.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const pay = require("../lib/sonara-merchant-payments.cjs");

const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const ORDER = "33333333-3333-4333-8333-333333333333";
const OTHER_ORDER = "44444444-3333-4333-8333-333333333333";
const ACCOUNT = "acct_shop12345678";
const SESSION = "cs_test_shopsession1";
const INTENT = "pi_shop12345678";
const NOW = new Date("2026-10-06T12:00:00Z");

const LINES = Object.freeze([
  { description: "Mug — Large", quantity: 2, unit_price_cents: 1200, line_total_cents: 2400, currency: "usd" },
  { description: "Tea towel", quantity: 1, unit_price_cents: 600, line_total_cents: 600, currency: "usd" }
]);
const ORDER_ROW = Object.freeze({
  id: ORDER, organization_id: ORG, status: "placed", payment_state: "unpaid", subtotal_cents: 3000, currency: "usd",
  buyer_email: "buyer@example.com", stripe_account_id: ACCOUNT, checkout_session_id: null, checkout_url: null,
  checkout_expires_at: null, checkout_attempts: 0, payment_intent_id: null, amount_paid_cents: null, refunded_cents: 0
});
const PAYABLE = Object.freeze({ ok: true, accountId: ACCOUNT });

const decidePay = (overrides = {}) => pay.payDecision({ order: ORDER_ROW, lines: LINES, payment: PAYABLE, now: NOW, ...overrides });

function sessionEvent(type, object = {}, event = {}) {
  return {
    id: "evt_shop1", type, account: ACCOUNT,
    data: { object: {
      id: SESSION, client_reference_id: ORDER, metadata: { sonara_order_id: ORDER, sonara_kind: "merchant_order" },
      amount_total: 3000, currency: "usd", payment_status: "paid", payment_intent: INTENT, ...object
    } },
    ...event
  };
}
const OPEN = Object.freeze({ ...ORDER_ROW, payment_state: "checkout_open", checkout_session_id: SESSION });
const PAID = Object.freeze({ ...ORDER_ROW, payment_state: "paid", checkout_session_id: SESSION, payment_intent_id: INTENT, amount_paid_cents: 3000, paid_at: "2026-10-06T12:01:00Z" });
const decide = (event, order = OPEN) => pay.eventDecision({ event, order });

describe("a storefront payment is checked against Stripe", () => {
  describe("the buyer's receipt token", () => {
    it("keeps only a hash, and the hash is of the token handed out", () => {
      const { token, hash } = pay.newBuyerToken();
      assert.match(token, /^[A-Za-z0-9_-]{32}$/);
      assert.equal(hash, crypto.createHash("sha256").update(token).digest("hex"));
      assert.equal(pay.hashToken(token), hash);
      assert.notEqual(pay.newBuyerToken().token, token);
    });

    it("refuses to hash anything not shaped like one of ours", () => {
      for (const token of ["", "short", "a".repeat(31), "a".repeat(33), `${"a".repeat(31)}/`, null, undefined]) {
        assert.equal(pay.hashToken(token), null, String(token));
      }
    });
  });

  describe("whether an order can be paid now", () => {
    it("opens a checkout for an unpaid order whose lines add up, on the shop's account", () => {
      assert.deepEqual({ ...decidePay() }, { ok: true, action: "open", expirePrevious: null, accountId: ACCOUNT });
    });

    for (const [why, overrides, code] of [
      ["the shop cancelled it", { order: { ...ORDER_ROW, status: "cancelled" } }, "cancelled"],
      ["it is already paid", { order: PAID }, "already_paid"],
      ["it was refunded", { order: { ...PAID, payment_state: "refunded" } }, "already_paid"],
      ["a delayed payment is on its way", { order: { ...ORDER_ROW, payment_state: "processing" } }, "processing"],
      ["its total is zero", { order: { ...ORDER_ROW, subtotal_cents: 0 }, lines: [] }, "nothing_to_pay"],
      ["its total was never read", { order: { ...ORDER_ROW, subtotal_cents: null } }, "nothing_to_pay"],
      ["its lines no longer add up to its total", { order: { ...ORDER_ROW, subtotal_cents: 2999 } }, "lines_disagree"],
      ["a line's quantity times price is not its total", { lines: [{ ...LINES[0], line_total_cents: 2500 }, LINES[1]], order: { ...ORDER_ROW, subtotal_cents: 3100 } }, "lines_disagree"],
      ["a line is in another currency", { lines: [LINES[0], { ...LINES[1], currency: "eur" }] }, "lines_disagree"],
      ["it has no lines at all", { lines: [] }, "lines_disagree"],
      ["a line's price was never read", { lines: [{ ...LINES[0], unit_price_cents: null }, LINES[1]] }, "lines_disagree"],
      ["the shop's Stripe account cannot take charges", { payment: { ok: false, code: "charges_disabled" } }, "shop_cannot_take_payment"],
      ["the account id is not one", { payment: { ok: true, accountId: "acct_" } }, "shop_cannot_take_payment"]
    ]) {
      it(`refuses when ${why}`, () => {
        const decision = decidePay(overrides);
        assert.equal(decision.ok, false);
        assert.equal(decision.code, code);
        assert.match(decision.sentence, /\w/);
      });
    }

    it("hands back an open checkout with time left on it, rather than opening a second", () => {
      const open = { ...OPEN, checkout_url: "https://checkout.stripe.com/c/pay/x", checkout_expires_at: "2026-10-06T12:20:00Z" };
      assert.deepEqual({ ...decidePay({ order: open }) }, { ok: true, action: "reuse", url: open.checkout_url });
    });

    it("expires a checkout about to run out before opening the next one", () => {
      const nearly = { ...OPEN, checkout_url: "https://checkout.stripe.com/c/pay/x", checkout_expires_at: "2026-10-06T12:01:00Z" };
      const decision = decidePay({ order: nearly });
      assert.equal(decision.action, "open");
      assert.equal(decision.expirePrevious, SESSION);
    });
  });

  describe("what Stripe is asked to charge", () => {
    const fields = pay.checkoutFields({ order: ORDER_ROW, lines: LINES, successUrl: "https://s/r", cancelUrl: "https://s/r", expiresAt: "2026-10-06T12:30:00Z" });

    it("charges the order's own lines, and takes no commission", () => {
      assert.equal(fields["line_items[0][price_data][unit_amount]"], "1200");
      assert.equal(fields["line_items[0][quantity]"], "2");
      assert.equal(fields["line_items[1][price_data][unit_amount]"], "600");
      assert.equal(fields["line_items[2][quantity]"], undefined);
      assert.ok(Object.keys(fields).length >= 15, "no fields; this check has gone blind");
      assert.deepEqual(Object.keys(fields).filter((key) => /application_fee|transfer_data|on_behalf_of/.test(key)), []);
    });

    it("names the order and its kind so the one Connect webhook can route it", () => {
      assert.equal(fields.client_reference_id, ORDER);
      assert.equal(fields["metadata[sonara_order_id]"], ORDER);
      assert.equal(fields["metadata[sonara_kind]"], "merchant_order");
      assert.equal(fields["payment_intent_data[metadata][sonara_kind]"], "merchant_order");
      assert.equal(fields.customer_email, "buyer@example.com");
      assert.equal(fields.expires_at, String(Date.parse("2026-10-06T12:30:00Z") / 1000));
    });
  });

  describe("what a verified Stripe event means", () => {
    it("pays an open order from a completed checkout whose every field matches", () => {
      const decision = decide(sessionEvent("checkout.session.completed"));
      assert.deepEqual([decision.action, decision.code, decision.paymentIntentId, decision.amountCents, decision.sessionId], ["pay", "paid", INTENT, 3000, SESSION]);
    });

    for (const [why, event, code] of [
      ["came from another account", sessionEvent("checkout.session.completed", {}, { account: "acct_someoneelse99" }), "account_mismatch"],
      ["came from the platform account", sessionEvent("checkout.session.completed", {}, { account: undefined }), "account_mismatch"],
      ["is a marketplace checkout", sessionEvent("checkout.session.completed", { metadata: { sonara_order_id: ORDER, sonara_kind: "creator_marketplace" } }), "order_mismatch"],
      ["names another order in metadata", sessionEvent("checkout.session.completed", { metadata: { sonara_order_id: OTHER_ORDER, sonara_kind: "merchant_order" } }), "order_mismatch"],
      ["names another order in client_reference_id", sessionEvent("checkout.session.completed", { client_reference_id: OTHER_ORDER }), "order_mismatch"],
      ["charged a different amount", sessionEvent("checkout.session.completed", { amount_total: 2999 }), "amount_mismatch"],
      ["charged a fractional amount", sessionEvent("checkout.session.completed", { amount_total: 3000.5 }), "amount_mismatch"],
      ["charged in another currency", sessionEvent("checkout.session.completed", { currency: "gbp" }), "currency_mismatch"],
      ["has no session id Stripe would issue", sessionEvent("checkout.session.completed", { id: "not-a-session" }), "session_unreadable"]
    ]) {
      it(`pays nothing for an event that ${why}`, () => {
        const decision = decide(event);
        assert.equal(decision.action, "ignore");
        assert.equal(decision.code, code);
      });
    }

    it("accepts a payment completed on an earlier checkout for the same order, and says so", () => {
      const decision = decide(sessionEvent("checkout.session.completed", { id: "cs_test_earlierattempt" }));
      assert.deepEqual([decision.action, decision.code, decision.sessionId], ["pay", "paid_earlier_attempt", "cs_test_earlierattempt"]);
    });

    it("treats the same payment again as nothing new, and a second payment as money owed back", () => {
      assert.equal(decide(sessionEvent("checkout.session.completed"), PAID).action, "confirm");
      const second = decide(sessionEvent("checkout.session.completed", { id: "cs_test_secondpay", payment_intent: "pi_secondpay1234" }), PAID);
      assert.deepEqual([second.action, second.code, second.paymentIntentId], ["duplicate", "duplicate_payment", "pi_secondpay1234"]);
    });

    it("records a payment made after the shop cancelled, rather than losing the money", () => {
      assert.equal(decide(sessionEvent("checkout.session.completed"), { ...OPEN, status: "cancelled" }).code, "paid_after_cancel");
    });

    it("holds a completed-but-unpaid checkout as processing, never paid", () => {
      assert.equal(decide(sessionEvent("checkout.session.completed", { payment_status: "unpaid" })).action, "processing");
      assert.equal(decide(sessionEvent("checkout.session.async_payment_succeeded"), { ...OPEN, payment_state: "processing" }).action, "pay");
    });

    it("reopens only the current checkout when it expires or its delayed payment fails", () => {
      assert.equal(decide(sessionEvent("checkout.session.expired")).action, "reopen");
      assert.equal(decide(sessionEvent("checkout.session.expired", { id: "cs_test_oldattempt1" })).code, "stale_session");
      assert.equal(decide(sessionEvent("checkout.session.expired"), PAID).action, "ignore");
      assert.equal(decide(sessionEvent("checkout.session.async_payment_failed"), { ...OPEN, payment_state: "processing" }).action, "reopen");
    });

    const charge = (type, object) => ({ id: "evt_shop2", type, account: ACCOUNT, data: { object: { payment_intent: INTENT, ...object } } });

    it("records a partial refund as part of the money back, and a full one as refunded", () => {
      const partial = decide(charge("charge.refunded", { amount_refunded: 1000, refunded: false }), PAID);
      assert.deepEqual([partial.action, partial.refundedCents], ["partial_refund", 1000]);
      const full = decide(charge("charge.refunded", { amount_refunded: 3000, refunded: true }), { ...PAID, refunded_cents: 1000 });
      assert.deepEqual([full.action, full.refundedCents], ["refund", 3000]);
    });

    it("never lets an older refund event shrink what has been refunded, or a refund exceed the payment", () => {
      assert.equal(decide(charge("charge.refunded", { amount_refunded: 1000, refunded: false }), { ...PAID, refunded_cents: 2000 }).code, "refund_not_newer");
      assert.equal(decide(charge("charge.refunded", { amount_refunded: 9000, refunded: true }), PAID).code, "refund_exceeds_payment");
      assert.equal(decide(charge("charge.refunded", { refunded: true }), PAID).code, "not_settled");
    });

    it("marks a dispute, and ignores refunds and disputes on another payment", () => {
      assert.equal(decide(charge("charge.dispute.created", {}), PAID).action, "dispute");
      assert.equal(decide(charge("charge.refunded", { amount_refunded: 3000, refunded: true, payment_intent: "pi_otherpayment1" }), PAID).code, "intent_mismatch");
      assert.equal(decide(charge("charge.refunded", { amount_refunded: 3000, refunded: true }), { ...PAID, payment_intent_id: null }).code, "intent_mismatch");
    });
  });

  describe("reconciliation", () => {
    const stripeSession = (overrides = {}, charge = {}) => ({
      id: SESSION, metadata: { sonara_order_id: ORDER, sonara_kind: "merchant_order" }, payment_status: "paid",
      amount_total: 3000, currency: "usd",
      payment_intent: { id: INTENT, latest_charge: { amount_refunded: 0, balance_transaction: { fee: 117, net: 2883, currency: "usd" }, ...charge } },
      ...overrides
    });
    const run = (orders, sessions, truncated = false) => pay.reconcile({ orders, sessions, truncated });
    const finding = (result, id = ORDER) => result.rows.find((row) => row.orderId === id)?.finding;

    it("agrees when Stripe and the order say the same thing, and totals gross, fee and net", () => {
      const result = run([PAID], [stripeSession()]);
      assert.equal(finding(result), "matched");
      const [total] = result.totals;
      assert.deepEqual([total.stripeGross, total.stripeFees, total.stripeNet, total.recordedPaid, total.payments], [3000, 117, 2883, 3000, 1]);
    });

    it("finds a payment Stripe took that the order does not show, and offers the repair", () => {
      const row = run([OPEN], [stripeSession()]).rows[0];
      assert.equal(row.finding, "missed_payment");
      assert.equal(row.repairable, true);
      assert.equal(row.sessionId, SESSION);
    });

    it("says an order recorded as paid is missing at Stripe only when Stripe's whole list was read", () => {
      assert.equal(finding(run([PAID], [])), "not_at_stripe");
      assert.equal(finding(run([PAID], [], true)), "unverified");
    });

    it("finds a different amount, a different payment, a different refund, and a second payment", () => {
      assert.equal(finding(run([{ ...PAID, amount_paid_cents: 2000 }], [stripeSession()])), "amount_mismatch");
      assert.equal(finding(run([{ ...PAID, payment_intent_id: "pi_otherpayment1" }], [stripeSession()])), "intent_mismatch");
      assert.equal(finding(run([PAID], [stripeSession({}, { amount_refunded: 500 })])), "refund_mismatch");
      const twice = run([PAID], [stripeSession(), stripeSession({ id: "cs_test_secondpay", payment_intent: { id: "pi_secondpay1234", latest_charge: null } })]);
      assert.equal(finding(twice), "duplicate_payment");
      assert.equal(twice.rows[0].repairable, false);
    });

    it("leaves Stripe sales this shop did not open alone, and counts them", () => {
      const result = run([], [stripeSession({ metadata: {} }), stripeSession({ metadata: { sonara_kind: "creator_marketplace", sonara_order_id: ORDER } })]);
      assert.deepEqual([result.rows.length, result.notOurs, result.compared], [0, 2, 0]);
    });

    it("reports a fee it was not told as unknown, not as zero", () => {
      const [total] = run([PAID], [stripeSession({}, { balance_transaction: null })]).totals;
      assert.equal(total.stripeFees, null);
      assert.equal(total.stripeNet, null);
      assert.equal(total.feesKnown, false);
    });

    it("does not reconcile missing or malformed amounts as zero", () => {
      for (const value of [null, undefined, false, "", "oops", -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        const missingRefund = run([PAID], [stripeSession({}, { amount_refunded: value })]);
        assert.equal(finding(missingRefund), "amount_unknown");
        assert.equal(missingRefund.totals[0].stripeRefunded, null);
        const missingGross = run([PAID], [stripeSession({ amount_total: value })]);
        assert.equal(finding(missingGross), "amount_unknown");
        assert.equal(missingGross.totals[0].stripeGross, null);
        const local = run([{ ...PAID, amount_paid_cents: value, refunded_cents: value }], [stripeSession()]);
        assert.equal(finding(local), "amount_unknown");
        assert.equal(local.totals[0].recordedPaid, null);
        assert.equal(local.totals[0].recordedRefunded, null);
        assert.equal(run([OPEN], [stripeSession({ amount_total: value })]).rows[0].repairable, false);
      }
    });

    it("keeps incomplete totals unknown in either row order", () => {
      const unknown = stripeSession({ amount_total: null }, { amount_refunded: null });
      for (const sessions of [[unknown, stripeSession()], [stripeSession(), unknown]]) {
        const [total] = run([PAID], sessions).totals;
        assert.equal(total.stripeGross, null);
        assert.equal(total.stripeRefunded, null);
      }
    });

    it("does not match different currencies or relabel settlement fees", () => {
      assert.equal(finding(run([PAID], [stripeSession({ currency: "eur" })])), "currency_mismatch");
      assert.equal(run([OPEN], [stripeSession({ currency: "eur" })]).rows[0].repairable, false);
      for (const currency of ["eur", "", null]) {
        const [total] = run([PAID], [stripeSession({}, { balance_transaction: { fee: 100, net: 2500, currency } })]).totals;
        assert.equal(total.stripeFees, null);
        assert.equal(total.stripeNet, null);
      }
    });

    it("ignores unpaid checkouts and unpaid orders entirely", () => {
      const result = run([ORDER_ROW], [stripeSession({ payment_status: "unpaid" })]);
      assert.deepEqual([result.rows.length, result.totals.length], [0, 0]);
    });
  });

  describe("the states the code knows are the states the database allows", () => {
    const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261006020000_a_storefront_order_is_paid_on_the_shops_own_account.sql"), "utf8");
    const allowed = (sql.match(/check \(payment_state in \(([^)]*)\)\)/) || [])[1];

    it("reads the check constraint rather than nothing", () => {
      assert.ok(allowed, "could not find the payment_state check; this check has gone blind");
    });

    it("matches PAYMENT_STATES exactly, and the receipt says something true for each", () => {
      assert.deepEqual(allowed.split(",").map((value) => value.trim().replace(/'/g, "")), [...pay.PAYMENT_STATES]);
      for (const state of pay.PAYMENT_STATES) assert.doesNotMatch(pay.receiptSentence({ payment_state: state }), /cannot tell/, state);
    });
  });
});
