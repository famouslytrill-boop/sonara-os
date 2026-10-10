// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only evidence. No state transitions, refunds, payouts or storage URLs.
// Expanded Stripe objects may contain client secrets; project an allowlist,
// never return them to a page, log or report.
const orders = require("./sonara-marketplace-orders.cjs");
const { ACCOUNT_ID } = require("./sonara-connected-payments.cjs");
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;
const INTENT_ID = /^pi_[A-Za-z0-9]+$/;
const CURRENCY = /^[a-z]{3}$/;
const amount = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;

const FINDINGS = Object.freeze({
  other_account: "This order belongs to a different payment account; Stripe was not checked for it.",
  payment_unverified: "Stripe's list is incomplete; this payment could not be checked.",
  missing_payment: "The recorded paid order has no checkout in the Stripe records read.",
  duplicate_payment: "Stripe reports more than one paid checkout for this order.",
  checkout_evidence_conflict: "The same Stripe checkout appeared with inconsistent payment evidence; review the source before trusting totals.",
  checkout_mismatch: "The Stripe checkout does not match the checkout recorded on the order.",
  reference_mismatch: "Stripe's order reference does not match this order.",
  amount_mismatch: "The checkout amount or currency differs from the purchase.",
  intent_mismatch: "The payment reference differs from the order.",
  payment_not_recorded: "Stripe reports payment, but the order has not recorded it.",
  charge_unverified: "Stripe's charge details could not be checked for refunds and disputes.",
  refund_not_recorded: "Stripe reports a full refund; the order has not recorded it.",
  dispute_not_recorded: "Stripe reports a dispute; the order has not recorded it.",
  refund_unverified: "The recorded refund could not be confirmed against this charge.",
  dispute_unverified: "The recorded dispute could not be confirmed against this charge.",
  licence_missing: "The paid order has no recorded licence grant.",
  licence_unverified: "The licence records are incomplete; this grant could not be checked.",
  licence_mismatch: "The grant's workspace, buyer, version or licence differs from the purchase.",
  licence_duplicate: "More than one licence grant was found for this order; review all grants before declaring delivery verified.",
  licence_revoked: "The order is paid, but its licence grant is revoked.",
  revocation_pending: "The closed order's licence revocation is missing or has the wrong reason.",
  unpaid_licence: "An unpaid order has an active licence grant.",
  order_not_in_report: "This Stripe checkout has no order in the period and order records shown.",
  malformed_payment: "Stripe's payment amount or currency could not be checked."
});

function projectSession(session) {
  if (session?.metadata?.sonara_kind !== "creator_marketplace"
    || !orders.isUuid(session.metadata.sonara_order_id)
    || !SESSION_ID.test(String(session.id || ""))) return null;
  const intent = session.payment_intent;
  const intentId = typeof intent === "string" ? intent : intent?.id;
  const charge = intent && typeof intent === "object" ? intent.latest_charge : null;
  const currency = String(session.currency || "").toLowerCase();
  const gross = amount(session.amount_total);
  const chargeIntentId = typeof charge?.payment_intent === "string"
    ? charge.payment_intent : charge?.payment_intent?.id;
  const chargeKnown = gross !== null && gross > 0 && charge && typeof charge === "object"
    && INTENT_ID.test(String(intentId || "")) && chargeIntentId === intentId
    && /^ch_[A-Za-z0-9]+$/.test(String(charge.id || ""))
    && charge.paid === true && charge.captured === true && charge.status === "succeeded"
    && amount(charge.amount) === gross && charge.currency === currency
    && typeof charge.disputed === "boolean" && typeof charge.refunded === "boolean"
    && amount(charge.amount_refunded) !== null && charge.amount_refunded <= gross
    && charge.refunded === (charge.amount_refunded === gross);
  const balance = chargeKnown && typeof charge.balance_transaction === "object"
    ? charge.balance_transaction : null;
  const balanceKnown = balance && CURRENCY.test(String(balance.currency || ""))
    && (typeof balance.source === "string" ? balance.source : balance.source?.id) === charge.id
    && amount(balance.amount) !== null && amount(balance.fee) !== null
    && Number.isSafeInteger(balance.net)
    && BigInt(balance.net) === BigInt(balance.amount) - BigInt(balance.fee);
  return {
    id: session.id, orderId: session.metadata.sonara_order_id,
    referenceMatches: session.client_reference_id === session.metadata.sonara_order_id,
    paid: session.payment_status === "paid",
    gross, currency: CURRENCY.test(currency) ? currency : null,
    intentId: INTENT_ID.test(String(intentId || "")) ? intentId : null,
    chargeKnown: Boolean(chargeKnown),
    refunded: chargeKnown ? charge.amount_refunded : null,
    fullyRefunded: chargeKnown ? charge.refunded || charge.amount_refunded === gross : null,
    disputed: chargeKnown ? charge.disputed : null,
    // Original charge balance transaction, excluding later refund/dispute impact.
    balance: balanceKnown ? { currency: balance.currency, fee: balance.fee, net: balance.net } : null
  };
}

