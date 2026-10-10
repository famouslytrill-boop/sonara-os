"use strict";

const assert = require("node:assert/strict");
const {
  ADAPTATION_TYPES,
  NEVER_LEARN_AS_AUTONOMOUS_ACTION,
  wilson95,
  evaluateLearningConsent,
  evaluateAdaptiveProposal,
  createAdaptiveProposalReader,
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
  trustedNow: "2026-10-09T19:00:00.000Z",
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
      { evidenceWindowStartsAt: "yesterday" },
      { observedAt: "2026-10-01T18:00:00.000Z" },
      { consentReceipt: { ...valid.consentReceipt, retentionDays: 1 } }
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

const {
  DAILY_METRICS, PHASES, forecastDailyAggregate, evaluateRollingForecastEvidence, mapLearningSequence,
  assessOperationalSignals, getPredictiveMappingReadiness
} = require("../lib/sonara-adaptive-prediction-mapping.cjs");

const forecastHistory = Object.freeze(Array.from({ length: 42 }, (_, i) => Object.freeze({
  date: new Date(Date.UTC(2026, 7, 25 + i)).toISOString().slice(0, 10),
  value: 10 + (i % 7) * 2
})));
const forecastValid = Object.freeze({
  organizationId: ORG,
  serverOrganizationId: ORG,
  metric: "daily_orders",
  aggregateEvidenceVerified: true,
  privacyReviewed: true,
  smallCellSuppressionVerified: true,
  distinctContributors: 30,
  provenance: "server-owned approved daily aggregate",
  trustedToday: "2026-10-09",
  horizonDays: 14,
  series: forecastHistory
});
const orderedStages = PHASES.map((phase, index) => ({
  id: phase, phase,
  dependsOn: index === 0 ? [] : [PHASES[index - 1]],
  estimatedCostUnits: 3
}));

describe("adaptive prediction and sequence mapping policy (no runtime execution)", () => {
  it("previews a 14-day seven-day baseline with a held-out backtest", () => {
    const result = forecastDailyAggregate(forecastValid);
    assert.equal(result.state, "forecast_preview_only");
    assert.equal(result.predictions.length, 14);
    assert.equal(result.backtest.holdoutDays, 7);
    assert.equal(result.backtest.mae, 0);
    assert.equal(result.backtest.wapePercent, 0);
    assert.equal(result.trainedModel, false);
    assert.equal(result.predictions[0].value, forecastHistory[35].value);
    assert.equal(result.predictions[7].value, result.predictions[0].value);
    assert.equal(result.predictions[0].date, "2026-10-06");
    assert.equal(result.readOnly, true);
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.dataWritten, false);
  });

  it("reports holdout errors and uncertainty honestly without fitted intervals", () => {
    const changed = forecastHistory.map((point, i) =>
      i >= 35 ? { ...point, value: point.value + 5 } : point);
    const result = forecastDailyAggregate({ ...forecastValid, series: changed });
    assert.equal(result.backtest.mae, 5);
    assert.equal(result.backtest.residualP80, 5);
    assert.equal(result.backtest.errorBandCalibrated, false);
    assert.equal(result.predictions[0].residualBand.lower, result.predictions[0].value - 5);
    assert.equal(forecastDailyAggregate({
      ...forecastValid, series: forecastHistory.map(point => ({ ...point, value: 0 }))
    }).backtest.wapePercent, null);
  });

  it("blocks cross-tenant, unapproved, small-population and non-aggregate forecasting", () => {
    for (const invalid of [
      { serverOrganizationId: USER },
      { metric: "individual_browsing_history" },
      { aggregateEvidenceVerified: false },
      { privacyReviewed: false },
      { smallCellSuppressionVerified: false },
      { distinctContributors: 9 },
      { provenance: "" },
      { horizonDays: 0 },
      { horizonDays: 15 },
      { horizonDays: 1.5 },
      { series: forecastHistory.slice(0, 20) },
      { series: [] },
      { trustedToday: "2026-10-04" },
      { trustedToday: "2026-11-11" },
      { trustedToday: "2026-02-30" },
      { trustedToday: "9999-12-31" }
    ]) {
      const result = forecastDailyAggregate({ ...forecastValid, ...invalid });
      assert.equal(result.state, "blocked", JSON.stringify(invalid).slice(0, 90));
      assert.equal(result.executionAuthorized, false);
    }
  });

  it("rejects missing, duplicate, out-of-order, malformed and impossible daily values", () => {
    const variants = [
      forecastHistory.map((v,i) => i === 10 ? { ...v, date: forecastHistory[9].date } : v),
      forecastHistory.map((v,i) => i === 10 ? { ...v, date: "2026-02-30" } : v),
      forecastHistory.map((v,i) => i === 10 ? { ...v, value: -1 } : v),
      forecastHistory.map((v,i) => i === 10 ? { ...v, value: 1.1 } : v),
      forecastHistory.map((v,i) => i === 10 ? { ...v, value: Infinity } : v),
      forecastHistory.map((v,i) => i === 10 ? { ...v, value: 1000001 } : v)
    ];
    for (const series of variants) {
      assert.equal(forecastDailyAggregate({ ...forecastValid, series }).state, "blocked");
    }
    assert.equal(forecastDailyAggregate(null).state, "blocked");
    assert.equal(DAILY_METRICS.length, 5);
  });

  it("produces a stable phase-by-phase read-only DAG plan", () => {
    const args = { organizationId: ORG, serverOrganizationId: ORG,
      purpose: "explainable aggregate demand and workflow feedback", steps: orderedStages };
    const result = mapLearningSequence(args);
    assert.equal(result.state, "reviewable_sequence_only");
    assert.deepEqual(result.orderedSteps.map(x => x.phase), PHASES);
    assert.equal(result.totalEstimatedCostUnits, 24);
    assert.equal(result.maxSequentialDepth, 8);
    assert.deepEqual(result.parallelBatches.map(batch => batch.length), Array(8).fill(1));
    assert.deepEqual(mapLearningSequence({ ...args, steps: [...orderedStages].reverse() }).orderedSteps,
      result.orderedSteps);
    assert.equal(result.canScheduleOrExecute, false);
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.approvalStatus, "not_requested");
  });

  it("rejects skipped phases, cycles, missing edges, duplicate names and budget bypasses", () => {
    const args = { organizationId: ORG, serverOrganizationId: ORG,
      purpose: "auditable readonly process", steps: orderedStages };
    for (const steps of [
      [{ ...orderedStages[0] }, { ...orderedStages[3], dependsOn: ["observe"] }],
      [...orderedStages.slice(0, -1), { ...orderedStages[7], dependsOn: ["verify"] }],
      [...orderedStages, orderedStages[0]],
      [...orderedStages.slice(0, 2), { ...orderedStages[2], dependsOn: ["missing"] }, ...orderedStages.slice(3)],
      [...orderedStages.slice(0, 1), { ...orderedStages[1], dependsOn: ["observe", "validate"] }, ...orderedStages.slice(2)],
      [...orderedStages.slice(0, 1), { ...orderedStages[1], id: "__proto__" }, ...orderedStages.slice(2)],
      orderedStages.map(v => ({ ...v, estimatedCostUnits: 101 })),
      orderedStages.map(v => ({ ...v, dependsOn: Array(9).fill("observe") }))
    ]) {
      assert.equal(mapLearningSequence({ ...args, steps }).state, "blocked");
    }
    assert.equal(mapLearningSequence({ ...args, serverOrganizationId: USER }).state, "blocked");
    assert.equal(mapLearningSequence({ ...args, purpose: "" }).state, "blocked");
    assert.equal(mapLearningSequence(null).state, "blocked");
  });

  it("does not mislabel incomplete sequences as completed audited workflows", () => {
    const partial = mapLearningSequence({
      organizationId: ORG, serverOrganizationId: ORG,
      purpose: "proposal-only plan",
      steps: orderedStages.slice(0, 4)
    });
    assert.equal(partial.state, "incomplete_sequence_requires_review");
    assert.equal(partial.endToEndComplete, false);
    assert.deepEqual(partial.missingPhases, PHASES.slice(4));
    assert.equal(partial.canScheduleOrExecute, false);
    const complete = mapLearningSequence({
      organizationId: ORG, serverOrganizationId: ORG,
      purpose: "audited",
      steps: orderedStages
    });
    assert.equal(complete.endToEndComplete, true);
    assert.deepEqual(complete.missingPhases, []);
    for (const bad of ["x".repeat(241), "untrusted" + String.fromCharCode(10) + "log injection"]) {
      assert.equal(mapLearningSequence({
        organizationId: ORG, serverOrganizationId: ORG,
        purpose: bad, steps: orderedStages
      }).state, "blocked");
    }
  });

  it("maps parallel branches without claiming to execute or approve them", () => {
    const steps = [...orderedStages, {
      id: "validate_extra", phase: "validate", dependsOn: ["observe"], estimatedCostUnits: 5
    }];
    const result = mapLearningSequence({ organizationId: ORG, serverOrganizationId: ORG,
      purpose: "plan duplicate review", steps });
    assert.equal(result.maxSequentialDepth, 8);
    assert.deepEqual(result.parallelBatches[1], ["validate", "validate_extra"]);
    assert.equal(result.humanReviewStillRequired, true);
  });

  it("triages operational telemetry without autorepair or self-coding", () => {
    const baseline = { organizationId: ORG, serverOrganizationId: ORG,
      telemetryVerified: true, provenance: "trusted request metric",
      trustedNow: "2026-10-09T20:00:00.000Z",
      windowStartsAt: "2026-10-09T19:00:00.000Z",
      windowEndsAt: "2026-10-09T19:30:00.000Z",
      telemetryAggregationMethod: "server_histogram_p95",
      telemetrySampleComplete: true,
      requests: 1000, failedRequests: 1, p95LatencyMs: 120,
      reviewedErrorRateThreshold: 0.01, reviewedLatencyThresholdMs: 500 };
    const healthy = assessOperationalSignals(baseline);
    assert.equal(healthy.state, "within_supplied_thresholds");
    assert.equal(healthy.errorRate, 0.001);
    assert.equal(healthy.automaticRepairAuthorized, false);
    assert.equal(assessOperationalSignals({ ...baseline, failedRequests: 50 }).state,
      "operator_review_recommended");
    assert.equal(assessOperationalSignals({ ...baseline, p95LatencyMs: 650 }).state,
      "operator_review_recommended");
    for (const override of [
      { telemetryVerified: false }, { serverOrganizationId: USER },
      { failedRequests: 1001 }, { requests: 20 },
      { reviewedErrorRateThreshold: 0 }, { p95LatencyMs: NaN },
      { reviewedLatencyThresholdMs: 0 }, { provenance: "" },
      { windowStartsAt: "2026-10-09T19:28:00.000Z" },
      { windowStartsAt: "2026-10-09T20:30:00.000Z" },
      { windowEndsAt: "2026-10-09T20:30:00.000Z" },
      { windowEndsAt: "2026-10-09T17:00:00.000Z" },
      { windowEndsAt: "2026-10-09T19:30:00Z" },
      { telemetryAggregationMethod: "browser_p95" },
      { telemetrySampleComplete: false },
      { trustedNow: "2026-10-10T21:00:00.000Z" }
    ]) {
      assert.equal(assessOperationalSignals({ ...baseline, ...override }).state, "blocked");
    }
  });

  it("cross-validates seven-day seasonal predictions on non-overlapping rolling origins", () => {
    const result = evaluateRollingForecastEvidence(forecastValid);
    assert.equal(result.state, "seasonal_baseline_review_candidate");
    assert.equal(result.foldCount, 3);
    assert.equal(result.evaluatedDays, 21);
    assert.equal(result.seasonalMae, 0);
    assert.ok(result.lastValueMae > 0);
    assert.equal(result.statisticalSignificanceEstablished, false);
    assert.equal(result.intervalCalibrated, false);
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.automaticInventoryOrMarketingChanges, false);
    assert.equal(result.folds[0].trainingDays, 21);
    assert.equal(result.folds[0].testDays, 7);
    assert.equal(result.folds[0].holdoutStartsAt, forecastHistory[21].date);
    assert.equal(result.folds[2].holdoutEndsAt, forecastHistory[41].date);
  });

  it("exposes drift and refuses to confuse historical error bands with confidence", () => {
    const drift = forecastHistory.map((point, i) =>
      i >= 35 ? { ...point, value: point.value + 100 } : point);
    const result = evaluateRollingForecastEvidence({ ...forecastValid, series: drift });
    assert.equal(result.state, "drift_requires_operator_review");
    assert.equal(result.driftFlag, true);
    assert.equal(result.intervalCalibrated, false);
    assert.equal(result.statisticalSignificanceEstablished, false);
    const zero = forecastHistory.map(point => ({ ...point, value: 0 }));
    const zeroResult = evaluateRollingForecastEvidence({ ...forecastValid, series: zero });
    assert.equal(zeroResult.seasonalWapePercent, null);
    assert.equal(zeroResult.lastValueWapePercent, null);
    assert.equal(zeroResult.state, "rolling_evidence_inconclusive");
  });

  it("keeps short but valid history non-executable and requires truthful proof", () => {
    const short = evaluateRollingForecastEvidence({
      ...forecastValid, series: forecastHistory.slice(7)
    });
    assert.equal(short.state, "insufficient_history_for_rolling_evaluation");
    assert.equal(short.customerOperationAuthorized, false);
    assert.equal(short.executionAuthorized, false);
    assert.equal(evaluateRollingForecastEvidence({
      ...forecastValid, serverOrganizationId: USER
    }).state, "blocked");
    assert.equal(evaluateRollingForecastEvidence({
      ...forecastValid, aggregateEvidenceVerified: false
    }).state, "blocked");
  });

  it("labels prediction, operational awareness, and planning as non-executing", () => {
    const metadata = getPredictiveMappingReadiness();
    assert.equal(metadata.modelWeightsUpdated, false);
    assert.match(metadata.rollingOriginEvaluation, /nonoverlapping_seven_day_folds/);
    assert.match(metadata.telemetryWindow, /canonical_utc/);
    assert.equal(metadata.personalHabitsCollected, false);
    assert.equal(metadata.automatedActionsAdded, 0);
    assert.equal(metadata.providerActivated, false);
    assert.equal(getAdaptiveLearningReadiness().predictiveMapping.status,
      "pure_policy_and_preview_only");
  });
});


