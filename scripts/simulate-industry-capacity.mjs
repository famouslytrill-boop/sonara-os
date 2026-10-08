/**
 * Offline, deterministic capacity *planning* model. This is not an observed SLO,
 * queue simulator, database benchmark, pricing quote, or permission to deploy.
 *
 * Customer/tenant identifiers and production credentials are never inputs.
 * No dependencies, network, database calls, or side effects beyond CLI stdout.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MONTH_SECONDS = 30 * 24 * 60 * 60;
const DEFAULTS = Object.freeze({
  tenants: 100,
  averageRequestsPerSecondPerTenant: 0.02,
  peakMultiplier: 4,
  databaseOperationsPerRequest: 3,
  operationServiceMilliseconds: 40,
  availableConcurrency: 8,
  targetUtilization: 0.7
});

function boundedNumber(value, name, min, max, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isSafeInteger(value))) {
    throw new TypeError(name + " must be a finite " + (integer ? "integer" : "number") +
      " between " + min + " and " + max);
  }
  return value;
}

/** Returns modeled demand, mathematical capacity and a conservative fail/plan signal. */
export function evaluateIndustryCapacity(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("capacity inputs must be an object");
  }
  for (const key of Object.keys(input)) {
    if (!(key in DEFAULTS) && key !== "egressKilobytesPerRequest" &&
        key !== "providerUsdPerThousandRequests") {
      throw new TypeError("unknown capacity input: " + key);
    }
  }
  const x = { ...DEFAULTS, ...input };
  const tenants = boundedNumber(x.tenants, "tenants", 1, 10000000, true);
  const average = boundedNumber(x.averageRequestsPerSecondPerTenant,
    "averageRequestsPerSecondPerTenant", 0, 100000, false);
  const peakMultiplier = boundedNumber(x.peakMultiplier, "peakMultiplier", 1, 10000);
  const fanout = boundedNumber(x.databaseOperationsPerRequest,
    "databaseOperationsPerRequest", 0, 10000, true);
  const operationMs = boundedNumber(x.operationServiceMilliseconds,
    "operationServiceMilliseconds", 0.001, 600000);
  const concurrency = boundedNumber(x.availableConcurrency, "availableConcurrency", 1, 100000, true);
  const target = boundedNumber(x.targetUtilization, "targetUtilization", 0.05, 0.95);
  const steadyRps = tenants * average;
  const peakRps = steadyRps * peakMultiplier;
  const peakOperationsPerSecond = peakRps * fanout;
  const offeredConcurrentOperations = peakOperationsPerSecond * operationMs / 1000;
  const availableOperationsPerSecond = concurrency * 1000 / operationMs;
  const utilization = offeredConcurrentOperations / concurrency;
  const requiredConcurrency = Math.max(1, Math.ceil(offeredConcurrentOperations / target));
  const growingBacklogOperationsPerMinute =
    Math.max(0, peakOperationsPerSecond - availableOperationsPerSecond) * 60;
  const monthlyRequestsAtAverage = steadyRps * MONTH_SECONDS;
  const egress = input.egressKilobytesPerRequest === undefined ? null :
    boundedNumber(input.egressKilobytesPerRequest, "egressKilobytesPerRequest", 0, 10000000);
  const providerRate = input.providerUsdPerThousandRequests === undefined ? null :
    boundedNumber(input.providerUsdPerThousandRequests, "providerUsdPerThousandRequests", 0, 1000000);
  const projectedEgress = egress === null ? null : monthlyRequestsAtAverage * egress / 1024 / 1024;
  const projectedProviderCost = providerRate === null ? null :
    monthlyRequestsAtAverage / 1000 * providerRate;
  // Optional projections also need a safe numerical bound; very large USD
  // projections cannot be represented with trustworthy integer precision.
  for (const [name, value] of Object.entries({
    projectedEgress, projectedProviderCost
  })) {
    if (value !== null && (!Number.isFinite(value) ||
        !Number.isSafeInteger(Math.ceil(value)))) {
      throw new RangeError("capacity result overflows safe precision: " + name);
    }
  }

  for (const [name, value] of Object.entries({
    steadyRps, peakRps, peakOperationsPerSecond, offeredConcurrentOperations,
    availableOperationsPerSecond, utilization, requiredConcurrency,
    growingBacklogOperationsPerMinute, monthlyRequestsAtAverage
  })) {
    if (!Number.isFinite(value) || !Number.isSafeInteger(Math.ceil(value))) {
      throw new RangeError("capacity result overflows safe precision: " + name);
    }
  }

  return Object.freeze({
    model: "deterministic-fluid-demand-v1",
    assumptions: "fixed per-operation service time; steady per-tenant average; modeled peak multiplier; no tail-latency, contention, storage or DB benchmark proof",
    steadyRequestsPerSecond: steadyRps,
    peakRequestsPerSecond: peakRps,
    peakDatabaseOperationsPerSecond: peakOperationsPerSecond,
    offeredConcurrentOperations,
    configuredConcurrency: concurrency,
    modeledUtilization: utilization,
    targetUtilization: target,
    requiredConcurrencyAtTarget: requiredConcurrency,
    peakBacklogGrowthOperationsPerMinute: growingBacklogOperationsPerMinute,
    monthlyRequestsAtAverage,
    modeledEgressGibPerMonth: projectedEgress,
    modeledProviderVariableCostUsdPerMonth: projectedProviderCost,
    passesPlanningTarget: utilization <= target
  });
}

