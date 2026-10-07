// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// An accounting-evidence DRAFT ledger for business leasing and licensed media.
// This module neither owns funds nor initiates charges, refunds, payouts, or
// property actions. No caller should present its output as a posted payment.
// Only trusted server-side adapters may supply verified provider evidence.
// Persisting requires a separate, atomic, tenant-scoped, append-only writer.
const { createHash } = require("node:crypto");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const EVENT_KINDS = Object.freeze({
  deposit_received: ["processor_receivable", "refundable_deposit_liability"],
  deposit_refunded: ["refundable_deposit_liability", "processor_receivable"],
  // Pending deductions are memo-only. They MUST NOT debit tenant liability
  // until a separate lawful, evidenced final action is processed by the owner.
  deposit_applied_pending_review: ["pending_deposit_deduction_memo", "pending_deposit_deduction_offset"],
  rent_received: ["processor_receivable", "rent_receipts_clearing"],
  license_fee_received: ["processor_receivable", "license_receipts_clearing"],
  license_fee_refunded: ["license_receipts_clearing", "processor_receivable"]
});
const PROVIDER_KINDS = new Set([
  "deposit_received", "deposit_refunded", "rent_received",
  "license_fee_received", "license_fee_refunded"
]);
const EVIDENCE_KINDS = Object.freeze(["verified_provider_event", "approved_documented_adjustment"]);

function requireValue(ok, code) {
  if (!ok) { const e = new Error(code); e.code = code; throw e; }
}
function requireUuid(value, field) {
  requireValue(typeof value === "string" && UUID.test(value), "invalid_" + field);
}
function requireText(value, field) {
  requireValue(typeof value === "string" && /^[A-Za-z0-9._:-]{1,160}$/.test(value), "invalid_" + field);
}
function requireCents(value) {
  requireValue(typeof value === "number" && Number.isSafeInteger(value) && value > 0, "invalid_amount_cents");
}
function requireTime(value) {
  requireValue(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)), "invalid_occurred_at");
}

function validateEvidence({ kind, amountCents, currency, sourceEventId, organizationId, evidence }) {
  requireValue(evidence && typeof evidence === "object" && !Array.isArray(evidence), "evidence_required");
  requireValue(EVIDENCE_KINDS.includes(evidence.type), "unsupported_evidence_type");
  if (PROVIDER_KINDS.has(kind)) {
    requireValue(evidence.type === "verified_provider_event", "verified_provider_event_required");
    requireValue(evidence.verifiedByServer === true && evidence.status === "succeeded", "unsettled_provider_event");
    requireText(evidence.provider, "provider");
    requireText(evidence.providerAccountRef, "provider_account_ref");
    requireText(evidence.providerEventRef, "provider_event_ref");
    requireValue(evidence.providerEventRef === sourceEventId, "source_event_mismatch");
    requireValue(evidence.organizationId === organizationId, "evidence_tenant_mismatch");
    requireValue(evidence.amountCents === amountCents && evidence.currency === currency, "provider_amount_or_currency_mismatch");
  } else {
    requireValue(evidence.type === "approved_documented_adjustment", "owner_approval_required");
    requireValue(evidence.ownerApproved === true && evidence.legalReviewRecorded === true, "legal_approval_required");
    requireText(evidence.reviewerRef, "reviewer_ref");
    requireText(evidence.documentRef, "document_ref");
    requireValue(evidence.organizationId === organizationId, "evidence_tenant_mismatch");
  }
}

// Produce a reviewable balanced entry, never a live payment.
// Hashes detect accidental edits in a chain. Without independent external
// anchoring and access controls a hash chain is NOT tamper-proof.
function createDraftJournal({
  organizationId, contractId, ledgerId, eventId, sourceEventId, kind,
  amountCents, currency = "USD", sequence, previousHash = null,
  occurredAt, evidence
} = {}) {
  requireUuid(organizationId, "organization_id");
  requireUuid(contractId, "contract_id");
  requireUuid(eventId, "event_id");
  requireText(ledgerId, "ledger_id");
  requireText(sourceEventId, "source_event_id");
  requireValue(Object.hasOwn(EVENT_KINDS, kind), "unsupported_event_kind");
  requireCents(amountCents);
  requireValue(currency === "USD", "unsupported_currency");
  requireValue(Number.isSafeInteger(sequence) && sequence > 0, "invalid_sequence");
  requireValue(
    sequence === 1 ? previousHash === null : typeof previousHash === "string" && HASH.test(previousHash),
    "invalid_previous_hash"
  );
  requireTime(occurredAt);
  validateEvidence({ kind, amountCents, currency, sourceEventId, organizationId, evidence });

  const [debit, credit] = EVENT_KINDS[kind];
  const lines = [
    Object.freeze({ account: debit, side: "debit", amountCents }),
    Object.freeze({ account: credit, side: "credit", amountCents })
  ];
  const draft = {
    version: 1, status: "draft_unposted", organizationId, contractId, ledgerId,
    eventId, sourceEventId, kind, currency, amountCents, sequence,
    previousHash, occurredAt,
    evidenceRef: evidence.providerEventRef || evidence.documentRef,
    evidenceType: evidence.type,
    lines
  };
  const hash = createHash("sha256").update(JSON.stringify(draft)).digest("hex");
  return Object.freeze({ ...draft, lines: Object.freeze(lines), hash });
}

