// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {
  budgetBucketKey,consumeDurableResourceBudget,claimDurableConcurrency,releaseDurableConcurrency
}=require("../lib/sonara-resource-budget-store.cjs");

const KEY="service_role_test_key_123456789";
const deps={getSupabaseServerConfig:()=>({ok:true,url:"https://database.example.invalid",serviceRoleKey:KEY})};
const BUCKET=budgetBucketKey({scopeKind:"organization",subjectId:"11111111-1111-4111-8111-111111111111",operationKey:"automation_run"});
const LEASE="22222222-2222-4222-8222-222222222222";

function response(body,{status=200}={}){
  return {ok:status>=200&&status<300,status,json:async()=>body};
}
describe("durable weighted resource budget adapter",()=>{
  it("hashes raw subjects before they become persistent bucket keys",()=>{
    const key=budgetBucketKey({scopeKind:"user",subjectId:"person@example.com",operationKey:"ai_draft"});
    assert.equal(key.length,64);
    assert.doesNotMatch(key,/person|example|@/i);
    assert.equal(key,budgetBucketKey({scopeKind:"user",subjectId:"person@example.com",operationKey:"ai_draft"}));
    assert.notEqual(key,budgetBucketKey({scopeKind:"user",subjectId:"person@example.com",operationKey:"media_generation"}));
  });
  it("fails closed when durable shared state is unavailable",async()=>{
    const out=await consumeDurableResourceBudget({getSupabaseServerConfig:()=>({ok:false})},{
      bucketKey:BUCKET,operationKey:"automation_run",capacityUnits:100,
      refillUnitsPerMinute:10,dailyLimitUnits:1000,costUnits:10
    });
    assert.deepEqual(out,{ok:false,code:"durable_resource_budget_unavailable"});
  });
  it("consumes budget only through the service-only RPC and returns no credential",async()=>{
    let seen;
    const out=await consumeDurableResourceBudget(deps,{
      bucketKey:BUCKET,operationKey:"automation_run",capacityUnits:100,
      refillUnitsPerMinute:10,dailyLimitUnits:1000,costUnits:10
    },async(url,init)=>{
      seen={url,init,body:JSON.parse(init.body)};
      return response([{allowed:true,reason:"within_budget",remaining_units:90,daily_remaining_units:990,retry_after_seconds:0}]);
    });
    assert.equal(out.allowed,true);
    assert.equal(out.budgetConsumed,true);
    assert.match(seen.url,/sonara_consume_resource_budget$/);
    assert.equal(seen.init.headers.apikey,KEY);
    assert.equal(seen.body.p_bucket_key,BUCKET);
    assert.equal(JSON.stringify(out).includes(KEY),false);
  });
  it("preserves a denied budget without claiming it consumed units",async()=>{
    const out=await consumeDurableResourceBudget(deps,{
      bucketKey:BUCKET,operationKey:"automation_run",capacityUnits:100,
      refillUnitsPerMinute:0,dailyLimitUnits:1000,costUnits:10
    },async()=>response([{allowed:false,reason:"budget_exhausted_no_refill",remaining_units:0,daily_remaining_units:900,retry_after_seconds:0}]));
    assert.equal(out.ok,true);
    assert.equal(out.allowed,false);
    assert.equal(out.budgetConsumed,false);
  });
  it("rejects malformed budget responses rather than inventing a decision",async()=>{
    const out=await consumeDurableResourceBudget(deps,{
      bucketKey:BUCKET,operationKey:"automation_run",capacityUnits:100,
      refillUnitsPerMinute:10,dailyLimitUnits:1000,costUnits:10
    },async()=>response([{allowed:"yes",reason:"within_budget"}]));
    assert.equal(out.code,"resource_budget_store_malformed");
  });
  it("claims concurrency with a caller-supplied idempotent lease id",async()=>{
    let seen;
    const out=await claimDurableConcurrency(deps,{bucketKey:BUCKET,leaseId:LEASE,concurrencyLimit:2,leaseSeconds:300},
      async(url,init)=>{
        seen={url,body:JSON.parse(init.body)};
        return response([{allowed:true,reason:"concurrency_lease_acquired",active_leases:1,lease_expires_at:"2026-10-08T23:00:00Z"}]);
      });
    assert.equal(out.leaseAcquired,true);
    assert.match(seen.url,/sonara_claim_resource_concurrency$/);
    assert.equal(seen.body.p_lease_id,LEASE);
  });
  it("reports saturation without manufacturing a lease",async()=>{
    const out=await claimDurableConcurrency(deps,{bucketKey:BUCKET,leaseId:LEASE,concurrencyLimit:1,leaseSeconds:300},
      async()=>response([{allowed:false,reason:"concurrency_budget_exceeded",active_leases:1,lease_expires_at:null}]));
    assert.equal(out.allowed,false);
    assert.equal(out.leaseAcquired,false);
  });
  it("releases a lease through the dedicated idempotent RPC",async()=>{
    let seen;
    const out=await releaseDurableConcurrency(deps,{bucketKey:BUCKET,leaseId:LEASE},async(url,init)=>{
      seen={url,body:JSON.parse(init.body)};
      return response([{released:true}]);
    });
    assert.equal(out.released,true);
    assert.match(seen.url,/sonara_release_resource_concurrency$/);
    assert.equal(seen.body.p_lease_id,LEASE);
  });
  it("refuses invalid costs, scopes and lease identifiers before network access",async()=>{
    assert.throws(()=>budgetBucketKey({scopeKind:"email",subjectId:"x",operationKey:"ai_draft"}),/invalid_resource_budget_scope/);
    let calls=0;
    const out=await consumeDurableResourceBudget(deps,{bucketKey:BUCKET,operationKey:"automation_run",
      capacityUnits:0,refillUnitsPerMinute:1,dailyLimitUnits:100,costUnits:1},async()=>{calls++;});
    assert.equal(out.code,"invalid_capacity_units");
    assert.equal(calls,0);
    const lease=await claimDurableConcurrency(deps,{bucketKey:BUCKET,leaseId:"not-a-uuid",concurrencyLimit:1},
      async()=>{calls++;});
    assert.equal(lease.code,"invalid_resource_budget_lease");
    assert.equal(calls,0);
  });
});
