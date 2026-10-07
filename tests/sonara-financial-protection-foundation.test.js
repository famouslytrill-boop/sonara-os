// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { MONEY_PATHS, moneyPathPreflight, auditMoneyEvents } =
  require("../lib/sonara-money-pathway-guards.cjs");
const { REQUIRED_SECTIONS, agreementReviewDigest, contractEvidencePreflight } =
  require("../lib/sonara-contract-evidence-gates.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const FOREIGN = "22222222-2222-4222-8222-222222222222";
const account = "acct_1234567890";
const goodContext = {
  flow: "business_invoice", organizationId: ORG,
  authenticatedOrganizationId: ORG, expectedAccount: account,
  proposedAccount: account, grossCents: 2500, currency: "USD",
  actorRole: "owner", pricingSnapshotVerified: true,
  webCheckoutOriginVerified: true
};
const providerEvent = (eventId, kind, amountCents, chargeId) => ({
  eventId, kind, amountCents, chargeId,
  organizationId: ORG, providerAccount: account, currency: "USD",
  status: kind === "dispute" ? "open" : "succeeded"
});
const charge = providerEvent("ch_123", "charge", 5000);
const refund = providerEvent("re_123", "refund", 1000, "ch_123");
const matched = (providerEvents, recordedEvents = providerEvents) => ({
  organizationId: ORG, providerAccount: account, currency: "USD",
  providerComplete: true, recordedComplete: true, providerEvents, recordedEvents
});
const allSections = [...REQUIRED_SECTIONS];
const fullBody = "Version 3. One business subscription with clear recurring charges and refund terms, accessible in full.";
const approvalHash = createHash("sha256").update(fullBody, "utf8").digest("hex");
const baseAgreement = {
  type: "saas_subscription", organizationId: ORG,
  actor: { id: ORG, organizationId: ORG, authorizedByServer: true },
  counterparty: { id: FOREIGN, identityVerified: true },
  jurisdiction: { verified: true, code: "US-OH" },
  document: {
    text: fullBody, version: "2026-v3",
    legalReviewStatus: "counsel_approved_for_this_type_and_jurisdiction",
    reviewedType: "saas_subscription", reviewedJurisdiction: "US-OH",
    approvedTextHash: approvalHash, reviewerRef: "counsel_ref",
    approvalEvidenceRef: "signed_review_report",
    approvedOn: "2026-10-01", approvalExpiresOn: "2027-10-01", immutableVersionStored: true,
    reproducibleCopyAvailable: true, sections: allSections
  },
  agreement: {
    oneTimeCents: 0, recurringCents: 2900, currency: "USD",
    totalPriceDisplayed: true, disputeProcedureDisplayed: true,
    cancellationTermsDisplayed: true, supportChannelVerified: true,
    noticeDeliveryReviewed: true, renewalCadenceShown: true,
    clearCancellationPathShown: true
  },
  consumerElectronicRecords: {
    legallyRequiredWrittenNoticeProvidedElectronically: false
  },
  asOf: "2026-10-06", action: "draft"
};
baseAgreement.document.approvedSnapshotHash = agreementReviewDigest({
  type: baseAgreement.type, jurisdictionCode: baseAgreement.jurisdiction.code,
  document: baseAgreement.document, agreement: baseAgreement.agreement
});

describe("SONARA cross-suite monetary boundary, preview-only", () => {
  it("maps every supported suite to explicit beneficiaries and flags custody", () => {
    assert.equal(MONEY_PATHS.sonara_subscription.account, "platform");
    assert.equal(MONEY_PATHS.merchant_storefront.account, "connected");
    assert.equal(MONEY_PATHS.creator_marketplace.account, "connected");
    assert.equal(MONEY_PATHS.rental_security_deposit.reviewRequired, true);
    assert.equal(MONEY_PATHS.wallet_stored_value.model, "prohibited_unlicensed");
  });
  it("provides draft inspection for direct-charge receipts but never executes", () => {
    const result = moneyPathPreflight(goodContext);
    assert.equal(result.status, "draft_review_ready");
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.transfersValue, false);
    assert.equal(result.complianceCertified, false);
  });
  it("blocks cross-tenant identity and payer-supplied connected accounts", () => {
    const cross = moneyPathPreflight({ ...goodContext, authenticatedOrganizationId: FOREIGN });
    assert.ok(cross.blockers.includes("tenant_scope_unverified"));
    const rerouted = moneyPathPreflight({ ...goodContext, proposedAccount: "acct_9999999999" });
    assert.ok(rerouted.blockers.includes("payee_routing_mismatch"));
  });
  it("quarantines payee or bank change attempts for independent step-up review", () => {
    const result = moneyPathPreflight({ ...goodContext,
      changeRequest: { connectedAccount: "acct_9999999999" } });
    assert.ok(result.blockers.includes("payee_change_step_up_independent_verification_required"));
  });
  it("rejects floats, negative, zero, unsafe and non-USD assumptions", () => {
    for (const grossCents of [0, -3, 12.5, "120", Number.MAX_SAFE_INTEGER + 1]) {
      assert.ok(moneyPathPreflight({ ...goodContext, grossCents }).blockers.includes("invalid_gross_cents"));
    }
    assert.ok(moneyPathPreflight({ ...goodContext, currency: "JPY" }).blockers.includes("currency_requires_separate_money_precision_review"));
  });
  it("requires a distinct platform billing destination for SONARA subscriptions", () => {
    assert.equal(moneyPathPreflight({ ...goodContext, flow: "sonara_subscription", expectedAccount: "sonara_platform",
      proposedAccount: "sonara_platform" }).status, "draft_review_ready");
    assert.ok(moneyPathPreflight({ ...goodContext, flow: "sonara_subscription" }).blockers.includes("platform_billing_account_mismatch"));
  });
  it("blocks wallets, escrow, peer transfers and cash advances", () => {
    for (const flow of ["wallet_stored_value", "custody_escrow", "customer_to_customer_transfer", "merchant_cash_advance"]) {
      const result = moneyPathPreflight({ ...goodContext, flow, ownerApproval: true, legalApproval: true });
      assert.equal(result.status, "blocked_pending_review");
      assert.equal(result.executionAuthorized, false);
      assert.ok(result.blockers.includes("regulated_money_movement_not_enabled"));
    }
  });
  it("never approves a rent/deposit payment merely because owner and lawyer approved a draft", () => {
    const result = moneyPathPreflight({ ...goodContext, flow: "rental_security_deposit",
      ownerApproval: true, legalApproval: true });
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.status, "draft_review_ready");
  });
  it("does not route Growth campaign budgets through customer balance transfers", () => {
    const result = moneyPathPreflight({ ...goodContext, flow: "growth_campaign_spend",
      ownerApproval: true, legalApproval: true });
    assert.ok(result.blockers.includes("provider_spend_must_use_approved_external_billing"));
  });
});