const {
  requireVerifiedUserScopedRead, isVerifiedUserScopedRead,
  createUserScopedRlsReadinessVerifier
} = require("../lib/sonara-supabase-clients.cjs");

const adapterReadConfig = Object.freeze({
  serviceRoleKey: "server-only-test-secret",
  anonKey: "sb_publishable_test_public_key"
});
async function mintedTestEvidenceRead() {
  const foreignOrg = "44444444-4444-4444-8444-444444444444";
  const foreignUser = "55555555-5555-4555-8555-555555555555";
  const ownRow = "66666666-6666-4666-8666-666666666666";
  const foreignRow = "77777777-7777-4777-8777-777777777777";
  const ownToken = "test-user-access-token";
  const foreignToken = "test-other-user-access-token";
  const verifier = createUserScopedRlsReadinessVerifier({
    inspectTableSecurity: async ({ table }) => ({
      table, grantVerified: true, rlsEnabled: true, sourceVerified: true
    }),
    readExactRow: async ({ accessToken, rowId }) => {
      if (accessToken === ownToken && rowId === ownRow) {
        return { status: 200, rows: [{ id: ownRow, organization_id: ORG }] };
      }
      if (accessToken === foreignToken && rowId === foreignRow) {
        return { status: 200, rows: [{ id: foreignRow, organization_id: foreignOrg }] };
      }
      return { status: 200, rows: [] };
    }
  });
  const proof = await verifier.verify({
    table: "sonara_learning_aggregates",
    organizationId: ORG, userId: USER, rowId: ownRow,
    otherOrganizationId: foreignOrg, otherUserId: foreignUser,
    otherRowId: foreignRow, accessToken: ownToken, otherAccessToken: foreignToken,
    trustedNow: "2026-10-09T18:00:00.000Z"
  });
  return requireVerifiedUserScopedRead({
    config: adapterReadConfig, accessToken: ownToken,
    table: "sonara_learning_aggregates",
    organizationId: ORG, serverOrganizationId: ORG,
    userId: USER, serverUserId: USER,
    trustedNow: valid.trustedNow, liveProof: proof
  });
}

