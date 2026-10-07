// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic calculations for proposed customer-facing rental statements.
// These results do not move money, amend leases, satisfy notice requirements,
// or establish legal eligibility. Call only after trusted jurisdiction preflight.
function cents(n, label, allowZero = true) {
  if (!Number.isSafeInteger(n) || n < 0 || (!allowZero && n === 0)) {
    const e = new Error("invalid_" + label);
    e.code = e.message;
    throw e;
  }
}
function month(value) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error("invalid_start_month");
  }
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2099) throw new Error("invalid_start_month");
  return { year, index: Number(value.slice(5)) - 1 };
}
function utcDate(year, index, day) {
  const dt = new Date(Date.UTC(year, index, day));
  return dt.toISOString().slice(0, 10);
}
function requireColumbusCoverage({ location, writtenLeaseExecutedOrRenewedOn }) {
  if (!location || location.verifiedByAuthority !== true || location.country !== "US" ||
      location.state !== "OH" || location.municipality !== "Columbus" ||
      location.jurisdictionKey !== "US-OH-COLUMBUS") {
    throw new Error("columbus_jurisdiction_unverified");
  }
  if (typeof writtenLeaseExecutedOrRenewedOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(writtenLeaseExecutedOrRenewedOn) ||
      !Number.isFinite(Date.parse(writtenLeaseExecutedOrRenewedOn + "T00:00:00Z")) ||
      new Date(writtenLeaseExecutedOrRenewedOn + "T00:00:00Z").toISOString().slice(0, 10) !== writtenLeaseExecutedOrRenewedOn) {
    throw new Error("lease_execution_date_unverified");
  }
  if (writtenLeaseExecutedOrRenewedOn <= "2025-01-31") {
    throw new Error("lease_cohort_requires_review");
  }
}

// Columbus City Code §4551.071(C) applies periodic tender to rent before
// non-rent charges on covered written leases. Overpayment is NOT quietly spent.
function draftRentFirstAllocation({
  location, writtenLeaseExecutedOrRenewedOn,
  tenderCents, rentDueCents, otherChargesDueCents
} = {}) {
  requireColumbusCoverage({ location, writtenLeaseExecutedOrRenewedOn });
  cents(tenderCents, "tender_cents");
  cents(rentDueCents, "rent_due_cents");
  cents(otherChargesDueCents, "other_charges_due_cents");
  const rentAppliedCents = Math.min(tenderCents, rentDueCents);
  const remaining = tenderCents - rentAppliedCents;
  const otherAppliedCents = Math.min(remaining, otherChargesDueCents);
  return Object.freeze({
    state: "draft_unposted", executionAuthorized: false,
    rentAppliedCents, otherAppliedCents,
    unappliedCents: remaining - otherAppliedCents,
    rentStillDueCents: rentDueCents - rentAppliedCents,
    otherStillDueCents: otherChargesDueCents - otherAppliedCents,
    amountRequiringProviderReconciliationCents: tenderCents
  });
}

// Under Columbus §4551.04 an applicable landlord's notice offers qualifying
// three- and six-month deposit installment alternatives. These are exactly
// equal to the penny as sums; legal choice/eligibility remains owner/counsel
// reviewed. Rent and security deposits MUST remain distinct in the real ledger.
function draftDepositInstallments({
  depositCents, numberOfPayments, startDueMonth, rentDueDay,
  location, rentalUnits, writtenAlternativesDelivered
} = {}) {
  if (!location || location.verifiedByAuthority !== true ||
      location.country !== "US" || location.state !== "OH" ||
      location.municipality !== "Columbus" || location.jurisdictionKey !== "US-OH-COLUMBUS") {
    throw new Error("columbus_jurisdiction_unverified");
  }
  if (!Number.isSafeInteger(rentalUnits) || rentalUnits < 5) {
    throw new Error("renter_choice_scope_requires_review");
  }
  if (writtenAlternativesDelivered !== true) throw new Error("written_notice_not_confirmed");
  if (![3, 6].includes(numberOfPayments)) throw new Error("invalid_installment_option");
  cents(depositCents, "deposit_cents", false);
  if (!Number.isSafeInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 28) {
    throw new Error("rent_due_day_needs_manual_schedule_review");
  }
  const { year, index } = month(startDueMonth);
  const base = Math.floor(depositCents / numberOfPayments);
  const extra = depositCents % numberOfPayments;
  const installments = [];
  for (let i = 0; i < numberOfPayments; i++) {
    installments.push(Object.freeze({
      number: i + 1,
      dueDate: utcDate(year, index + i, rentDueDay),
      depositCents: base + (i < extra ? 1 : 0)
    }));
  }
  return Object.freeze({
    state: "draft_unposted", executionAuthorized: false,
    depositCents, numberOfPayments,
    installments: Object.freeze(installments),
    consentAndContractReviewRequired: true
  });
}
module.exports = { draftRentFirstAllocation, draftDepositInstallments };
