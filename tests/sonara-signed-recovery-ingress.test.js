"use strict";
const assert = require("node:assert/strict");
const {createHmac} = require("node:crypto");
const {ingestSignedRecoveryEnvelope} = require("../lib/sonara-signed-recovery-ingress.cjs");
const {createPostgresSensorNonceClaim} = require("../lib/sonara-postgres-sensor-nonces.cjs");

const NOW=1800000000000;
const ORG="11111111-1111-4111-8111-111111111111";
const KEY=Buffer.alloc(32,0xab); // Test fixture; never a real credential.
const OBS={incidentId:"signed-1",resourceId:"mail-optional",sensorId:"sensor-A",
  signal:"provider.timeout",observedAtMs:NOW-1000,organizationId:ORG};
function sign(observation=OBS, overrides={}){
  const rawBody=Buffer.from(JSON.stringify(observation),"utf8");
  const timestampMs=overrides.timestampMs??NOW;
  const nonce=overrides.nonce??"b".repeat(32);
  const signature=createHmac("sha256",KEY).update(Buffer.concat([
    Buffer.from("sonara-recovery-v1\n"),
    Buffer.from(observation.sensorId+"\n"+timestampMs+"\n"+nonce+"\n"),
    rawBody
  ])).digest("hex");
  return {rawBody,sensorId:observation.sensorId,timestampMs,nonce,signature};
}
const RESOURCE={sensorId:"sensor-A",scope:"organization",organizationId:ORG,
  domain:"optional_provider",sensitive:false,authorizedScope:true,
  verifiedIdempotency:true,operationId:"op-1",attempt:0,deadlineAtMs:NOW+60000};
function environment(changes={}){
  const seen=new Set(),scheduled=[];
  return {scheduled,getKey:async()=>KEY,lookup:async()=>RESOURCE,
    claimNonce:async({sensorId,nonce})=>{
      const key=sensorId+":"+nonce;
      if(seen.has(key))return false;
      seen.add(key);return true;
    },
    scheduler:{schedule:async job=>{
      scheduled.push(job);
      return {persisted:true,notBeforeMs:job.notBeforeMs};
    }},...changes};
}
describe("SONARA signed sensor to durable recovery queue integration",()=>{
  it("never touches credentials, nonce store or scheduler when disabled",async()=>{
    let effects=0;
    const dependencies=environment({getKey:async()=>{effects++;return KEY;},
      claimNonce:async()=>{effects++;return true;},
      scheduler:{schedule:async()=>{effects++;return {persisted:true};}}});
    const outcome=await ingestSignedRecoveryEnvelope(sign(),{
      ...dependencies,enabled:false,nowMs:NOW});
    assert.equal(outcome.status,"disabled");
    assert.equal(effects,0);
  });
  it("accepts one signed low-risk incident into the durable scheduler",async()=>{
    const e=environment();
    const result=await ingestSignedRecoveryEnvelope(sign(),{...e,enabled:true,nowMs:NOW});
    assert.equal(result.status,"scheduled");
    assert.equal(e.scheduled.length,1);
    assert.equal(e.scheduled[0].organizationId,ORG);
    assert.equal(e.scheduled[0].attempt,0);
  });
  it("blocks repeated signed deliveries before a second schedule",async()=>{
    const e=environment();
    assert.equal((await ingestSignedRecoveryEnvelope(sign(),{...e,enabled:true,nowMs:NOW})).status,"scheduled");
    const replay=await ingestSignedRecoveryEnvelope(sign(),{...e,enabled:true,nowMs:NOW});
    assert.equal(replay.status,"escalated");
    assert.equal(e.scheduled.length,1);
  });
  it("rejects a forged signature and a cross-tenant registry record",async()=>{
    const bad=sign();
    bad.signature="0".repeat(64);
    const e=environment();
    const forged=await ingestSignedRecoveryEnvelope(bad,{...e,enabled:true,nowMs:NOW});
    assert.equal(forged.status,"escalated");
    assert.equal(e.scheduled.length,0);
    const mismatch=environment({lookup:async()=>({
      ...RESOURCE,organizationId:"22222222-2222-4222-8222-222222222222"
    })});
    const wrongTenant=await ingestSignedRecoveryEnvelope(sign(),{
      ...mismatch,enabled:true,nowMs:NOW});
    assert.equal(wrongTenant.status,"escalated");
    assert.equal(mismatch.scheduled.length,0);
  });
  it("fails closed on missing nonce storage or nonbyte request bodies",async()=>{
    const e=environment({claimNonce:async()=>{throw Error("database unavailable");}});
    assert.equal((await ingestSignedRecoveryEnvelope(sign(),{
      ...e,enabled:true,nowMs:NOW})).status,"escalated");
    const malformed=sign();
    malformed.rawBody=malformed.rawBody.toString("utf8");
    assert.equal((await ingestSignedRecoveryEnvelope(malformed,{
      ...environment(),enabled:true,nowMs:NOW})).status,"escalated");
  });
  it("postgres adapter accepts only an exact authoritative true",async()=>{
    const good=createPostgresSensorNonceClaim({rpc:async(name,args)=>{
      assert.equal(name,"sonara_claim_autonomic_sensor_nonce");
      assert.equal(args.p_sensor_id,"sensor-A");
      return {data:true,error:null};
    }});
    const identity={sensorId:"sensor-A",nonce:"b".repeat(32),timestampMs:NOW,ttlMs:250000};
    assert.equal(await good(identity),true);
    const no=createPostgresSensorNonceClaim({rpc:async()=>({data:false})});
    assert.equal(await no(identity),false);
    const outage=createPostgresSensorNonceClaim({rpc:async()=>{throw Error("offline");}});
    assert.equal(await outage(identity),false);
    assert.equal(await good({...identity,ttlMs:1}),false);
  });
});
