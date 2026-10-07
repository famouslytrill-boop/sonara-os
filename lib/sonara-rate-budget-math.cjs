// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure weighted-rate/resource math to complement durable auth throttling.
// This module stores no counters and authorizes no request. Production state
// must be updated atomically in a shared durable store (not serverless memory).
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
const MiB=1048576n;
const OPERATIONS=Object.freeze({
  public_read:Object.freeze({base:1,perMiB:0,maxCost:5,scopes:["ip"]}),
  authenticated_read:Object.freeze({base:1,perMiB:0,maxCost:5,scopes:["organization","user"]}),
  search:Object.freeze({base:3,perMiB:0,maxCost:20,scopes:["organization","user"]}),
  spreadsheet_export:Object.freeze({base:5,perMiB:2,maxCost:100,scopes:["organization","user"]}),
  file_upload:Object.freeze({base:4,perMiB:3,maxCost:2000,scopes:["organization","user"]}),
  ai_draft:Object.freeze({base:15,perMiB:2,maxCost:200,scopes:["organization","user"]}),
  media_generation:Object.freeze({base:50,perMiB:5,maxCost:5000,scopes:["organization","user"]}),
  automation_run:Object.freeze({base:10,perMiB:1,maxCost:500,scopes:["organization","automation"]})
});
function bint(value,name,{positive=false,nonnegative=false}={}){
  if(!Number.isSafeInteger(value)||(positive&&value<=0)||(nonnegative&&value<0))
    throw new Error("invalid_"+name);
  return BigInt(value);
}
function num(v){if(v>MAX||v<-MAX)throw new Error("rate_budget_overflow");return Number(v);}
function ceilDiv(a,b){if(b<=0n)throw new Error("invalid_divisor");return (a+b-1n)/b;}
function parseTime(v,name){const t=typeof v==="string"?Date.parse(v):NaN;if(!Number.isFinite(t))throw new Error("invalid_"+name);return BigInt(t);}

function operationCost({operation,payloadBytes=0,declaredWorkUnits=0}={}){
  const policy=OPERATIONS[operation];
  if(!policy)return Object.freeze({ok:false,code:"unknown_operation",costUnits:null});
  const bytes=bint(payloadBytes,"payload_bytes",{nonnegative:true});
  const work=bint(declaredWorkUnits,"declared_work_units",{nonnegative:true});
  const sizeMiB=bytes===0n?0n:ceilDiv(bytes,MiB);
  let cost=BigInt(policy.base)+sizeMiB*BigInt(policy.perMiB)+work;
  if(cost>BigInt(policy.maxCost))return Object.freeze({
    ok:false,code:"single_request_cost_exceeds_policy",costUnits:null,
    maximumCostUnits:policy.maxCost,requiredScopes:policy.scopes
  });
  return Object.freeze({
    ok:true,costUnits:num(cost),sizeMiBRoundedUp:num(sizeMiB),
    requiredScopes:Object.freeze([...policy.scopes]),maximumCostUnits:policy.maxCost
  });
}

function tokenBucketDecision({
  capacityUnits,refillUnitsPerMinute,availableUnits,lastRefillAt,now,requestCostUnits
}={}){
  const cap=bint(capacityUnits,"capacity_units",{positive:true});
  const refill=bint(refillUnitsPerMinute,"refill_units_per_minute",{nonnegative:true});
  let available=bint(availableUnits,"available_units",{nonnegative:true});
  const cost=bint(requestCostUnits,"request_cost_units",{positive:true});
  const last=parseTime(lastRefillAt,"last_refill_at");
  const current=parseTime(now,"now");
  if(current<last)throw new Error("clock_moved_backwards");
  if(available>cap)available=cap;
  const elapsed=current-last;
  const replenished=(elapsed*refill)/60000n;
  const afterRefill=available+replenished>cap?cap:available+replenished;
  const allowed=cost<=afterRefill;
  const remaining=allowed?afterRefill-cost:afterRefill;
  let retry=0n;
  if(!allowed){
    if(refill===0n)return Object.freeze({
      allowed:false,remainingUnits:num(remaining),retryAfterSeconds:null,
      nextAvailableAt:null,reason:"budget_exhausted_no_refill",
      stateWriteAuthorized:false
    });
    const missing=cost-afterRefill;
    const waitMs=ceilDiv(missing*60000n,refill);
    retry=ceilDiv(waitMs,1000n);
  }
  return Object.freeze({
    allowed,remainingUnits:num(remaining),retryAfterSeconds:num(retry),
    refillUnitsAdded:num(replenished>cap?cap:replenished),
    evaluatedAt:new Date(Number(current)).toISOString(),
    stateWriteAuthorized:false,
    reason:allowed?"within_budget":"weighted_rate_budget_exceeded"
  });
}

function concurrencyDecision({active,limit,requested=1}={}){
  const a=bint(active,"active",{nonnegative:true});
  const l=bint(limit,"limit",{positive:true});
  const r=bint(requested,"requested",{positive:true});
  const allowed=a+r<=l;
  return Object.freeze({
    allowed,active:num(a),limit:num(l),requested:num(r),
    remainingSlots:num(a>=l?0n:l-a),
    reason:allowed?"within_concurrency_budget":"concurrency_budget_exceeded",
    slotAcquired:false
  });
}

function dailyBudgetDecision({usedUnits,dailyLimitUnits,requestCostUnits}={}){
  const used=bint(usedUnits,"used_units",{nonnegative:true});
  const limit=bint(dailyLimitUnits,"daily_limit_units",{positive:true});
  const cost=bint(requestCostUnits,"request_cost_units",{positive:true});
  const allowed=used+cost<=limit;
  return Object.freeze({
    allowed,projectedUsedUnits:num(used+cost),dailyLimitUnits:num(limit),
    remainingAfterUnits:allowed?num(limit-used-cost):num(limit>used?limit-used:0n),
    reason:allowed?"within_daily_budget":"daily_budget_exceeded",
    usageRecorded:false
  });
}

module.exports={OPERATIONS,operationCost,tokenBucketDecision,concurrencyDecision,dailyBudgetDecision};
