"use strict";

const assert = require("node:assert/strict");
const {
  ADAPTATION_TYPES,
  NEVER_LEARN_AS_AUTONOMOUS_ACTION,
  wilson95,
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
  verifiedConsent: true,
  consentRevoked: false,
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
      { verifiedConsent: false },
      { consentRevoked: true },
      { userCanInspectCorrectDelete: false },
      { aggregateEvidenceVerified: false },
      { rollbackPlanReviewed: false },
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
      const result = evaluateAdaptiveProposal({ ...valid, changeType });
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

  it("makes readiness truthful without enabling a new runtime", () => {
    const readiness = getAdaptiveLearningReadiness();
    assert.equal(readiness.mode, "non_executing_policy_only");
    assert.equal(readiness.automaticExecutionAdded, 0);
    assert.equal(readiness.learningWritesAdded, 0);
    assert.equal(readiness.types.length, ADAPTATION_TYPES.length);
  });
});
