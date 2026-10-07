// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const {
  createDraftJournal, verifyDraftChain, depositPosition
} = require("../lib/sonara-lease-ledger.cjs");
const {
  riskPreflight, ohioDepositDeadline
} = require("../lib/sonara-lease-policy-gates.cjs");
const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CONTRACT = "33333333-3333-4333-8333-333333333333";
const EVENT1 = "44444444-4444-4444-8444-444444444444";
const EVENT2 = "55555555-5555-4555-8555-555555555555";
function evidence(sourceEventId, amountCents = 10000) {
  return {
    type: "verified_provider_event", verifiedByServer: true, status: "succeeded",
    provider: "stripe", providerAccountRef: "acct_example",
    providerEventRef: sourceEventId, organizationId: ORG, amountCents, currency: "USD"
  };
}
function journal(override = {}) {
  const sourceEventId = override.sourceEventId || "evt_1";
  const amountCents = override.amountCents === undefined ? 10000 : override.amountCents;
  return createDraftJournal({
    organizationId: ORG, contractId: CONTRACT, ledgerId: "lease_books",
    eventId: EVENT1, sourceEventId, kind: "deposit_received",
    amountCents, currency: "USD", sequence: 1, previousHash: null,
    occurredAt: "2026-10-06T16:00:00Z", evidence: evidence(sourceEventId, amountCents),
    ...override
  });
}
const COLUMBUS = { verifiedByAuthority: true, country: "US", state: "OH", municipality: "Columbus", jurisdictionKey: "US-OH-COLUMBUS" };
function preflight(overrides = {}) {
  return riskPreflight({
    transactionClass: "residential_property", location: COLUMBUS,
    asOf: "2026-10-06", action: "draft",
    actor: { authorityVerified: true, authorizationReference: "owner_ref", rentalUnits: 5 },
    policy: {
      reviewerRole: "qualified_counsel", decision: "approved_for_scope",
      reviewedOn: "2026-10-01", expiresOn: "2026-12-31", jurisdictionKey: "US-OH-COLUMBUS",
      transactionClass: "residential_property"
    },
    terms: {
      versionApproved: true, termsVersion: "lease_v3", requiredChargesCents: 100000,
      fairHousingReview: true, securityDepositCents: 10000, depositLedgerEnabled: true,
      registryApplicabilityReviewed: true,
      writtenDepositAlternativesDelivered: true, depositInstallmentOptions: [3, 6]
    },
    screening: { sourceOfIncomeNeutral: true },
    ...overrides
  });
}

