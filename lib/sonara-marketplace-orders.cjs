// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What it takes for a marketplace purchase to become a licence somebody holds.
//
// Every decision on the money path lives here. The routes read, write, call
// Stripe and render; they never decide whether a buyer has paid, whether a file
// may be delivered, or whether an event is genuine. docs/COMMERCE_UPLOAD_READINESS.md
// is the specification, and the invariants below are its requirements stated as
// code.
//
// ## The invariants
//
// **1. What was bought is what is delivered.** An order snapshots the listing's
// title, licence, price and currency and the version id; the version's file is a
// pinned copy (creator_version_files) that nothing can replace. `pinDecision`
// refuses to pin a file whose checksum disagrees with the one the version
// recorded.
//
// **2. Only a verified event pays an order.** `fulfilmentDecision` checks the
// event's connected account, session id, order id, amount, currency and payment
// status against the order before it answers `grant`. The success page a buyer
// lands on reads the order; it never grants anything. Every field is compared,
// because each one alone is something a forged or misrouted event could match.
//
// **3. Only the buyer downloads, and only while the grant stands.** `downloadDecision`
// needs the order's buyer, a paid order and an unrevoked grant. A refund or
// dispute revokes; nothing deletes.
//
// **4. An exclusive licence is sold once.** The database's partial unique index
// is the guarantee. The buy route answers its 409 with a sentence for the buyer
// who lost the race, and releases a pending hold only once its checkout expired.
//
// ## What is deliberately not here
//
// No refund. AGENTS.md puts refunds behind owner approval; a refund the seller
// issues in their own Stripe dashboard arrives as an event and is recorded. No
// card data -- this module never sees anything but Stripe identifiers and amounts.
// No commission: the checkout has no application fee, and MARKETPLACE_FEES says
// zero.

const { listingReadiness } = require("./sonara-creator-marketplace.cjs");

const ORDER_STATES = Object.freeze(["pending", "processing", "paid", "payment_failed", "expired", "refunded", "disputed"]);
// Stripe's minimum Checkout expiry is 30 minutes. The order's own expiry is the
// session's, so an exclusive listing held by an abandoned checkout is released
// at the same moment the checkout stops being payable.
const CHECKOUT_SECONDS = 30 * 60;
// How long a delivery link lasts. Long enough to start a download, short enough
// that a link pasted somewhere is not a lasting copy of the work.
const DOWNLOAD_SECONDS = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT = /^acct_[A-Za-z0-9]{8,}$/;
const SESSION = /^cs_(test|live)_[A-Za-z0-9]+$/;

function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

function normalizeChecksum(value) {
  const text = String(value || "").trim().toLowerCase().replace(/^sha256[:-]/, "");
  return /^[a-f0-9]{64}$/.test(text) ? text : null;
}

/**
 * May the asset's current file be pinned to this version?
 *
 * Three answers, because the version may not have recorded a checksum: `match`,
 * `not_recorded` (allowed, and the pin says it was not verified), and refused when
 * both checksums exist and disagree -- that file is not the version that was
 * approved, and selling it would sell something nobody approved.
 */
function pinDecision({ version, assetFile } = {}) {
  if (!assetFile || !assetFile.path) {
    return Object.freeze({ ok: false, code: "no_file", sentence: "This asset has no file attached, so there is nothing to deliver. Attach the file for this version first." });
  }
  const bytes = Number(assetFile.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return Object.freeze({ ok: false, code: "no_file", sentence: "The attached file has no recorded size, so it cannot be delivered as it stands. Attach it again." });
  }
  const recorded = normalizeChecksum(version?.checksum);
  const held = normalizeChecksum(assetFile.sha256);
  if (recorded && held && recorded !== held) {
    return Object.freeze({
      ok: false,
      code: "checksum_mismatch",
      sentence: "The file attached now is not the file this version recorded. Attach the version's own file, or create a new version for this one and have it approved."
    });
  }
  return Object.freeze({
    ok: true,
    verified: Boolean(recorded && held),
    code: recorded && held ? "match" : "not_recorded",
    sentence: recorded && held
      ? "The attached file matches this version's recorded checksum."
      : "This version recorded no checksum to compare against, so the file attached now is pinned as it is."
  });
}

/**
 * Whether this buyer may start a purchase, and the snapshot the order will hold.
 *
 * Re-runs listingReadiness with what was read just now -- never a flag from when
 * the page was drawn -- and requires a pinned delivery file and a connected
 * account that Stripe says can take charges. Every amount, account and
 * organization comes from the server's own reads; the buyer's form supplies only
 * which listing.
 */
