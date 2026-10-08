// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only, bounded diagnostic contract for internal background workflows.
// This module never calls providers, issues repairs or grants authorization.
const WORKFLOWS = Object.freeze({
  sonara_one: Object.freeze(["auth_session", "tenant_setup", "service_health"]),
  business_builder: Object.freeze(["work_order", "dispatch", "commerce_reconciliation"]),
  creator_studio: Object.freeze(["media_generation", "artifact_delivery", "rights_review"]),
  growth_studio: Object.freeze(["campaign_dispatch", "provider_sync", "social_delivery"])
});
const PHASES = Object.freeze(["queued","running","completed","blocked","failed","unknown"]);
const CAUSES = Object.freeze(["none","provider_unavailable","deadline","rate_limited",
  "permission","storage","validation","unknown"]);
function workflowObservation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !Object.hasOwn(WORKFLOWS,input.suite) || !WORKFLOWS[input.suite].includes(input.workflow) ||
      !PHASES.includes(input.phase) || !CAUSES.includes(input.cause) ||
      !Number.isSafeInteger(input.durationMs) || input.durationMs < 0 ||
      input.durationMs > 86400000) {
    return Object.freeze({ status: "invalid_evidence" });
  }
  return Object.freeze({
    status: "observed", suite: input.suite, workflow: input.workflow,
    phase: input.phase, cause: input.cause, durationMs: input.durationMs,
    recovery: "diagnostics_only"
  });
}
function summarizeWorkflowObservations(observations,{minimumSamples=30}={}) {
  if (!Array.isArray(observations) || observations.length>10000 ||
      !Number.isSafeInteger(minimumSamples) || minimumSamples<1) {
    return Object.freeze({status:"invalid_evidence",series:[]});
  }
  const groups=new Map();
  for (const row of observations) {
    const x=workflowObservation(row);
    if(x.status!=="observed")return Object.freeze({status:"invalid_evidence",series:[]});
    const key=x.suite+"|"+x.workflow;
    if(!groups.has(key))groups.set(key,{suite:x.suite,workflow:x.workflow,
      sampleCount:0,failures:0,durations:[]});
    const g=groups.get(key);
    g.sampleCount++;
    if(x.phase==="failed")g.failures++;
    g.durations.push(x.durationMs);
  }
  return Object.freeze({status:"measured",series:Object.freeze([...groups.values()].map(g=>{
    g.durations.sort((a,b)=>a-b);
    const measured=g.sampleCount>=minimumSamples;
    return Object.freeze({suite:g.suite,workflow:g.workflow,sampleCount:g.sampleCount,
      failures:g.failures,status:measured?"measured":"insufficient_evidence",
      failureRate:measured?g.failures/g.sampleCount:null,
      p95Ms:measured?g.durations[Math.ceil(g.sampleCount*.95)-1]:null});
  }))});
}
module.exports={WORKFLOWS,PHASES,CAUSES,workflowObservation,summarizeWorkflowObservations};
