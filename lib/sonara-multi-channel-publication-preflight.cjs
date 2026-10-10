// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic, offline PRE-FLIGHT ONLY. No provider calls, DB writes,
// scheduling, publishing, approval issuance or authorization take place here.
// The server must derive identity, account grants, scopes, moderation, quotas,
// actor step-up and provider proof from independent trusted sources. NEVER
// accept those booleans directly from an untrusted HTTP request payload.

const { createHash } = require("node:crypto");
const { evaluateApprovalBoard } = require("./sonara-customer-approval-board.cjs");
const { getGrowthProvider, getGrowthProviderReadiness } = require("./growth-studio-provider-registry.cjs");

const SHA256 = /^[0-9a-f]{64}$/i;
const ACCOUNT_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/;
const IDEMPOTENCY = /^[a-zA-Z0-9][a-zA-Z0-9_-]{15,127}$/;
const PROVIDER_CAPABILITY = Object.freeze({
  linkedin_marketing: "organization_posts",
  tiktok_content: "direct_post",
  meta_marketing: "content_publish",
  youtube_data: "video_upload"
});
const FORMATS = Object.freeze(["text", "image", "video"]);
const VISIBILITIES = Object.freeze(["public", "private"]);

function isoTime(input) {
  if (typeof input !== "string") return null;
  const time = Date.parse(input);
  return Number.isFinite(time) && new Date(time).toISOString() === input ? time : null;
}

function invalid(code) {
  return Object.freeze({ state: "blocked", code, executionAuthorized: false, sideEffectExecuted: false });
}

// Order of destinations is significant: the hash binds each target, account,
// intended visibility, media format, immutable content and schedule.
function snapshotFor({ organizationId, contentHash, scheduledAt = null, destinations }) {
  if (typeof organizationId !== "string" || !SHA256.test(contentHash || "") ||
      !Array.isArray(destinations) || destinations.length < 1 || destinations.length > 12) {
    return null;
  }
  if (scheduledAt !== null && isoTime(scheduledAt) === null) return null;
  const seenAccounts = new Set();
  const seenKeys = new Set();
  const normalized = [];
  for (const dest of destinations) {
    if (!dest || typeof dest !== "object" || Array.isArray(dest) ||
        !Object.hasOwn(PROVIDER_CAPABILITY, dest.providerKey) ||
        !ACCOUNT_ID.test(dest.accountId || "") ||
        !IDEMPOTENCY.test(dest.idempotencyKey || "") ||
        !FORMATS.includes(dest.format) || !VISIBILITIES.includes(dest.visibility)) return null;
    const account = `${dest.providerKey}:${dest.accountId}`;
    if (seenAccounts.has(account) || seenKeys.has(dest.idempotencyKey)) return null;
    seenAccounts.add(account);
    seenKeys.add(dest.idempotencyKey);
    normalized.push({
      providerKey: dest.providerKey,
      accountId: dest.accountId,
      idempotencyKey: dest.idempotencyKey,
      format: dest.format,
      visibility: dest.visibility
    });
  }
  return Object.freeze({ version: 1, organizationId, contentHash: contentHash.toLowerCase(), scheduledAt, destinations: normalized });
}

function publicationSnapshotHash(input) {
  const snapshot = snapshotFor(input || {});
  if (!snapshot) return null;
  return createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex");
}

