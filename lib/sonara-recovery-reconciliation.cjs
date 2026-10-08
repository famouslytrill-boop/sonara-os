// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only classification of already-permitted private retry ledger data.
// Never returns claim tokens, tenant IDs, emails, provider references or SQL.
// A manual investigation is required for ambiguous or expired work.
const STATES = new Set(["queued", "started", "verified", "unverified", "failed"]);
function inspectRecoveryBacklog(records, {
  nowMs = Date.now(), stalledAfterMs = 120000
} = {}) {
  if (!Array.isArray(records) || records.length > 10000 ||
      !Number.isSafeInteger(nowMs) || nowMs < 0 ||
      !Number.isSafeInteger(stalledAfterMs) ||
      stalledAfterMs < 30000 || stalledAfterMs > 3600000) {
    return Object.freeze({status:"invalid_evidence",actions:[]});
  }
  const counts={waiting:0,due:0,deadlineLapsed:0,inFlight:0,stalled:0,
    verified:0,unverified:0,failed:0};
  for(const row of records){
    if (!row || !STATES.has(row.state) ||
        !Number.isSafeInteger(row.deadlineAtMs) || row.deadlineAtMs <= 0 ||
        (row.state === "queued" &&
         (!Number.isSafeInteger(row.notBeforeMs) || row.notBeforeMs <= 0)) ||
        (row.state === "started" &&
         (!Number.isSafeInteger(row.startedAtMs) || row.startedAtMs <= 0))) {
      return Object.freeze({status:"invalid_evidence",actions:[]});
    }
    if(row.state === "queued"){
      if(row.deadlineAtMs <= nowMs+1000) counts.deadlineLapsed++;
      else if(row.notBeforeMs <= nowMs) counts.due++;
      else counts.waiting++;
    }else if(row.state === "started"){
      if(row.startedAtMs < nowMs-stalledAfterMs) counts.stalled++;
      else counts.inFlight++;
    }else{
      counts[row.state]++;
    }
  }
  const reviewTotal=counts.deadlineLapsed+counts.stalled+counts.unverified+counts.failed;
  return Object.freeze({
    status:"measured",sampleCount:records.length,counts:Object.freeze(counts),
    manualReviewRequired:reviewTotal,autoRequeueAllowed:false,
    // Action codes, not customer data or mutable instructions.
    actions:Object.freeze(reviewTotal>0?["reconcile_provider_status","inspect_immutable_audit","request_operator_decision"]:[])
  });
}
module.exports={inspectRecoveryBacklog};
