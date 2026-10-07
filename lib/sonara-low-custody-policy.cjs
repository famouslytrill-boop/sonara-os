// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * LOW-COST / LOW-CUSTODY default for SONARA Industries.
 *
 * SONARA collects ONLY its own SaaS subscription or clearly disclosed direct
 * software-service invoice into its own platform Stripe account.
 *
 * All customer-to-merchant payments, rent, deposits, equipment payments, ad
 * spending and marketplace asset sales are done by the business directly
 * with its OWN, INDEPENDENT merchant processor. SONARA may prepare a quote,
 * record a customer-supplied external reference, and show explicitly
 * "unverified" until independent confirmation. SONARA neither creates that
 * merchant payment, receives funds, routes, splits, captures, refunds, holds,
 * releases, pays out or claims escrow/custody.
 *
 * This is an advisory decision engine / release contract, not a legal opinion,
 * a payment route, or evidence that all existing Connect endpoints are disabled.
 * A production safety switch must be wired into every route before claiming
 * this policy is enforced throughout the application.
 */

const MODES = Object.freeze(["external_only", "connect_direct_reviewed"]);
const SOFTWARE_FEES = Object.freeze(["sonara_subscription", "sonara_software_invoice"]);
const MERCHANT_FLOWS = Object.freeze([
  "business_invoice", "merchant_storefront", "creator_marketplace",
  "rental_rent", "rental_security_deposit", "equipment_leasing",
  "growth_campaign_spend", "third_party_services", "merchant_pos"
]);
const NEVER_SUPPORTED = Object.freeze([
  "wallet_stored_value", "customer_to_customer_transfer", "custody_escrow",
  "merchant_cash_advance", "sonara_held_deposits", "platform_split_payout"
]);
const MODE_LOCK = "sonara_customer_money_mode_unverified";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY_METHODS = Object.freeze([
  "stripe_independent_merchant", "other_independent_provider",
  "cash_outside_sonara", "bank_transfer_outside_sonara"
]);

// External links are *reviewed metadata*, never payment authorization.
// No open redirect, URL shortener, dynamic "pay me" domain or client-side
// merchant identity proof. Revalidate via trusted seller-origin evidence.
// Branded processor custom domains can be added ONLY by counsel/security
// review and a server-side verified merchant ownership mapping.
const PROCESSOR_HOSTS = Object.freeze(new Set([
  "buy.stripe.com", "checkout.stripe.com", "pay.stripe.com",
  "www.paypal.com", "paypal.com"
]));
function externalPaymentLinkReview(input) {
  if (typeof input !== "string" || input.length > 2048) {
    return { ok: false, code: "external_payment_url_invalid", verifiedMerchantOwner: false };
  }
  let url;
  try { url = new URL(input); } catch {
    return { ok: false, code: "external_payment_url_invalid", verifiedMerchantOwner: false };
  }
  if (url.protocol !== "https:" || !PROCESSOR_HOSTS.has(url.hostname.toLowerCase()) ||
      url.username || url.password || url.port ||
      url.hash || !url.pathname || url.pathname.includes("\\")) {
    return { ok: false, code: "external_payment_host_unapproved", verifiedMerchantOwner: false };
  }
  // Deliberately omit URL from returned objects; if rendered, show only the
  // separately verified canonical processor link and merchant identification.
  return Object.freeze({
    ok: true, code: "processor_link_shape_only",
    providerDomain: url.hostname.toLowerCase(),
    verifiedMerchantOwner: false,
    authenticatedProcessorSession: false,
    executionAuthorized: false
  });
}

