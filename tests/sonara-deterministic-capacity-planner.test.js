// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const {
  cohortScenario, storageScenario, queueCapacityScenario, subscriptionUnitScenario
} = require("../lib/sonara-deterministic-capacity-planner.cjs");
describe("budget infrastructure scenarios are deterministic but not forecasts",()=>{
  it("cohort model computes auditable monthly balances, not guaranteed growth",()=>{
    const plan=cohortScenario({startingCustomers:100,newCustomersPerMonth:10,
      churnBasisPoints:1000,months:2});
    assert.deepEqual(plan.rows.map(row=>row.endCustomers),[100,100]);
    assert.equal(plan.acquisitionGuaranteed,false);
  });
  it("cohort model rejects impossible churn assumptions",()=>{
    assert.throws(()=>cohortScenario({startingCustomers:1,newCustomersPerMonth:1,
      churnBasisPoints:10001,months:1}),/scenario_out_of_range/);
  });
  it("storage counts replicated bytes separately from logical bytes",()=>{
    const d=storageScenario({organizations:10,assetsPerOrganizationPerDay:2,
      averageAssetBytes:100,retentionDays:30,redundancyCopies:2});
    assert.equal(d.dailyAssetCount,20);
    assert.equal(d.logicalBytes,60000);
    assert.equal(d.replicatedBytes,120000);
    assert.equal(d.actualUsageObserved,false);
  });
  it("storage refuses unsafe overflow",()=>{
    assert.throws(()=>storageScenario({organizations:Number.MAX_SAFE_INTEGER,
      assetsPerOrganizationPerDay:2,averageAssetBytes:100,
      retentionDays:365,redundancyCopies:3}),/scenario_overflow/);
  });
  it("queue workers are sized for peak workload and target utilization",()=>{
    const plan=queueCapacityScenario({workItemsPerHour:100,
      averageProcessingMs:36000,concurrentJobsPerWorker:1,
      targetUtilizationBasisPoints:7000,peakMultiplierBasisPoints:15000});
    assert.equal(plan.peakWorkItemsPerHour,150);
    assert.equal(plan.assumedItemsPerWorkerHour,70);
    assert.equal(plan.minimumWorkersAtAssumptions,3);
    assert.equal(plan.retryDeadLetterAndIdempotencyRequired,true);
  });
  it("queue capacity is zero for zero traffic",()=>{
    const plan=queueCapacityScenario({workItemsPerHour:0,averageProcessingMs:1000});
    assert.equal(plan.minimumWorkersAtAssumptions,0);
  });
  it("queue refuses processing durations beyond capacity at target utilization",()=>{
    assert.throws(()=>queueCapacityScenario({workItemsPerHour:20,
      averageProcessingMs:100000000}),/processing_duration_exceeds_capacity/);
  });
  it("subscription math rounds processor fees up and makes overhead break-even conditional",()=>{
    const m=subscriptionUnitScenario({monthlySubscriptionCents:2900,
      processingRateBasisPoints:360,fixedProcessorFeeCents:30,
      resourceCostCents:400,supportCostCents:200,
      refundRiskReserveCents:100,monthlyFixedCostsCents:100000});
    assert.equal(m.processorFeeCents,135);
    assert.equal(m.contributionCents,2065);
    assert.equal(m.minimumCustomersToCoverOverhead,49);
    assert.equal(m.excludesTaxesTaxJurisdictionAndActualProcessorFees,true);
  });
  it("subscription pricing with negative contribution never claims break-even",()=>{
    const m=subscriptionUnitScenario({monthlySubscriptionCents:100,
      processingRateBasisPoints:0,fixedProcessorFeeCents:30,
      resourceCostCents:200,supportCostCents:0,refundRiskReserveCents:0,
      monthlyFixedCostsCents:10000});
    assert.equal(m.noBreakEvenUnderAssumptions,true);
    assert.equal(m.minimumCustomersToCoverOverhead,null);
  });
  it("rejects fractional cents, negative assumptions and invalid capacity rates",()=>{
    assert.throws(()=>subscriptionUnitScenario({monthlySubscriptionCents:29.5}),
      /invalid_monthly_subscription_cents/);
    assert.throws(()=>queueCapacityScenario({workItemsPerHour:2,
      averageProcessingMs:3,targetUtilizationBasisPoints:9500}),/scenario_out_of_range/);
    assert.throws(()=>storageScenario({organizations:-1,assetsPerOrganizationPerDay:1,
      averageAssetBytes:2,retentionDays:3}),/invalid_organizations/);
  });
});