const adapterEvidence = Object.freeze({
  sourceVerified: true,
  organizationId: ORG,
  changeType: "workspace_layout",
  definitionId: "workflow_completion_rate",
  smallCellSuppressionVerified: true,
  distinctContributors: 25,
  provenance: "approved organization aggregate: version 4",
  evidenceWindowStartsAt: valid.evidenceWindowStartsAt,
  observedAt: valid.observedAt,
  baselineTrials: valid.baselineTrials,
  baselineSuccesses: valid.baselineSuccesses,
  candidateTrials: valid.candidateTrials,
  candidateSuccesses: valid.candidateSuccesses
});

function mockAdaptiveReaders(overrides = {}) {
  let consentReads = 0;
  let aggregateReads = 0;
  const reader = createAdaptiveProposalReader({
    resolvePrincipal: overrides.resolvePrincipal || (async () => ({
      authenticated: true, membershipVerified: true, canReadLearningEvidence: true,
      userId: USER, organizationId: ORG
    })),
    readLatestConsent: overrides.readLatestConsent || (async () => {
      consentReads++;
      return { verifiedLatest: true, receipt: valid.consentReceipt };
    }),
    readAggregateEvidence: overrides.readAggregateEvidence || (async () => {
      aggregateReads++;
      return adapterEvidence;
    }),
    readGovernance: overrides.readGovernance || (async () => ({
      controlsVerified: true, inspectAvailable: true,
      correctionAvailable: true, deletionAvailable: true,
      rollbackPlanReviewed: true,
      explanation: "An approved, reversible workspace layout preview."
    })),
    authorizeUserScopedEvidenceRead: overrides.authorizeUserScopedEvidenceRead
      || (async () => mintedTestEvidenceRead()),
    clock: overrides.clock || (() => valid.trustedNow)
  });
  return {
    reader, calls: () => ({ consentReads, aggregateReads })
  };
}