function lowCustodyDecision({
  flow, mode = "external_only",
  tenantId, serverTenantId,
  platformBillingMerchantVerified = false,
  merchantIdentityIndependentlyVerified = false,
  externalProviderAccountOwnedByMerchant = false,
  callerWantsToCharge = false,
  callerWantsToTransfer = false,
  callerWantsToVerifyPayment = false,
  explicitOwnerApprovedConnect = false,
  financeCounselConnectReview = false,
  connectLossConfigurationReviewed = false
} = {}) {
  const blockers = [];
  const advisory = [];
  const recognized = [...SOFTWARE_FEES, ...MERCHANT_FLOWS, ...NEVER_SUPPORTED].includes(flow);
  if (!recognized) blockers.push("unknown_flow");
  if (!MODES.includes(mode)) blockers.push(MODE_LOCK);
  if (typeof tenantId !== "string" || !UUID.test(tenantId) || tenantId !== serverTenantId) {
    blockers.push("tenant_scope_unverified");
  }
  const isSoftwareFee = SOFTWARE_FEES.includes(flow);
  const isMerchant = MERCHANT_FLOWS.includes(flow);
  if (NEVER_SUPPORTED.includes(flow)) blockers.push("regulated_money_movement_prohibited");
  if (isSoftwareFee) {
    if (platformBillingMerchantVerified !== true) blockers.push("platform_billing_account_unverified");
    if (callerWantsToTransfer) blockers.push("platform_payout_to_third_party_prohibited");
    return Object.freeze({
      mode, flow, responsibleMerchant: "sonara_industries",
      fundsDestination: "sonara_platform_software_revenue_only",
      architecture: "platform_stripe_hosted_billing_only",
      status: blockers.length ? "blocked_pending_review" : "software_fee_draft_ready",
      blockers: Object.freeze(blockers), advisory: Object.freeze(advisory),
      paymentAuthorized: false, thirdPartyFundsTouched: false,
      custodyAssumed: false, noLegalRiskGuaranteed: false
    });
  }
  if (isMerchant) {
    if (!merchantIdentityIndependentlyVerified || !externalProviderAccountOwnedByMerchant) {
      blockers.push("independent_merchant_identity_and_provider_ownership_unverified");
    }
    if (mode === "external_only") {
      if (callerWantsToCharge || callerWantsToTransfer || callerWantsToVerifyPayment) {
        blockers.push("sonara_must_not_execute_or_claim_external_payment");
      }
      advisory.push("merchant_operates_separate_processor_account_and_owns_refunds_disputes");
      advisory.push("payment_evidence_is_self_reported_until_independently_verified");
    } else if (mode === "connect_direct_reviewed") {
      // An alternative exists ONLY after explicit owner/legal/provider review.
      // Even then this function DOES NOT authorize checkout, refunds or payouts.
      if (!(explicitOwnerApprovedConnect && financeCounselConnectReview &&
            connectLossConfigurationReviewed)) blockers.push("connect_authorization_missing");
      advisory.push("stripe_connect_account_loss_exposure_not_automatically_zero");
      if (callerWantsToTransfer) blockers.push("platform_payouts_prohibited");
    }
    return Object.freeze({
      mode, flow, responsibleMerchant: "customer_business",
      fundsDestination: "verified_merchant_external_provider_account_only",
      architecture: mode === "external_only" ? "merchant_managed_outside_sonara"
        : "connect_direct_charges_review_required",
      status: blockers.length ? "blocked_pending_review" : "merchant_external_draft_ready",
      blockers: Object.freeze(blockers), advisory: Object.freeze(advisory),
      paymentAuthorized: false, thirdPartyFundsTouched: false,
      custodyAssumed: false, noLegalRiskGuaranteed: false
    });
  }
  return Object.freeze({
    mode, flow: flow || "unknown", responsibleMerchant: "unknown",
    fundsDestination: null, architecture: "blocked",
    status: "blocked_pending_review",
    blockers: Object.freeze(blockers), advisory: Object.freeze(advisory),
    paymentAuthorized: false, thirdPartyFundsTouched: false,
    custodyAssumed: false, noLegalRiskGuaranteed: false
  });
}

// User-controlled self-reported bookkeeping. A seller may mark an invoice as
// received externally, but the product must NEVER say "provider confirmed" or
// grant paid digital delivery from that claim. Proof must come independently
// from provider or a manual owner-controlled fulfillment step with liability
// notices, permissions and audit.
function externalReceiptEvidence({ flow, organizationId, serverOrganizationId,
  method, sellerAttested, amountCents, currency, externalReference
} = {}) {
  const issues = [];
  if (!MERCHANT_FLOWS.includes(flow)) issues.push("merchant_flow_required");
  if (!UUID.test(organizationId || "") || organizationId !== serverOrganizationId) {
    issues.push("tenant_scope_unverified");
  }
  if (!MONEY_METHODS.includes(method)) issues.push("external_method_unknown");
  if (sellerAttested !== true) issues.push("seller_attestation_missing");
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) issues.push("amount_not_recordable");
  if (currency !== "USD") issues.push("currency_precision_review_missing");
  if (typeof externalReference !== "string" || !/^[A-Za-z0-9._:-]{3,160}$/.test(externalReference)) {
    issues.push("external_reference_invalid");
  }
  return Object.freeze({
    status: issues.length ? "blocked_pending_review" : "seller_reported_unverified",
    issues: Object.freeze(issues), cashHandledBySonara: false,
    merchantSettlementVerified: false, buyerPaymentConfirmed: false,
    providerWebhookVerified: false, inventoryFulfillmentAuthorized: false,
    licenseDeliveryAuthorized: false, refundAuthorized: false,
    journalPosted: false
  });
}

module.exports = {
  MODES, SOFTWARE_FEES, MERCHANT_FLOWS, NEVER_SUPPORTED,
  externalPaymentLinkReview, lowCustodyDecision, externalReceiptEvidence
};
