"use strict";
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { ingestSignedRecoveryRawHttp } = require("../lib/sonara-signed-recovery-http-boundary.cjs");
const NOW=1800000000000, ORG="11111111-1111-4111-8111-111111111111";
const KEY=Buffer.alloc(32,0x77);
const BODY=Buffer.from(JSON.stringify({
  incidentId:"http-signed-1",resourceId:"optional-mail",sensorId:"sensor-X",
  signal:"provider.timeout",observedAtMs:NOW-1000,organizationId:ORG
}),"utf8");
function headers(){
  const nonce="c".repeat(32);
  const signature=createHmac("sha256",KEY).update(Buffer.concat([
    Buffer.from("sonara-recovery-v1\n"),
    Buffer.from("sensor-X\n"+NOW+"\n"+nonce+"\n"),BODY
  ])).digest("hex");
  return [
    "X-Sonara-Sensor-ID","sensor-X",
    "X-Sonara-Timestamp-MS",String(NOW),
    "X-Sonara-Nonce",nonce,
    "X-Sonara-Signature",signature
  ];
}
function deps(){
  const jobs=[];
  return {
    jobs,nowMs:NOW,
    getKey:async()=>KEY,
    claimNonce:async()=>true,
    lookup:async()=>({
      sensorId:"sensor-X",scope:"organization",organizationId:ORG,
      domain:"optional_provider",sensitive:false,authorizedScope:true,
      verifiedIdempotency:true,operationId:"op-http-1",attempt:0,
      deadlineAtMs:NOW+60000
    }),
    scheduler:{schedule:async job=>{
      jobs.push(job);return {persisted:true,notBeforeMs:job.notBeforeMs};
    }}
  };
}
describe("signed SONARA raw HTTP composition (not an active route)",()=>{
  it("rejects duplicate signature transport before any key or nonce access",async()=>{
    const d=deps();let calls=0;
    d.getKey=async()=>{calls++;return KEY;};
    const r=await ingestSignedRecoveryRawHttp(BODY,[...headers(),"x-sonara-signature","0".repeat(64)],{...d,enabled:true});
    assert.equal(r.reason,"invalid_signed_transport");
    assert.equal(calls,0);assert.equal(d.jobs.length,0);
  });
  it("schedules one eligible incident only after valid raw HTTP signature",async()=>{
    const d=deps();const r=await ingestSignedRecoveryRawHttp(BODY,headers(),{...d,enabled:true});
    assert.equal(r.status,"scheduled");
    assert.equal(d.jobs.length,1);
    assert.equal(d.jobs[0].organizationId,ORG);
  });
  it("does not expose a callable recovery surface while disabled",async()=>{
    const d=deps();let calls=0;
    d.scheduler.schedule=async()=>{calls++;return {persisted:true};};
    const r=await ingestSignedRecoveryRawHttp(BODY,headers(),{...d,enabled:false});
    assert.equal(r.status,"disabled");
    assert.equal(calls,0);
  });
  it("denies signature tampering even with syntactically valid headers",async()=>{
    const d=deps();const h=headers();h[7]="0".repeat(64);
    const r=await ingestSignedRecoveryRawHttp(BODY,h,{...d,enabled:true});
    assert.equal(r.status,"escalated");assert.equal(d.jobs.length,0);
  });
});