describe("SONARA reconciliation math and anti-duplicate provenance", () => {
  it("reconciles exact server and processor windows as observed events, not cash balance", () => {
    const result = auditMoneyEvents(matched([charge, refund]));
    assert.equal(result.status, "matched_processor_events");
    assert.equal(result.certain, true);
    assert.equal(result.grossCents, 5000);
    assert.equal(result.refundCents, 1000);
    assert.equal(result.observedNetBeforeFeesCents, 4000);
    assert.equal(result.bankSettlementProven, false);
    assert.equal(result.custodyProven, false);
  });
  it("rejects incomplete windows instead of calling missing money zero", () => {
    const result = auditMoneyEvents({ ...matched([charge]), providerComplete: false });
    assert.equal(result.status, "incomplete_evidence");
    assert.equal(result.grossCents, null);
  });
  it("catches duplicate processor event IDs", () => {
    const result = auditMoneyEvents(matched([charge, charge]));
    assert.ok(result.issues.includes("provider_duplicate_event"));
    assert.equal(result.grossCents, null);
  });
  it("catches a local amount or status that disagrees with verified processor evidence", () => {
    const result = auditMoneyEvents(matched([charge], [{ ...charge, amountCents: 4800 }]));
    assert.ok(result.issues.includes("event_disagrees_with_processor"));
    assert.equal(result.certain, false);
  });
  it("catches forged connected account and cross-organization records", () => {
    const result = auditMoneyEvents(matched([charge], [{ ...charge, organizationId: FOREIGN }]));
    assert.ok(result.issues.includes("recorded_tenant_account_currency_mismatch"));
  });
  it("rejects unexpected provider receipts missing locally", () => {
    const result = auditMoneyEvents(matched([charge], []));
    assert.ok(result.issues.includes("provider_event_unrecorded"));
  });
  it("rejects local paid receipts missing from complete provider window", () => {
    const result = auditMoneyEvents(matched([], [charge]));
    assert.ok(result.issues.includes("recorded_event_not_observed"));
  });
  it("rejects refunds without an original charge", () => {
    const result = auditMoneyEvents(matched([refund]));
    assert.ok(result.issues.includes("refund_without_matching_charge"));
  });
  it("rejects refunds exceeding the original gross charge", () => {
    const invalidRefund = providerEvent("re_222", "refund", 5100, "ch_123");
    const result = auditMoneyEvents(matched([charge, invalidRefund]));
    assert.ok(result.issues.includes("refund_exceeds_charge"));
  });
  it("tracks open disputes separately rather than silently calling them refunds", () => {
    const dispute = providerEvent("dp_123", "dispute", 1000, "ch_123");
    const result = auditMoneyEvents(matched([charge, dispute]));
    assert.equal(result.status, "matched_processor_events");
    assert.equal(result.unresolvedDisputeCents, 1000);
    assert.equal(result.observedNetBeforeFeesCents, 5000);
    assert.equal(result.bankSettlementProven, false);
  });
  it("refuses unverified pending events and unsafe amounts", () => {
    const result = auditMoneyEvents(matched([{ ...charge, status: "pending" }]));
    assert.ok(result.issues.includes("provider_unsettled_event"));
    assert.equal(result.certain, false);
    const invalid = auditMoneyEvents(matched([{ ...charge, amountCents: 2.5 }]));
    assert.ok(invalid.issues.includes("provider_event_unreadable"));
  });
});

