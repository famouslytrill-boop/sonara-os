"use strict";

const assert = require("node:assert/strict");
const {
  ADAPTATION_TYPES,
  NEVER_LEARN_AS_AUTONOMOUS_ACTION,
  wilson95,
  evaluateLearningConsent,
  evaluateAdaptiveProposal,
  getAdaptiveLearningReadiness
} = require("../lib/sonara-adaptive-learning-policy.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const valid = Object.freeze({
  organizationId: ORG,
  serverOrganizationId: ORG,
  requestedByUserId: USER,
  changeType: "workspace_layout",
  latestConsentReadVerified: true,
  evidenceWindowStartsAt: "2026-10-02T19:00:00.000Z",
  consentRevoked: false,
  consentReceipt: Object.freeze({
    receiptId: "33333333-3333-4333-8333-333333333333",
    organizationId: ORG,
    userId: USER,
    changeType: "workspace_layout",
    status: "opted_in",
    method: "explicit_user_action",
    noticeVersion: "v1",
    revision: 1,
    retentionDays: 30,
    revokedAt: null,
    consentAt: "2026-10-01T19:00:00.000Z",
    expiresAt: "2026-10-31T19:00:00.000Z"
  }),
  userCanInspectCorrectDelete: true,
  aggregateEvidenceVerified: true,
  provenance: "verified tenant aggregate success records",
  rollbackPlanReviewed: true,
  explanation: "Preview a reversible workflow layout with opt-out.",
  trustedNow: "2026-10-09T19:00:00Z",
  observedAt: "2026-10-08T19:00:00Z",
  baselineTrials: 100,
  baselineSuccesses: 25,
  candidateTrials: 100,
  candidateSuccesses: 90
});

