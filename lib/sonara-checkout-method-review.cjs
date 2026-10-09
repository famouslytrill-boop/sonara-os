// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only merchant checkout method review. This file has no SDK, account
// credentials, payment initiation, processor webhooks, money ledger or payouts.
// The caller MUST reconstruct every claim from trusted authenticated server
// records and provider SDK/server eligibility. This function does not attest
// to the source of the claims it receives; never expose it as an authority API.
const { evaluateIntegrationActivation } = require("./sonara-integration-activation-policy.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_SOURCES = new Set(["verified_provider_server", "verified_provider_sdk_server_bound"]);
const METHODS = Object.freeze({
  paypal_checkout: Object.freeze({
    provider: "paypal", connectionMode: "oauth", channels: Object.freeze(["web"]),
    flows: Object.freeze(["business_invoice", "merchant_storefront"]), restriction: "provider_eligibility_required"
  }),
  paypal_venmo: Object.freeze({
    provider: "paypal", connectionMode: "oauth", channels: Object.freeze(["web"]),
    flows: Object.freeze(["business_invoice", "merchant_storefront"]), restriction: "us_usd_web_only"
  }),
  square_cash_app_pay: Object.freeze({
    provider: "square", connectionMode: "api", channels: Object.freeze(["web"]),
    flows: Object.freeze(["business_invoice", "merchant_storefront"]), restriction: "us_usd_web_only"
  })
});
const MAX_AGE_MS = 120000;
function timestamp(input) {
  if (typeof input !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(input)) return null;
  const t = Date.parse(input);
  return Number.isFinite(t) ? t : null;
}
function recent(evidenceTime, nowTime) {
  const at = timestamp(evidenceTime), now = timestamp(nowTime);
  return at !== null && now !== null && at <= now && now - at <= MAX_AGE_MS;
}
function boundedName(input) {
  return typeof input === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(input);
}

/**
 * Assess if merchant checkout integration is ready for controlled development.
 * A favorable result is NOT permission to show a payment method in checkout,
 * create a charge, refund, route customer funds or release order fulfillment.
 */
function assessCheckoutMethod({
  organizationId, authenticatedOrganizationId, method, flow, channel,
  merchantCountry, buyerCountry, currency, amountCents, nowUtc,
  merchantBinding, priceSnapshot, methodEligibility, integration
} = {}) {
  const blockers = [];
  const check = (pass, reason) => { if (!pass && !blockers.includes(reason)) blockers.push(reason); };
  const rule = METHODS[method];
  check(Boolean(rule), "unsupported_checkout_method");
  check(UUID.test(organizationId || "") && organizationId === authenticatedOrganizationId,
    "tenant_authority_unverified");
  check(rule?.flows.includes(flow), "unsupported_money_flow");
  check(rule?.channels.includes(channel), "unsupported_checkout_channel");
  check(Number.isSafeInteger(amountCents) && amountCents > 0 && amountCents <= 100000000000,
    "invalid_checkout_amount");
  check(typeof currency === "string" && /^[A-Z]{3}$/.test(currency), "currency_unverified");
  check(typeof merchantCountry === "string" && /^[A-Z]{2}$/.test(merchantCountry)
    && typeof buyerCountry === "string" && /^[A-Z]{2}$/.test(buyerCountry),
    "country_information_missing");
  if (rule?.restriction === "us_usd_web_only") {
    check(merchantCountry === "US" && buyerCountry === "US" && currency === "USD",
      "method_geography_or_currency_ineligible");
  }

  check(merchantBinding?.organizationId === organizationId
    && merchantBinding?.provider === rule?.provider
    && boundedName(merchantBinding?.accountReference)
    && merchantBinding?.serverVerified === true,
  "merchant_provider_binding_unverified");
  check(priceSnapshot?.organizationId === organizationId
    && priceSnapshot?.amountCents === amountCents
    && priceSnapshot?.currency === currency
    && boundedName(priceSnapshot?.revision)
    && priceSnapshot?.serverVerified === true
    && recent(priceSnapshot?.checkedAtUtc, nowUtc), "price_snapshot_unverified");

  check(methodEligibility?.organizationId === organizationId
    && methodEligibility?.method === method
    && methodEligibility?.eligible === true
    && VALID_SOURCES.has(methodEligibility?.source)
    && methodEligibility?.serverVerified === true
    && recent(methodEligibility?.checkedAtUtc, nowUtc), "live_method_eligibility_unverified");

  // Reuses the canonical SONARA commercial/credential/rate-limit controls.
  // Passing this function is a *necessary* condition, never an authorization.
  const activation = rule ? evaluateIntegrationActivation({
    connectionMode: rule.connectionMode,
    settings: integration?.settings,
    providerVerification: integration?.providerVerification
  }) : null;
  if (!activation?.allowed) check(false, "integration_activation_gate_not_satisfied");

  return Object.freeze({
    method: rule ? method : null,
    provider: rule?.provider || null,
    status: blockers.length ? "integration_review_blocked" : "sandbox_integration_review_candidate",
    blockers: Object.freeze(blockers),
    activationBlockers: Object.freeze(activation?.reasons || []),
    supportsAutomaticPayments: false,
    checkoutEnabled: false, mayCreatePayment: false, mayCapture: false,
    mayRefund: false, mayPayout: false, mayFulfillOrder: false,
    merchantRoutingCertified: false, executionAuthorized: false,
    requiresActualProviderSDKEligibility: true,
    evidenceOnly: true,
    caveat: "Only a server-authorized provider adapter may present checkout; provider eligibility, signed payment callbacks and settled-order policy must be rechecked at execution."
  });
}

/**
 * Advisory interpretation of *verified* provider event type after webhook
 * signature + account + tenant + dedupe checks performed by caller.
 * Does NOT mutate order status, approve fulfillment, or prove bank settlement.
 */
function describePaymentEvent({ provider, eventType, signatureVerified,
  providerAccountBound, organizationVerified, eventUnique } = {}) {
  const proofs = signatureVerified === true && providerAccountBound === true
    && organizationVerified === true && eventUnique === true;
  if (!proofs) return Object.freeze({ status: "unverified_event", nextAction: "deny_and_reconcile",
    settled: false, fulfillAuthorized: false });
  const paypal = {
    "CHECKOUT.ORDER.APPROVED": "approval_not_capture",
    "PAYMENT.CAPTURE.PENDING": "pending_not_fulfillable",
    "PAYMENT.CAPTURE.COMPLETED": "completed_requires_order_reconciliation",
    "PAYMENT.CAPTURE.DENIED": "denied_block_fulfillment",
    "CHECKOUT.PAYMENT-APPROVAL.REVERSED": "reversed_block_fulfillment"
  };
  const state = provider === "paypal" && Object.hasOwn(paypal, eventType)
    ? paypal[eventType] : "unknown_event_reconcile";
  return Object.freeze({ status: state, nextAction: "review_against_order_and_provider",
    settled: false, fulfillAuthorized: false });
}

module.exports = { METHODS, assessCheckoutMethod, describePaymentEvent };