describe("SONARA leasing/subscription contract evidence, review-only", () => {
  it("produces a document fingerprint only for an approved exact version", () => {
    const result = contractEvidencePreflight(baseAgreement);
    assert.equal(result.status, "draft_structurally_reviewed");
    assert.equal(result.documentDigest.length, 64);
    assert.equal(result.signatureCollected, false);
    assert.equal(result.customerAccepted, false);
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.enforceabilityProven, false);
  });
  it("blocks a fee change even when the approved contract prose is untouched", () => {
    const adjusted = contractEvidencePreflight({ ...baseAgreement,
      agreement: { ...baseAgreement.agreement, recurringCents: 29000 } });
    assert.ok(adjusted.blockers.includes("counsel_scope_review_missing_or_text_changed"));
    assert.equal(adjusted.documentDigest, null);
    assert.equal(adjusted.legalApprovalRecorded, false);
  });
  it("blocks unreviewed new contract terms hidden in optional metadata", () => {
    const adjusted = contractEvidencePreflight({ ...baseAgreement,
      agreement: { ...baseAgreement.agreement, newLiquidatedDamagesCents: 150000 } });
    assert.ok(adjusted.blockers.includes("counsel_scope_review_missing_or_text_changed"));
  });
  it("blocks stale counsel approvals even when text and price remain unchanged", () => {
    const adjusted = contractEvidencePreflight({ ...baseAgreement,
      document: { ...baseAgreement.document, approvalExpiresOn: "2026-10-05" } });
    assert.ok(adjusted.blockers.includes("counsel_scope_review_missing_or_text_changed"));
  });
  it("has canonical review digests regardless of harmless object key ordering", () => {
    const reordered = Object.fromEntries(Object.entries(baseAgreement.agreement).reverse());
    assert.equal(agreementReviewDigest({
      type: baseAgreement.type, jurisdictionCode: baseAgreement.jurisdiction.code,
      document: baseAgreement.document, agreement: reordered
    }), baseAgreement.document.approvedSnapshotHash);
  });
  it("fails closed on unserializable terms and unsupported financial metadata", () => {
    const adjusted = contractEvidencePreflight({ ...baseAgreement,
      agreement: { ...baseAgreement.agreement, supplement: undefined } });
    assert.ok(adjusted.blockers.includes("agreement_snapshot_unverifiable"));
  });
  it("blocks silently edited legal text after approval", () => {
    const result = contractEvidencePreflight({ ...baseAgreement,
      document: { ...baseAgreement.document, text: fullBody + " Surprise auto-renewal." } });
    assert.ok(result.blockers.includes("counsel_scope_review_missing_or_text_changed"));
    assert.equal(result.documentDigest, null);
  });
  it("requires an authorized signer and separately verified customer", () => {
    assert.ok(contractEvidencePreflight({ ...baseAgreement,
      actor: { ...baseAgreement.actor, organizationId: FOREIGN }
    }).blockers.includes("signer_authority_unverified"));
    assert.ok(contractEvidencePreflight({ ...baseAgreement,
      counterparty: { ...baseAgreement.counterparty, identityVerified: false }
    }).blockers.includes("counterparty_identity_review_missing"));
  });
  it("requires a reproducible copy and all required disclosures", () => {
    assert.ok(contractEvidencePreflight({ ...baseAgreement,
      document: { ...baseAgreement.document, reproducibleCopyAvailable: false }
    }).blockers.includes("versioned_retainable_copy_missing"));
    assert.ok(contractEvidencePreflight({ ...baseAgreement,
      document: { ...baseAgreement.document, sections: ["parties_and_authority"] }
    }).blockers.some(x => x.startsWith("missing_section:")));
  });
  it("blocks contract signing despite structurally complete agreement", () => {
    const result = contractEvidencePreflight({ ...baseAgreement, action: "sign" });
    assert.ok(result.blockers.includes("contract_execution_not_authorized"));
  });
  it("blocks electronic consumer notice without verified affirmative and retainable consent", () => {
    const result = contractEvidencePreflight({ ...baseAgreement,
      consumerElectronicRecords: {
        legallyRequiredWrittenNoticeProvidedElectronically: true,
        affirmativeConsent: true, consentWithdrawn: false,
        paperOptionExplained: true, withdrawalExplained: true,
        hardwareRequirementsShown: true, accessDemonstrated: false,
        retentionCopyAvailable: false, consentRecordRef: ""
      }
    });
    assert.ok(result.blockers.includes("esign_consumer_electronic_records_consent_incomplete"));
  });
  it("does not infer E-SIGN exemption when applicability is unknown", () => {
    assert.ok(contractEvidencePreflight({ ...baseAgreement,
      consumerElectronicRecords: {}
    }).blockers.includes("esign_applicability_unresolved"));
  });
  it("requires provenance and scope before digital intellectual-property rights can be offered", () => {
    const doc = { ...baseAgreement.document, reviewedType: "digital_content_license" };
    const result = contractEvidencePreflight({ ...baseAgreement, type: "digital_content_license",
      document: doc });
    assert.ok(result.blockers.includes("content_rights_chain_missing"));
    assert.ok(result.blockers.includes("reproduction_distribution_derivative_rights_missing"));
  });
  it("requires deposit, fair-housing, repair and lead disclosure reviews in housing leases", () => {
    const result = contractEvidencePreflight({ ...baseAgreement, type: "residential_lease",
      document: { ...baseAgreement.document, reviewedType: "residential_lease" }
    });
    for (const code of ["fair_housing_review_missing", "security_deposit_rules_review_missing",
      "housing_notice_and_repair_review_missing", "lead_disclosure_applicability_review_missing"]) {
      assert.ok(result.blockers.includes(code));
    }
  });
  it("requires Regulation M review when an equipment lease is for household use", () => {
    const result = contractEvidencePreflight({ ...baseAgreement, type: "equipment_lease",
      document: { ...baseAgreement.document, reviewedType: "equipment_lease" },
      agreement: { ...baseAgreement.agreement, personalFamilyHouseholdUse: true } });
    assert.ok(result.blockers.includes("consumer_regulation_m_review_missing"));
  });
  it("rejects renewals that conceal recurring billing or cancellation", () => {
    const result = contractEvidencePreflight({ ...baseAgreement,
      agreement: { ...baseAgreement.agreement, clearCancellationPathShown: false } });
    assert.ok(result.blockers.includes("subscription_renewal_cancellation_missing"));
  });
});