describe("governed adaptive learning (policy-only)", () => {
  it("blocks empty, malformed, and cross-tenant proposals", () => {
    assert.equal(evaluateAdaptiveProposal().state, "blocked");
    assert.equal(evaluateAdaptiveProposal([]).state, "blocked");
    assert.ok(evaluateAdaptiveProposal({ ...valid, serverOrganizationId: USER }).blockers.includes("tenant_scope_unverified"));
    assert.ok(evaluateAdaptiveProposal({ ...valid, requestedByUserId: "not-a-user" }).blockers.includes("requester_identity_invalid"));
  });

  it("requires independent opt-in, controls, verified aggregates and rollback", () => {
    for (const changed of [
      { latestConsentReadVerified: false },
      { consentRevoked: true },
      { userCanInspectCorrectDelete: false },
      { aggregateEvidenceVerified: false },
      { rollbackPlanReviewed: false },
      { consentReceipt: null },
      { provenance: "" },
      { explanation: "" }
    ]) {
      assert.equal(evaluateAdaptiveProposal({ ...valid, ...changed }).state, "blocked");
    }
  });

  it("does not allow sensitive autonomy or unknown adaptation types", () => {
    for (const changeType of [...NEVER_LEARN_AS_AUTONOMOUS_ACTION, "unknown_action"]) {
      const result = evaluateAdaptiveProposal({ ...valid, changeType });
      assert.equal(result.state, "blocked", changeType);
      assert.equal(result.mayExecuteTools, false);
    }
  });

  it("rejects stale/forward dated and malformed success counts", () => {
    for (const changed of [
      { observedAt: "2026-01-01T00:00:00Z" },
      { observedAt: "2026-10-10T00:00:00Z" },
      { trustedNow: "not-a-date" },
      { baselineTrials: Infinity },
      { candidateTrials: 10, candidateSuccesses: 20 },
      { candidateSuccesses: NaN },
      { baselineSuccesses: -1 }
    ]) {
      assert.equal(evaluateAdaptiveProposal({ ...valid, ...changed }).state, "blocked");
    }
  });

  it("does not treat small samples or weak differences as proven improvement", () => {
    assert.equal(evaluateAdaptiveProposal({
      ...valid, baselineTrials: 10, baselineSuccesses: 1, candidateTrials: 10, candidateSuccesses: 9
    }).state, "needs_more_evidence");
    assert.equal(evaluateAdaptiveProposal({
      ...valid, candidateSuccesses: 30
    }).state, "needs_more_evidence");
    const interval = wilson95(5, 10);
    assert.ok(interval.lower < interval.rate && interval.rate < interval.upper);
    assert.equal(wilson95(10, 5), null);
  });

  it("recommends a measured candidate but never authorizes self-modification", () => {
    for (const changeType of ADAPTATION_TYPES) {
      const result = evaluateAdaptiveProposal({ ...valid, changeType, consentReceipt: { ...valid.consentReceipt, changeType } });
      assert.equal(result.state, "review_ready", changeType);
      assert.equal(result.proposalOnly, true);
      assert.equal(result.requiresHumanAcceptance, true);
      assert.equal(result.mayExecuteTools, false);
      assert.equal(result.mayWriteCustomerMemory, false);
      assert.equal(result.mayModifySource, false);
      assert.equal(result.mayCommitOrDeploy, false);
      assert.equal(result.productionActivation, false);
      assert.equal(result.evidence.causalProof, false);
    }
  });

  it("requires a fresh, explicit, same-person same-tenant consent snapshot", () => {
    const variants = [
      { latestConsentReadVerified: false },
      { consentReceipt: { ...valid.consentReceipt, organizationId: USER } },
      { consentReceipt: { ...valid.consentReceipt, userId: ORG } },
      { consentReceipt: { ...valid.consentReceipt, changeType: "template_suggestion" } },
      { consentReceipt: { ...valid.consentReceipt, status: "revoked" } },
      { consentReceipt: { ...valid.consentReceipt, revokedAt: "2026-10-02T19:00:00.000Z" } },
      { consentReceipt: { ...valid.consentReceipt, revokedAt: undefined } },
      { consentReceipt: { ...valid.consentReceipt, method: "implied_by_usage" } },
      { consentReceipt: { ...valid.consentReceipt, noticeVersion: "" } },
      { consentReceipt: { ...valid.consentReceipt, revision: 0 } },
      { consentReceipt: { ...valid.consentReceipt, retentionDays: 365 } },
      { consentReceipt: { ...valid.consentReceipt, consentAt: "2026-10-10T19:00:00.000Z" } },
      { consentReceipt: { ...valid.consentReceipt, expiresAt: "2026-10-05T19:00:00.000Z" } },
      { consentReceipt: { ...valid.consentReceipt, expiresAt: "2027-01-09T19:00:00.000Z" } },
      { evidenceWindowStartsAt: "2026-09-30T19:00:00.000Z" },
      { evidenceWindowStartsAt: "yesterday" }
    ];
    for (const variant of variants) {
      const result = evaluateAdaptiveProposal({ ...valid, ...variant });
      assert.equal(result.state, "blocked", JSON.stringify(variant));
      assert.equal(result.mayExecuteTools, false);
    }
  });

  it("allows only a proposal when the consent snapshot is complete", () => {
    const consent = evaluateLearningConsent({
      receipt: valid.consentReceipt,
      organizationId: valid.organizationId,
      requestedByUserId: valid.requestedByUserId,
      changeType: valid.changeType,
      trustedNow: valid.trustedNow,
      evidenceWindowStartsAt: valid.evidenceWindowStartsAt,
      latestConsentReadVerified: true
    });
    assert.equal(consent.allowed, true);
    assert.deepEqual(consent.blockers, []);
    assert.equal(evaluateAdaptiveProposal(valid).state, "review_ready");
  });

  it("makes readiness truthful without enabling a new runtime", () => {
    const readiness = getAdaptiveLearningReadiness();
    assert.equal(readiness.mode, "non_executing_policy_only");
    assert.equal(readiness.automaticExecutionAdded, 0);
    assert.equal(readiness.learningWritesAdded, 0);
    assert.equal(readiness.consentState, "trusted_server_snapshot_contract_only_no_store_no_persistence");
    assert.equal(readiness.types.length, ADAPTATION_TYPES.length);
  });
});
