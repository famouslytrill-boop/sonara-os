/**
 * Side-effect-free cross-industry shared-capacity planning (not runtime
 * admission, billing authority, a performance benchmark or provider telemetry).
 * Inputs describe industry aggregates, never customers or tenant identifiers.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { evaluateIndustryCapacity } from "./simulate-industry-capacity.mjs";

const SUITES = Object.freeze([
  "sonara_industries", "business_builder", "creator_studio", "growth_studio"
]);
const INDUSTRIES = Object.freeze([
  "restaurants", "trades", "hvac", "electrical", "plumbing", "carpentry",
  "cleaning", "trucking", "delivery", "retail", "manufacturing",
  "real_estate", "rentals", "venues", "professional_services",
  "media", "education", "logistics"
]);
const MONTH_SECONDS = 30 * 86400;
const EXAMPLE = Object.freeze([
  Object.freeze({
    suite: "business_builder", industry: "restaurants", tenants: 100,
    averageRequestsPerSecondPerTenant: 0.02, peakMultiplier: 4,
    databaseOperationsPerRequest: 3, operationServiceMilliseconds: 40
  }),
  Object.freeze({
    suite: "creator_studio", industry: "media", tenants: 50,
    averageRequestsPerSecondPerTenant: 0.01, peakMultiplier: 5,
    databaseOperationsPerRequest: 2, operationServiceMilliseconds: 100
  })
]);

function requiredNumber(value, name, low, high, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) ||
      value < low || value > high || (integer && !Number.isSafeInteger(value))) {
    throw new TypeError(name + " must be a bounded finite " +
      (integer ? "integer" : "number"));
  }
  return value;
}
function safeResult(value, field) {
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.ceil(value))) {
    throw new RangeError("aggregate exceeds safe numeric precision: " + field);
  }
  return value;
}

/**
 * Sums concurrent *work*, not independent percentages: workload pools are
 * shared, so every industry contributes peak ops/s times DB service seconds.
 * Peaks assumed simultaneous (deliberately conservative). Different service
 * times use the weighted mean; no p95/p99, contention or queue proof implied.
 */
export function evaluateIndustryPortfolio(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("portfolio configuration must be an object");
  }
  for (const key of Object.keys(input)) {
    if (!["workloads", "availableConcurrency", "targetUtilization"].includes(key)) {
      throw new TypeError("unrecognized portfolio field: " + key);
    }
  }
  const workloads = input.workloads === undefined ? EXAMPLE : input.workloads;
  if (!Array.isArray(workloads) || workloads.length < 1 || workloads.length > 72) {
    throw new TypeError("workloads must contain between 1 and 72 industry aggregates");
  }
  const concurrency = requiredNumber(input.availableConcurrency ?? 8,
    "availableConcurrency", 1, 100000, true);
  const target = requiredNumber(input.targetUtilization ?? 0.7,
    "targetUtilization", 0.05, 0.95);
  const seen = new Set();
  let steadyRps = 0;
  let peakRps = 0;
  let peakOps = 0;
  let workConcurrency = 0;
  let monthlyEgress = 0;
  let monthlyProviderCost = 0;
  let allEgressKnown = true;
  let allProviderRatesKnown = true;
  const breakdown = workloads.map((workload, index) => {
    if (!workload || typeof workload !== "object" || Array.isArray(workload)) {
      throw new TypeError("workload " + index + " must be a structured aggregate");
    }
    const { suite, industry, ...inputNumbers } = workload;
    if (!SUITES.includes(suite) || !INDUSTRIES.includes(industry)) {
      throw new TypeError("unsupported suite or industry for workload " + index);
    }
    const key = suite + ":" + industry;
    if (seen.has(key)) throw new TypeError("duplicate workload: " + key);
    seen.add(key);
    // Reuse validated single-industry parameters; reject unknown keys there.
    const result = evaluateIndustryCapacity({
      ...inputNumbers, availableConcurrency: concurrency, targetUtilization: target
    });
    const monthlyEgressGiB = result.modeledEgressGibPerMonth;
    const monthlyProviderUsd = result.modeledProviderVariableCostUsdPerMonth;
    allEgressKnown &&= monthlyEgressGiB !== null;
    allProviderRatesKnown &&= monthlyProviderUsd !== null;
    monthlyEgress = safeResult(monthlyEgress +
      (monthlyEgressGiB === null ? 0 : monthlyEgressGiB), "monthly egress");
    monthlyProviderCost = safeResult(monthlyProviderCost +
      (monthlyProviderUsd === null ? 0 : monthlyProviderUsd), "provider cost");
    steadyRps = safeResult(steadyRps + result.steadyRequestsPerSecond, "steady rate");
    peakRps = safeResult(peakRps + result.peakRequestsPerSecond, "peak rate");
    peakOps = safeResult(peakOps + result.peakDatabaseOperationsPerSecond, "peak DB operations");
    workConcurrency = safeResult(workConcurrency + result.offeredConcurrentOperations,
      "concurrent DB work");
    return Object.freeze({
      suite, industry,
      steadyRequestsPerSecond: result.steadyRequestsPerSecond,
      peakRequestsPerSecond: result.peakRequestsPerSecond,
      peakDatabaseOperationsPerSecond: result.peakDatabaseOperationsPerSecond,
      concurrentDatabaseWork: result.offeredConcurrentOperations,
      monthlyEgressGib: monthlyEgressGiB,
      monthlyProviderVariableCostUsd: monthlyProviderUsd
    });
  });
  // Note: if a known portfolio component is missing a quoted cost, "null"
  // denotes UNKNOWN total, never a free/zero-cost claim.
  const utilization = safeResult(workConcurrency / concurrency, "utilization");
  const neededConcurrency = safeResult(Math.max(1, Math.ceil(workConcurrency / target)),
    "required concurrency");
  const meanOperationMs = peakOps === 0 ? null :
    safeResult(workConcurrency * 1000 / peakOps, "weighted service milliseconds");
  const throughput = meanOperationMs === null ? null :
    safeResult(concurrency * 1000 / meanOperationMs, "aggregate service capacity");
  return Object.freeze({
    model: "simultaneous-industry-peaks-fluid-v1",
    assumptions: "isolated aggregate workloads; shared DB pool; coincident peaks; deterministic average service times; not tail latency, retries, storage, external provider or benchmark proof",
    distinctIndustries: new Set(breakdown.map(x => x.industry)).size,
    workloadCount: breakdown.length,
    steadyRequestsPerSecond: steadyRps,
    peakRequestsPerSecond: peakRps,
    peakDatabaseOperationsPerSecond: peakOps,
    modeledConcurrentDatabaseWork: workConcurrency,
    configuredConcurrency: concurrency,
    modeledUtilization: utilization,
    requiredConcurrencyAtTarget: neededConcurrency,
    targetUtilization: target,
    weightedMeanOperationMilliseconds: meanOperationMs,
    peakBacklogGrowthOperationsPerMinute: throughput === null ? 0 :
      safeResult(Math.max(0, peakOps - throughput) * 60, "backlog growth"),
    monthlyRequestsAtAverage: safeResult(steadyRps * MONTH_SECONDS, "monthly requests"),
    modeledEgressGibPerMonth: allEgressKnown ? monthlyEgress : null,
    modeledProviderVariableCostUsdPerMonth: allProviderRatesKnown ? monthlyProviderCost : null,
    passesPlanningTarget: utilization <= target,
    workloads: Object.freeze(breakdown)
  });
}

