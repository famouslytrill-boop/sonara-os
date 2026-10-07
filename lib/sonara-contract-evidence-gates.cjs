// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { createHash } = require("node:crypto");

// Contract drafting/evidence checklist ONLY. Never executes signatures,
// binds a party, sends legal notices, approves screening or authorizes payment.
// Legal requirements vary by agreement type and jurisdiction. A draft may be
// structurally complete and still be unenforceable until counsel reviews it.

const CONTRACT_TYPES = Object.freeze([
  "residential_lease", "commercial_lease", "equipment_lease",
  "digital_content_license", "merchant_purchase", "saas_subscription"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const LEGAL_APPROVAL = "counsel_approved_for_this_type_and_jurisdiction";
const REQUIRED_SECTIONS = Object.freeze([
  "parties_and_authority", "goods_or_premises_or_rights",
  "price_and_periodic_fees", "taxes_and_deposits",
  "renewal_and_termination", "refunds_disputes_and_remedies",
  "customer_support_and_notice", "privacy_data_and_retention"
]);

// Freeze the ENTIRE reviewed commercial schedule, not just the visible prose.
// A lawyer's approval of $29/month cannot be reused for $290/month by changing
// independent JSON metadata without changing the document text.
function canonicalJSON(value, depth = 0) {
  if (depth > 16) throw new Error("agreement_snapshot_too_deep");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("agreement_snapshot_unsafe_number");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new Error("agreement_snapshot_too_large");
    return value.map((entry) => canonicalJSON(entry, depth + 1));
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("agreement_snapshot_invalid_field");
  }
  const keys = Object.keys(value).sort();
  if (keys.length > 150 || keys.some((key) => ["__proto__", "prototype", "constructor"].includes(key))) {
    throw new Error("agreement_snapshot_invalid_field");
  }
  const out = {};
  for (const key of keys) {
    if (value[key] === undefined) throw new Error("agreement_snapshot_invalid_field");
    out[key] = canonicalJSON(value[key], depth + 1);
  }
  return out;
}
function agreementReviewDigest({ type, jurisdictionCode, document, agreement } = {}) {
  if (!CONTRACT_TYPES.includes(type) || typeof jurisdictionCode !== "string" ||
      !document || typeof document.version !== "string" || typeof document.text !== "string" ||
      !Array.isArray(document.sections) || !agreement || typeof agreement !== "object") return null;
  try {
    const envelope = canonicalJSON({
      type, jurisdictionCode, version: document.version,
      text: document.text, sections: [...document.sections].sort(), agreement
    });
    const encoded = JSON.stringify(envelope);
    if (encoded.length > 131072) return null;
    return createHash("sha256").update(encoded, "utf8").digest("hex");
  } catch {
    return null;
  }
}

function contractEvidencePreflight({ type, organizationId, actor, counterparty,
  jurisdiction, document, agreement, consumerElectronicRecords, action = "draft",
  asOf
} = {}) {
  const blockers = [];
  const block = (condition, code) => { if (!condition) blockers.push(code); };
  const supported = CONTRACT_TYPES.includes(type);
  block(supported, "unsupported_agreement_type");
  block(typeof organizationId === "string" && UUID.test(organizationId), "organization_unverified");
  block(typeof actor?.id === "string" && UUID.test(actor.id) &&
    actor.organizationId === organizationId && actor.authorizedByServer === true,
  "signer_authority_unverified");
  block(typeof counterparty?.id === "string" && UUID.test(counterparty.id) &&
    counterparty.identityVerified === true, "counterparty_identity_review_missing");
  block(jurisdiction?.verified === true && typeof jurisdiction.code === "string" &&
    jurisdiction.code.length > 2, "jurisdiction_unverified");
  block(typeof asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asOf) &&
    Number.isFinite(Date.parse(asOf + "T00:00:00Z")) &&
    new Date(asOf + "T00:00:00Z").toISOString().slice(0, 10) === asOf, "review_date_unverified");
  const approvedBodyHash = typeof document?.text === "string"
    ? createHash("sha256").update(document.text, "utf8").digest("hex") : null;
  const fullReviewHash = agreementReviewDigest({ type, jurisdictionCode: jurisdiction?.code, document, agreement });
  block(fullReviewHash !== null, "agreement_snapshot_unverifiable");
  block(document?.legalReviewStatus === LEGAL_APPROVAL &&
    document?.reviewedJurisdiction === jurisdiction?.code &&
    document?.reviewedType === type &&
    document?.approvedTextHash === approvedBodyHash &&
    HEX64.test(document?.approvedTextHash || "") &&
    fullReviewHash !== null &&
    HEX64.test(document?.approvedSnapshotHash || "") &&
    document.approvedSnapshotHash === fullReviewHash &&
    typeof document?.reviewerRef === "string" && document.reviewerRef.length > 2 &&
    typeof document?.approvalEvidenceRef === "string" && document.approvalEvidenceRef.length > 2 &&
    typeof document?.approvedOn === "string" && !Number.isNaN(Date.parse(document.approvedOn)) &&
    document.approvedOn <= asOf &&
    typeof document?.approvalExpiresOn === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(document.approvalExpiresOn) &&
    document.approvalExpiresOn >= asOf,
    "counsel_scope_review_missing_or_text_changed");
  block(typeof document?.text === "string" && document.text.trim().length >= 50, "full_document_text_missing");
  block(typeof document?.version === "string" && document.version.trim().length > 0, "document_version_missing");
  block(document?.immutableVersionStored === true && document?.reproducibleCopyAvailable === true,
    "versioned_retainable_copy_missing");
  const existing = new Set(Array.isArray(document?.sections) ? document.sections : []);
  for (const section of REQUIRED_SECTIONS) block(existing.has(section), "missing_section:" + section);
  block(Number.isSafeInteger(agreement?.oneTimeCents) && agreement.oneTimeCents >= 0 &&
    Number.isSafeInteger(agreement?.recurringCents) && agreement.recurringCents >= 0 &&
    agreement?.currency === "USD", "price_fees_unverified");
  block(agreement?.totalPriceDisplayed === true, "total_price_not_disclosed");
  block(agreement?.disputeProcedureDisplayed === true && agreement?.cancellationTermsDisplayed === true,
    "customer_remedies_not_disclosed");
  block(agreement?.supportChannelVerified === true && agreement?.noticeDeliveryReviewed === true,
    "notice_and_support_unverified");

  if (["residential_lease", "commercial_lease", "equipment_lease"].includes(type)) {
    block(agreement?.ownerOrBrokerAuthorityVerified === true, "property_or_equipment_owner_authority_missing");
    block(agreement?.conditionReturnAndDamageTermsReviewed === true, "maintenance_return_damage_terms_missing");
    block(agreement?.depositCustodyRoleReviewed === true, "deposit_custody_and_accounting_review_missing");
  }
  if (type === "residential_lease") {
    block(agreement?.fairHousingReview === true, "fair_housing_review_missing");
    block(agreement?.tenantNoticesAndRepairProcessReviewed === true, "housing_notice_and_repair_review_missing");
    block(agreement?.securityDepositRulesReviewed === true, "security_deposit_rules_review_missing");
    block(agreement?.requiredLeadDisclosureReviewed === true, "lead_disclosure_applicability_review_missing");
  }
  if (type === "equipment_lease") {
    block(agreement?.leaseVsSecurityInterestReviewed === true, "lease_finance_classification_missing");
    if (agreement?.personalFamilyHouseholdUse === true) {
      block(agreement?.regulationMReviewed === true, "consumer_regulation_m_review_missing");
    }
  }
  if (type === "digital_content_license") {
    block(agreement?.chainOfTitleVerified === true, "content_rights_chain_missing");
    block(agreement?.licenseScopeReviewed === true, "reproduction_distribution_derivative_rights_missing");
    block(agreement?.licenseTermTerritoryAndRevocationReviewed === true, "license_duration_territory_revocation_missing");
  }
  if (type === "saas_subscription") {
    block(agreement?.renewalCadenceShown === true &&
      agreement?.clearCancellationPathShown === true, "subscription_renewal_cancellation_missing");
  }
  // ESIGN 15 USC 7001(c): where statutory consumer written disclosures are
  // provided electronically, evidence of affirmative consent, paper rights,
  // withdrawal, technology and ability to access/retain is required.
  if (consumerElectronicRecords?.legallyRequiredWrittenNoticeProvidedElectronically === true) {
    block(consumerElectronicRecords?.affirmativeConsent === true &&
      consumerElectronicRecords?.consentWithdrawn !== true &&
      consumerElectronicRecords?.paperOptionExplained === true &&
      consumerElectronicRecords?.withdrawalExplained === true &&
      consumerElectronicRecords?.hardwareRequirementsShown === true &&
      consumerElectronicRecords?.accessDemonstrated === true &&
      consumerElectronicRecords?.retentionCopyAvailable === true &&
      typeof consumerElectronicRecords?.consentRecordRef === "string" &&
      consumerElectronicRecords.consentRecordRef.length > 2,
    "esign_consumer_electronic_records_consent_incomplete");
  } else {
    // Unknown applicability is not grounds to assume exemption.
    block(consumerElectronicRecords?.legallyRequiredWrittenNoticeProvidedElectronically === false,
      "esign_applicability_unresolved");
  }
  if (action !== "draft") block(false, "contract_execution_not_authorized");
  const inputOk = blockers.length === 0;
  // An immutable text hash is only a fingerprint. It is not a signature, not a
  // notary, and does not prove the customer saw or accepted these terms.
  const draftHash = typeof document?.text === "string" && inputOk
    ? createHash("sha256").update(
      JSON.stringify([organizationId, type, jurisdiction.code, document.version, document.text]),
      "utf8").digest("hex")
    : null;
  return Object.freeze({
    status: inputOk ? "draft_structurally_reviewed" : "blocked_pending_review",
    blockers: Object.freeze(blockers), legalApprovalRecorded: document?.legalReviewStatus === LEGAL_APPROVAL &&
      document?.approvedTextHash === approvedBodyHash &&
      fullReviewHash !== null && document?.approvedSnapshotHash === fullReviewHash,
    documentDigest: draftHash && HEX64.test(draftHash) ? draftHash : null,
    signatureCollected: false, enforceabilityProven: false,
    customerAccepted: false, executionAuthorized: false
  });
}

module.exports = { CONTRACT_TYPES, REQUIRED_SECTIONS, agreementReviewDigest, contractEvidencePreflight };