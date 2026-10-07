// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {authorizationDecision}=require("../lib/sonara-customer-authorization-calculator.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
const valid=(o={})=>({organizationId:ORG,resourceOrganizationId:ORG,userId:USER,
  role:"owner",action:"read",resourceClass:"tenant_standard",
  ownsRecord:true,stepUpVerified:false,boardEvidenceReady:false,publicResource:false,...o});
describe("customer authorization calculator",()=>{
  it("allows a normal tenant-scoped owner read as a policy candidate only",()=>{
    const out=authorizationDecision(valid());
    assert.equal(out.allowed,true);
    assert.equal(out.runtimePermissionGranted,false);
    assert.equal(out.rlsStillRequired,true);
  });
  it("denies cross-tenant access even for an owner",()=>{
    const out=authorizationDecision(valid({resourceOrganizationId:"33333333-3333-4333-8333-333333333333"}));
    assert.ok(out.blockers.includes("tenant_scope_unverified"));
  });
  it("fails closed on unknown roles and actions",()=>{
    assert.ok(authorizationDecision(valid({role:"supergod"})).blockers.includes("unknown_role"));
    assert.ok(authorizationDecision(valid({action:"wire_money"})).blockers.includes("unknown_action"));
  });
  it("lets a viewer read but not write ordinary tenant records",()=>{
    assert.equal(authorizationDecision(valid({role:"viewer",action:"read"})).allowed,true);
    assert.ok(authorizationDecision(valid({role:"viewer",action:"update"})).blockers.includes("role_action_not_allowed"));
  });
  it("requires record ownership/elevation for ordinary member updates",()=>{
    const out=authorizationDecision(valid({role:"member",action:"update",ownsRecord:false}));
    assert.ok(out.blockers.includes("record_ownership_or_elevated_role_required"));
  });
  it("restricts sensitive resources to owner/business-owner/admin",()=>{
    const out=authorizationDecision(valid({role:"manager",resourceClass:"restricted"}));
    assert.ok(out.blockers.includes("restricted_resource_role_required"));
  });
  it("requires step-up for publish and approval actions",()=>{
    const out=authorizationDecision(valid({action:"publish",stepUpVerified:false}));
    assert.ok(out.blockers.includes("step_up_authentication_required"));
    assert.equal(out.approvalStillRequired,true);
  });
  it("requires board evidence for destructive/security/billing administration",()=>{
    for(const action of ["delete","security_admin","billing_admin"]){
      const out=authorizationDecision(valid({action,stepUpVerified:true,boardEvidenceReady:false}));
      assert.ok(out.blockers.includes("governance_board_evidence_required"),action);
    }
  });
  it("permits public reads without tenant membership but not other public actions",()=>{
    const read=authorizationDecision({organizationId:"",resourceOrganizationId:"",userId:USER,
      role:"viewer",action:"read",resourceClass:"public",publicResource:true});
    assert.equal(read.allowed,true);
    const write=authorizationDecision({organizationId:"",resourceOrganizationId:"",userId:USER,
      role:"viewer",action:"update",resourceClass:"public",publicResource:true});
    assert.equal(write.allowed,false);
  });
  it("never treats authorization policy math as the runtime permission grant",()=>{
    const out=authorizationDecision(valid({action:"delete",stepUpVerified:true,boardEvidenceReady:true}));
    assert.equal(out.allowed,true);
    assert.equal(out.runtimePermissionGranted,false);
  });
});