function selfTest() {
  const a = evaluateIndustryPortfolio();
  assert.equal(a.workloadCount, 2);
  assert.equal(a.distinctIndustries, 2);
  assert.equal(a.steadyRequestsPerSecond, 2.5);
  assert.equal(a.peakRequestsPerSecond, 10.5);
  assert.equal(a.peakDatabaseOperationsPerSecond, 29);
  assert.equal(a.modeledConcurrentDatabaseWork, 1.46);
  assert.equal(a.requiredConcurrencyAtTarget, 3);
  assert.equal(a.monthlyRequestsAtAverage, 6480000);
  assert.equal(a.passesPlanningTarget, true);
  assert.equal(a.modeledProviderVariableCostUsdPerMonth, null);
  assert.equal(a.peakBacklogGrowthOperationsPerMinute, 0);
  const overloaded = evaluateIndustryPortfolio({ availableConcurrency: 1 });
  assert.equal(overloaded.passesPlanningTarget, false);
  assert.ok(overloaded.peakBacklogGrowthOperationsPerMinute > 0);
  const zeroOps = evaluateIndustryPortfolio({ workloads: [
    { ...EXAMPLE[0], databaseOperationsPerRequest: 0 }
  ] });
  assert.equal(zeroOps.weightedMeanOperationMilliseconds, null);
  assert.equal(zeroOps.peakBacklogGrowthOperationsPerMinute, 0);
  const quoted = evaluateIndustryPortfolio({ workloads: EXAMPLE.map(w => ({
    ...w, egressKilobytesPerRequest: 1024, providerUsdPerThousandRequests: 1
  })) });
  assert.ok(quoted.modeledEgressGibPerMonth > 0);
  assert.equal(quoted.modeledProviderVariableCostUsdPerMonth, 6480);
  assert.throws(() => evaluateIndustryPortfolio({ workloads: [] }), /workloads/);
  assert.throws(() => evaluateIndustryPortfolio({ availableConcurrency: 0 }), /availableConcurrency/);
  assert.throws(() => evaluateIndustryPortfolio({ workloads: [EXAMPLE[0], EXAMPLE[0]] }), /duplicate/);
  assert.throws(() => evaluateIndustryPortfolio({ workloads: [
    { ...EXAMPLE[0], suite: "unknown" }
  ] }), /unsupported/);
  assert.throws(() => evaluateIndustryPortfolio({ workloads: [
    { ...EXAMPLE[0], organization_id: "should-never-be-fed-to-planner" }
  ] }), /unknown capacity input/);
  assert.throws(() => evaluateIndustryPortfolio({ workloads: [
    { ...EXAMPLE[0], tenants: "999999" }
  ] }), /tenants/);
  assert.throws(() => evaluateIndustryPortfolio({ providerKey: "secret" }), /unrecognized/);
  assert.throws(() => evaluateIndustryPortfolio({ workloads: [
    { ...EXAMPLE[0], tenants: 10000000, averageRequestsPerSecondPerTenant: 100000,
      peakMultiplier: 10000, databaseOperationsPerRequest: 10000 }
  ] }), /safe precision/);
  console.log("SONARA industry portfolio: 25 deterministic assertions passed.");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--self-test")) {
      if (process.argv.length !== 3) throw new TypeError("--self-test must be used alone");
      selfTest();
    } else if (process.argv.length === 2) {
      console.log(JSON.stringify(evaluateIndustryPortfolio(), null, 2));
    } else {
      throw new TypeError("Use without arguments for an illustrative portfolio or --self-test");
    }
  } catch (error) {
    console.error("SONARA industry portfolio: " + error.message);
    process.exitCode = 1;
  }
}