function addTotal(totals, currency, key, value) {
  if (!CURRENCY.test(String(currency || "")) || !Number.isSafeInteger(value)) return;
  const row = totals[currency] || (totals[currency] = { localPaid: 0, stripePaid: 0, refunded: 0 });
  row[key] += value;
}

function reconcile({ organizationId, accountId, orderRows = [], grants = [], sessions = [],
  ordersTruncated = false, sessionsTruncated = false, grantsComplete = true } = {}) {
  if (!orders.isUuid(organizationId) || !ACCOUNT_ID.test(String(accountId || ""))) {
    throw new TypeError("A verified seller scope is required.");
  }
  // REST reads use the service role. Do not render records if that scope fails.
  if (orderRows.some((order) => order.organization_id !== organizationId || !orders.isUuid(order.id))
    || grants.some((grant) => grant.organization_id !== organizationId)) {
    throw new TypeError("Marketplace evidence is outside the seller scope.");
  }
  const payments = new Map();
  const checkoutConflicts = new Set();
  for (const session of sessions) {
    const projected = projectSession(session);
    if (!projected) continue;
    const prior = payments.get(projected.id);
    // Duplicate pagination is harmless only when the provider evidence agrees.
    // A stale or forged repeated session must never silently overwrite the
    // first snapshot and make a disputed checkout appear verified.
    if (prior && JSON.stringify(prior) !== JSON.stringify(projected)) {
      checkoutConflicts.add(projected.id);
    }
    if (!prior) payments.set(projected.id, projected);
  }
  const byOrder = new Map();
  for (const payment of payments.values()) {
    const group = byOrder.get(payment.orderId) || [];
    group.push(payment);
    byOrder.set(payment.orderId, group);
  }
  // Never let Map() silently discard duplicate licence grants. A duplicate
  // might leave an unauthorized grant active even if the last row looks good.
  const grantsByOrder = new Map();
  for (const grant of grants) {
    const rows = grantsByOrder.get(grant.order_id) || [];
    rows.push(grant);
    grantsByOrder.set(grant.order_id, rows);
  }
  const totals = {};
  const balances = {};
  let unknownBalances = 0;
  let unknownRefunds = 0;
  for (const payment of payments.values()) {
    if (!payment.paid) continue;
    addTotal(totals, payment.currency, "stripePaid", payment.gross);
    if (payment.refunded === null) unknownRefunds += 1;
    else addTotal(totals, payment.currency, "refunded", payment.refunded);
    if (!payment.balance) unknownBalances += 1;
    else {
      const { currency, fee, net } = payment.balance;
      const row = balances[currency] || (balances[currency] = { fee: 0, net: 0, charges: 0 });
      row.fee += fee; row.net += net; row.charges += 1;
    }
  }
  const rows = orderRows.map((order) => {
    const codes = [];
    const candidates = byOrder.get(order.id) || [];
    const paid = candidates.filter((payment) => payment.paid);
    if (candidates.some((payment) => checkoutConflicts.has(payment.id)))
      codes.push("checkout_evidence_conflict");
    const payment = candidates.find((entry) => entry.id === order.checkout_session_id) || paid[0] || candidates[0] || null;
    const grantRows = grantsByOrder.get(order.id) || [];
    if (grantRows.length > 1) codes.push("licence_duplicate");
    if (order.state === "paid") addTotal(totals, order.currency, "localPaid", order.price_cents);
    if (order.stripe_account_id !== accountId) codes.push("other_account");
    else {
      if (paid.length > 1) codes.push("duplicate_payment");
      if (!payment) {
        if (sessionsTruncated) codes.push("payment_unverified");
        else if (["paid", "refunded", "disputed"].includes(order.state)) codes.push("missing_payment");
      } else {
        if (payment.id !== order.checkout_session_id) codes.push("checkout_mismatch");
        if (!payment.referenceMatches) codes.push("reference_mismatch");
        if (payment.gross !== order.price_cents || payment.currency !== order.currency) codes.push("amount_mismatch");
        if (order.payment_intent_id && payment.intentId !== order.payment_intent_id) codes.push("intent_mismatch");
        if (payment.paid && !["paid", "refunded", "disputed"].includes(order.state)) codes.push("payment_not_recorded");
        if (order.state === "paid" && (!payment.paid || !order.payment_intent_id)) codes.push("payment_unverified");
        if (payment.paid) {
          if (!payment.chargeKnown) codes.push("charge_unverified");
          else {
            if (payment.disputed && order.state !== "disputed") codes.push("dispute_not_recorded");
            if (payment.fullyRefunded && !["refunded", "disputed"].includes(order.state)) codes.push("refund_not_recorded");
            if (order.state === "refunded" && !payment.fullyRefunded) codes.push("refund_unverified");
            if (order.state === "disputed" && !payment.disputed) codes.push("dispute_unverified");
          }
        }
      }
    }
    if (grantRows.some((grant) => grant.buyer_user_id !== order.buyer_user_id
      || grant.version_id !== order.version_id || grant.licence !== order.licence))
      codes.push("licence_mismatch");
    if (order.state === "paid") {
      if (!grantRows.length) codes.push(grantsComplete ? "licence_missing" : "licence_unverified");
      else if (grantRows.some((grant) => Boolean(grant.revoked_at))) codes.push("licence_revoked");
    } else if (["refunded", "disputed"].includes(order.state)) {
      if (!grantRows.length && !grantsComplete) codes.push("licence_unverified");
      else if (grantRows.some((grant) => !grant.revoked_at || grant.revoked_reason !== order.state))
        codes.push("revocation_pending");
    } else if (grantRows.some((grant) => !grant.revoked_at)) codes.push("unpaid_licence");
    return { orderId: order.id, title: order.title, state: order.state,
      waiting: ["pending", "processing"].includes(order.state) && !payment?.paid,
      licence: order.licence, payment, codes };
  });
  const knownOrders = new Set(orderRows.map((order) => order.id));
  for (const payment of payments.values()) {
    if (!knownOrders.has(payment.orderId)) rows.push({
      orderId: payment.orderId, title: "Stripe checkout", state: payment.paid ? "paid at Stripe" : "unpaid at Stripe",
      licence: null, payment, codes: ["order_not_in_report",
        ...(checkoutConflicts.has(payment.id) ? ["checkout_evidence_conflict"] : []),
        ...(payment.gross === null || !payment.currency ? ["malformed_payment"] : [])]
    });
  }
  return {
    rows, totals, balances, unknownBalances, unknownRefunds,
    complete: !ordersTruncated && !sessionsTruncated && grantsComplete && checkoutConflicts.size === 0,
    ordersTruncated, sessionsTruncated, grantsComplete,
    checked: rows.filter((row) => !row.codes.length).length,
    attention: rows.filter((row) => row.codes.length).length
  };
}

module.exports = { reconcile, projectSession, FINDINGS };
