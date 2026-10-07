// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
// Exact-integer scenario math. These are not market forecasts, measured
// benchmarks, credit decisions, financial statements or actual invoices.
// Use measured workloads / prices before choosing an infrastructure tier.
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function integer(name, value, positive = false) {
  if (!Number.isSafeInteger(value) || value < 0 || (positive && value === 0)) {
    throw new Error("invalid_" + name);
  }
  return BigInt(value);
}
function roundCeil(n, d) {
  if (d <= 0n) throw new Error("invalid_divisor");
  return (n + d - 1n) / d;
}
function toNumber(n) {
  if (n > MAX || n < -MAX) throw new Error("scenario_overflow");
  return Number(n);
}
function cohortScenario({
  startingCustomers, newCustomersPerMonth,
  churnBasisPoints, months
} = {}) {
  const initial = integer("starting_customers", startingCustomers);
  const newCustomers = integer("new_customers_per_month", newCustomersPerMonth);
  const churn = integer("churn_basis_points", churnBasisPoints);
  const period = integer("months", months, true);
  if (churn > 10000n || period > 120n) throw new Error("scenario_out_of_range");
  const rows = [];
  let customers = initial;
  for (let index = 1n; index <= period; index++) {
    // Rounded nearest half up: deterministic assumption, not a prediction.
    const departed = (customers * churn + 5000n) / 10000n;
    const next = customers - departed + newCustomers;
    rows.push(Object.freeze({
      month: Number(index), startCustomers: toNumber(customers),
      scenarioChurned: toNumber(departed), scenarioAcquired: toNumber(newCustomers),
      endCustomers: toNumber(next)
    }));
    customers = next;
  }
  return Object.freeze({
    classification: "deterministic_scenario_not_prediction",
    rows: Object.freeze(rows), endingCustomers: toNumber(customers),
    churnPredicted: false, acquisitionGuaranteed: false
  });
}
function storageScenario({
  organizations, assetsPerOrganizationPerDay,
  averageAssetBytes, retentionDays, redundancyCopies = 1
} = {}) {
  const a = integer("organizations", organizations);
  const b = integer("assets_per_organization_per_day", assetsPerOrganizationPerDay);
  const c = integer("average_asset_bytes", averageAssetBytes);
  const d = integer("retention_days", retentionDays);
  const copies = integer("redundancy_copies", redundancyCopies, true);
  if (copies > 20n || d > 3650n) throw new Error("scenario_out_of_range");
  const dailyAssets = a * b;
  const logicalBytes = dailyAssets * c * d;
  const replicatedBytes = logicalBytes * copies;
  return Object.freeze({
    classification: "storage_plan_not_provider_usage",
    dailyAssetCount: toNumber(dailyAssets),
    logicalBytes: toNumber(logicalBytes),
    replicatedBytes: toNumber(replicatedBytes),
    actualUsageObserved: false,
    excludesDerivativesSnapshotsAndBackups: true
  });
}
function queueCapacityScenario({
  workItemsPerHour, averageProcessingMs,
  concurrentJobsPerWorker = 1,
  targetUtilizationBasisPoints = 7000,
  peakMultiplierBasisPoints = 15000
} = {}) {
  const items = integer("work_items_per_hour", workItemsPerHour);
  const duration = integer("average_processing_ms", averageProcessingMs, true);
  const parallel = integer("concurrent_jobs_per_worker", concurrentJobsPerWorker, true);
  const util = integer("target_utilization_basis_points", targetUtilizationBasisPoints, true);
  const peak = integer("peak_multiplier_basis_points", peakMultiplierBasisPoints, true);
  if (util > 9000n || peak > 100000n || parallel > 256n) throw new Error("scenario_out_of_range");
  // Work volume is integer; no float drift. Include assumed peak factor.
  const peakItems = roundCeil(items * peak, 10000n);
  const capacityPerWorker = (3600000n * parallel * util) / (duration * 10000n);
  if (capacityPerWorker <= 0n) throw new Error("processing_duration_exceeds_capacity");
  const workers = peakItems === 0n ? 0n : roundCeil(peakItems, capacityPerWorker);
  return Object.freeze({
    classification: "capacity_scenario_not_sla",
    peakWorkItemsPerHour: toNumber(peakItems),
    assumedItemsPerWorkerHour: toNumber(capacityPerWorker),
    minimumWorkersAtAssumptions: toNumber(workers),
    actualLatencyBenchmarked: false, gpuMemoryProofEstablished: false,
    retryDeadLetterAndIdempotencyRequired: true
  });
}
function subscriptionUnitScenario({
  monthlySubscriptionCents, processingRateBasisPoints,
  fixedProcessorFeeCents, resourceCostCents, supportCostCents,
  refundRiskReserveCents, monthlyFixedCostsCents
} = {}) {
  const price = integer("monthly_subscription_cents", monthlySubscriptionCents, true);
  const rate = integer("processing_rate_basis_points", processingRateBasisPoints);
  const fixedFee = integer("fixed_processor_fee_cents", fixedProcessorFeeCents);
  const resource = integer("resource_cost_cents", resourceCostCents);
  const support = integer("support_cost_cents", supportCostCents);
  const risk = integer("refund_risk_reserve_cents", refundRiskReserveCents);
  const overhead = integer("monthly_fixed_costs_cents", monthlyFixedCostsCents);
  if (rate > 10000n) throw new Error("processing_rate_out_of_range");
  // Conservatively rounds variable processor fees UP to the next cent.
  const processor = roundCeil(price * rate, 10000n) + fixedFee;
  const contribution = price - processor - resource - support - risk;
  const needed = contribution <= 0n ? null : roundCeil(overhead, contribution);
  return Object.freeze({
    classification: "conservative_scenario_not_bank_report",
    processorFeeCents: toNumber(processor),
    contributionCents: toNumber(contribution),
    minimumCustomersToCoverOverhead: needed === null ? null : toNumber(needed),
    noBreakEvenUnderAssumptions: contribution <= 0n,
    excludesTaxesTaxJurisdictionAndActualProcessorFees: true
  });
}
module.exports = {
  cohortScenario, storageScenario, queueCapacityScenario, subscriptionUnitScenario
};
