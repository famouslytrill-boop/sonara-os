// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure provider receipt interpretation only. This module does NOT send,
// retry, store, cancel, schedule or execute a publication. The caller MUST
// independently authenticate tenant, provider evidence, quota and claim fence
// and reconcile a remote provider status before any duplicate-sensitive retry.

const SHA256 = /^[0-9a-f]{64}$/i;
const REMOTE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,199}$/;
const IDEMPOTENCY = /^[a-zA-Z0-9][a-zA-Z0-9_-]{15,127}$/;
const KNOWN_STATES = new Set([
  "dispatched", "awaiting_provider", "outcome_unknown", "provider_processing",
  "published", "rejected", "cancelled"
]);
const RECEIPT_KINDS = new Set([
  "published", "accepted", "processing", "rejected", "throttled", "transport_unknown"
]);

function canonicalTime(value) {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value ? ms : null;
}
function verdict(state, code, details = {}) {
  return Object.freeze({
    state, code, ...details,
    executionAuthorized: false,
    safeToBlindlyRetry: false,
    sideEffectExecuted: false,
    providerVisibilityCertified: false
  });
}

/**
 * Trust precondition: every input (including evidenceVerified, status result
 * and tenant identifiers) was assembled server-side after a durable per-job
 * claim and an authenticated provider response/status lookup.
 *
 * "published_verified" means a verified provider receipt says visible for the
 * requested visibility. It is NOT an independent audit of a public URL.
 */
function classifyPublicationReceipt(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return verdict("blocked", "receipt_input_invalid");
  const {
    organizationId, serverOrganizationId, snapshotHash, approvedSnapshotHash,
    providerKey, expectedProviderKey, accountId, expectedAccountId,
    idempotencyKey, expectedIdempotencyKey, lastKnownState, receipt,
    serverNow, attemptedAt, requestedVisibility, existingRemoteId = null
  } = input;
  if (typeof organizationId !== "string" || !organizationId ||
    organizationId !== serverOrganizationId ||
    !SHA256.test(snapshotHash || "") ||
    snapshotHash !== approvedSnapshotHash ||
    !providerKey || providerKey !== expectedProviderKey ||
    !accountId || accountId !== expectedAccountId ||
    !IDEMPOTENCY.test(idempotencyKey || "") ||
    idempotencyKey !== expectedIdempotencyKey) {
    return verdict("blocked", "receipt_identity_or_scope_mismatch");
  }
  if (!["public", "private"].includes(requestedVisibility)) {
    return verdict("blocked", "receipt_visibility_unknown");
  }
  const now = canonicalTime(serverNow);
  const attempted = canonicalTime(attemptedAt);
  if (now === null || attempted === null || attempted > now) {
    return verdict("blocked", "receipt_time_unverified");
  }
  if (!KNOWN_STATES.has(lastKnownState) ||
      ["published", "rejected", "cancelled"].includes(lastKnownState)) {
    return verdict("blocked", "receipt_terminal_or_unknown_state");
  }
  if (existingRemoteId !== null && !REMOTE_ID.test(existingRemoteId)) {
    return verdict("blocked", "existing_remote_id_invalid");
  }
  if (!receipt) {
    // Dispatch without an authenticated receipt cannot be assumed safe to
    // resend. Worker should query remote state first by provider-specific ID.
    return verdict("reconciliation_required", "missing_receipt_after_dispatch");
  }
  if (typeof receipt !== "object" || Array.isArray(receipt) ||
      !RECEIPT_KINDS.has(receipt.kind)) return verdict("blocked", "receipt_kind_invalid");
  const observed = canonicalTime(receipt.observedAt);
  if (receipt.providerEvidenceVerified !== true || observed === null ||
      observed < attempted || observed > now) {
    return verdict("blocked", "provider_receipt_evidence_invalid");
  }
  if (receipt.kind === "transport_unknown") {
    return verdict("reconciliation_required", "transport_outcome_unknown");
  }
  if (receipt.kind === "throttled") {
    // A 429 alone does not prove the upstream side effect did not occur.
    if (receipt.providerConfirmedNotAccepted !== true ||
        !Number.isSafeInteger(receipt.retryAfterSeconds) ||
        receipt.retryAfterSeconds < 1 || receipt.retryAfterSeconds > 86400) {
      return verdict("reconciliation_required", "throttle_outcome_requires_lookup");
    }
    return verdict("retry_review_candidate", "provider_verified_not_accepted", {
      minimumRetryAfterSeconds: receipt.retryAfterSeconds
    });
  }
  if (receipt.kind === "rejected") {
    return verdict("manual_review_required", "provider_rejected");
  }
  if (receipt.kind === "accepted" || receipt.kind === "processing") {
    return verdict("provider_processing", "provider_did_not_confirm_publication");
  }
  if (!REMOTE_ID.test(receipt.remoteId || "") ||
      (existingRemoteId && existingRemoteId !== receipt.remoteId)) {
    return verdict("blocked", "provider_remote_id_missing_or_conflicting");
  }
  if (receipt.publicationVisibility !== requestedVisibility ||
      receipt.visibilityVerified !== true) {
    return verdict("reconciliation_required", "publication_visibility_unverified");
  }
  return verdict("provider_published_receipt", "provider_published_status_observed", {
    providerPostId: receipt.remoteId,
    // A provider can later remove/hide a post. Reconcile on subsequent reads.
    publicationVisibility: receipt.publicationVisibility
  });
}

module.exports = { classifyPublicationReceipt };
