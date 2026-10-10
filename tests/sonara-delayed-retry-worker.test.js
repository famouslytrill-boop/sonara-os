"use strict";
const assert = require("node:assert/strict");
const { createPostgresDelayedRetryStore } = require("../lib/sonara-postgres-delayed-retry.cjs");
const { enqueueBoundedRetry } = require("../lib/sonara-recovery-scheduling.cjs");
const { runOneDueRecovery } = require("../lib/sonara-due-recovery-worker.cjs");
const NOW=1800000000000;
const ORG="11111111-1111-4111-8111-111111111111";
const TOKEN="22222222-2222-4222-8222-222222222222";
const JOB="33333333-3333-4333-8333-333333333333";
const resourceKey=JSON.stringify(["organization",ORG,"retry_idempotent","mail-provider"]);
const incident={incidentId:"incident-1",resourceId:"mail-provider",organizationId:ORG,scope:"organization",observedAtMs:NOW-1000,
 sensitive:false,authorizedScope:true,domain:"optional_provider",signal:"provider.rate_limited",
 verifiedIdempotency:true,operationId:"operation-1",attempt:1,retryAfterMs:6000,deadlineAtMs:NOW+60_000};
const claimed={
 job_id:JOB,claim_token:TOKEN,fencing_token:1,organization_id:ORG,
 resource_key:resourceKey,operation_id:"operation-1",attempt:1,
 deadline_at:new Date(NOW+60000).toISOString()
};
describe("private PostgreSQL delayed retry boundary",()=>{
  it("schedules with canonical tenant, attempt and DB-confirmed due time",async()=>{
    let called=0;
    const store=createPostgresDelayedRetryStore({rpc:async(name,args)=>{
      assert.equal(name,"sonara_schedule_autonomic_retry");
      called++;
      assert.equal(args.p_organization_id,ORG);
      assert.equal(args.p_attempt,1);
      assert.equal(args.p_dedupe_key,JSON.stringify([resourceKey,"operation-1",1]));
      return {data:[{persisted:true,duplicate:false,not_before:args.p_not_before}]};
    }});
    const result=await enqueueBoundedRetry(incident,{enabled:true,nowMs:NOW,scheduler:store.scheduler});
    assert.equal(result.status,"scheduled");
    assert.equal(called,1);
    assert.ok(result.notBeforeMs>=NOW+6000);
  });
  it("rejects forged tenant, unbounded attempt and malformed resource key before RPC",async()=>{
    let calls=0;
    const store=createPostgresDelayedRetryStore({rpc:async()=>{calls++;return {data:[]};}});
    const payload={
      action:"retry_idempotent",organizationId:ORG,resourceKey,operationId:"operation-1",
      incidentId:"incident-1",attempt:1,notBeforeMs:NOW+10000,deadlineAtMs:NOW+60000,
      dedupeKey:JSON.stringify([resourceKey,"operation-1",1])
    };
    for(const changes of [
      {organizationId:"22222222-2222-4222-8222-222222222222"},
      {attempt:3},
      {resourceKey:"garbage"},
      {dedupeKey:"hijack"}
    ])await assert.rejects(store.scheduler.schedule({...payload,...changes}));
    assert.equal(calls,0);
  });
  it("returns no due work, and validates exclusive fenced claims",async()=>{
    const empty=createPostgresDelayedRetryStore({rpc:async()=>({data:[]})});
    assert.equal(await empty.worker.claimDue(),null);
    const good=createPostgresDelayedRetryStore({rpc:async()=>({data:[claimed]})});
    const c=await good.worker.claimDue();
    assert.equal(c.jobId,JOB);
    assert.equal(c.fencingToken,1);
    const malformed=createPostgresDelayedRetryStore({rpc:async()=>({data:[{...claimed,claim_token:"invalid"}]})});
    await assert.rejects(malformed.worker.claimDue());
  });
  it("rejects malformed completed states and propagates RPC failure without secrets",async()=>{
    const s=createPostgresDelayedRetryStore({rpc:async()=>({error:{message:"secret"}})});
    await assert.rejects(s.worker.claimDue(),/autonomic_retry_rpc_failed/);
    await assert.rejects(s.worker.complete({jobId:JOB,claimToken:TOKEN,outcome:"refire"}));
    const done=createPostgresDelayedRetryStore({rpc:async(name,args)=>{
      assert.equal(name,"sonara_complete_autonomic_retry");
      assert.equal(args.p_claim_token,TOKEN);
      return {data:true};
    }});
    assert.equal(await done.worker.complete({jobId:JOB,claimToken:TOKEN,outcome:"verified"}),true);
  });
  it("a worker is disabled by default and refuses an unconfigured adapter",async()=>{
    assert.equal((await runOneDueRecovery()).status,"disabled");
    assert.equal((await runOneDueRecovery({enabled:true})).reason,"worker_dependencies_missing");
  });
  it("runs one claimed job with independent permission and health checks",async()=>{
    const sequence=[];
    const worker={claimDue:async()=>{sequence.push("claim");return {
      jobId:JOB,claimToken:TOKEN,fencingToken:1,organizationId:ORG,
      resourceKey,operationId:"operation-1",attempt:1,deadlineAtMs:NOW+60_000
    };},complete:async x=>{sequence.push("complete:"+x.outcome);return true;}};
    const result=await runOneDueRecovery({enabled:true,nowMs:NOW,worker,isPaused:async()=>false,
      authorize:async x=>{sequence.push("authorize");return {authorized:true,tenantVerified:x.organizationId===ORG,idempotencyVerified:true,fencingVerified:true,operationRetryable:true};},
      perform:async()=>{sequence.push("perform");},
      verify:async()=>{sequence.push("verify");return {healthy:true,tenantVerified:true,operationVerified:true};}
    });
    assert.equal(result.status,"recovered");
    assert.deepEqual(sequence,["claim","authorize","perform","verify","complete:verified"]);
  });
  it("prevents provider effects without current authorization",async()=>{
    let calls=0;
    const worker={claimDue:async()=>({...claimed,jobId:JOB,claimToken:TOKEN,deadlineAtMs:NOW+10000}),complete:async x=>{assert.equal(x.outcome,"unverified");return true;}};
    const result=await runOneDueRecovery({enabled:true,nowMs:NOW,worker,isPaused:async()=>false,
      authorize:async()=>({authorized:true,tenantVerified:false,idempotencyVerified:true,fencingVerified:true,operationRetryable:true}),
      perform:async()=>{calls++;},verify:async()=>({healthy:true})});
    assert.equal(result.reason,"current_authority_not_proven");
    assert.equal(calls,0);
  });
  it("ambiguous provider failure is closed, never retried within this worker",async()=>{
    let effects=0, terminal;
    const worker={claimDue:async()=>({jobId:JOB,claimToken:TOKEN,deadlineAtMs:NOW+10000}),
      complete:async ({outcome})=>{terminal=outcome;return true;}};
    const r=await runOneDueRecovery({enabled:true,nowMs:NOW,worker,isPaused:async()=>false,
      authorize:async()=>({authorized:true,tenantVerified:true,idempotencyVerified:true,fencingVerified:true,operationRetryable:true}),
      perform:async()=>{effects++;throw Error("provider accepted but response lost");},
      verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})});
    assert.equal(effects,1);assert.equal(terminal,"failed");
    assert.equal(r.reason,"external_outcome_ambiguous");
  });
  it("does not execute expired claims or lie about a failed terminal audit",async()=>{
    let effects=0;
    const worker={claimDue:async()=>({jobId:JOB,claimToken:TOKEN,deadlineAtMs:NOW+500}),
      complete:async()=>false};
    const r=await runOneDueRecovery({enabled:true,nowMs:NOW,worker,isPaused:async()=>false,
      authorize:async()=>({authorized:true}),perform:async()=>{effects++;},verify:async()=>({healthy:true})});
    assert.equal(effects,0);assert.equal(r.reason,"deadline_and_terminal_audit_failed");
  });
  it("requires a real pause adapter on an enabled worker",async()=>{
    let claims=0;
    const result=await runOneDueRecovery({enabled:true,nowMs:NOW,
      worker:{claimDue:async()=>{claims++;return null;},complete:async()=>true},
      authorize:async()=>({authorized:true}),perform:async()=>{},verify:async()=>({healthy:true})});
    assert.equal(result.reason,"worker_dependencies_missing");
    assert.equal(claims,0);
  });
  it("does not execute when pause verification finishes after the deadline",async()=>{
    let actions=0;let ticks=0;let terminal;
    const worker={claimDue:async()=>({jobId:JOB,claimToken:TOKEN,deadlineAtMs:NOW+10000}),
      complete:async({outcome})=>{terminal=outcome;return true;}};
    const result=await runOneDueRecovery({enabled:true,nowMs:NOW,worker,
      clock:()=>++ticks===1?NOW:NOW+10001,isPaused:async()=>false,
      authorize:async()=>({authorized:true,tenantVerified:true,idempotencyVerified:true,
        fencingVerified:true,operationRetryable:true}),
      perform:async()=>{actions++;},verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})});
    assert.equal(actions,0);
    assert.equal(terminal,"unverified");
    assert.equal(result.reason,"deadline_expired_during_pause_check");
  });
  it("rechecks the deadline after authorization, before any provider effect",async()=>{
    let effects=0;let terminal;
    const worker={claimDue:async()=>({jobId:JOB,claimToken:TOKEN,deadlineAtMs:NOW+10_000}),
      complete:async ({outcome})=>{terminal=outcome;return true;}};
    const r=await runOneDueRecovery({enabled:true,nowMs:NOW,clock:()=>NOW+11_000,worker,isPaused:async()=>false,
      authorize:async()=>({authorized:true,tenantVerified:true,idempotencyVerified:true,fencingVerified:true,operationRetryable:true}),
      perform:async()=>{effects++;},verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})});
    assert.equal(r.reason,"deadline_expired_during_authorization");
    assert.equal(effects,0);assert.equal(terminal,"unverified");
  });
  it("honors a late operator pause before reaching the provider",async()=>{
    let effects=0;let terminal;
    const worker={claimDue:async()=>({jobId:JOB,claimToken:TOKEN,deadlineAtMs:NOW+60_000}),
      complete:async ({outcome})=>{terminal=outcome;return true;}};
    const r=await runOneDueRecovery({enabled:true,nowMs:NOW,clock:()=>NOW,worker,
      authorize:async()=>({authorized:true,tenantVerified:true,idempotencyVerified:true,fencingVerified:true,operationRetryable:true}),
      isPaused:async()=>true,
      perform:async()=>{effects++;},verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})});
    assert.equal(r.reason,"recovery_paused");
    assert.equal(effects,0);assert.equal(terminal,"unverified");
  });
  it("does not misclassify an unavailable kill switch as provider execution",async()=>{
    let effects=0;let terminal;
    const worker={claimDue:async()=>({jobId:JOB,claimToken:TOKEN,deadlineAtMs:NOW+60_000}),
      complete:async ({outcome})=>{terminal=outcome;return true;}};
    const r=await runOneDueRecovery({enabled:true,nowMs:NOW,clock:()=>NOW,worker,
      authorize:async()=>({authorized:true,tenantVerified:true,idempotencyVerified:true,fencingVerified:true,operationRetryable:true}),
      isPaused:async()=>{throw Error("offline");},
      perform:async()=>{effects++;},verify:async()=>({healthy:true,tenantVerified:true,operationVerified:true})});
    assert.equal(r.reason,"pre_effect_evidence_unavailable");
    assert.equal(effects,0);assert.equal(terminal,"unverified");
  });

});
