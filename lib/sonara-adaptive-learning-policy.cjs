// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { getPredictiveMappingReadiness } = require("./sonara-adaptive-prediction-mapping.cjs");

// Offline, non-executing adaptation evaluator. It does not read customer
// events, profile people, train models, persist data or change product settings.
// Callers MUST supply independently verified, tenant-scoped aggregate evidence.
// All approved outcomes are proposals, never runtime authority.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_TRIALS_PER_ARM = 30;
const MIN_ABSOLUTE_UPLIFT = 0.05;
const MAX_EVIDENCE_AGE_DAYS = 90;

const ADAPTATION_TYPES = Object.freeze([
  "workspace_layout",
  "template_suggestion",
  "workflow_hint",
  "agent_skill_routing",
  "code_patch"
]);
const NEVER_LEARN_AS_AUTONOMOUS_ACTION = Object.freeze([
  "billing",
  "security_policy",
  "permission_change",
  "public_publish",
  "external_outreach",
  "destructive_change",
  "production_deployment"
]);

function wilson95(successes, trials) {
  if (!Number.isSafeInteger(successes) || !Number.isSafeInteger(trials)
    || successes < 0 || trials < 1 || successes > trials) return null;
  const z = 1.96;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const margin = z * Math.sqrt(p * (1 - p) / trials + z2 / (4 * trials * trials)) / denominator;
  return { rate: p, lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

// Validates the shape of a consent snapshot fetched by a trusted server
// component. This is deliberately NOT a token verifier or a stand-alone
// authorization mechanism: a client may forge every field in this object.
// Only a separately authenticated, version-consistent read of the durable
// consent store can supply latestConsentReadVerified=true.
function parseCanonicalUtc(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? time : null;
}

function evaluateLearningConsent({
  receipt,
  organizationId,
  requestedByUserId,
  changeType,
  trustedNow,
  evidenceWindowStartsAt,
  latestConsentReadVerified = false
} = {}) {
  const blockers = [];
  if (latestConsentReadVerified !== true) blockers.push("latest_consent_state_not_verified");
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return Object.freeze({ allowed: false, blockers: Object.freeze([...blockers, "consent_receipt_missing"]) });
  }
  if (!UUID.test(receipt.receiptId || "")) blockers.push("consent_receipt_id_invalid");
  if (!UUID.test(organizationId || "") || receipt.organizationId !== organizationId)
    blockers.push("consent_organization_mismatch");
  if (!UUID.test(requestedByUserId || "") || receipt.userId !== requestedByUserId)
    blockers.push("consent_subject_mismatch");
  if (!ADAPTATION_TYPES.includes(changeType) || receipt.changeType !== changeType)
    blockers.push("consent_scope_mismatch");
  if (receipt.status !== "opted_in" || receipt.revokedAt !== null)
    blockers.push("consent_inactive_or_revoked");
  if (receipt.method !== "explicit_user_action" || !/^v[1-9]\d*(?:\.\d+)*$/.test(receipt.noticeVersion || ""))
    blockers.push("consent_notice_or_method_invalid");
  if (!Number.isSafeInteger(receipt.revision) || receipt.revision < 1)
    blockers.push("consent_revision_invalid");
  if (!Number.isSafeInteger(receipt.retentionDays) || receipt.retentionDays < 1 || receipt.retentionDays > 90)
    blockers.push("consent_retention_invalid");

  const now = parseCanonicalUtc(trustedNow);
  const granted = parseCanonicalUtc(receipt.consentAt);
  const expires = parseCanonicalUtc(receipt.expiresAt);
  const evidenceStart = parseCanonicalUtc(evidenceWindowStartsAt);
  if (now === null || granted === null || expires === null || evidenceStart === null
    || granted > now || expires <= now || expires <= granted
    || expires - granted > 90 * 86400000 || evidenceStart < granted || evidenceStart > now
    || (Number.isSafeInteger(receipt.retentionDays)
      && evidenceStart < now - receipt.retentionDays * 86400000))
    blockers.push("consent_or_evidence_window_invalid");

  return Object.freeze({ allowed: blockers.length === 0, blockers: Object.freeze(blockers) });
}

function response(state, blockers, evidence = null, changeType = null) {
  return Object.freeze({
    ok: state !== "blocked",
    state,
    blockers: Object.freeze([...new Set(blockers)]),
    changeType,
    evidence,
    proposalOnly: true,
    requiresHumanAcceptance: true,
    mayExecuteTools: false,
    mayWriteCustomerMemory: false,
    mayModifySource: false,
    mayCommitOrDeploy: false,
    productionActivation: false,
    nextStep: state === "review_ready" ? "show_reviewable_proposal" :
      state === "needs_more_evidence" ? "collect_opted_in_aggregate_evidence" : "stop"
  });
}

// Stats are aggregated binary outcomes from the SAME explicit measurement
// definition across independent baseline/candidate cohorts. They are NOT
// inferred from raw clicks or covert habit tracking. Success thresholds are
// deliberately conservative; they are a triage rule, not a causal proof.
function evaluateAdaptiveProposal(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return response("blocked", ["invalid_proposal"]);
  }

  const changeType = input.changeType;
  const blockers = [];
  if (!UUID.test(input.organizationId || "") || input.organizationId !== input.serverOrganizationId)
    blockers.push("tenant_scope_unverified");
  if (!UUID.test(input.requestedByUserId || "")) blockers.push("requester_identity_invalid");
  if (NEVER_LEARN_AS_AUTONOMOUS_ACTION.includes(changeType))
    blockers.push("consequential_action_cannot_be_learned_as_authority");
  else if (!ADAPTATION_TYPES.includes(changeType)) blockers.push("unknown_adaptation_type");

  // The receipt must be fetched from a trusted, authenticated consent store.
  // Passing a forged flag/receipt from a browser would be a security bug.
  // This pure evaluator issues no approval and never executes anything.
  const consent = evaluateLearningConsent({
    receipt: input.consentReceipt,
    organizationId: input.organizationId,
    requestedByUserId: input.requestedByUserId,
    changeType,
    trustedNow: input.trustedNow,
    evidenceWindowStartsAt: input.evidenceWindowStartsAt,
    latestConsentReadVerified: input.latestConsentReadVerified
  });
  blockers.push(...consent.blockers);
  if (input.consentRevoked === true) blockers.push("consent_revocation_noted");
  if (input.userCanInspectCorrectDelete !== true)
    blockers.push("user_memory_controls_required");
  if (input.aggregateEvidenceVerified !== true)
    blockers.push("independent_aggregate_evidence_required");
  if (typeof input.provenance !== "string" || !input.provenance.trim())
    blockers.push("source_provenance_required");
  if (input.rollbackPlanReviewed !== true)
    blockers.push("rollback_plan_required");
  if (typeof input.explanation !== "string" || !input.explanation.trim())
    blockers.push("user_explanation_required");

  const current = Date.parse(input.trustedNow);
  const observed = Date.parse(input.observedAt);
  const evidenceStart = parseCanonicalUtc(input.evidenceWindowStartsAt);
  if (!Number.isFinite(current) || !Number.isFinite(observed)
    || observed > current || current - observed > MAX_EVIDENCE_AGE_DAYS * 86400000
    || evidenceStart === null || observed < evidenceStart)
    blockers.push("evidence_window_invalid_or_stale");

  const bTrials = input.baselineTrials;
  const cTrials = input.candidateTrials;
  const b = wilson95(input.baselineSuccesses, bTrials);
  const c = wilson95(input.candidateSuccesses, cTrials);
  if (!b || !c) blockers.push("aggregate_outcomes_invalid");

  if (blockers.length) return response("blocked", blockers, null, changeType);

  const evidence = Object.freeze({
    baseline: Object.freeze(b),
    candidate: Object.freeze(c),
    absoluteUplift: c.rate - b.rate,
    intervalMethod: "wilson_95_percent",
    trialDefinition: "independent_binary_outcomes",
    minimumTrialsPerArm: MIN_TRIALS_PER_ARM,
    minimumAbsoluteUplift: MIN_ABSOLUTE_UPLIFT,
    causalProof: false
  });

  const enoughSamples = bTrials >= MIN_TRIALS_PER_ARM && cTrials >= MIN_TRIALS_PER_ARM;
  const clearImprovement = c.rate - b.rate >= MIN_ABSOLUTE_UPLIFT && c.lower > b.upper;
  if (!enoughSamples || !clearImprovement) {
    return response("needs_more_evidence", [
      ...(!enoughSamples ? ["minimum_sample_size_not_met"] : []),
      ...(!clearImprovement ? ["uplift_not_sufficiently_supported"] : [])
    ], evidence, changeType);
  }
  return response("review_ready", [], evidence, changeType);
}