describe("SONARA draft lease and licensing ledger (no money moved)", () => {
  it("creates an exact balanced cents-only draft with provider evidence reference", () => {
    const row = journal();
    assert.equal(row.status, "draft_unposted");
    assert.equal(row.lines[0].side, "debit");
    assert.equal(row.lines[1].side, "credit");
    assert.equal(row.lines[0].amountCents, row.lines[1].amountCents);
    assert.equal(row.lines[1].account, "refundable_deposit_liability");
    assert.equal(row.evidenceRef, "evt_1");
    assert.equal(row.hash.length, 64);
    assert.equal(row.organizationId, ORG);
    assert.equal(depositPosition([row], { organizationId: ORG, ledgerId: "lease_books", contractId: CONTRACT }).actualLiabilityCents, null);
    assert.equal(verifyDraftChain([row], { organizationId: ORG, ledgerId: "lease_books" }).ok, true);
  });
  it("rejects decimal, negative, zero, numeric string, overflow and unsupported currency", () => {
    for (const amount of [-1, 0, 100.5, "100", Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => journal({ amountCents: amount }), /invalid_amount_cents/);
    }
    assert.throws(() => journal({ currency: "EUR" }), /unsupported_currency/);
  });
  it("rejects unverified payments and forged provider tenant or amount evidence", () => {
    assert.throws(() => journal({ evidence: { ...evidence("evt_1"), verifiedByServer: false } }), /unsettled_provider_event/);
    assert.throws(() => journal({ evidence: { ...evidence("evt_1"), status: "pending" } }), /unsettled_provider_event/);
    assert.throws(() => journal({ evidence: { ...evidence("evt_1"), organizationId: OTHER } }), /evidence_tenant_mismatch/);
    assert.throws(() => journal({ evidence: { ...evidence("evt_1"), amountCents: 1 } }), /provider_amount_or_currency_mismatch/);
    assert.throws(() => journal({ evidence: { ...evidence("evt_bad") } }), /source_event_mismatch/);
  });
  it("does not create a source-less provider payment or allow a second first-entry marker", () => {
    assert.throws(() => journal({ sourceEventId: "" }), /invalid_source_event_id/);
    assert.throws(() => journal({ sequence: 2, previousHash: null }), /invalid_previous_hash/);
  });
  it("validates chain order and rejects duplicate provider events even with different entry IDs", () => {
    const first = journal();
    const next = journal({
      kind: "deposit_refunded", eventId: EVENT2, sourceEventId: "evt_2",
      sequence: 2, previousHash: first.hash, evidence: evidence("evt_2")
    });
    assert.equal(verifyDraftChain([first, next], { organizationId: ORG, ledgerId: "lease_books" }).ok, true);
    assert.equal(depositPosition([first, next], { organizationId: ORG, ledgerId: "lease_books", contractId: CONTRACT }).projectedLiabilityCents, 0);
    const duplicate = journal({
      eventId: EVENT2, sequence: 2, previousHash: first.hash,
      sourceEventId: "evt_1", evidence: evidence("evt_1")
    });
    assert.ok(verifyDraftChain([first, duplicate], { organizationId: ORG, ledgerId: "lease_books" }).failures.some(x => x.startsWith("duplicate_source")));
    assert.equal(verifyDraftChain([next, first], { organizationId: ORG, ledgerId: "lease_books" }).ok, false);
  });
  it("detects mutated amounts, tampered lines, extra fields and wrong tenant", () => {
    const first = journal();
    for (const changed of [
      { ...first, amountCents: 20000 },
      { ...first, lines: [{ ...first.lines[0], amountCents: 999 }, first.lines[1]] },
      { ...first, forged: "changed" }
    ]) assert.equal(verifyDraftChain([changed], { organizationId: ORG, ledgerId: "lease_books" }).ok, false);
    assert.equal(verifyDraftChain([first], { organizationId: OTHER, ledgerId: "lease_books" }).ok, false);
  });
  it("tracks a deposit as customer liability; flags attempted overdraw rather than masking it", () => {
    const first = journal();
    const returned = journal({
      kind: "deposit_refunded", amountCents: 15000, eventId: EVENT2,
      sourceEventId: "evt_2", sequence: 2, previousHash: first.hash,
      evidence: evidence("evt_2", 15000)
    });
    const out = depositPosition([first, returned], { organizationId: ORG, ledgerId: "lease_books", contractId: CONTRACT });
    assert.deepEqual(out, { mathVerified: false, projectedLiabilityCents: null, actualLiabilityCents: null, issue: "deposit_overdrawn" });
  });
  it("requires documented owner and legal approval for deduction proposals", () => {
    const first = journal();
    assert.throws(() => journal({
      kind: "deposit_applied_pending_review", evidence: evidence("evt_1")
    }), /owner_approval_required/);
    const deduction = journal({
      kind: "deposit_applied_pending_review", eventId: EVENT2,
      sourceEventId: "deduction_2", sequence: 2, previousHash: first.hash,
      amountCents: 1000,
      evidence: { type: "approved_documented_adjustment", organizationId: ORG,
        ownerApproved: true, legalReviewRecorded: true, reviewerRef: "legal_ref",
        documentRef: "damage_photo_ref" }
    });
    assert.equal(depositPosition([first, deduction], { organizationId: ORG, ledgerId: "lease_books", contractId: CONTRACT }).projectedLiabilityCents, 9000);
  });
});

