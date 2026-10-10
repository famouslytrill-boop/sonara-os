// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure read-only operational forecasting, dependency mapping and telemetry triage.
// All flags below are caller assertions, NOT proof. Only a trusted server may
// independently source the tenant, evidence, subject count and consent facts.
// Nothing here reads accounts, collects habits, executes steps, or writes state.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[a-z][a-z0-9_]{0,47}$/;
const DAILY_METRICS = Object.freeze([
  "daily_orders", "daily_bookings", "daily_creative_jobs",
  "daily_opted_in_leads", "daily_workflow_runs"
]);
const PHASES = Object.freeze([
  "observe", "validate", "map", "predict",
  "evaluate", "propose", "review", "verify"
]);

function parseDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value)) return null;
  // Keep preview dates in the unambiguous four-digit calendar range.
  // ISO's expanded-year form would otherwise corrupt dayText().slice(0, 10).
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) return null;
  const date = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== value) return null;
  return date;
}
function dayText(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 10);
}
function validTenant(input) {
  return typeof input?.organizationId === "string" && UUID.test(input.organizationId)
    && input.organizationId === input.serverOrganizationId;
}
function block(code, details = []) {
  return Object.freeze({
    ok: false, state: "blocked", blockers: Object.freeze([...new Set([code, ...details])]),
    readOnly: true, executionAuthorized: false, dataWritten: false
  });
}
function readonly(state, payload = {}) {
  return Object.freeze({
    ok: true, state, readOnly: true, executionAuthorized: false,
    dataWritten: false, ...payload
  });
}

// Weekly seasonal-naive baseline: forecast h days ahead by repeating the
// last seven observed days. A fixed 7-day holdout is predicted from a single
// older origin (no training/selection using holdout outcomes). This is a simple
// benchmark, NOT trained ML, causal inference or a probabilistic confidence band.
function forecastDailyAggregate(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return block("invalid_input");
  if (!validTenant(input)) return block("tenant_scope_unverified");
  if (!DAILY_METRICS.includes(input.metric)) return block("unsupported_aggregate_metric");
  if (input.aggregateEvidenceVerified !== true || input.privacyReviewed !== true
    || input.smallCellSuppressionVerified !== true
    || !Number.isSafeInteger(input.distinctContributors) || input.distinctContributors < 10)
    return block("server_verified_aggregate_privacy_evidence_required");
  if (typeof input.provenance !== "string" || !input.provenance.trim())
    return block("source_provenance_required");
  const horizon = input.horizonDays ?? 7;
  if (!Number.isSafeInteger(horizon) || horizon < 1 || horizon > 14)
    return block("forecast_horizon_out_of_bounds");
  const series = input.series;
  if (!Array.isArray(series) || series.length < 35 || series.length > 180)
    return block("series_length_out_of_bounds");
  const now = parseDay(input.trustedToday);
  if (now === null) return block("trusted_today_invalid");
  const values = [];
  let previous = null;
  for (const row of series) {
    if (!row || typeof row !== "object" || Array.isArray(row)
      || !Number.isSafeInteger(row.value) || row.value < 0 || row.value > 1000000)
      return block("daily_aggregate_invalid");
    const at = parseDay(row.date);
    if (at === null || (previous !== null && at - previous !== 86400000))
      return block("daily_series_not_complete_and_ordered");
    previous = at;
    values.push(row.value);
  }
  if (previous > now || now - previous > 7 * 86400000)
    return block("observations_future_dated_or_stale");

  const holdout = values.slice(-7);
  const training = values.slice(0, -7);
  const backtestPredictions = training.slice(-7);
  const absErrors = holdout.map((actual, i) => Math.abs(actual - backtestPredictions[i]));
  const totalError = absErrors.reduce((sum, value) => sum + value, 0);
  const totalActual = holdout.reduce((sum, value) => sum + value, 0);
  const sortedErrors = [...absErrors].sort((a, b) => a - b);
  const residualP80 = sortedErrors[Math.ceil(0.8 * sortedErrors.length) - 1];
  const lastWeek = values.slice(-7);
  const predictions = Array.from({ length: horizon }, (_, i) => {
    const value = lastWeek[i % 7];
    return Object.freeze({
      date: dayText(previous + (i + 1) * 86400000),
      value,
      residualBand: Object.freeze({
        lower: Math.max(0, value - residualP80),
        upper: Math.min(1000000, value + residualP80)
      })
    });
  });
  return readonly("forecast_preview_only", {
    metric: input.metric,
    algorithm: "seven_day_seasonal_naive",
    trainedModel: false,
    observations: series.length,
    historyEndsAt: dayText(previous),
    horizonDays: horizon,
    backtest: Object.freeze({
      holdoutDays: 7,
      method: "single_origin_seven_day_seasonal_naive_no_holdout_fitting",
      mae: totalError / 7,
      wapePercent: totalActual === 0 ? null : 100 * totalError / totalActual,
      actualTotal: totalActual,
      forecastTotal: backtestPredictions.reduce((sum, value) => sum + value, 0),
      residualP80,
      errorBandCalibrated: false,
      reliabilityNote: "7 holdout observations: historical absolute-error reference only; not a confidence interval"
    }),
    predictions: Object.freeze(predictions),
    humanDecisionRequired: true,
    canChangeInventoryOrPublish: false
  });
}