function selfTest() {
  const baseline = evaluateIndustryCapacity();
  assert.equal(baseline.steadyRequestsPerSecond, 2);
  assert.equal(baseline.peakRequestsPerSecond, 8);
  assert.equal(baseline.peakDatabaseOperationsPerSecond, 24);
  assert.equal(baseline.requiredConcurrencyAtTarget, 2);
  assert.equal(baseline.passesPlanningTarget, true);
  assert.equal(baseline.peakBacklogGrowthOperationsPerMinute, 0);
  const large = evaluateIndustryCapacity({ tenants: 10000 });
  assert.equal(large.passesPlanningTarget, false);
  assert.equal(large.requiredConcurrencyAtTarget, 138);
  assert.ok(large.peakBacklogGrowthOperationsPerMinute > 0);
  const noDb = evaluateIndustryCapacity({ databaseOperationsPerRequest: 0 });
  assert.equal(noDb.requiredConcurrencyAtTarget, 1);
  assert.equal(noDb.modeledUtilization, 0);
  const costing = evaluateIndustryCapacity({
    tenants: 1, averageRequestsPerSecondPerTenant: 1,
    peakMultiplier: 1, databaseOperationsPerRequest: 0,
    egressKilobytesPerRequest: 1024, providerUsdPerThousandRequests: 1
  });
  assert.equal(costing.monthlyRequestsAtAverage, MONTH_SECONDS);
  assert.equal(costing.modeledEgressGibPerMonth, MONTH_SECONDS / 1024);
  assert.equal(costing.modeledProviderVariableCostUsdPerMonth, MONTH_SECONDS / 1000);
  assert.equal(baseline.modeledProviderVariableCostUsdPerMonth, null);
  assert.throws(() => evaluateIndustryCapacity({ tenants: -1 }), /tenants/);
  assert.throws(() => evaluateIndustryCapacity({ tenants: "10" }), /tenants/);
  assert.throws(() => evaluateIndustryCapacity({ targetUtilization: 0 }), /targetUtilization/);
  assert.throws(() => evaluateIndustryCapacity({ unverifiedTenantLimit: 10 }), /unknown capacity input/);
  assert.throws(() => evaluateIndustryCapacity({ tenants: 10000000, averageRequestsPerSecondPerTenant: 100000,
    peakMultiplier: 10000, databaseOperationsPerRequest: 10000 }), /overflows safe precision/);
  assert.throws(() => evaluateIndustryCapacity({
    tenants: 5000000, averageRequestsPerSecondPerTenant: 1,
    peakMultiplier: 1, databaseOperationsPerRequest: 0,
    providerUsdPerThousandRequests: 1000000
  }), /projectedProviderCost/);
  console.log("Industry capacity planning model: 21 deterministic assertions passed.");
}

function parseArgs(args) {
  const parsed = {};
  for (const arg of args) {
    if (!arg.startsWith("--") || !arg.includes("=")) {
      throw new TypeError("expected --parameter=number (or --self-test)");
    }
    const [name, ...rest] = arg.slice(2).split("=");
    if (!name || rest.length !== 1 || !rest[0].trim()) {
      throw new TypeError("invalid parameter assignment");
    }
    if (Object.hasOwn(parsed, name)) throw new TypeError("duplicate capacity parameter: " + name);
    parsed[name] = Number(rest[0]);
  }
  return parsed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--self-test")) {
      if (process.argv.length !== 3) throw new TypeError("--self-test must be used alone");
      selfTest();
    } else {
      const result = evaluateIndustryCapacity(parseArgs(process.argv.slice(2).filter(arg => arg !== "--strict")));
      console.log(JSON.stringify(result, null, 2));
      if (process.argv.includes("--strict") && !result.passesPlanningTarget) process.exitCode = 1;
    }
  } catch (error) {
    console.error("Industry capacity planning: " + error.message);
    process.exitCode = 1;
  }
}
