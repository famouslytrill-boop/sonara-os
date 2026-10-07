// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const {operationCost,tokenBucketDecision,concurrencyDecision,dailyBudgetDecision}=
  require("../lib/sonara-rate-budget-math.cjs");
describe("weighted resource budgets",()=>{
  it("charges heavier operations more than simple reads",()=>{
    assert.equal(operationCost({operation:"public_read"}).costUnits,1);
    assert.ok(operationCost({operation:"media_generation"}).costUnits>
      operationCost({operation:"authenticated_read"}).costUnits);
  });
  it("charges file size in rounded-up MiB units",()=>{
    assert.equal(operationCost({operation:"file_upload",payloadBytes:1}).sizeMiBRoundedUp,1);
    assert.equal(operationCost({operation:"file_upload",payloadBytes:1048577}).sizeMiBRoundedUp,2);
  });
  it("refuses a single operation that exceeds its own cost ceiling",()=>{
    const out=operationCost({operation:"ai_draft",declaredWorkUnits:500});
    assert.equal(out.ok,false);
    assert.equal(out.code,"single_request_cost_exceeds_policy");
  });
  it("refills token budget deterministically by elapsed time",()=>{
    const out=tokenBucketDecision({capacityUnits:100,refillUnitsPerMinute:60,
      availableUnits:10,lastRefillAt:"2026-10-07T06:00:00Z",
      now:"2026-10-07T06:00:30Z",requestCostUnits:25});
    assert.equal(out.allowed,true);
    assert.equal(out.remainingUnits,15);
  });
  it("caps refill at configured capacity",()=>{
    const out=tokenBucketDecision({capacityUnits:100,refillUnitsPerMinute:60,
      availableUnits:90,lastRefillAt:"2026-10-07T06:00:00Z",
      now:"2026-10-07T06:10:00Z",requestCostUnits:1});
    assert.equal(out.remainingUnits,99);
  });
  it("computes retry-after when weighted budget is exhausted",()=>{
    const out=tokenBucketDecision({capacityUnits:100,refillUnitsPerMinute:60,
      availableUnits:0,lastRefillAt:"2026-10-07T06:00:00Z",
      now:"2026-10-07T06:00:00Z",requestCostUnits:30});
    assert.equal(out.allowed,false);
    assert.equal(out.retryAfterSeconds,30);
  });
  it("never says a calculation acquired the shared-state token",()=>{
    const out=tokenBucketDecision({capacityUnits:10,refillUnitsPerMinute:0,
      availableUnits:10,lastRefillAt:"2026-10-07T06:00:00Z",
      now:"2026-10-07T06:00:00Z",requestCostUnits:1});
    assert.equal(out.stateWriteAuthorized,false);
  });
  it("uses concurrency limits independently of request frequency",()=>{
    assert.equal(concurrencyDecision({active:4,limit:5,requested:1}).allowed,true);
    assert.equal(concurrencyDecision({active:5,limit:5,requested:1}).allowed,false);
  });
  it("enforces daily automation/AI usage budgets",()=>{
    assert.equal(dailyBudgetDecision({usedUnits:90,dailyLimitUnits:100,requestCostUnits:10}).allowed,true);
    assert.equal(dailyBudgetDecision({usedUnits:90,dailyLimitUnits:100,requestCostUnits:11}).allowed,false);
  });
  it("fails on backwards clock or invalid numeric inputs",()=>{
    assert.throws(()=>tokenBucketDecision({capacityUnits:10,refillUnitsPerMinute:1,
      availableUnits:1,lastRefillAt:"2026-10-07T06:01:00Z",
      now:"2026-10-07T06:00:00Z",requestCostUnits:1}),/clock_moved_backwards/);
    assert.throws(()=>concurrencyDecision({active:-1,limit:1}),/invalid_active/);
  });
});
