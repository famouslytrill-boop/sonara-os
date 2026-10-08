"use strict";
const assert=require("node:assert/strict");
const {createPostgresAutonomicOperatorGate}=require("../lib/sonara-postgres-operator-gate.cjs");
const {runOneDueRecovery}=require("../lib/sonara-due-recovery-worker.cjs");
const {runOperatorGatedRecovery}=require("../lib/sonara-controlled-recovery-execution.cjs");
const NOW=1800000000000;
const jobId="55555555-5555-4555-8555-555555555555";
const claimToken="22222222-2222-4222-8222-222222222222";
const ctx=Object.freeze({jobId,claimToken,fencingToken:4});
const authorized=async()=>({
 authorized:true,tenantVerified:true,idempotencyVerified:true,
 fencingVerified:true,operationRetryable:true
});
function worker(terminal){
 return {
  claimDue:async()=>({...ctx,deadlineAtMs:NOW+60000}),
  complete:async x=>{terminal.push(x.outcome);return true;}
 };
}
describe("SONARA durable operator execution gate",()=>{
 it("rejects a missing server RPC and malformed claim without a database call",async()=>{
   assert.throws(()=>createPostgresAutonomicOperatorGate(),/server_side_rpc_required/);
   let calls=0;
   const gate=createPostgresAutonomicOperatorGate({rpc:async()=>{calls++;return {data:true};}});
   assert.equal(await gate.isPaused({...ctx,claimToken:"forged"}),true);
   assert.equal(await gate.isPaused({...ctx,fencingToken:0}),true);
   assert.equal(await gate.isPaused({jobId}),true);
   assert.equal(calls,0);
 });
 it("permits only an explicit database true with a valid claim/fence",async()=>{
   let seen;
   const gate=createPostgresAutonomicOperatorGate({rpc:async(name,args)=>{
     seen={name,args};return {data:true,error:null};
   }});
   assert.equal(await gate.isPaused(ctx),false);
   assert.equal(seen.name,"sonara_autonomic_execution_permitted");
   assert.deepEqual(seen.args,{p_job_id:jobId,p_claim_token:claimToken,p_fencing_token:4});
 });
 it("fails closed on false, null, malformed response and database errors",async()=>{
   for(const reply of [{data:false},{data:null},{data:"true"},{data:1},
      {data:[true]},null,{data:true,error:{message:"denied"}}]){
     const gate=createPostgresAutonomicOperatorGate({rpc:async()=>reply});
     assert.equal(await gate.isPaused(ctx),true);
   }
   const outage=createPostgresAutonomicOperatorGate({rpc:async()=>{throw Error("database down");}});
   assert.equal(await outage.isPaused(ctx),true);
 });
 it("never executes a provider effect if the live database gate denies",async()=>{
   let effects=0;const done=[];
   const gate=createPostgresAutonomicOperatorGate({rpc:async()=>({data:false})});
   const result=await runOneDueRecovery({
     enabled:true,worker:worker(done),nowMs:NOW,clock:()=>NOW,
     authorize:authorized,isPaused:gate.isPaused,
     perform:async()=>{effects++;},
     verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})
   });
   assert.equal(result.reason,"recovery_paused");
   assert.equal(effects,0);
   assert.deepEqual(done,["unverified"]);
 });
 it("requires independently verified healthy evidence even with an approved gate",async()=>{
   let effects=0;const done=[];
   const gate=createPostgresAutonomicOperatorGate({rpc:async()=>({data:true})});
   const result=await runOneDueRecovery({
     enabled:true,worker:worker(done),nowMs:NOW,clock:()=>NOW,
     authorize:authorized,isPaused:gate.isPaused,
     perform:async()=>{effects++;},
     verify:async()=>({healthy:false,tenantVerified:true,operationVerified:true})
   });
   assert.equal(effects,1);
   assert.equal(result.reason,"post_action_evidence_missing");
   assert.deepEqual(done,["unverified"]);
 });
 it("recovers only after a current DB grant and independent verification",async()=>{
   let effects=0;const done=[];
   const gate=createPostgresAutonomicOperatorGate({rpc:async()=>({data:true})});
   const result=await runOneDueRecovery({
     enabled:true,worker:worker(done),nowMs:NOW,clock:()=>NOW,
     authorize:authorized,isPaused:gate.isPaused,
     perform:async()=>{effects++;},
     verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})
   });
   assert.equal(effects,1);
   assert.equal(result.status,"recovered");
   assert.deepEqual(done,["verified"]);
 });
 it("operator-gated entry refuses missing database controls before claiming work",async()=>{
   let claims=0;
   const unavailable=await runOperatorGatedRecovery({
     enabled:true,operatorRpc:null,
     worker:{claimDue:async()=>{claims++;return null;},complete:async()=>true},
     authorize:authorized,perform:async()=>{},verify:async()=>({healthy:true}),
     clock:()=>NOW,nowMs:NOW
   });
   assert.equal(unavailable.reason,"operator_gate_not_configured");
   assert.equal(claims,0);
 });
 it("operator-gated entry refuses the caller's forged permissive pause callback",async()=>{
   let effects=0;const done=[];
   const result=await runOperatorGatedRecovery({
     enabled:true,operatorRpc:async()=>({data:false}),worker:worker(done),
     authorize:authorized,clock:()=>NOW,nowMs:NOW,
     isPaused:async()=>false, // ignored; not part of accepted contract.
     perform:async()=>{effects++;},
     verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})
   });
   assert.equal(result.reason,"recovery_paused");
   assert.equal(effects,0);assert.deepEqual(done,["unverified"]);
 });
 it("operator-gated entry allows only DB-approved, independently verified recovery",async()=>{
   let effects=0;const done=[];
   const result=await runOperatorGatedRecovery({
     enabled:true,operatorRpc:async()=>({data:true}),worker:worker(done),
     authorize:authorized,clock:()=>NOW,nowMs:NOW,
     perform:async()=>{effects++;},
     verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})
   });
   assert.equal(result.status,"recovered");assert.equal(effects,1);
   assert.deepEqual(done,["verified"]);
 });
});