function purchaseDecision({ listing, version, approvals, storefrontCurrency, versionFile, payment, buyerUserId, now = new Date() } = {}) {
  if (!isUuid(buyerUserId)) {
    return Object.freeze({ ok: false, code: "sign_in", sentence: "Sign in to buy. A licence is granted to an account, so the download is yours and nobody else's." });
  }
  if (!listing || listing.state !== "listed") {
    return Object.freeze({ ok: false, code: "not_on_sale", sentence: "This is not on sale right now." });
  }
  const readiness = listingReadiness({ listing, version, approvals, storefrontCurrency });
  if (!readiness.ok) {
    return Object.freeze({ ok: false, code: "not_cleared", sentence: "This listing is no longer cleared to sell, so it cannot be bought. Nothing has been charged." });
  }
  if (!versionFile || !versionFile.object_path || versionFile.version_id !== version?.id) {
    return Object.freeze({ ok: false, code: "no_delivery_file", sentence: "The seller has not pinned a file to this version yet, so there would be nothing to deliver. Nothing has been charged." });
  }
  if (!payment || payment.ok !== true || !ACCOUNT.test(String(payment.accountId || ""))) {
    return Object.freeze({ ok: false, code: "seller_cannot_take_payment", sentence: "The seller cannot take payments right now. Nothing has been charged." });
  }
  const priceCents = Number(listing.price_cents);
  const currency = String(listing.currency || "").toLowerCase();
  if (!Number.isInteger(priceCents) || priceCents <= 0 || !/^[a-z]{3}$/.test(currency)) {
    return Object.freeze({ ok: false, code: "not_cleared", sentence: "This listing has no usable price, so it cannot be bought." });
  }
  return Object.freeze({
    ok: true,
    order: Object.freeze({
      organization_id: listing.organization_id,
      listing_id: listing.id,
      version_id: version.id,
      buyer_user_id: buyerUserId,
      title: String(listing.title || "A work").slice(0, 200),
      licence: listing.licence,
      price_cents: priceCents,
      currency,
      stripe_account_id: payment.accountId,
      state: "pending",
      expires_at: new Date(now.getTime() + CHECKOUT_SECONDS * 1000).toISOString()
    })
  });
}

/**
 * The form fields for Stripe Checkout, as a direct charge on the seller's account.
 *
 * Built by naming every field: no application fee (zero commission), the order id
 * as client_reference_id and in metadata so the webhook can find it, and the
 * session's expiry equal to the order's. The route sends these with the seller's
 * Stripe-Account header and the order id as the idempotency key.
 */
function checkoutFields(order, { successUrl, cancelUrl } = {}) {
  const expires = Math.floor(new Date(order.expires_at).getTime() / 1000);
  return Object.freeze({
    mode: "payment",
    client_reference_id: order.id,
    "metadata[sonara_order_id]": order.id,
    "metadata[sonara_kind]": "creator_marketplace",
    "payment_intent_data[metadata][sonara_order_id]": order.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": order.currency,
    "line_items[0][price_data][unit_amount]": String(order.price_cents),
    "line_items[0][price_data][product_data][name]": order.title,
    expires_at: String(expires),
    success_url: successUrl,
    cancel_url: cancelUrl
  });
}

/**
 * What a verified Stripe event means for an order.
 *
 * `{ action, code }`, where action is one of grant, processing, fail, expire,
 * refund, dispute, ignore. Called only after the signature has been verified -- and then
 * every field the event carries is compared to the order, because a valid
 * signature says Stripe sent it, not that it is about this order.
 */
