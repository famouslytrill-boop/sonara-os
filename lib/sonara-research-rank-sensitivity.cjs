// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
// Offline, deterministic interval comparison. Bounds are caller-supplied and
// are NOT NIST-expanded uncertainty, probability or statistical confidence.
const { planComparableTop50 } = require("./sonara-research-comparable-top50.cjs");
const FIELD_NAMES = ["entityId", "evidenceId", "lower", "upper", "intervalType"];
const ALLOWED_INTERVAL_TYPES = new Set(["source_reported_range", "scenario_bounds"]);
function assessTop50RankSensitivity({ comparison, intervals } = {}) {
  // Retain the existing data type, time-period, metric, geography and
  // copyright/publisher restrictions before reading interval information.
  const plan = planComparableTop50(comparison);
  if (!Array.isArray(intervals) || intervals.length !== comparison.observations.length || intervals.length > 500) {
    throw new TypeError("Exactly one bounded interval is required per comparison observation");
  }
  const rows = new Map(comparison.observations.map(r => [r.entityId, r]));
  const byEntity = new Map();
  for (let i = 0; i < intervals.length; i++) {
    const item = intervals[i];
    if (!item || typeof item !== "object" || Array.isArray(item)
      || Object.keys(item).length !== FIELD_NAMES.length
      || Object.keys(item).some(k => !FIELD_NAMES.includes(k))
      || typeof item.entityId !== "string" || !rows.has(item.entityId)
      || byEntity.has(item.entityId)
      || item.evidenceId !== rows.get(item.entityId).evidenceId
      || !ALLOWED_INTERVAL_TYPES.has(item.intervalType)
      || !Number.isFinite(item.lower) || !Number.isFinite(item.upper)
      || item.lower < 0 || item.upper > 1e15 || item.lower > item.upper
      || item.lower > rows.get(item.entityId).value
      || rows.get(item.entityId).value > item.upper
      || (plan.unit === "fraction" && item.upper > 1)
      || (["persons", "units", "works", "citations", "patents", "people"].includes(plan.unit)
        && (!Number.isSafeInteger(item.lower) || !Number.isSafeInteger(item.upper)))) {
      throw new TypeError("Invalid or unmatched uncertainty interval at index " + i);
    }
    byEntity.set(item.entityId, Object.freeze({
      entityId: item.entityId, observedValue: rows.get(item.entityId).value,
      lower: item.lower, upper: item.upper,
      intervalType: item.intervalType, evidenceId: item.evidenceId
    }));
  }
  const records = [...byEntity.values()];
  const descending = plan.direction === "descending";
  const assessed = records.map(a => {
    let unavoidablePredecessors = 0;
    let potentialPredecessors = 0;
    for (const b of records) {
      if (b.entityId === a.entityId) continue;
      if (descending ? b.lower > a.upper : b.upper < a.lower) unavoidablePredecessors++;
      // Equality at a boundary is conservatively treated as potential
      // displacement, never as an independently resolved tie-break.
      if (descending ? b.upper >= a.lower : b.lower <= a.upper) potentialPredecessors++;
    }
    const bestPossibleRank = 1 + unavoidablePredecessors;
    const worstPossibleRank = 1 + potentialPredecessors;
    const positionClass = bestPossibleRank > 50 ? "outside_sample_top50_under_bounds"
      : worstPossibleRank <= 50 ? "within_sample_top50_under_bounds"
        : "ambiguous_sample_top50_boundary";
    return Object.freeze({ ...a, bestPossibleRank, worstPossibleRank, positionClass });
  });
  assessed.sort((a, b) => (descending ? b.observedValue - a.observedValue : a.observedValue - b.observedValue)
    || a.entityId.localeCompare(b.entityId));
  const count = (name) => assessed.filter(x => x.positionClass === name).length;
  const blockers = Object.freeze([
    ...plan.blockers,
    ...(assessed.length < 50 ? ["sample_below_50"] : []),
    ...(assessed.length === 50 ? ["only_50_observed_no_exclusion_test"] : []),
    ...(count("ambiguous_sample_top50_boundary") ? ["uncertainty_overlaps_top50_cutoff"] : []),
    "interval_source_and_coverage_unverified",
    "sampling_and_population_completeness_unverified",
    "rights_and_reviewer_approval_missing"
  ]);
  return Object.freeze({
    categoryId: plan.categoryId, metric: plan.metric, unit: plan.unit,
    period: plan.period, geography: plan.geography, direction: plan.direction,
    observedCount: assessed.length,
    withinSampleTop50Count: count("within_sample_top50_under_bounds"),
    outsideSampleTop50Count: count("outside_sample_top50_under_bounds"),
    ambiguousBoundaryCount: count("ambiguous_sample_top50_boundary"),
    entities: Object.freeze(assessed), blockers,
    rankBoundsMethod: "deterministic_pairwise_interval_conservative_bounds",
    interpretation: "Sample-relative, conservative interval order only; not a probabilistic confidence interval or an official ranking",
    uncertaintyMethodValidated: false, evidenceIndependentlyVerified: false,
    sourceIntervalsAuthenticated: false, publisherRightsCleared: false,
    sampleRepresentative: false, rankingVerified: false,
    customerDecisionAuthorized: false, publicationAuthorized: false,
    productionAuthorized: false
  });
}
module.exports = Object.freeze({ assessTop50RankSensitivity });
