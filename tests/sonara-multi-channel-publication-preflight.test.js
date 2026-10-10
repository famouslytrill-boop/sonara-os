// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const nodeTest = require("node:test");
const describe = global.describe || nodeTest.describe;
const it = global.it || nodeTest.it;
const { publicationSnapshotHash, evaluatePublicationBatch } =
  require("../lib/sonara-multi-channel-publication-preflight.cjs");

const { classifyPublicationReceipt } = require("../lib/sonara-publication-receipt-reconciliation.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const DECISION = "44444444-4444-4444-8444-444444444444";
// Compose non-secret fixture values at runtime; no bearer/token-shaped literals.
const IDEMPOTENCY_A = "test_" + "a".repeat(20);
const IDEMPOTENCY_B = "test_" + "b".repeat(20);
const env = {
  LINKEDIN_MARKETING_ENABLED: "true",
  LINKEDIN_ACCESS_TOKEN: "dummy-test-credential",
  LINKEDIN_ORGANIZATION_ID: "example-org",
  TIKTOK_CONTENT_ENABLED: "true",
  TIKTOK_ACCESS_TOKEN: "dummy-test-credential",
  TIKTOK_CLIENT_KEY: "dummy-test-key",
  META_MARKETING_ENABLED: "true",
  META_ACCESS_TOKEN: "dummy-test-credential",
  META_AD_ACCOUNT_ID: "example-ad-account"
};
function target(overrides = {}) {
  return {
    providerKey: "linkedin_marketing", accountId: "company-page",
    idempotencyKey: IDEMPOTENCY_A, format: "image", visibility: "public",
    providerAccountAuthorized: true, requiredScopesGranted: true,
    providerPolicyValidated: true, providerExecutionAdapterVerified: true,
    mediaRequirementsSatisfied: true, contentRightsVerified: true,
    contentModerationApproved: true, peopleAppear: false,
    userFinalConfirmationVerified: true, rateBudgetReserved: true,
    providerQuotaReserved: true, ...overrides
  };
}
function input(overrides = {}) {
  const result = {
    organizationId: ORG, serverOrganizationId: ORG,
    contentHash: "a".repeat(64), scheduledAt: null,
    serverNow: "2026-10-10T15:02:00.000Z",
    destinations: [target()]
  };
  Object.assign(result, overrides);
  const hash = publicationSnapshotHash(result);
  result.approval = {
    organizationId: ORG, serverOrganizationId: ORG,
    riskClass: "external_publish", requestId: REQUEST,
    proposalSnapshotHash: hash,
    requestedAt: "2026-10-10T15:00:00.000Z",
    expiresAt: "2026-10-10T16:00:00.000Z",
    proposedByUserId: OWNER,
    eligibleHumanApproverCount: 1,
    stepUpVerified: true,
    decisions: [{id: DECISION, organizationId: ORG, requestId: REQUEST,
      status: "approved", userId: OWNER, role: "owner", snapshotHash: hash,
      decidedAt: "2026-10-10T15:01:00.000Z"}]
  };
  return result;
}

describe("multi-channel publishing is preflight only", () => {
  it("permits a reviewed configured target as a worker-claim candidate, never execution", () => {
    const result = evaluatePublicationBatch(input(), env);
    assert.equal(result.state, "worker_claim_candidate");
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.sideEffectExecuted, false);
    assert.equal(result.databaseClaimed, false);
    assert.equal(result.providerReceiptVerified, false);
  });
  it("requires human approval", () => {
    const candidate = input();
    candidate.approval.decisions = [];
    assert.equal(evaluatePublicationBatch(candidate, env).code, "owner_approval_incomplete");
  });
  it("binds the exact content hash and destination account", () => {
    const candidate = input();
    candidate.destinations[0].accountId = "changed-account";
    assert.equal(evaluatePublicationBatch(candidate, env).code, "approval_snapshot_mismatch");
    const other = input();
    other.contentHash = "b".repeat(64);
    assert.equal(evaluatePublicationBatch(other, env).code, "approval_snapshot_mismatch");
  });
  it("rejects expired and noncanonical trusted timestamps", () => {
    const candidate = input({serverNow: "2026-10-10T16:00:00.000Z"});
    assert.equal(evaluatePublicationBatch(candidate, env).code, "approval_freshness_unverified");
    candidate.serverNow = "not-a-timestamp";
    assert.equal(evaluatePublicationBatch(candidate, env).code, "approval_freshness_unverified");
  });
  it("rejects schedule outside approval window", () => {
    const candidate = input({scheduledAt: "2026-10-11T15:00:00.000Z"});
    assert.equal(evaluatePublicationBatch(candidate, env).code, "schedule_outside_current_approval_window");
  });
  it("rejects duplicate accounts and idempotency keys", () => {
    assert.equal(publicationSnapshotHash({organizationId: ORG, contentHash: "a".repeat(64),
      destinations: [target(), target()]}), null);
    const duplicateKey = target({providerKey:"meta_marketing", accountId:"second-page"});
    assert.equal(publicationSnapshotHash({organizationId: ORG, contentHash: "a".repeat(64),
      destinations: [target(), duplicateKey]}), null);
  });
  it("blocks a reference-only YouTube connector", () => {
    const candidate = input({destinations:[target({providerKey:"youtube_data", format:"video"})]});
    const result = evaluatePublicationBatch(candidate, env);
    assert.equal(result.state, "blocked");
    assert.ok(result.targets[0].blockers.includes("provider_not_executable"));
  });
  it("requires provider authorization, scope and final confirmation", () => {
    const candidate = input({destinations:[target({
      requiredScopesGranted:false, providerAccountAuthorized:false, userFinalConfirmationVerified:false
    })]});
    const result = evaluatePublicationBatch(candidate, env);
    assert.equal(result.state, "blocked");
    assert.ok(result.targets[0].blockers.includes("provider_scope_missing"));
    assert.ok(result.targets[0].blockers.includes("provider_account_authorization_missing"));
    assert.ok(result.targets[0].blockers.includes("user_final_confirmation_missing"));
  });
  it("blocks unaudited public TikTok direct publishing", () => {
    const tiktok = target({providerKey:"tiktok_content",format:"video",
      creatorInfoFresh:true,creatorVisibilityOptionAllowed:true,providerAuditApproved:false});
    const result = evaluatePublicationBatch(input({destinations:[tiktok]}), env);
    assert.equal(result.state, "blocked");
    assert.ok(result.targets[0].blockers.includes("tiktok_public_audit_missing"));
  });
  it("blocks missing capacity reservation, moderation and appearance release", () => {
    const candidate = input({destinations:[target({
      rateBudgetReserved:false, contentModerationApproved:false, peopleAppear:true
    })]});
    const result = evaluatePublicationBatch(candidate, env);
    assert.equal(result.state, "blocked");
    assert.ok(result.targets[0].blockers.includes("publication_capacity_not_reserved"));
    assert.ok(result.targets[0].blockers.includes("content_rights_or_moderation_missing"));
    assert.ok(result.targets[0].blockers.includes("people_release_consent_missing"));
  });
  it("does not allow partial-batch fanout", () => {
    const second = target({providerKey:"meta_marketing",accountId:"alt-page",
      idempotencyKey:IDEMPOTENCY_B,providerExecutionAdapterVerified:false});
    const result = evaluatePublicationBatch(input({destinations:[target(),second]}), env);
    assert.equal(result.state, "blocked");
    assert.equal(result.targets[0].state, "worker_claim_candidate");
    assert.equal(result.targets[1].state, "blocked");
    assert.equal(result.executionAuthorized, false);
  });
  it("rejects mismatched tenant identity", () => {
    const candidate = input({serverOrganizationId:"55555555-5555-4555-8555-555555555555"});
    assert.equal(evaluatePublicationBatch(candidate, env).code, "tenant_scope_mismatch");
  });
  it("rejects disabled or unconfigured provider", () => {
    const result = evaluatePublicationBatch(input(), {LINKEDIN_MARKETING_ENABLED:"false"});
    assert.equal(result.state, "blocked");
    assert.ok(result.targets[0].blockers.includes("provider_configuration_incomplete"));
  });
  it("rejects an approval decision whose timestamp is in the future", () => {
    const candidate = input();
    candidate.approval.decisions[0].decidedAt = "2026-10-10T15:04:00.000Z";
    assert.equal(evaluatePublicationBatch(candidate, env).code, "approval_decision_not_yet_effective");
  });
  it("rejects missing or malformed proposal input without throwing", () => {
    assert.equal(evaluatePublicationBatch(null, env).state, "blocked");
    assert.equal(evaluatePublicationBatch([], env).state, "blocked");
    assert.equal(publicationSnapshotHash(null), null);
    assert.equal(publicationSnapshotHash("not-a-proposal"), null);
  });
  it("blocks an unaudited TikTok client without SELF_ONLY and a private creator account", () => {
    const tiktok = target({providerKey:"tiktok_content", format:"video", visibility:"private",
      creatorInfoFresh:true, creatorVisibilityOptionAllowed:true});
    const denied = evaluatePublicationBatch(input({destinations:[tiktok]}), env);
    assert.equal(denied.state, "blocked");
    assert.ok(denied.targets[0].blockers.includes("tiktok_unaudited_private_account_required"));
    const allowed = target({...tiktok, creatorAccountPrivate:true, privacyLevel:"SELF_ONLY"});
    const candidate = evaluatePublicationBatch(input({destinations:[allowed]}), env);
    assert.equal(candidate.state, "worker_claim_candidate");
    assert.equal(candidate.executionAuthorized, false);
  });

});


