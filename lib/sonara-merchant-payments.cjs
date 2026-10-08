// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What it takes for a storefront order to be paid, and for the owner to know the
// payments they have recorded are the payments Stripe took.
//
// The Business Builder storefront (lib/sonara-merchant-storefront.cjs) prices an
// order from rows the server read and records it. This module decides everything
// after that: whether the order can be paid now, what Stripe is asked to charge,
// what a verified Stripe event means for it, and -- the half the owner sees -- how
// the orders compare with Stripe's own record of the same payments.
//
// It follows the commerce contract in docs/CODEX_HANDOFF_SKILLS_FORMULAS_AGENTS.md
// section 12, the same one lib/sonara-marketplace-orders.cjs follows: direct
// charges on the shop's connected account, no application fee, fulfilment only
// from Stripe's word, refunds recorded and never issued.
//
// ## The invariants
//
// **1. The amount charged is the amount the order recorded.** The Checkout line
// items are the order's own lines, which were priced from the catalogue and frozen;
// `payDecision` refuses to open a checkout when they no longer add up to the
// subtotal, rather than charge a figure nobody agreed to.
//
// **2. Only Stripe's word pays an order.** `eventDecision` compares the connected
// account, the order id in two places, the amount and the currency before it says
// `pay`. The receipt page reads the order; landing on it changes nothing.
//
// **3. A buyer pays once.** Opening a new checkout expires the previous one first
// (the route does that, on the decision's instruction). If an earlier checkout
// completes anyway, that payment is not lost and not silently merged: it is
// reported as a duplicate so the owner can refund it.
//
// **4. Reconciliation never claims more than it read.** If Stripe's list was cut
// short, an order Stripe "did not mention" is reported as unverified rather than
// as missing at Stripe. A fee Stripe did not report is unknown, not zero.

const crypto = require("node:crypto");
const { databaseAmount, addKnownAmounts } = require("./sonara-commerce-amounts.cjs");

const PAYMENT_STATES = Object.freeze(["unpaid", "checkout_open", "processing", "paid", "refunded", "disputed"]);
const SETTLED_STATES = Object.freeze(["paid", "refunded", "disputed"]);
// Stripe's minimum Checkout expiry. The order's own checkout_expires_at is the
// session's, so the receipt page can say honestly when the link stops working.
const CHECKOUT_SECONDS = 30 * 60;
// A session this close to expiring is not handed to a buyer: they would be sent to
// a page that closes while they type.
const REUSE_MARGIN_SECONDS = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT = /^acct_[A-Za-z0-9]{8,}$/;
const SESSION = /^cs_(test|live)_[A-Za-z0-9]+$/;
const INTENT = /^pi_[A-Za-z0-9]{8,}$/;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const KIND = "merchant_order";

function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

// ---------------------------------------------------------------------------
// The buyer's receipt token
// ---------------------------------------------------------------------------

/** A fresh token for the buyer, and the hash that is all the database keeps. */
function newBuyerToken() {
  const token = crypto.randomBytes(24).toString("base64url");
  return { token, hash: crypto.createHash("sha256").update(token).digest("hex") };
}