describe("SONARA review-only jurisdiction and customer protections", () => {
  it("allows only drafting after evidence; never authorizes regulated execution", () => {
    const draft = preflight();
    assert.equal(draft.readyForDraftReview, true);
    assert.equal(draft.actionAuthorized, false);
    assert.equal(draft.complianceClaim, false);
    for (const action of ["sign", "accept_payment", "deny", "evict", "transfer_deposit"]) {
      const result = preflight({ action });
      assert.equal(result.readyForDraftReview, false);
      assert.ok(result.blockers.includes("non_draft_action_requires_separate_server_authorization"));
    }
  });
  it("blocks unknown jurisdiction, missing actor authority and out-of-scope counsel", () => {
    assert.ok(preflight({ location: { country: "US", state: "OH", municipality: "Columbus" } }).blockers.includes("jurisdiction_unverified"));
    assert.ok(preflight({ actor: { authorityVerified: false } }).blockers.includes("actor_authority_missing"));
    assert.ok(preflight({ policy: { reviewerRole: "qualified_counsel", decision: "approved_for_scope", transactionClass: "vehicle_lease", reviewedOn: "2026-10-01", expiresOn: "2026-12-31", jurisdictionKey: "US-OH-COLUMBUS" } }).blockers.includes("qualified_legal_scope_review_missing_or_expired"));
    assert.equal(preflight({ asOf: "2026-02-30" }).state, "blocked_pending_review");
    assert.ok(preflight({ policy: { reviewerRole: "qualified_counsel", decision: "approved_for_scope", transactionClass: "residential_property", reviewedOn: "2026-10-01", expiresOn: "2026-12-31", jurisdictionKey: "US-OH-CLEVELAND" } }).blockers.includes("qualified_legal_scope_review_missing_or_expired"));
  });
  it("applies Columbus 5+ unit deposit-alternatives checks and the October 2026 registry review", () => {
    const baseline = preflight();
    assert.ok(baseline.advisory.some(x => x.includes("rental_registry_initial_window")));
    const withoutAlternatives = preflight({
      terms: {
        versionApproved: true, termsVersion: "v1", requiredChargesCents: 0,
        fairHousingReview: true, securityDepositCents: 10000, depositLedgerEnabled: true,
        registryApplicabilityReviewed: true, writtenDepositAlternativesDelivered: false
      }
    });
    assert.ok(withoutAlternatives.blockers.includes("columbus_renter_choice_notice_or_options_missing"));
    const missingUnitCount = preflight({ actor: { authorityVerified: true, authorizationReference: "owner_ref" } });
    assert.ok(missingUnitCount.blockers.includes("columbus_renter_choice_unit_count_missing"));
    const after = preflight({ asOf: "2027-01-02", policy: {
      reviewerRole: "qualified_counsel", decision: "approved_for_scope",
      reviewedOn: "2026-12-15", expiresOn: "2027-04-01", transactionClass: "residential_property", jurisdictionKey: "US-OH-COLUMBUS"
    } });
    assert.ok(after.blockers.includes("columbus_rental_registry_registration_unverified"));
  });
  it("requires FCRA screening vendor and notices when reports influence adverse action", () => {
    const result = preflight({
      screening: { sourceOfIncomeNeutral: true, usesConsumerReport: true, proposedAdverseAction: true }
    });
    for (const code of ["fcra_permissible_purpose_missing", "screening_vendor_review_missing", "fcra_adverse_action_notice_review_missing"]) {
      assert.ok(result.blockers.includes(code));
    }
    assert.ok(result.advisory.includes("never_auto_reject_application"));
  });
  it("does not treat vehicle/equipment consumer leases as residential tenancies", () => {
    const result = preflight({
      transactionClass: "equipment_lease",
      policy: { reviewerRole: "qualified_counsel", decision: "approved_for_scope",
        transactionClass: "equipment_lease", reviewedOn: "2026-10-01", expiresOn: "2026-12-31", jurisdictionKey: "US-OH-COLUMBUS" },
      terms: { versionApproved: true, termsVersion: "lease_v1",
        requiredChargesCents: 1000, consumerPurpose: true }
    });
    assert.ok(result.blockers.includes("consumer_leasing_regulation_m_review_missing"));
    assert.equal(result.advisory.includes("ohio_5321_16_deposit_interest_and_return_deduction_review"), false);
  });
  it("holds digital licensing unless rights, identity and grant scope are reviewed", () => {
    const result = preflight({
      transactionClass: "digital_content_license",
      policy: { reviewerRole: "qualified_counsel", decision: "approved_for_scope",
        transactionClass: "digital_content_license", reviewedOn: "2026-10-01", expiresOn: "2026-12-31", jurisdictionKey: "US-OH-COLUMBUS" }
    });
    assert.ok(result.blockers.includes("media_license_rights_unverified"));
    assert.ok(result.blockers.includes("seller_identity_unverified"));
    assert.equal(result.actionAuthorized, false);
  });
  it("sets a reminder 30 calendar days after later termination or possession return", () => {
    assert.deepEqual(ohioDepositDeadline({ terminationDate: "2026-10-01", possessionReturnedDate: "2026-10-06" }),
      { known: true, dueDate: "2026-11-05", reviewRequired: true });
    assert.equal(ohioDepositDeadline({ terminationDate: "2026-10-01" }).known, false);
  });
});

