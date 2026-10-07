// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Draft-only money-pathway analysis for SONARA Industries and its three Studios.
// Pure functions here DO NOT authorize money movement, establish custody,
// execute a payment, verify a webhook signature or certify legal compliance.
// Callers must re-derive ALL facts from authenticated, organization-scoped server
// records and independently verified processor responses, never request fields.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRIPE_ACCOUNT = /^acct_[A-Za-z0-9]{8,}$/;
const MONEY_PATHS = Object.freeze({
  sonara_subscription: Object.freeze({ model: "platform_billing", account: "platform", reviewRequired: false }),
  business_invoice: Object.freeze({ model: "direct_connected_charge", account: "connected", reviewRequired: false }),
  merchant_storefront: Object.freeze({ model: "direct_connected_charge", account: "connected", reviewRequired: false }),
  creator_marketplace: Object.freeze({ model: "direct_connected_charge", account: "connected", reviewRequired: false }),
  rental_rent: Object.freeze({ model: "regulated_rental_review", account: "connected", reviewRequired: true }),
  rental_security_deposit: Object.freeze({ model: "regulated_rental_review", account: "connected", reviewRequired: true }),
  equipment_leasing: Object.freeze({ model: "regulated_lease_review", account: "connected", reviewRequired: true }),
  growth_campaign_spend: Object.freeze({ model: "third_party_spend_review", account: "provider_external", reviewRequired: true }),
  usage_credits: Object.freeze({ model: "platform_billing_review", account: "platform", reviewRequired: true }),
  wallet_stored_value: Object.freeze({ model: "prohibited_unlicensed", account: null, reviewRequired: true }),
  customer_to_customer_transfer: Object.freeze({ model: "prohibited_unlicensed", account: null, reviewRequired: true }),
  custody_escrow: Object.freeze({ model: "prohibited_unlicensed", account: null, reviewRequired: true }),
  merchant_cash_advance: Object.freeze({ model: "prohibited_unlicensed", account: null, reviewRequired: true })
});
const EDITABLE_PAYEE_FIELDS = Object.freeze(["externalAccount", "bankAccount", "beneficiary", "connectedAccount", "paymentDestination"]);
const REFUND_LIKE = new Set(["refund", "dispute", "chargeback"]);
function exactCents(value) { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function scopeValid(value) { return typeof value === "string" && UUID.test(value); }
function accountValid(value) { return typeof value === "string" && STRIPE_ACCOUNT.test(value); }

// A preflight for a proposed monetary event. Passing a checklist NEVER grants
// permission to charge; the real route still needs authentication, Stripe
// account eligibility and contract-specific consent/authority.
function moneyPathPreflight({
  flow, organizationId, authenticatedOrganizationId, proposedAccount,
  expectedAccount, grossCents, currency, ownerApproval, legalApproval,
  actorRole, changeRequest, webCheckoutOriginVerified,
  pricingSnapshotVerified
} = {}) {
  const blockers = [];
  const reviews = [];
  const rule = MONEY_PATHS[flow];
  const block = (ok, reason) => { if (!ok) blockers.push(reason); };
  block(!!rule, "unknown_money_flow");
  block(scopeValid(organizationId) && organizationId === authenticatedOrganizationId, "tenant_scope_unverified");
  block(exactCents(grossCents) && grossCents > 0, "invalid_gross_cents");
  block(currency === "USD", "currency_requires_separate_money_precision_review");
  block(actorRole === "owner" || actorRole === "finance_manager" || actorRole === "authorized_buyer", "actor_role_unverified");
  block(pricingSnapshotVerified === true, "server_price_snapshot_missing");

  if (rule?.account === "connected") {
    block(accountValid(expectedAccount) && proposedAccount === expectedAccount, "payee_routing_mismatch");
    block(webCheckoutOriginVerified === true, "hosted_checkout_origin_unverified");
  } else if (rule?.account === "platform") {
    block(proposedAccount === "sonara_platform" && expectedAccount === "sonara_platform", "platform_billing_account_mismatch");
    block(webCheckoutOriginVerified === true, "hosted_checkout_origin_unverified");
  } else if (rule?.account === "provider_external") {
    block(false, "provider_spend_must_use_approved_external_billing");
  }
  if (rule?.model === "prohibited_unlicensed") block(false, "regulated_money_movement_not_enabled");
  if (rule?.reviewRequired) {
    if (ownerApproval !== true) blockers.push("owner_approval_missing");
    if (legalApproval !== true) blockers.push("legal_or_regulatory_review_missing");
    reviews.push("regulated_flow_requires_provider_and_legal_evidence");
  }
  if (changeRequest && typeof changeRequest === "object") {
    if (EDITABLE_PAYEE_FIELDS.some(key => Object.hasOwn(changeRequest, key))) {
      blockers.push("payee_change_step_up_independent_verification_required");
    }
  }
  if (REFUND_LIKE.has(flow)) blockers.push("owner_approved_refund_review_required");
  reviews.push("stripe_connect_loss_liability_is_account_configuration_dependent");
  reviews.push("processor_success_is_not_bank_settlement");
  return Object.freeze({
    flow: rule ? flow : "unknown", status: blockers.length ? "blocked_pending_review" : "draft_review_ready",
    blockers: Object.freeze(blockers), reviewNotes: Object.freeze(reviews),
    executionAuthorized: false, transfersValue: false, complianceCertified: false
  });
}

// Reconcile normalized server-side payment events from a processor against the
// application's independently stored records. Never infer a zero balance from
// missing rows, incomplete pagination, or an unverified payment status.
// Comparison is per event, exact amount, currency, tenant, account and kind.
// All calculated totals are observed event activity, NEVER actual bank balances.
const EVENT_KINDS = Object.freeze(["charge", "refund", "dispute"]);
function auditMoneyEvents({ organizationId, providerAccount, currency = "USD",
  providerEvents, recordedEvents, providerComplete, recordedComplete
} = {}) {
  const issues = [];
  const warn = (v) => { if (!issues.includes(v)) issues.push(v); };
  if (!scopeValid(organizationId)) warn("tenant_scope_unverified");
  if (!accountValid(providerAccount)) warn("provider_account_unverified");
  if (currency !== "USD") warn("unsupported_currency");
  if (!Array.isArray(providerEvents) || !Array.isArray(recordedEvents) ||
      providerComplete !== true || recordedComplete !== true) {
    return Object.freeze({ status: "incomplete_evidence", certain: false,
      issues: Object.freeze(["event_windows_unverified"]), grossCents: null,
      refundCents: null, unresolvedDisputeCents: null, observedNetBeforeFeesCents: null });
  }
  const collect = (rows, source) => {
    const map = new Map();
    for (const row of rows) {
      if (!row || typeof row.eventId !== "string" || !/^[A-Za-z0-9_-]{3,180}$/.test(row.eventId)) {
        warn(source + "_event_id_invalid"); continue;
      }
      if (map.has(row.eventId)) { warn(source + "_duplicate_event"); continue; }
      if (row.organizationId !== organizationId ||
          row.providerAccount !== providerAccount || row.currency !== currency) {
        warn(source + "_tenant_account_currency_mismatch"); continue;
      }
      if (!EVENT_KINDS.includes(row.kind) || !exactCents(row.amountCents) || row.amountCents === 0) {
        warn(source + "_event_unreadable"); continue;
      }
      if (row.status !== "succeeded" && !(row.kind === "dispute" && ["open", "won", "lost"].includes(row.status))) {
        warn(source + "_unsettled_event"); continue;
      }
      if (row.kind === "refund" && (typeof row.chargeId !== "string" || row.chargeId.length === 0)) {
        warn(source + "_refund_unlinked"); continue;
      }
      map.set(row.eventId, row);
    }
    return map;
  };
  const provider = collect(providerEvents, "provider");
  const recorded = collect(recordedEvents, "recorded");
  for (const [id, row] of provider) {
    const local = recorded.get(id);
    if (!local) { warn("provider_event_unrecorded"); continue; }
    if (row.kind !== local.kind || row.status !== local.status ||
        row.amountCents !== local.amountCents || row.chargeId !== local.chargeId) {
      warn("event_disagrees_with_processor");
    }
  }
  for (const id of recorded.keys()) if (!provider.has(id)) warn("recorded_event_not_observed");
  const charges = new Map();
  for (const row of provider.values()) {
    if (row.kind === "charge" && row.status === "succeeded") charges.set(row.eventId, BigInt(row.amountCents));
  }
  const refundByCharge = new Map();
  let gross = 0n, refunds = 0n, disputed = 0n;
  for (const row of provider.values()) {
    if (row.kind === "charge") gross += BigInt(row.amountCents);
    if (row.kind === "refund") {
      if (!charges.has(row.chargeId)) warn("refund_without_matching_charge");
      const amount = (refundByCharge.get(row.chargeId) || 0n) + BigInt(row.amountCents);
      refundByCharge.set(row.chargeId, amount);
      if (charges.has(row.chargeId) && amount > charges.get(row.chargeId)) warn("refund_exceeds_charge");
      refunds += BigInt(row.amountCents);
    }
    if (row.kind === "dispute" && row.status === "open") disputed += BigInt(row.amountCents);
  }
  if (refunds > gross) warn("refunds_exceed_collected_amount");
  const safe = (number) => number >= 0n && number <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(number) : null;
  const grossCents = safe(gross), refundCents = safe(refunds), unresolvedDisputeCents = safe(disputed);
  const net = safe(gross - refunds);
  if ([grossCents, refundCents, unresolvedDisputeCents, net].some(x => x === null)) warn("amount_exceeds_safe_integer");
  const certain = issues.length === 0;
  return Object.freeze({
    status: certain ? "matched_processor_events" : "needs_reconciliation",
    certain, issues: Object.freeze(issues),
    grossCents: certain ? grossCents : null,
    refundCents: certain ? refundCents : null,
    unresolvedDisputeCents: certain ? unresolvedDisputeCents : null,
    observedNetBeforeFeesCents: certain ? net : null,
    bankSettlementProven: false, custodyProven: false,
    source: "matched_complete_processor_and_app_event_windows"
  });
}
module.exports = { MONEY_PATHS, EDITABLE_PAYEE_FIELDS, moneyPathPreflight, auditMoneyEvents };