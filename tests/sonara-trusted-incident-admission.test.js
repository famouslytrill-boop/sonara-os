"use strict";
const assert = require("node:assert/strict");
const { admitTrustedIncident } = require("../lib/sonara-trusted-incident-admission.cjs");
const NOW = 1800000000000;
const event = {incidentId:"mon-1",sensorId:"sensor-1",resourceId:"optional-provider-1",signal:"provider.timeout",observedAtMs:NOW-1000};
const record = {sensorId:"sensor-1",scope:"organization",organizationId:"tenant-1",domain:"optional_provider",sensitive:false,authorizedScope:true,verifiedIdempotency:true,operationId:"op-1",attempt:0,deadlineAtMs:NOW+60_000};
const admit=(ev=event, r=record)=>admitTrustedIncident(ev,{nowMs:NOW,registry:{lookup:async()=>r}});
describe("trusted incident admission",()=>{
  it("derives all authority fields from server registry, not telemetry",async()=>{
    const received=await admit({...event,organizationId:"hacker",authorizedScope:true,sensitive:false,domain:"worker",verifiedIdempotency:true});
    assert.equal(received.admitted,true);
    assert.equal(received.incident.organizationId,"tenant-1");
    assert.equal(received.incident.domain,"optional_provider");
    assert.equal(received.plan.action,"retry_idempotent");
  });
  it("denies sensor mismatch, sensitive operations, revoked scope and cross-tenant unknown",async()=>{
    for(const change of [{sensorId:"wrong"},{sensitive:true},{authorizedScope:false},{scope:"organization",organizationId:null}]){
      assert.equal((await admit(event,{...record,...change})).admitted,false);
    }
  });
  it("refuses unknown error signals, stale evidence and unregistered sensors",async()=>{
    assert.equal((await admit({...event,signal:"schema.drop"})).admitted,false);
    assert.equal((await admit({...event,observedAtMs:NOW-180_000})).admitted,false);
    assert.equal((await admit(event,null)).admitted,false);
  });
  it("fails closed if registry is unavailable",async()=>{
    const result=await admitTrustedIncident(event,{nowMs:NOW,registry:{lookup:async()=>{throw Error("unavailable")}}});
    assert.equal(result.reason,"registry_unavailable");
  });
});