// Adapter boundary for a future authenticated, READ-ONLY server-side route.
// Readers MUST be wired to SONARA's existing authenticated session, membership
// checks and tenant-filtered database queries, never request-body parameters.
// A JavaScript callback or a "verified" field is not proof of authorization.
// No reader is provided or activated by this file.
function createAdaptiveProposalReader({ resolvePrincipal, readLatestConsent, readAggregateEvidence, readGovernance, clock } = {}) {
  if ([resolvePrincipal, readLatestConsent, readAggregateEvidence, readGovernance, clock]
    .some(reader => typeof reader !== "function")) {
    throw new TypeError("all five server-owned adapter functions are required");
  }
  const fail = reason => response("blocked", [reason]);

  async function preview({ organizationId, changeType, sessionContext } = {}) {
    if (!UUID.test(organizationId || "") || !ADAPTATION_TYPES.includes(changeType)) {
      return fail("unsupported_request_scope");
    }
    try {
      // The request's identity and flags are ignored. The resolver must derive
      // the principal from server-verified authentication and active membership.
      const principal = await resolvePrincipal({ sessionContext, organizationId });
      if (!principal || principal.authenticated !== true || principal.membershipVerified !== true
        || principal.canReadLearningEvidence !== true
        || !UUID.test(principal.userId || "")
        || principal.organizationId !== organizationId) return fail("authenticated_tenant_permission_required");

      const scope = Object.freeze({ organizationId, userId: principal.userId, changeType });
      const first = await readLatestConsent(scope);
      if (!first || first.verifiedLatest !== true || !first.receipt
        || first.receipt.organizationId !== organizationId
        || first.receipt.userId !== principal.userId
        || first.receipt.changeType !== changeType) return fail("latest_consent_not_verified");
      // Check consent before accessing potentially sensitive aggregates.
      const nowBefore = clock();
      const consentStart = first.receipt.consentAt;
      if (parseCanonicalUtc(nowBefore) === null || parseCanonicalUtc(consentStart) === null
        || first.receipt.status !== "opted_in" || first.receipt.revokedAt !== null) {
        return fail("inactive_or_invalid_consent");
      }

      const [evidence, governance] = await Promise.all([
        readAggregateEvidence(scope), readGovernance(scope)
      ]);
      // Only accept aggregate counts and specific metadata. No raw events,
      // personal records, model-generated instructions or secrets are accepted.
      if (!evidence || evidence.sourceVerified !== true
        || evidence.organizationId !== organizationId
        || evidence.changeType !== changeType
        || typeof evidence.definitionId !== "string"
        || !/^[a-z][a-z0-9_]{0,63}$/.test(evidence.definitionId)
        || evidence.smallCellSuppressionVerified !== true
        || !Number.isSafeInteger(evidence.distinctContributors)
        || evidence.distinctContributors < 10
        || Object.keys(evidence).some(key => ![
          "sourceVerified", "organizationId", "changeType", "definitionId",
          "smallCellSuppressionVerified", "distinctContributors", "provenance",
          "observedAt", "evidenceWindowStartsAt", "baselineTrials",
          "baselineSuccesses", "candidateTrials", "candidateSuccesses"
        ].includes(key))) return fail("aggregate_evidence_scope_or_shape_invalid");
      if (!governance || governance.controlsVerified !== true
        || governance.rollbackPlanReviewed !== true
        || typeof governance.explanation !== "string"
        || governance.explanation.trim().length < 1 || governance.explanation.length > 240
        || Object.keys(governance).some(key => ![
          "controlsVerified", "rollbackPlanReviewed", "explanation"
        ].includes(key))) return fail("governance_state_unverified");

      // Re-read current consent after reading evidence. This detects changes
      // during evaluation, but does NOT grant transactional isolation or protect
      // against later revocation. No action/persistence is performed here.
      const second = await readLatestConsent(scope);
      if (!second || second.verifiedLatest !== true || !second.receipt
        || second.receipt.receiptId !== first.receipt.receiptId
        || second.receipt.revision !== first.receipt.revision
        || second.receipt.organizationId !== organizationId
        || second.receipt.userId !== principal.userId
        || second.receipt.changeType !== changeType) return fail("consent_changed_during_read");
      const nowAfter = clock();
      if (parseCanonicalUtc(nowAfter) === null || nowAfter < nowBefore)
        return fail("trusted_clock_invalid");

      return evaluateAdaptiveProposal({
        organizationId,
        serverOrganizationId: principal.organizationId,
        requestedByUserId: principal.userId,
        changeType,
        latestConsentReadVerified: true,
        consentReceipt: second.receipt,
        evidenceWindowStartsAt: evidence.evidenceWindowStartsAt,
        observedAt: evidence.observedAt,
        trustedNow: nowAfter,
        aggregateEvidenceVerified: true,
        userCanInspectCorrectDelete: true,
        rollbackPlanReviewed: governance.rollbackPlanReviewed,
        explanation: governance.explanation,
        provenance: evidence.provenance,
        baselineTrials: evidence.baselineTrials,
        baselineSuccesses: evidence.baselineSuccesses,
        candidateTrials: evidence.candidateTrials,
        candidateSuccesses: evidence.candidateSuccesses
      });
    } catch (_error) {
      // Never leak SQL/provider/authorization exception strings in responses.
      return fail("trusted_evidence_source_unavailable");
    }
  }
  return Object.freeze({ preview, mayExecuteTools: false, mayWriteMemory: false });
}

