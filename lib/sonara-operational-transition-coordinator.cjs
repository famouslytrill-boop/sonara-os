// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// INTERNAL SERVER-ONLY ADAPTER CONTRACT — not mounted as a route or enabled.
// Dependencies must be implemented with a trusted transactional database client.
// A browser/agent must never provide the authorizer, verifier or transaction.
const { operationalTransitionDecision } =
  require("./sonara-backend-operations-intelligence-2026.cjs");

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ID = /^[A-Za-z0-9:_-]{1,128}$/;
const VERIFIED_FIELDS = Object.freeze([
  "verifiedSecurityIncident", "incidentClearedVerified", "recoveryVerified",
  "inFlightJobsDrained", "healthVerified", "releaseGatesVerified",
  "safeShutdownPlanReviewed"
]);
const FORBIDDEN_REQUEST_FIELDS = Object.freeze([
  "actorId", "from", "evidence", "ownerApproved", "actorAuthorized",
  "scopeVerified", "releaseGatesVerified", "bypassRequested",
  "overrideReleaseGate", "ignoreSecurityIncident", "approvedBy"
]);

function operationalTransitionCoordinator({ store, authorizer, evidenceVerifier } = {}) {
  if (!store || typeof store.withTransaction !== "function" ||
      !authorizer || typeof authorizer.authorize !== "function" ||
      typeof authorizer.verifyApproval !== "function" ||
      !evidenceVerifier || typeof evidenceVerifier.verify !== "function") {
    throw new TypeError("trusted_transaction_and_authority_dependencies_required");
  }

  const deny = reason => Object.freeze({
    applied: false, reason, transitionExecuted: false, auditCommitted: false
  });
  const reject = reason => {
    const error = new Error(reason);
    error.operationalDenial = reason;
    throw error;
  };

  return Object.freeze({
    async transition({ session, command } = {}) {
      if (!command || typeof command !== "object" || Array.isArray(command) ||
          FORBIDDEN_REQUEST_FIELDS.some(key => Object.hasOwn(command, key))) {
        return deny("untrusted_evidence_or_command_shape");
      }
      const scope = command.scope;
      const organizationId = command.organizationId ?? null;
      if ((scope !== "platform" && scope !== "tenant") ||
          (scope === "tenant" && (!UUID.test(organizationId))) ||
          (scope === "platform" && organizationId !== null)) {
        return deny("invalid_operational_scope");
      }
      if (!ID.test(command.eventId) || !ID.test(command.approvalId) ||
          !Number.isSafeInteger(command.expectedRevision) ||
          command.expectedRevision < 0 ||
          command.expectedRevision >= Number.MAX_SAFE_INTEGER ||
          !["active", "paused", "maintenance", "lockdown", "offline"].includes(command.to)) {
        return deny("invalid_operational_command");
      }

      try {
        // The underlying transaction MUST roll back on any rejection or error;
        // locking/read and both writes must share the same DB transaction.
        return await store.withTransaction(async tx => {
          for (const method of [
            "nowMs", "readStateForUpdate", "readApprovalForUpdate",
            "consumeApproval", "compareAndSwapState", "appendAuditEvent"
          ]) {
            if (typeof tx?.[method] !== "function") reject("transaction_contract_missing");
          }
          const principal = await authorizer.authorize({
            tx, session, scope, organizationId, action: command.to
          });
          if (!principal || !UUID.test(principal.actorId) ||
              principal.authorized !== true ||
              principal.scope !== scope ||
              (principal.organizationId ?? null) !== organizationId) {
            reject("actor_authorization_unverified");
          }
          const state = await tx.readStateForUpdate({ scope, organizationId });
          if (!state || state.scope !== scope ||
              (state.organizationId ?? null) !== organizationId ||
              !Number.isSafeInteger(state.revision) ||
              state.revision !== command.expectedRevision ||
              typeof state.mode !== "string") reject("stale_or_unavailable_operational_state");

          const nowMs = await tx.nowMs();
          if (!Number.isSafeInteger(nowMs) || nowMs < 0) reject("trusted_clock_unverified");
          const approval = await tx.readApprovalForUpdate({
            approvalId: command.approvalId, scope, organizationId
          });
          if (!approval || approval.id !== command.approvalId ||
              approval.status !== "approved" || approval.consumedAtMs != null ||
              approval.scope !== scope ||
              (approval.organizationId ?? null) !== organizationId ||
              approval.from !== state.mode || approval.to !== command.to ||
              approval.expectedRevision !== state.revision ||
              !UUID.test(approval.approvedBy) ||
              approval.approvedBy === principal.actorId ||
              !Number.isSafeInteger(approval.issuedAtMs) ||
              !Number.isSafeInteger(approval.expiresAtMs) ||
              approval.issuedAtMs < 0 || approval.expiresAtMs < approval.issuedAtMs ||
              approval.expiresAtMs - approval.issuedAtMs > 900000 ||
              nowMs < approval.issuedAtMs || nowMs > approval.expiresAtMs) {
            reject("approval_missing_expired_or_reused");
          }
          if (await authorizer.verifyApproval({
            tx, session, principal, approval, scope, organizationId, to: command.to
          }) !== true) reject("independent_approval_unverified");

          // All evidentiary booleans originate from a separate trusted verifier.
          const proof = await evidenceVerifier.verify({
            tx, session, principal, state, approval, to: command.to, nowMs
          });
          if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
            reject("independent_operational_evidence_unverified");
          }
          const verified = Object.fromEntries(
            VERIFIED_FIELDS.map(key => [key, proof[key] === true])
          );
          const decision = operationalTransitionDecision({
            ...verified, from: state.mode, to: command.to, scope,
            expectedRevision: state.revision, observedRevision: state.revision,
            scopeVerified: true, actorAuthorized: true, ownerApproved: true
          });
          if (!decision.candidate) reject("policy_denied_" + decision.reason);
          // Apply one-use approval, CAS and audit together; never catch inside
          // the transaction or accept a zero-write/unknown write result.
          const consumed = await tx.consumeApproval({
            approvalId: approval.id, scope, organizationId,
            expectedRevision: state.revision, eventId: command.eventId
          });
          if (consumed !== 1) reject("approval_claim_conflict");
          const changed = await tx.compareAndSwapState({
            scope, organizationId, expectedMode: state.mode,
            expectedRevision: state.revision, nextMode: command.to,
            nextRevision: decision.nextRevision
          });
          if (changed !== 1) reject("operational_revision_conflict");
          const inserted = await tx.appendAuditEvent({
            eventId: command.eventId, approvalId: approval.id,
            actorId: principal.actorId, scope, organizationId,
            from: state.mode, to: command.to,
            revision: decision.nextRevision, occurredAtMs: nowMs
          });
          if (inserted !== 1) reject("operational_audit_conflict");
          return Object.freeze({
            applied: true, reason: "transaction_commit_requested",
            scope, organizationId, mode: command.to,
            revision: decision.nextRevision,
            transitionExecuted: false, auditCommitted: false,
            commitResultRequiresDatabaseProof: true
          });
        });
      } catch (error) {
        // Only a confirmed transaction COMMIT may establish actual mutation.
        // Avoid leaking raw SQL, secrets, actor data or provider details.
        return deny(error?.operationalDenial || "operational_transaction_failed");
      }
    }
  });
}

module.exports = { operationalTransitionCoordinator };