describe("Columbus customer-facing deposit and rent allocation calculations", () => {
  const { draftRentFirstAllocation, draftDepositInstallments } =
    require("../lib/sonara-rental-customer-protections.cjs");
  const leaseDate = "2026-10-06";

  it("allocates periodic tender to rent before fees without moving money", () => {
    const result = draftRentFirstAllocation({
      location: COLUMBUS, writtenLeaseExecutedOrRenewedOn: leaseDate,
      tenderCents: 8500, rentDueCents: 8000, otherChargesDueCents: 3000
    });
    assert.equal(result.rentAppliedCents, 8000);
    assert.equal(result.otherAppliedCents, 500);
    assert.equal(result.otherStillDueCents, 2500);
    assert.equal(result.unappliedCents, 0);
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.state, "draft_unposted");
  });

  it("retains excess tender as unapplied; never silently converts it into fees", () => {
    const result = draftRentFirstAllocation({
      location: COLUMBUS, writtenLeaseExecutedOrRenewedOn: leaseDate,
      tenderCents: 18000, rentDueCents: 8000, otherChargesDueCents: 3000
    });
    assert.equal(result.rentAppliedCents, 8000);
    assert.equal(result.otherAppliedCents, 3000);
    assert.equal(result.unappliedCents, 7000);
  });

  it("rejects non-Columbus or unknown lease-date allocations and unsafe money inputs", () => {
    const valid = { location: COLUMBUS, writtenLeaseExecutedOrRenewedOn: leaseDate,
      tenderCents: 1000, rentDueCents: 1000, otherChargesDueCents: 0 };
    assert.throws(() => draftRentFirstAllocation({ ...valid, location: { country: "US", state: "OH" } }), /columbus_jurisdiction_unverified/);
    assert.throws(() => draftRentFirstAllocation({ ...valid, writtenLeaseExecutedOrRenewedOn: "2025-01-31" }), /lease_cohort_requires_review/);
    assert.throws(() => draftRentFirstAllocation({ ...valid, tenderCents: 1.5 }), /invalid_tender_cents/);
    assert.throws(() => draftRentFirstAllocation({ ...valid, rentDueCents: -1 }), /invalid_rent_due_cents/);
  });

  it("generates exact three- and six-month deposit options without penny leakage", () => {
    const common = {
      depositCents: 10001, startDueMonth: "2026-10", rentDueDay: 15,
      location: COLUMBUS, rentalUnits: 5, writtenAlternativesDelivered: true
    };
    for (const n of [3, 6]) {
      const result = draftDepositInstallments({ ...common, numberOfPayments: n });
      assert.equal(result.installments.length, n);
      assert.equal(result.installments.reduce((sum, x) => sum + x.depositCents, 0), common.depositCents);
      assert.equal(result.installments[0].dueDate, "2026-10-15");
      assert.equal(result.executionAuthorized, false);
      assert.equal(result.consentAndContractReviewRequired, true);
    }
    assert.deepEqual(
      draftDepositInstallments({ ...common, numberOfPayments: 3 }).installments.map(x => x.depositCents),
      [3334, 3334, 3333]
    );
  });

  it("refuses unreviewed notices, operator scope, unsupported days and dates", () => {
    const values = {
      depositCents: 12000, numberOfPayments: 3,
      startDueMonth: "2026-10", rentDueDay: 10,
      location: COLUMBUS, rentalUnits: 5, writtenAlternativesDelivered: true
    };
    assert.throws(() => draftDepositInstallments({ ...values, writtenAlternativesDelivered: false }), /written_notice_not_confirmed/);
    assert.throws(() => draftDepositInstallments({ ...values, rentalUnits: 4 }), /renter_choice_scope_requires_review/);
    assert.throws(() => draftDepositInstallments({ ...values, numberOfPayments: 2 }), /invalid_installment_option/);
    assert.throws(() => draftDepositInstallments({ ...values, rentDueDay: 31 }), /rent_due_day_needs_manual_schedule_review/);
    assert.throws(() => draftDepositInstallments({ ...values, startDueMonth: "2026-13" }), /invalid_start_month/);
  });
});