function getAdaptiveLearningReadiness() {
  return {
    mode: "non_executing_policy_only",
    source: "deterministic_aggregate_evaluation",
    types: [...ADAPTATION_TYPES],
    disallowedAutonomousChanges: [...NEVER_LEARN_AS_AUTONOMOUS_ACTION],
    privacy: "explicit_opt_in_aggregates_only_with_review_correction_export_deletion_controls",
    consentState: "trusted_server_snapshot_contract_only_no_store_no_persistence",
    authenticatedEvidenceBoundary: "injected_read_only_source_interface_unwired",
    consentMaxLifetimeDays: 90,
    consentMaxRetentionDays: 90,
    predictiveMapping: getPredictiveMappingReadiness(),
    operationalSelfAwareness: "health_and_quality_observability_not_consciousness",
    developerSelfCoding: "isolated_patch_draft_then_independent_tests_review_and_protected_release",
    prerequisites: [
      "server_authenticated_tenant_and_user",
      "durable_verifiable_consent_receipts_and_revoke_control",
      "tenant_scoped_aggregate_metrics_no_raw_behavior_profiles",
      "versioned_review_and_provenance",
      "retention_export_deletion_implementation",
      "independent_experiment_measurement_and_rollback",
      "existing_agent_permission_approval_and_release_gates"
    ],
    automaticExecutionAdded: 0,
    learningWritesAdded: 0
  };
}

module.exports = {
  ADAPTATION_TYPES,
  NEVER_LEARN_AS_AUTONOMOUS_ACTION,
  wilson95,
  evaluateLearningConsent,
  evaluateAdaptiveProposal,
  createAdaptiveProposalReader,
  getAdaptiveLearningReadiness
};