function receiptInput(overrides = {}) {
  const defaults = {
    organizationId: ORG, serverOrganizationId: ORG,
    snapshotHash: "a".repeat(64), approvedSnapshotHash: "a".repeat(64),
    providerKey:"linkedin_marketing", expectedProviderKey:"linkedin_marketing",
    accountId:"company-page", expectedAccountId:"company-page",
    idempotencyKey:IDEMPOTENCY_A,
    expectedIdempotencyKey:IDEMPOTENCY_A,
    lastKnownState:"dispatched", requestedVisibility:"public",
    attemptedAt:"2026-10-10T15:00:00.000Z",
    serverNow:"2026-10-10T15:03:00.000Z",
    receipt:{kind:"published",remoteId:"urn:li:share:12345",
      publicationVisibility:"public",visibilityVerified:true,
      observedAt:"2026-10-10T15:02:00.000Z",
      providerEvidenceVerified:true}
  };
  return {...defaults,...overrides};
}
describe("provider receipt classification is non-executing and never enables blind retry", () => {
  it("accepts an authenticated matching published status as a receipt, not independent visibility certification", () => {
    const result = classifyPublicationReceipt(receiptInput());
    assert.equal(result.state, "provider_published_receipt");
    assert.equal(result.providerPostId, "urn:li:share:12345");
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.providerVisibilityCertified, false);
  });
  it("never blindly retries an unacknowledged dispatch or transport timeout", () => {
    for (const receipt of [null, {
      kind:"transport_unknown",observedAt:"2026-10-10T15:02:00.000Z",providerEvidenceVerified:true
    }]) {
      const result = classifyPublicationReceipt(receiptInput({receipt}));
      assert.equal(result.state, "reconciliation_required");
      assert.equal(result.safeToBlindlyRetry,false);
    }
  });
  it("does not misreport upload accepted/processing as a published post", () => {
    for (const kind of ["accepted","processing"]) {
      const result = classifyPublicationReceipt(receiptInput({receipt:{
        kind,observedAt:"2026-10-10T15:02:00.000Z",providerEvidenceVerified:true
      }}));
      assert.equal(result.state, "provider_processing");
      assert.equal(result.providerPostId,undefined);
    }
  });
  it("rejects cross-tenant, account, content and idempotency mismatch", () => {
    const cases = [
      {serverOrganizationId:"55555555-5555-4555-8555-555555555555"},
      {expectedAccountId:"another-account"},
      {approvedSnapshotHash:"b".repeat(64)},
      {expectedIdempotencyKey:IDEMPOTENCY_B}
    ];
    for (const mismatch of cases) {
      assert.equal(classifyPublicationReceipt(receiptInput(mismatch)).state,"blocked");
    }
  });
  it("rejects unverifiable or future-dated provider status evidence", () => {
    const cases = [
      {providerEvidenceVerified:false},
      {observedAt:"2026-10-10T15:05:00.000Z"},
      {observedAt:"2026-10-10"},
    ];
    for (const record of cases) {
      assert.equal(classifyPublicationReceipt(receiptInput({
        receipt:{...receiptInput().receipt,...record}
      })).state,"blocked");
    }
  });
  it("requires exact provider visibility and stable remote identifier", () => {
    for (const receipt of [
      {...receiptInput().receipt, publicationVisibility:"private"},
      {...receiptInput().receipt, visibilityVerified:false}
    ]) {
      assert.equal(classifyPublicationReceipt(receiptInput({receipt})).state,"reconciliation_required");
    }
    const conflict = classifyPublicationReceipt(receiptInput({existingRemoteId:"urn:li:share:99999"}));
    assert.equal(conflict.code,"provider_remote_id_missing_or_conflicting");
  });
  it("does not auto-retry 429 unless the provider confirms no acceptance", () => {
    const receipt={kind:"throttled",observedAt:"2026-10-10T15:02:00.000Z",
      providerEvidenceVerified:true,retryAfterSeconds:60};
    assert.equal(classifyPublicationReceipt(receiptInput({receipt})).state,"reconciliation_required");
    const known = classifyPublicationReceipt(receiptInput({receipt:{
      ...receipt,providerConfirmedNotAccepted:true
    }}));
    assert.equal(known.state,"retry_review_candidate");
    assert.equal(known.minimumRetryAfterSeconds,60);
    assert.equal(known.safeToBlindlyRetry,false);
  });
  it("blocks decisions on terminal states and rejected post cannot be assumed published", () => {
    assert.equal(classifyPublicationReceipt(receiptInput({lastKnownState:"published"})).state,"blocked");
    const receipt={kind:"rejected",observedAt:"2026-10-10T15:02:00.000Z",
      providerEvidenceVerified:true};
    assert.equal(classifyPublicationReceipt(receiptInput({receipt})).state,"manual_review_required");
  });
  it("rejects malformed receipt inputs instead of throwing", () => {
    assert.equal(classifyPublicationReceipt(null).state,"blocked");
    assert.equal(classifyPublicationReceipt({}).state,"blocked");
  });
});