function inspectTarget(target, environment) {
  const blockers = [];
  const key = target.providerKey;
  const provider = getGrowthProvider(key);
  const capability = PROVIDER_CAPABILITY[key];
  if (!provider || provider.adapterMode === "reference_only" ||
      !provider.capabilities.includes(capability)) blockers.push("provider_not_executable");
  if (provider && provider.adapterMode !== "reference_only") {
    const readiness = getGrowthProviderReadiness(provider, environment);
    if (readiness.configured !== true) blockers.push("provider_configuration_incomplete");
  }
  if (target.providerAccountAuthorized !== true) blockers.push("provider_account_authorization_missing");
  if (target.requiredScopesGranted !== true) blockers.push("provider_scope_missing");
  if (target.providerPolicyValidated !== true) blockers.push("provider_policy_review_missing");
  if (target.providerExecutionAdapterVerified !== true) blockers.push("provider_adapter_proof_missing");
  if (target.mediaRequirementsSatisfied !== true) blockers.push("provider_media_contract_missing");
  if (target.contentRightsVerified !== true || target.contentModerationApproved !== true) {
    blockers.push("content_rights_or_moderation_missing");
  }
  if (target.peopleAppear !== true && target.peopleAppear !== false) {
    blockers.push("people_release_status_unknown");
  } else if (target.peopleAppear && target.peopleReleaseConsentVerified !== true) {
    blockers.push("people_release_consent_missing");
  }
  if (target.userFinalConfirmationVerified !== true) blockers.push("user_final_confirmation_missing");
  if (target.rateBudgetReserved !== true || target.providerQuotaReserved !== true) {
    blockers.push("publication_capacity_not_reserved");
  }
  if (key === "tiktok_content") {
    if (!(["image", "video"].includes(target.format))) blockers.push("tiktok_format_unsupported");
    if (target.creatorInfoFresh !== true || target.creatorVisibilityOptionAllowed !== true) {
      blockers.push("tiktok_creator_preflight_missing");
    }
    if (target.visibility === "public" && target.providerAuditApproved !== true) {
      blockers.push("tiktok_public_audit_missing");
    }
  }
  return Object.freeze({
    providerKey: key, accountId: target.accountId,
    state: blockers.length ? "blocked" : "worker_claim_candidate",
    blockers: Object.freeze(blockers),
    executionAuthorized: false, sideEffectExecuted: false
  });
}

/**
 * Server-only compositional evaluation. This is NOT a transactional grant.
 * A worker must re-read and lock approvals, media/version, connected account,
 * limits and tenant scope, claim each idempotency key, and reconcile provider
 * receipts/ambiguous outcomes before any side effect. A partial batch MUST NOT
 * fan out: the return state is blocked if even one target is blocked.
 */
function evaluatePublicationBatch(input = {}, environment = process.env) {
  const now = isoTime(input.serverNow);
  const requested = isoTime(input.approval?.requestedAt);
  const expiry = isoTime(input.approval?.expiresAt);
  if (now === null || requested === null || expiry === null || requested > now ||
      now >= expiry || expiry - requested > 24 * 60 * 60 * 1000) {
    return invalid("approval_freshness_unverified");
  }
  const snapshot = snapshotFor(input);
  if (!snapshot) return invalid("publication_snapshot_invalid");
  if (input.organizationId !== input.serverOrganizationId) return invalid("tenant_scope_mismatch");
  if (snapshot.scheduledAt && (isoTime(snapshot.scheduledAt) < now || isoTime(snapshot.scheduledAt) >= expiry)) {
    return invalid("schedule_outside_current_approval_window");
  }
  const hash = publicationSnapshotHash(input);
  if (input.approval?.proposalSnapshotHash !== hash) return invalid("approval_snapshot_mismatch");
  const approval = evaluateApprovalBoard({
    ...input.approval,
    riskClass: "external_publish",
    organizationId: input.organizationId,
    serverOrganizationId: input.serverOrganizationId
  });
  if (approval.state !== "approval_evidence_ready") {
    return Object.freeze({ state: "blocked", code: "owner_approval_incomplete",
      blockers: approval.blockers, snapshotHash: hash,
      executionAuthorized: false, sideEffectExecuted: false });
  }
  const targets = input.destinations.map((target) => inspectTarget(target, environment));
  const allCandidate = targets.every((target) => target.state === "worker_claim_candidate");
  return Object.freeze({
    state: allCandidate ? "worker_claim_candidate" : "blocked",
    code: allCandidate ? "preflight_passed_no_execution_authority" : "destination_preflight_incomplete",
    snapshotHash: hash, targets: Object.freeze(targets),
    executionAuthorized: false, sideEffectExecuted: false,
    databaseClaimed: false, providerReceiptVerified: false
  });
}

module.exports = { PROVIDER_CAPABILITY, publicationSnapshotHash, evaluatePublicationBatch };