// Non-overlapping seven-day test blocks at chronological rolling origins.
// Every fold forecasts with prior data only; no look-ahead or model-fitting.
// This improves evaluation evidence but never establishes prospective accuracy.
function evaluateRollingForecastEvidence(input = {}) {
  const checked = forecastDailyAggregate({ ...input, horizonDays: 7 });
  if (!checked.ok) return checked;
  const values = input.series.map(row => row.value);
  if (values.length < 42) {
    return readonly("insufficient_history_for_rolling_evaluation", {
      observedDays: values.length,
      requiredDays: 42,
      folds: Object.freeze([]),
      customerOperationAuthorized: false
    });
  }

  const foldResults = [];
  let seasonalError = 0;
  let persistenceError = 0;
  let totalActual = 0;
  let evaluatedDays = 0;
  for (let origin = 21; origin + 7 <= values.length; origin += 7) {
    let foldSeasonalError = 0;
    let foldPersistenceError = 0;
    let foldActual = 0;
    for (let step = 0; step < 7; step++) {
      const actual = values[origin + step];
      const seasonal = values[origin - 7 + step];
      const persistence = values[origin - 1];
      foldSeasonalError += Math.abs(actual - seasonal);
      foldPersistenceError += Math.abs(actual - persistence);
      foldActual += actual;
    }
    seasonalError += foldSeasonalError;
    persistenceError += foldPersistenceError;
    totalActual += foldActual;
    evaluatedDays += 7;
    foldResults.push(Object.freeze({
      trainingDays: origin,
      originDate: input.series[origin - 1].date,
      holdoutStartsAt: input.series[origin].date,
      holdoutEndsAt: input.series[origin + 6].date,
      testDays: 7,
      seasonalMae: foldSeasonalError / 7,
      persistenceMae: foldPersistenceError / 7,
      holdoutActualTotal: foldActual
    }));
  }

  const priorWeekTotal = values.slice(-14, -7).reduce((sum, v) => sum + v, 0);
  const latestWeekTotal = values.slice(-7).reduce((sum, v) => sum + v, 0);
  const absoluteShift = Math.abs(latestWeekTotal - priorWeekTotal);
  const relativeShift = priorWeekTotal === 0 ? null : absoluteShift / priorWeekTotal;
  const driftFlag = priorWeekTotal === 0 ? latestWeekTotal !== 0 : relativeShift > 0.3;
  const seasonalMae = seasonalError / evaluatedDays;
  const persistenceMae = persistenceError / evaluatedDays;
  const betterThanReference = persistenceError > 0
    && seasonalError <= 0.95 * persistenceError;
  const state = driftFlag ? "drift_requires_operator_review"
    : betterThanReference ? "seasonal_baseline_review_candidate"
      : "rolling_evidence_inconclusive";
  return readonly(state, {
    evaluationMethod: "nonoverlapping_rolling_origin_weekly_seasonal_vs_last_value",
    modelFitted: false,
    evaluatedDays,
    foldCount: foldResults.length,
    folds: Object.freeze(foldResults),
    seasonalMae,
    lastValueMae: persistenceMae,
    seasonalWapePercent: totalActual ? 100 * seasonalError / totalActual : null,
    lastValueWapePercent: totalActual ? 100 * persistenceError / totalActual : null,
    referenceForecast: "last_training_day_repeated_seven_days",
    seasonalBeatsReferenceByFivePercent: betterThanReference,
    previousWeekTotal: priorWeekTotal,
    latestWeekTotal,
    relativeWeekVolumeShift: relativeShift,
    driftReviewThreshold: 0.3,
    driftFlag,
    statisticalSignificanceEstablished: false,
    intervalCalibrated: false,
    improvementCausalProof: false,
    operatorReviewRequired: true,
    automaticInventoryOrMarketingChanges: false
  });
}

