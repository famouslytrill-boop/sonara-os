"use strict";
const assert=require("node:assert/strict");
const {safeRouteTemplate}=require("../lib/sonara-safe-route-template.cjs");
const {WORKFLOWS,workflowObservation,summarizeWorkflowObservations}
  =require("../lib/sonara-workflow-diagnostics.cjs");

describe("SONARA bounded cross-suite workflow diagnostics",()=>{
  it("accepts server-declared route templates and known mount points",()=>{
    assert.equal(safeRouteTemplate({baseUrl:"",route:{path:"/api/creator/generation/jobs/:jobId"}}),
      "/api/creator/generation/jobs/:jobId");
    assert.equal(safeRouteTemplate({baseUrl:"/api/growth",route:{path:"/campaigns/:campaignId"}}),
      "/api/growth/campaigns/:campaignId");
  });
  it("rejects resolved tenant names, emails and unbounded mount paths",()=>{
    for(const baseUrl of ["/api/growth/user@domain.com","/api/growth/tenant-ABC",
        "/api/creator/123","https://evil","/api/growth?token=x",
        "/api/growth/x".repeat(100)]) {
      assert.equal(safeRouteTemplate({baseUrl,route:{path:"/campaigns"}}),"unmatched");
    }
  });
  it("rejects query strings, control characters and oversized routes",()=>{
    for(const path of ["/api/x?user=abc","/api/x#hash","/api/x\ny",
      "/x".repeat(200),"not-absolute"]) {
      assert.equal(safeRouteTemplate({baseUrl:"",route:{path}}),"unmatched");
    }
  });
  it("reports a fixed, PII-free diagnostic vocabulary for all products",()=>{
    for(const [suite,workflows] of Object.entries(WORKFLOWS))for(const workflow of workflows){
      const r=workflowObservation({suite,workflow,phase:"blocked",
        cause:"permission",durationMs:55,organizationId:"secret-tenant"});
      assert.equal(r.suite,suite);
      assert.equal(r.recovery,"diagnostics_only");
      assert.doesNotMatch(JSON.stringify(r),/secret-tenant/);
    }
  });
  it("denies forged outcomes and unrecognized cause strings",()=>{
    const rows=[null,{suite:"unknown",workflow:"work_order",phase:"completed",cause:"none",durationMs:1},
      {suite:"creator_studio",workflow:"media_generation",phase:"completed",cause:"none",durationMs:-1},
      {suite:"growth_studio",workflow:"campaign_dispatch",phase:"sent_all",cause:"none",durationMs:5},
      {suite:"growth_studio",workflow:"campaign_dispatch",phase:"failed",cause:"client-secret",durationMs:1}];
    for(const row of rows)assert.equal(workflowObservation(row).status,"invalid_evidence");
  });
  it("treats low-traffic background failures as insufficient evidence",()=>{
    const r=summarizeWorkflowObservations([{suite:"creator_studio",workflow:"media_generation",
      phase:"failed",cause:"provider_unavailable",durationMs:200}]);
    assert.equal(r.series[0].status,"insufficient_evidence");
    assert.equal(r.series[0].failureRate,null);
  });
  it("deterministically computes workflow failure rate and p95",()=>{
    const rows=Array.from({length:40},(_,i)=>({suite:"business_builder",workflow:"work_order",
      phase:i<4?"failed":"completed",cause:i<4?"validation":"none",durationMs:i+1}));
    const r=summarizeWorkflowObservations(rows);
    assert.equal(r.status,"measured");
    assert.equal(r.series[0].failureRate,.1);
    assert.equal(r.series[0].p95Ms,38);
  });
});
