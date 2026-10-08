// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const {QUEUEABLE,NEVER_OFFLINE,prepareOfflineMutation,reconcileOfflineMutation}=
  require("../lib/sonara-offline-sync-policy.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const DEV="22222222-2222-4222-8222-222222222222";
const MUT="33333333-3333-4333-8333-333333333333";
const ENT="44444444-4444-4444-8444-444444444444";
const valid=(o={})=>({
  organizationId:ORG,authenticatedOrganizationId:ORG,deviceId:DEV,mutationId:MUT,
  operation:"draft_task",entityType:"task",entityId:ENT,baseVersion:4,
  payloadHash:"a".repeat(64),payloadFields:["title","status"],
  deviceKeyProtectionVerified:true,localVaultEncrypted:true,...o
});
describe("offline deterministic sync policy",()=>{
  it("queues ordinary drafts only after encrypted local storage is verified",()=>{
    const out=prepareOfflineMutation(valid());
    assert.equal(out.state,"queue_candidate");
    assert.equal(out.serverWriteAuthorized,false);
    assert.equal(out.queuedLocally,false);
  });
  it("blocks all money, legal, destructive and permission-changing operations offline",()=>{
    for(const operation of NEVER_OFFLINE){
      const out=prepareOfflineMutation(valid({operation}));
      assert.ok(out.blockers.includes("sensitive_operation_online_only"),operation);
      assert.equal(out.serverWriteAuthorized,false);
    }
  });
  it("blocks sensitive financial/security field names even in an allowed operation",()=>{
    for(const field of ["bank","routing","payment_status","refund","secret","token"]){
      assert.ok(prepareOfflineMutation(valid({payloadFields:["title",field]}))
        .blockers.includes("sensitive_fields_not_allowed_offline"));
    }
  });
  it("requires device identity, mutation id and payload integrity metadata",()=>{
    assert.ok(prepareOfflineMutation(valid({deviceId:"bad"})).blockers.includes("device_identity_unverified"));
    assert.ok(prepareOfflineMutation(valid({mutationId:"bad"})).blockers.includes("mutation_id_invalid"));
    assert.ok(prepareOfflineMutation(valid({payloadHash:"bad"})).blockers.includes("payload_hash_missing"));
  });
  it("requires OS-backed/local vault protection before queueing",()=>{
    assert.ok(prepareOfflineMutation(valid({deviceKeyProtectionVerified:false}))
      .blockers.includes("local_encryption_not_verified"));
    assert.ok(prepareOfflineMutation(valid({localVaultEncrypted:false}))
      .blockers.includes("local_encryption_not_verified"));
  });
  it("clean base-version match becomes an apply candidate, not an automatic write",()=>{
    const out=reconcileOfflineMutation({operation:"draft_task",baseVersion:4,serverVersion:4,
      payloadHashMatchesQueued:true,serverEntityExists:true});
    assert.equal(out.state,"clean_apply_candidate");
    assert.equal(out.applyCandidate,true);
    assert.equal(out.nextVersion,5);
  });
  it("ordinary update conflicts never use last-write-wins",()=>{
    const out=reconcileOfflineMutation({operation:"draft_task",baseVersion:4,serverVersion:5,
      payloadHashMatchesQueued:true,serverEntityExists:true});
    assert.equal(out.state,"version_conflict_human_review");
    assert.equal(out.applyCandidate,false);
    assert.equal(out.humanConflictReview,true);
  });
  it("append-only notes can merge without overwriting server content",()=>{
    const out=reconcileOfflineMutation({operation:"append_note",baseVersion:2,serverVersion:9,
      payloadHashMatchesQueued:true,serverEntityExists:true});
    assert.equal(out.state,"append_only_merge_candidate");
    assert.equal(out.applyCandidate,true);
    assert.equal(out.nextVersion,10);
  });
  it("idempotent mutation replay does nothing twice",()=>{
    const out=reconcileOfflineMutation({operation:"append_note",baseVersion:1,serverVersion:5,
      mutationAlreadyApplied:true});
    assert.equal(out.state,"idempotent_already_applied");
    assert.equal(out.applyCandidate,false);
  });
  it("unknown operations fail closed",()=>{
    const out=prepareOfflineMutation(valid({operation:"do_anything"}));
    assert.ok(out.blockers.includes("unknown_offline_operation"));
    assert.equal(QUEUEABLE.has("do_anything"),false);
  });
});