// Deterministic DAG planning for a non-executing research/learning workflow.
// Require each phase to explicitly depend on the immediately preceding phase,
// so an 'approval' or 'verification' stage cannot silently be skipped.
// This is a graph check, NOT an execution engine or human approval.
function mapLearningSequence(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return block("invalid_input");
  if (!validTenant(input)) return block("tenant_scope_unverified");
  if (typeof input.purpose !== "string" || !input.purpose.trim())
    return block("purpose_required");
  const steps = input.steps;
  if (!Array.isArray(steps) || steps.length < 2 || steps.length > 32)
    return block("sequence_size_out_of_bounds");
  const byId = new Map();
  let totalCostUnits = 0;
  for (const step of steps) {
    if (!step || typeof step !== "object" || Array.isArray(step)
      || typeof step.id !== "string" || !ID.test(step.id)
      || !PHASES.includes(step.phase)
      || !Array.isArray(step.dependsOn) || step.dependsOn.length > 8
      || !step.dependsOn.every(dep => typeof dep === "string" && ID.test(dep))
      || new Set(step.dependsOn).size !== step.dependsOn.length
      || !Number.isSafeInteger(step.estimatedCostUnits) || step.estimatedCostUnits < 0
      || step.estimatedCostUnits > 100)
      return block("sequence_step_invalid");
    if (byId.has(step.id)) return block("duplicate_sequence_step");
    totalCostUnits += step.estimatedCostUnits;
    byId.set(step.id, step);
  }
  if (totalCostUnits > 1000) return block("sequence_estimated_budget_exceeded");
  for (const step of steps) {
    const phaseRank = PHASES.indexOf(step.phase);
    if (phaseRank === 0 && step.dependsOn.length) return block("observation_must_have_no_dependencies");
    if (phaseRank > 0 && !step.dependsOn.some(id => byId.get(id)?.phase === PHASES[phaseRank - 1]))
      return block("mandatory_previous_phase_missing");
    for (const id of step.dependsOn) {
      const prerequisite = byId.get(id);
      if (!prerequisite) return block("missing_sequence_dependency");
      if (PHASES.indexOf(prerequisite.phase) >= phaseRank) return block("invalid_sequence_direction_or_cycle");
    }
  }
  const ordered = [...steps].sort((a, b) =>
    PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const depths = new Map();
  for (const step of ordered) {
    depths.set(step.id, 1 + Math.max(0, ...step.dependsOn.map(id => depths.get(id) || 0)));
  }
  const maxDepth = Math.max(...depths.values());
  const parallelBatches = Array.from({ length: maxDepth }, (_, i) =>
    Object.freeze(ordered.filter(step => depths.get(step.id) === i + 1).map(step => step.id)));
  return readonly("reviewable_sequence_only", {
    purpose: input.purpose,
    orderedSteps: Object.freeze(ordered.map(step => Object.freeze({
      id: step.id, phase: step.phase, dependsOn: Object.freeze([...step.dependsOn]),
      estimatedCostUnits: step.estimatedCostUnits, depth: depths.get(step.id)
    }))),
    totalEstimatedCostUnits: totalCostUnits,
    maxSequentialDepth: maxDepth,
    parallelBatches: Object.freeze(parallelBatches),
    approvalStatus: "not_requested",
    humanReviewStillRequired: true,
    canScheduleOrExecute: false
  });
}

function parseTrustedTelemetryTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

// Operational 'self-awareness' means validated telemetry triage; it is NOT
// subjective awareness, secret discovery, remediation or source modification.
function assessOperationalSignals(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return block("invalid_input");
  if (!validTenant(input)) return block("tenant_scope_unverified");
  if (input.telemetryVerified !== true || typeof input.provenance !== "string" || !input.provenance.trim())
    return block("verified_telemetry_required");
  const now = parseTrustedTelemetryTime(input.trustedNow);
  const windowStart = parseTrustedTelemetryTime(input.windowStartsAt);
  const windowEnd = parseTrustedTelemetryTime(input.windowEndsAt);
  if (now === null || windowStart === null || windowEnd === null
    || windowStart >= windowEnd || windowEnd > now || now - windowEnd > 2 * 3600000
    || windowEnd - windowStart < 5 * 60000
    || windowEnd - windowStart > 24 * 3600000)
    return block("telemetry_window_invalid_stale_or_unbounded");
  if (input.telemetryAggregationMethod !== "server_histogram_p95"
    || input.telemetrySampleComplete !== true)
    return block("telemetry_aggregation_proof_required");
  if (!Number.isSafeInteger(input.requests) || input.requests < 100 || input.requests > 100000000
    || !Number.isSafeInteger(input.failedRequests) || input.failedRequests < 0 || input.failedRequests > input.requests
    || !Number.isSafeInteger(input.p95LatencyMs) || input.p95LatencyMs < 0 || input.p95LatencyMs > 600000
    || !Number.isSafeInteger(input.reviewedLatencyThresholdMs) || input.reviewedLatencyThresholdMs < 1
    || !Number.isFinite(input.reviewedErrorRateThreshold) || input.reviewedErrorRateThreshold <= 0
    || input.reviewedErrorRateThreshold >= 1)
    return block("telemetry_or_slo_threshold_invalid");
  const errorRate = input.failedRequests / input.requests;
  const degraded = errorRate > input.reviewedErrorRateThreshold
    || input.p95LatencyMs > input.reviewedLatencyThresholdMs;
  return readonly(degraded ? "operator_review_recommended" : "within_supplied_thresholds", {
    requestCount: input.requests,
    windowStartsAt: input.windowStartsAt,
    windowEndsAt: input.windowEndsAt,
    windowDurationMinutes: (windowEnd - windowStart) / 60000,
    telemetryAggregationMethod: input.telemetryAggregationMethod,
    errorRate,
    p95LatencyMs: input.p95LatencyMs,
    errorThreshold: input.reviewedErrorRateThreshold,
    latencyThresholdMs: input.reviewedLatencyThresholdMs,
    healthConclusion: "supplied_window_only",
    humanVerificationRequired: degraded,
    automaticRepairAuthorized: false,
    selfModificationAuthorized: false
  });
}

function getPredictiveMappingReadiness() {
  return Object.freeze({
    status: "pure_policy_and_preview_only",
    forecasting: "daily_aggregate_weekly_seasonal_naive_with_fixed_holdout",
    rollingOriginEvaluation: "nonoverlapping_seven_day_folds_plus_drift_flag_no_auto_action",
    forecastingMetrics: [...DAILY_METRICS],
    maxForecastHorizonDays: 14,
    sequenceMapping: "bounded_dependency_graph_no_execution",
    phases: [...PHASES],
    selfObservation: "verified_telemetry_triage_only_not_consciousness",
    telemetryWindow: "canonical_utc_5minutes_to_24hours_fresh_under_two_hours",
    modelWeightsUpdated: false,
    personalHabitsCollected: false,
    customerRecordsRead: false,
    providerActivated: false,
    automatedActionsAdded: 0
  });
}

module.exports = {
  DAILY_METRICS, PHASES, forecastDailyAggregate, evaluateRollingForecastEvidence,
  mapLearningSequence, assessOperationalSignals, getPredictiveMappingReadiness
};