/** The hash of a token as presented, or null if it is not shaped like one of ours. */
function hashToken(token) {
  const text = String(token || "");
  if (!TOKEN.test(text)) return null;
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ---------------------------------------------------------------------------
// Whether the order can be paid now
// ---------------------------------------------------------------------------

function cents(value) {
  return databaseAmount(value);
}

/**
 * `{ ok, action }` where action is `open` (start a checkout, expiring
 * `expirePrevious` first if it names one) or `reuse` (send the buyer to `url`), or
 * `{ ok: false, code, sentence }`. Re-read every time; nothing here trusts the page
 * the buyer pressed a button on.
 */
function payDecision({ order, lines, payment, now = new Date() } = {}) {
  if (!order) return refusal("not_found", "There is no order of yours at this address.");
  if (order.status === "cancelled") {
    return refusal("cancelled", "The shop cancelled this order, so it cannot be paid. Nothing has been charged.");
  }
  if (SETTLED_STATES.includes(order.payment_state)) {
    return refusal("already_paid", "This order is already paid. Nothing more is owed.");
  }
  if (order.payment_state === "processing") {
    return refusal("processing", "Your payment is already on its way. Some payment methods take a few days to clear; you do not need to pay again.");
  }
  const subtotal = cents(order.subtotal_cents);
  if (!subtotal || subtotal <= 0) {
    return refusal("nothing_to_pay", "This order has no amount to pay. Contact the shop.");
  }
  const currency = String(order.currency || "").toLowerCase();
  const rows = Array.isArray(lines) ? lines : [];
  const total = rows.reduce((sum, line) => sum + (cents(line.line_total_cents) ?? NaN), 0);
  const agree = rows.length > 0
    && total === subtotal
    && rows.every((line) => String(line.currency || "").toLowerCase() === currency
      && cents(line.quantity) > 0
      && cents(line.unit_price_cents) > 0
      && cents(line.unit_price_cents) * cents(line.quantity) === cents(line.line_total_cents));
  if (!agree) {
    // Refused rather than charged at the subtotal: the buyer is owed a receipt
    // whose lines add up, and a checkout whose items do not match its total is the
    // thing nobody can argue with afterwards.
    return refusal("lines_disagree", "We could not check what is in this order against its total, so it cannot be paid online. Nothing has been charged -- contact the shop.");
  }
  if (!payment || payment.ok !== true || !ACCOUNT.test(String(payment.accountId || ""))) {
    return refusal("shop_cannot_take_payment", "The shop cannot take payments online right now. Nothing has been charged -- the shop can tell you another way to pay.");
  }

  if (order.payment_state === "checkout_open" && order.checkout_session_id) {
    const expires = new Date(order.checkout_expires_at || 0).getTime();
    if (order.checkout_url && Number.isFinite(expires) && expires > now.getTime() + REUSE_MARGIN_SECONDS * 1000) {
      return Object.freeze({ ok: true, action: "reuse", url: order.checkout_url });
    }
    return Object.freeze({ ok: true, action: "open", expirePrevious: order.checkout_session_id, accountId: payment.accountId });
  }
  return Object.freeze({ ok: true, action: "open", expirePrevious: null, accountId: payment.accountId });
}

function refusal(code, sentence) {
  return Object.freeze({ ok: false, code, sentence });
}

/**
 * The Checkout Session fields: the order's own lines, its id in two places, and no
 * application fee. `attempt` makes the idempotency key and the session distinct
 * per attempt, so a retry after an expired checkout is a new session rather than
 * Stripe handing back the expired one.
 */
function checkoutFields({ order, lines, successUrl, cancelUrl, expiresAt }) {
  const fields = {
    mode: "payment",
    client_reference_id: order.id,
    "metadata[sonara_order_id]": order.id,
    "metadata[sonara_kind]": KIND,
    "payment_intent_data[metadata][sonara_order_id]": order.id,
    "payment_intent_data[metadata][sonara_kind]": KIND,
    customer_email: order.buyer_email,
    expires_at: String(Math.floor(new Date(expiresAt).getTime() / 1000)),
    success_url: successUrl,
    cancel_url: cancelUrl
  };
  lines.forEach((line, index) => {
    fields[`line_items[${index}][quantity]`] = String(line.quantity);
    fields[`line_items[${index}][price_data][currency]`] = String(line.currency).toLowerCase();
    fields[`line_items[${index}][price_data][unit_amount]`] = String(line.unit_price_cents);
    fields[`line_items[${index}][price_data][product_data][name]`] = String(line.description).slice(0, 250);
  });
  return Object.freeze(fields);
}

// ---------------------------------------------------------------------------
// What a verified Stripe event means
// ---------------------------------------------------------------------------

const ignore = (code) => Object.freeze({ action: "ignore", code });

/**
 * `{ action, code, ... }`. Actions: pay, processing, reopen, refund,
 * partial_refund, dispute, duplicate, confirm, ignore.
 *
 * Called only after the signature is verified, or with a session the server read
 * from Stripe itself. A genuine event is still compared field by field: a valid
 * signature says Stripe sent it, not that it is about this order.
 */
function eventDecision({ event, order } = {}) {
  if (!order) return ignore("no_order");
  const object = event?.data?.object || {};
  const type = String(event?.type || "");
  if (!event?.account || event.account !== order.stripe_account_id) return ignore("account_mismatch");

  if (type.startsWith("checkout.session.")) {
    if (!SESSION.test(String(object.id || ""))) return ignore("session_unreadable");
    if (object.metadata?.sonara_kind !== KIND || object.metadata?.sonara_order_id !== order.id || object.client_reference_id !== order.id) {
      return ignore("order_mismatch");
    }
    const current = object.id === order.checkout_session_id;

    if (type === "checkout.session.expired") {
      return current && order.payment_state === "checkout_open" ? Object.freeze({ action: "reopen", code: "expired" }) : ignore("stale_session");
    }
    if (type === "checkout.session.async_payment_failed") {
      return current && ["checkout_open", "processing"].includes(order.payment_state)
        ? Object.freeze({ action: "reopen", code: "payment_failed" })
        : ignore("stale_session");
    }
    if (type !== "checkout.session.completed" && type !== "checkout.session.async_payment_succeeded") return ignore("unhandled_type");

    if (String(object.currency || "").toLowerCase() !== String(order.currency || "").toLowerCase()) return ignore("currency_mismatch");
    if (Number(object.amount_total) !== Number(order.subtotal_cents) || !Number.isInteger(object.amount_total)) return ignore("amount_mismatch");
    const intent = intentIdOf(object.payment_intent);

    if (SETTLED_STATES.includes(order.payment_state)) {
      // The same payment again (a retry, or reconciliation repeating the webhook):
      // nothing changes. A *different* payment for an order already paid is money
      // the buyer is owed back, and the owner has to see it.
      if (intent && intent === order.payment_intent_id) return Object.freeze({ action: "confirm", code: "already_paid" });
      return Object.freeze({ action: "duplicate", code: "duplicate_payment", paymentIntentId: intent, amountCents: object.amount_total });
    }
    if (order.status === "cancelled" && object.payment_status === "paid") {
      // Paid after the shop cancelled. Recorded as paid -- the money is real and the
      // owner has to refund it -- and the reconciliation page says so.
      return Object.freeze({ action: "pay", code: "paid_after_cancel", paymentIntentId: intent, amountCents: object.amount_total, sessionId: object.id });
    }
    if (object.payment_status !== "paid") {
      return ["unpaid", "checkout_open"].includes(order.payment_state)
        ? Object.freeze({ action: "processing", code: "not_yet_paid", sessionId: object.id })
        : ignore("not_yet_paid");
    }
    if (!intent) return ignore("no_payment_intent");
    return Object.freeze({ action: "pay", code: current ? "paid" : "paid_earlier_attempt", paymentIntentId: intent, amountCents: object.amount_total, sessionId: object.id });
  }

  if (type === "charge.refunded" || type === "charge.dispute.created") {
    const intent = intentIdOf(object.payment_intent);
    if (!order.payment_intent_id || intent !== order.payment_intent_id) return ignore("intent_mismatch");
    if (type === "charge.dispute.created") {
      return ["paid", "refunded"].includes(order.payment_state) ? Object.freeze({ action: "dispute", code: "disputed" }) : ignore("not_settled");
    }
    const refunded = cents(object.amount_refunded);
    if (refunded === null || !["paid", "refunded"].includes(order.payment_state)) return ignore("not_settled");
    // Cumulative, and only ever rises: an older event arriving late must not
    // shrink what has been refunded.
    if (refunded <= (cents(order.refunded_cents) || 0)) return ignore("refund_not_newer");
    if (refunded > (cents(order.amount_paid_cents) ?? Number(order.subtotal_cents))) return ignore("refund_exceeds_payment");
    return Object.freeze({ action: object.refunded === true ? "refund" : "partial_refund", code: object.refunded === true ? "refunded" : "partially_refunded", refundedCents: refunded });
  }
  return ignore("unhandled_type");
}

function intentIdOf(value) {
  const id = typeof value === "string" ? value : value?.id;
  return INTENT.test(String(id || "")) ? id : null;
}

/** What the buyer's receipt says about the money, from the order alone. */
function receiptSentence(order) {
  const refunded = cents(order?.refunded_cents) || 0;
  return ({
    unpaid: "Not paid yet. Nothing has been charged.",
    checkout_open: "A checkout is open for this order. Nothing is charged until you finish paying on Stripe's page.",
    processing: "Your payment is on its way. Some payment methods take a few days to clear; this page changes when it does.",
    paid: refunded > 0 ? "Paid. Part of it has since been refunded; the amounts are below." : "Paid. This page is your receipt.",
    refunded: "Paid, and then refunded in full.",
    disputed: "Paid, and the payment is now disputed with the card issuer."
  })[order?.payment_state] || "We cannot tell whether this order is paid. Contact the shop.";
}

// ---------------------------------------------------------------------------
// Reconciliation: our record against Stripe's
// ---------------------------------------------------------------------------

const FINDINGS = Object.freeze({
  matched: "Recorded here and at Stripe, for the same amount.",
  missed_payment: "Stripe took this payment and this order does not show it as paid. Usually a webhook that never arrived -- record it from Stripe's own record.",
  not_at_stripe: "Recorded here as paid, and Stripe's list for this period has no paid checkout for it. Check it in your Stripe dashboard before relying on it.",
  unverified: "Recorded here as paid. Stripe's list was longer than we read, so this payment could not be checked this time.",
  amount_unknown: "A payment or refund amount is unavailable. Check the records before treating this order as reconciled.",
  currency_mismatch: "The payment currency does not agree with the order currency.",
  amount_mismatch: "Recorded here for a different amount from the one Stripe took.",
  intent_mismatch: "Recorded here against a different Stripe payment from the one Stripe shows.",
  refund_mismatch: "Stripe has refunded a different amount from the one recorded here.",
  duplicate_payment: "Stripe took more than one payment for this order. The buyer is owed a refund for the extra one.",
  paid_after_cancel: "Paid after you cancelled it. The money is real; the buyer is owed a refund or the goods."
});

/**
 * Compare orders with Stripe Checkout Sessions read from the shop's account.
 *
 * `sessions` are as Stripe returns them, with payment_intent.latest_charge
 * .balance_transaction expanded. Only sessions this application created for a
 * storefront order (metadata.sonara_kind) are compared; the rest -- the shop's own
 * Stripe sales, marketplace sales -- are counted and left alone.
 */
function reconcile({ orders = [], sessions = [], truncated = false } = {}) {
  const ours = [];
  let notOurs = 0;
  for (const session of sessions) {
    if (session?.metadata?.sonara_kind === KIND && isUuid(session?.metadata?.sonara_order_id)) ours.push(session);
    else notOurs += 1;
  }
  const paidByOrder = new Map();
  for (const session of ours) {
    if (session.payment_status !== "paid") continue;
    const list = paidByOrder.get(session.metadata.sonara_order_id) || [];
    list.push(session);
    paidByOrder.set(session.metadata.sonara_order_id, list);
  }

  const rows = [];
  const byId = new Map(orders.map((order) => [order.id, order]));
  const ids = new Set([...orders.filter((order) => SETTLED_STATES.includes(order.payment_state)).map((order) => order.id), ...paidByOrder.keys()]);
  for (const id of ids) {
    const order = byId.get(id) || null;
    const paid = paidByOrder.get(id) || [];
    const stripe = paid[0] || null;
    const charge = stripe?.payment_intent?.latest_charge || null;
    const stripeRefunded = cents(charge?.amount_refunded);
    const stripeAmount = cents(stripe?.amount_total);
    const stripeCurrency = String(stripe?.currency || "").toLowerCase();
    const orderCurrency = String(order?.currency || "").toLowerCase();
    let finding;
    if (!order) finding = "missed_payment";
    else if (paid.length > 1) finding = "duplicate_payment";
    else if (!stripe) finding = truncated ? "unverified" : "not_at_stripe";
    else if (stripeAmount === null || stripeRefunded === null) finding = "amount_unknown";
    else if (!/^[a-z]{3}$/.test(stripeCurrency) || stripeCurrency !== orderCurrency) finding = "currency_mismatch";
    else if (!SETTLED_STATES.includes(order.payment_state)) finding = "missed_payment";
    else if (cents(order.amount_paid_cents) === null || cents(order.refunded_cents) === null) finding = "amount_unknown";
    else if (stripeAmount !== cents(order.amount_paid_cents)) finding = "amount_mismatch";
    else if (intentIdOf(stripe.payment_intent) !== order.payment_intent_id) finding = "intent_mismatch";
    else if (stripeRefunded !== cents(order.refunded_cents)) finding = "refund_mismatch";
    else if (order.status === "cancelled") finding = "paid_after_cancel";
    else finding = "matched";
    rows.push(Object.freeze({
      orderId: id,
      order,
      finding,
      sentence: FINDINGS[finding],
      // Only a payment Stripe holds and this order lacks can be repaired from here.
      repairable: finding === "missed_payment" && Boolean(order) && paid.length === 1,
      sessionId: stripe?.id || null,
      stripeAmountCents: stripeAmount,
      stripeRefundedCents: stripe ? stripeRefunded : null,
      currency: String(stripe?.currency || order?.currency || "").toLowerCase()
    }));
  }

  // Totals per currency. Stripe's side from the sessions; ours from the orders.
  // A fee Stripe did not report makes the fee total unknown rather than smaller.
  const totals = new Map();
  const bucket = (currency) => {
    if (!totals.has(currency)) {
      totals.set(currency, { currency, stripeGross: 0, stripeRefunded: 0, stripeFees: 0, stripeNet: 0, feesKnown: true, recordedPaid: 0, recordedRefunded: 0, payments: 0 });
    }
    return totals.get(currency);
  };
  for (const list of paidByOrder.values()) {
    for (const session of list) {
      const total = bucket(String(session.currency || "").toLowerCase());
      total.payments += 1;
      total.stripeGross = addKnownAmounts(total.stripeGross, cents(session.amount_total));
      const charge = session.payment_intent?.latest_charge || null;
      total.stripeRefunded = addKnownAmounts(total.stripeRefunded, cents(charge?.amount_refunded));
      const balance = charge?.balance_transaction;
      if (balance && Number.isSafeInteger(balance.fee) && balance.fee >= 0 && Number.isSafeInteger(balance.net)
          && /^[a-z]{3}$/.test(total.currency) && balance.currency === total.currency) {
        total.stripeFees = addKnownAmounts(total.stripeFees, balance.fee);
        total.stripeNet = addKnownAmounts(total.stripeNet, balance.net);
        if (total.stripeFees === null || total.stripeNet === null) total.feesKnown = false;
      } else {
        total.feesKnown = false;
      }
    }
  }
  for (const order of orders) {
    if (!SETTLED_STATES.includes(order.payment_state)) continue;
    const total = bucket(String(order.currency || "").toLowerCase());
    total.recordedPaid = addKnownAmounts(total.recordedPaid, cents(order.amount_paid_cents));
    total.recordedRefunded = addKnownAmounts(total.recordedRefunded, cents(order.refunded_cents));
  }

  const counts = {};
  for (const row of rows) counts[row.finding] = (counts[row.finding] || 0) + 1;
  return Object.freeze({
    rows: Object.freeze(rows.sort((a, b) => (a.finding === "matched") - (b.finding === "matched"))),
    totals: Object.freeze([...totals.values()].map((total) => Object.freeze({ ...total, stripeFees: total.feesKnown ? total.stripeFees : null, stripeNet: total.feesKnown ? total.stripeNet : null }))),
    counts: Object.freeze(counts),
    truncated: Boolean(truncated),
    notOurs,
    compared: ours.length
  });
}

module.exports = {
  PAYMENT_STATES,
  SETTLED_STATES,
  CHECKOUT_SECONDS,
  REUSE_MARGIN_SECONDS,
  FINDINGS,
  KIND,
  isUuid,
  newBuyerToken,
  hashToken,
  payDecision,
  checkoutFields,
  eventDecision,
  receiptSentence,
  reconcile
};