function fulfilmentDecision({ event, order } = {}) {
  const object = event?.data?.object || {};
  const type = String(event?.type || "");
  if (!order) return Object.freeze({ action: "ignore", code: "no_order" });
  // Connected-account events carry the account they happened on. An event for
  // this order must come from the account the order was charged on.
  if (event?.account !== order.stripe_account_id) return Object.freeze({ action: "ignore", code: "account_mismatch" });

  if (type.startsWith("checkout.session.")) {
    if (!SESSION.test(String(object.id || "")) || object.id !== order.checkout_session_id) return Object.freeze({ action: "ignore", code: "session_mismatch" });
    if (object.client_reference_id !== order.id || object.metadata?.sonara_order_id !== order.id) return Object.freeze({ action: "ignore", code: "order_mismatch" });
    if (type === "checkout.session.expired") {
      return Object.freeze({ action: order.state === "pending" ? "expire" : "ignore", code: "expired" });
    }
    const open = ["pending", "processing"].includes(order.state);
    if (type === "checkout.session.async_payment_failed") {
      return Object.freeze({ action: open ? "fail" : "ignore", code: "payment_failed" });
    }
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      if (Number(object.amount_total) !== Number(order.price_cents)) return Object.freeze({ action: "ignore", code: "amount_mismatch" });
      if (String(object.currency || "").toLowerCase() !== order.currency) return Object.freeze({ action: "ignore", code: "currency_mismatch" });
      // Already paid: answered with `grant` again, not `ignore`. The route marks the
      // order paid and then writes the grant; if the grant write failed, Stripe's
      // retry finds the order paid -- and ignoring it then would leave a buyer who
      // paid with no licence, for good. The order update is conditional and the
      // grant is keyed on the order, so granting again is a no-op when it worked.
      // Refunded and disputed orders stay ignored: a replay must never revive a
      // revoked licence.
      if (order.state === "paid") {
        return Object.freeze({ action: "grant", code: "already_paid", paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : null });
      }
      if (!open) return Object.freeze({ action: "ignore", code: "not_payable" });
      // `completed` fires for a delayed payment method before the money arrives.
      // Only `paid` is paid; until async_payment_succeeded brings the rest, the
      // order is processing -- held, and never released by its expiry.
      if (object.payment_status !== "paid") {
        return Object.freeze({ action: order.state === "pending" ? "processing" : "ignore", code: "not_yet_paid" });
      }
      return Object.freeze({ action: "grant", code: "paid", paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : null });
    }
    return Object.freeze({ action: "ignore", code: "unhandled_type" });
  }

  // A refund or dispute names the payment intent, not the session.
  if (type === "charge.refunded" || type === "charge.dispute.created") {
    const intent = object.payment_intent;
    if (!order.payment_intent_id || intent !== order.payment_intent_id) return Object.freeze({ action: "ignore", code: "intent_mismatch" });
    if (type === "charge.refunded") {
      // Only a full refund revokes the licence. A partial refund is a
      // conversation between the seller and the buyer, and taking the work back
      // over one would be a decision nobody made.
      if (object.refunded !== true) return Object.freeze({ action: "ignore", code: "partial_refund" });
      return Object.freeze({ action: order.state === "paid" ? "refund" : "ignore", code: "refunded" });
    }
    return Object.freeze({ action: ["paid", "refunded"].includes(order.state) ? "dispute" : "ignore", code: "disputed" });
  }
  return Object.freeze({ action: "ignore", code: "unhandled_type" });
}

/**
 * Whether this person may download this order's file now.
 */
function downloadDecision({ order, grant, userId } = {}) {
  if (!order || !isUuid(userId) || order.buyer_user_id !== userId) {
    // The same answer for "not yours" and "does not exist", so guessing order ids
    // learns nothing.
    return Object.freeze({ ok: false, status: 404, code: "not_found", sentence: "There is no purchase of yours at this address." });
  }
  if (order.state === "pending" || order.state === "processing") {
    return Object.freeze({ ok: false, status: 409, code: "pending", sentence: "Your payment has not been confirmed yet. This page updates when Stripe tells us it has; nothing is unlocked by landing here." });
  }
  if (!grant || grant.order_id !== order.id || grant.buyer_user_id !== userId) {
    return Object.freeze({ ok: false, status: 409, code: "no_grant", sentence: "There is no licence on this order, so there is nothing to download." });
  }
  if (grant.revoked_at) {
    return Object.freeze({ ok: false, status: 410, code: "revoked", sentence: grant.revoked_reason === "disputed"
      ? "This licence is suspended while the payment is disputed."
      : "This order was refunded, so the licence and the download have ended." });
  }
  return Object.freeze({ ok: true, seconds: DOWNLOAD_SECONDS });
}

/**
 * What the buyer is told about an order, from its state alone.
 */
function orderSentence(order) {
  return ({
    pending: "Waiting for Stripe to confirm the payment. If you paid, this changes on its own -- usually within a minute.",
    processing: "Your payment is on its way. Some payment methods take a few days to clear; the licence is granted when it does.",
    paid: "Paid. Your licence is granted and the download is below.",
    payment_failed: "The payment did not go through, so nothing was charged and no licence was granted.",
    expired: "The checkout expired before payment, so nothing was charged.",
    refunded: "This order was refunded. The licence has ended.",
    disputed: "The payment on this order is disputed, so the licence is suspended."
  })[order?.state] || "We cannot tell what state this order is in.";
}

module.exports = {
  ORDER_STATES,
  CHECKOUT_SECONDS,
  DOWNLOAD_SECONDS,
  isUuid,
  normalizeChecksum,
  pinDecision,
  purchaseDecision,
  checkoutFields,
  fulfilmentDecision,
  downloadDecision,
  orderSentence
};