// Check every transaction, its tenant, order, uniqueness and structural balance.
// Passing verification does NOT prove actual funds arrived: provider receipts
// and bank statements require independent settlement reconciliation.
function verifyDraftChain(records, { organizationId, ledgerId } = {}) {
  const failures = [];
  if (!Array.isArray(records)) return { ok: false, failures: ["records_unreadable"], count: 0 };
  if (!UUID.test(organizationId || "") || !/^[A-Za-z0-9._:-]{1,160}$/.test(ledgerId || "")) {
    return { ok: false, failures: ["invalid_scope"], count: records.length };
  }
  let prev = null;
  const sources = new Set();
  const events = new Set();
  records.forEach((item, i) => {
    if (!item || item.organizationId !== organizationId || item.ledgerId !== ledgerId) failures.push("scope_mismatch:" + i);
    if (item?.sequence !== i + 1 || item?.previousHash !== prev) failures.push("chain_break:" + i);
    if (!Object.hasOwn(EVENT_KINDS, item?.kind)) failures.push("unknown_kind:" + i);
    if (typeof item?.sourceEventId !== "string" || sources.has(item.sourceEventId)) failures.push("duplicate_source:" + i);
    else sources.add(item.sourceEventId);
    if (typeof item?.eventId !== "string" || events.has(item.eventId)) failures.push("duplicate_event:" + i);
    else events.add(item.eventId);
    if (!Number.isSafeInteger(item?.amountCents) || item.amountCents <= 0 || item.currency !== "USD") {
      failures.push("invalid_amount:" + i);
    }
    const expected = EVENT_KINDS[item?.kind];
    if (!Array.isArray(item?.lines) || item.lines.length !== 2 ||
        !expected || item.lines[0]?.account !== expected[0] || item.lines[1]?.account !== expected[1] ||
        item.lines[0]?.side !== "debit" || item.lines[1]?.side !== "credit" ||
        item.lines[0]?.amountCents !== item?.amountCents || item.lines[1]?.amountCents !== item?.amountCents) {
      failures.push("unbalanced_or_invalid_lines:" + i);
    }
    const { hash, ...data } = item || {};
    if (typeof hash !== "string" || !HASH.test(hash) ||
        createHash("sha256").update(JSON.stringify(data)).digest("hex") !== hash) {
      failures.push("modified_entry:" + i);
    }
    prev = hash || null;
  });
  return { ok: failures.length === 0, failures, count: records.length, lastHash: prev };
}

// A tenant's deposit is a liability, not revenue. DRAFT entries can only
// produce projected balances, NEVER a confirmed amount actually held or owed.
// Missing evidence or any over-deduction is never collapsed into zero.
function depositPosition(records, { organizationId, ledgerId, contractId } = {}) {
  const review = verifyDraftChain(records, { organizationId, ledgerId });
  if (!review.ok || !UUID.test(contractId || "")) {
    return { mathVerified: false, projectedLiabilityCents: null, actualLiabilityCents: null, issue: "ledger_unverified" };
  }
  let liability = 0n;
  let pending = 0n;
  for (const row of records) {
    if (row.contractId !== contractId) continue;
    if (row.kind === "deposit_received") liability += BigInt(row.amountCents);
    if (row.kind === "deposit_refunded") liability -= BigInt(row.amountCents);
    // A proposed deduction is NOT a settled deduction, revenue, or a payment.
    if (row.kind === "deposit_applied_pending_review") pending += BigInt(row.amountCents);
    if (liability < 0n) return {
      mathVerified: false, projectedLiabilityCents: null, actualLiabilityCents: null,
      issue: "deposit_overdrawn"
    };
  }
  if (liability > BigInt(Number.MAX_SAFE_INTEGER) ||
      pending > BigInt(Number.MAX_SAFE_INTEGER)) return {
    mathVerified: false, projectedLiabilityCents: null, actualLiabilityCents: null,
    issue: "amount_exceeds_safe_integer"
  };
  // A pending request cannot lawfully reduce the refundable balance. If the
  // proposed deductions exceed the projected balance, FLAG them; do not net
  // overdrawn proposals to zero or silently approve them.
  if (pending > liability) return {
    mathVerified: false, projectedLiabilityCents: null, actualLiabilityCents: null,
    pendingDeductionCents: Number(pending), issue: "pending_deductions_exceed_deposit"
  };
  return {
    mathVerified: true,
    projectedLiabilityCents: Number(liability), // pending deductions excluded
    pendingDeductionCents: Number(pending),
    hypotheticalAfterPendingCents: Number(liability - pending),
    actualLiabilityCents: null, issue: null, posted: false
  };
}
module.exports = { EVENT_KINDS, createDraftJournal, verifyDraftChain, depositPosition };