describe("trusted-source adaptive preview adapter (inactive integration boundary)", () => {
  it("reads authenticated consent twice and produces only a proposal", async () => {
    const { reader, calls } = mockAdaptiveReaders();
    const result = await reader.preview({
      organizationId: ORG, changeType: "workspace_layout", sessionContext: { session: "test-only" }
    });
    assert.equal(result.state, "review_ready");
    assert.deepEqual(calls(), { consentReads: 2, aggregateReads: 1 });
    assert.equal(result.mayExecuteTools, false);
    assert.equal(result.mayWriteCustomerMemory, false);
    assert.equal(reader.mayExecuteTools, false);
  });

  it("blocks unauthenticated and cross-tenant sessions before reading evidence", async () => {
    for (const principal of [
      null,
      { authenticated: false, membershipVerified: true, canReadLearningEvidence: true, userId: USER, organizationId: ORG },
      { authenticated: true, membershipVerified: false, canReadLearningEvidence: true, userId: USER, organizationId: ORG },
      { authenticated: true, membershipVerified: true, canReadLearningEvidence: false, userId: USER, organizationId: ORG },
      { authenticated: true, membershipVerified: true, canReadLearningEvidence: true, userId: USER, organizationId: USER }
    ]) {
      const { reader, calls } = mockAdaptiveReaders({ resolvePrincipal: async () => principal });
      const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(result.state, "blocked");
      assert.deepEqual(calls(), { consentReads: 0, aggregateReads: 0 });
    }
  });

  it("rejects expired, invalid and revoked consent before reading any aggregate", async () => {
    for (const receipt of [
      { ...valid.consentReceipt, expiresAt: "2026-10-08T19:00:00.000Z" },
      { ...valid.consentReceipt, retentionDays: 91 },
      { ...valid.consentReceipt, receiptId: "not-a-uuid" },
      { ...valid.consentReceipt, method: "passive_tracking" },
      { ...valid.consentReceipt, revision: 0 },
      { ...valid.consentReceipt, revokedAt: valid.observedAt }
    ]) {
      let aggregateReads = 0;
      const { reader } = mockAdaptiveReaders({
        readLatestConsent: async () => ({ verifiedLatest: true, receipt }),
        readAggregateEvidence: async () => { aggregateReads++; return adapterEvidence; }
      });
      const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(result.state, "blocked", JSON.stringify(receipt));
      assert.equal(aggregateReads, 0);
    }
  });

  it("rejects oversized or control-character-laden provenance and explanation", async () => {
    for (const provenance of ["x".repeat(241), "verified" + String.fromCharCode(10) + "spoof"]) {
      const { reader } = mockAdaptiveReaders({
        readAggregateEvidence: async () => ({ ...adapterEvidence, provenance })
      });
      assert.equal((await reader.preview({
        organizationId: ORG, changeType: "workspace_layout"
      })).state, "blocked");
    }
    const { reader } = mockAdaptiveReaders({
      readGovernance: async () => ({
        controlsVerified: true, rollbackPlanReviewed: true,
        explanation: "approve" + String.fromCharCode(10) + "injected message"
      })
    });
    assert.equal((await reader.preview({
      organizationId: ORG, changeType: "workspace_layout"
    })).state, "blocked");
  });

  it("does not accept request body verified flags as an authority", async () => {
    const { reader, calls } = mockAdaptiveReaders({
      readLatestConsent: async () => ({ verifiedLatest: false, receipt: valid.consentReceipt })
    });
    const result = await reader.preview({
      organizationId: ORG, changeType: "workspace_layout",
      verifiedConsent: true, aggregateEvidenceVerified: true,
      latestConsentReadVerified: true, requestedByUserId: USER
    });
    assert.equal(result.state, "blocked");
    assert.equal(result.blockers[0], "latest_consent_not_verified");
    assert.equal(calls().aggregateReads, 0);
  });

  it("rejects changed or revoked consent snapshots", async () => {
    const revoked = mockAdaptiveReaders({
      readLatestConsent: async () => ({ verifiedLatest: true, receipt: {
        ...valid.consentReceipt, status: "revoked", revokedAt: valid.observedAt
      } })
    });
    assert.equal((await revoked.reader.preview({
      organizationId: ORG, changeType: "workspace_layout"
    })).state, "blocked");
    const changed = mockAdaptiveReaders({
      readLatestConsent: (() => {
        let count = 0;
        return async () => ({ verifiedLatest: true, receipt: {
          ...valid.consentReceipt, revision: ++count
        } });
      })()
    });
    const result = await changed.reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
    assert.equal(result.state, "blocked");
    assert.equal(result.blockers[0], "consent_changed_during_read");
  });

  it("rejects service-role fallback and missing live user-scoped read proof", async () => {
    for (const result of [
      null,
      { client: "service_role", mode: "rls_scoped_read_only", serviceRoleFallbackAllowed: false, method: "GET", table: "sonara_learning_aggregates", organizationId: ORG, userId: USER },
      { client: "user", mode: "rls_scoped_read_only", serviceRoleFallbackAllowed: true, method: "GET", table: "sonara_learning_aggregates", organizationId: ORG, userId: USER },
      { client: "user", mode: "rls_scoped_read_only", serviceRoleFallbackAllowed: false, method: "POST", table: "sonara_learning_aggregates", organizationId: ORG, userId: USER },
      { client: "user", mode: "rls_scoped_read_only", serviceRoleFallbackAllowed: false, method: "GET", table: "another_table", organizationId: ORG, userId: USER },
      { client: "user", mode: "rls_scoped_read_only", serviceRoleFallbackAllowed: false, method: "GET", table: "sonara_learning_aggregates", organizationId: USER, userId: USER }
    ]) {
      let count = 0;
      const { reader } = mockAdaptiveReaders({
        authorizeUserScopedEvidenceRead: async () => result,
        readAggregateEvidence: async () => { count++; return adapterEvidence; }
      });
      const answer = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(answer.state, "blocked");
      assert.equal(answer.blockers[0], "verified_user_scoped_evidence_read_required");
      assert.equal(count, 0, "no aggregate read without user-JWT scoped authorization");
    }
  });

  it("rejects forged object copies while a branded scoped read may pass", async () => {
    const minted = await mintedTestEvidenceRead();
    assert.equal(isVerifiedUserScopedRead(minted, {
      table: "sonara_learning_aggregates", organizationId: ORG, userId: USER
    }), true);
    assert.equal(Object.keys(minted).includes("headers"), false);
    assert.equal(JSON.stringify(minted).includes("test-user-access-token"), false);
    assert.equal(minted.headers.Authorization, "Bearer test-user-access-token");

    for (const forged of [
      { ...minted },
      JSON.parse(JSON.stringify(minted)),
      Object.assign({}, minted),
      { ...minted, headers: minted.headers }
    ]) {
      assert.equal(isVerifiedUserScopedRead(forged, {
        table: "sonara_learning_aggregates", organizationId: ORG, userId: USER
      }), false);
      let readCount = 0;
      const { reader } = mockAdaptiveReaders({
        authorizeUserScopedEvidenceRead: async () => forged,
        readAggregateEvidence: async () => { readCount++; return adapterEvidence; }
      });
      const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(result.state, "blocked");
      assert.equal(readCount, 0);
    }
  });

  it("refuses raw personal records, cross-tenant evidence, and absent aggregation proof", async () => {
    for (const evidence of [
      { ...adapterEvidence, organizationId: USER },
      { ...adapterEvidence, sourceVerified: false },
      { ...adapterEvidence, distinctContributors: 5 },
      { ...adapterEvidence, smallCellSuppressionVerified: false },
      { ...adapterEvidence, definitionId: "__proto__" },
      { ...adapterEvidence, rawRows: [{ email: "must-not-appear@example.com" }] }
    ]) {
      const { reader } = mockAdaptiveReaders({ readAggregateEvidence: async () => evidence });
      const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(result.state, "blocked");
      assert.equal(JSON.stringify(result).includes("must-not-appear@example.com"), false);
    }
  });

  it("fails closed on missing governance controls and stale evidence", async () => {
    const noControls = mockAdaptiveReaders({
      readGovernance: async () => ({ controlsVerified: false, rollbackPlanReviewed: true, explanation: "test" })
    });
    assert.equal((await noControls.reader.preview({
      organizationId: ORG, changeType: "workspace_layout"
    })).state, "blocked");
    const stale = mockAdaptiveReaders({
      readAggregateEvidence: async () => ({
        ...adapterEvidence, evidenceWindowStartsAt: "2026-09-15T19:00:00.000Z"
      })
    });
    assert.equal((await stale.reader.preview({
      organizationId: ORG, changeType: "workspace_layout"
    })).state, "blocked");
  });

  it("requires individual inspect, correction and deletion controls before aggregate access", async () => {
    for (const missing of ["inspectAvailable", "correctionAvailable", "deletionAvailable"]) {
      const states = {
        controlsVerified: true, inspectAvailable: true,
        correctionAvailable: true, deletionAvailable: true,
        rollbackPlanReviewed: true, explanation: "review"
      };
      delete states[missing];
      let aggregateReads = 0;
      const { reader } = mockAdaptiveReaders({
        readGovernance: async () => states,
        readAggregateEvidence: async () => { aggregateReads++; return adapterEvidence; }
      });
      const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(result.state, "blocked", missing);
      assert.equal(aggregateReads, 0, missing);
      states[missing] = false;
      const again = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(again.state, "blocked", missing);
      assert.equal(aggregateReads, 0, missing);
    }
  });

  it("does not read aggregates when governance fails or throws", async () => {
    for (const governance of [
      { controlsVerified: false, rollbackPlanReviewed: true, explanation: "review" },
      { controlsVerified: true, rollbackPlanReviewed: false, explanation: "review" },
      { controlsVerified: true, rollbackPlanReviewed: true, explanation: "x".repeat(241) }
    ]) {
      let aggregateReads = 0;
      const { reader } = mockAdaptiveReaders({
        readGovernance: async () => governance,
        readAggregateEvidence: async () => { aggregateReads++; return adapterEvidence; }
      });
      const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(result.state, "blocked");
      assert.equal(aggregateReads, 0, "denied governance must not access aggregates");
    }
    let aggregateReads = 0;
    const { reader } = mockAdaptiveReaders({
      readGovernance: async () => { throw new Error("sensitive policy SQL error"); },
      readAggregateEvidence: async () => { aggregateReads++; return adapterEvidence; }
    });
    const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
    assert.equal(result.state, "blocked");
    assert.equal(aggregateReads, 0);
    assert.doesNotMatch(JSON.stringify(result), /sensitive policy SQL error/);
  });

  it("rechecks active principal membership and scope before returning a proposal", async () => {
    for (const replacement of [
      null,
      { authenticated: false, membershipVerified: true, canReadLearningEvidence: true, userId: USER, organizationId: ORG },
      { authenticated: true, membershipVerified: false, canReadLearningEvidence: true, userId: USER, organizationId: ORG },
      { authenticated: true, membershipVerified: true, canReadLearningEvidence: false, userId: USER, organizationId: ORG },
      { authenticated: true, membershipVerified: true, canReadLearningEvidence: true, userId: ORG, organizationId: ORG },
      { authenticated: true, membershipVerified: true, canReadLearningEvidence: true, userId: USER, organizationId: USER }
    ]) {
      let principalReads = 0;
      const first = {
        authenticated: true, membershipVerified: true,
        canReadLearningEvidence: true, userId: USER, organizationId: ORG
      };
      const { reader } = mockAdaptiveReaders({
        resolvePrincipal: async () => (++principalReads === 1 ? first : replacement)
      });
      const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
      assert.equal(principalReads, 2);
      assert.equal(result.state, "blocked");
      assert.equal(result.blockers[0], "principal_permission_changed_during_read");
      assert.equal(result.mayExecuteTools, false);
    }
  });

  it("redacts exceptions and requires all server-side functions", async () => {
    assert.throws(() => createAdaptiveProposalReader({}), /server-owned/);
    const { reader } = mockAdaptiveReaders({
      readAggregateEvidence: async () => { throw new Error("private database password is secret"); }
    });
    const result = await reader.preview({ organizationId: ORG, changeType: "workspace_layout" });
    assert.equal(result.state, "blocked");
    assert.equal(result.blockers[0], "trusted_evidence_source_unavailable");
    assert.doesNotMatch(JSON.stringify(result), /private database password/);
  });

  it("denies malformed scope without calling the trusted readers", async () => {
    const { reader, calls } = mockAdaptiveReaders();
    const result = await reader.preview({ organizationId: USER, changeType: "production_deployment" });
    assert.equal(result.state, "blocked");
    assert.deepEqual(calls(), { consentReads: 0, aggregateReads: 0 });
  });
});
