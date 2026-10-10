"use strict";
const assert = require("node:assert/strict");
const { ingestAuthenticatedRecoveryEvidence } = require("../lib/sonara-recovery-incident-ingress.cjs");
const NOW = 1800000000000;
const ORG = "11111111-1111-4111-8111-111111111111";
const event = {incidentId:"e-1",resourceId:"mail-optional",sensorId:"sensor-1",
  signal:"provider.timeout",observedAtMs:NOW-1000};
const owner = {sensorId:"sensor-1",scope:"organization",organizationId:ORG,
  domain:"optional_provider",sensitive:false,authorizedScope:true,
  verifiedIdempotency:true,operationId:"op-1",attempt:0,deadlineAtMs:NOW+60000};
function adapters({authenticate=true,record=owner}={}){
  const scheduled=[];
  const registry={
    verifyObservation:async incoming=>authenticate
      ? {authenticated:true,sensorId:incoming.sensorId,resourceId:incoming.resourceId,organizationId:ORG}
      : {authenticated:false},
    lookup:async()=>record
  };
  return {registry,scheduled,scheduler:{schedule:async job=>{
    scheduled.push(job);return {persisted:true,notBeforeMs:job.notBeforeMs};
  }}};
}
describe("authenticated SONARA recovery ingestion",()=>{
  it("does nothing while the control plane is disabled",async()=>{
    const {registry,scheduler,scheduled}=adapters();
    assert.equal((await ingestAuthenticatedRecoveryEvidence(event,{registry,scheduler,nowMs:NOW})).status,"disabled");
    assert.equal(scheduled.length,0);
  });
  it("rejects unsigned observations before scheduling any retry",async()=>{
    const {registry,scheduler,scheduled}=adapters({authenticate:false});
    const r=await ingestAuthenticatedRecoveryEvidence(event,{enabled:true,registry,scheduler,nowMs:NOW});
    assert.equal(r.status,"escalated");assert.equal(scheduled.length,0);
  });
  it("ignores user-provided authority and persists registered tenant only",async()=>{
    const {registry,scheduler,scheduled}=adapters();
    const r=await ingestAuthenticatedRecoveryEvidence({...event,organizationId:"attacker",authorizedScope:true,
      sensitive:false,verifiedIdempotency:true,domain:"payments"},
      {enabled:true,registry,scheduler,nowMs:NOW});
    assert.equal(r.status,"scheduled");assert.equal(scheduled.length,1);
    assert.equal(scheduled[0].organizationId,ORG);
    assert.equal(scheduled[0].attempt,0);
  });
  it("refuses non-retry actions through the delayed scheduler",async()=>{
    const {registry,scheduler,scheduled}=adapters({record:{...owner,optionalDependency:true}});
    const r=await ingestAuthenticatedRecoveryEvidence({...event,signal:"provider.optional_unavailable"},
      {enabled:true,registry,scheduler,nowMs:NOW});
    assert.equal(r.reason,"non_retry_runbook_requires_manual_review");
    assert.equal(scheduled.length,0);
  });
  it("prevents mutation of signed event between verification and admission",async()=>{
    const input={...event};
    const {registry,scheduler,scheduled}=adapters();
    registry.verifyObservation=async snapshot=>{
      input.signal="security.admin_reset";
      assert.equal(snapshot.signal,"provider.timeout");
      assert.equal(Object.isFrozen(snapshot),true);
      return {authenticated:true,sensorId:"sensor-1",resourceId:"mail-optional",organizationId:ORG};
    };
    const r=await ingestAuthenticatedRecoveryEvidence(input,{enabled:true,registry,scheduler,nowMs:NOW});
    assert.equal(r.status,"scheduled");
    assert.equal(scheduled.length,1);
    assert.equal(input.signal,"security.admin_reset");
  });
});
