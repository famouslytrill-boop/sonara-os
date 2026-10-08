"use strict";
const assert=require("node:assert/strict");
const {SUITES,EFFECT_CLASSES,classifyHttpJourney,recoveryPolicyForEffect,summarizeProductHttpObservations}
 =require("../lib/sonara-cross-suite-reliability.cjs");
describe("SONARA cross-suite reliability",()=>{
 it("classifies real routes across all four products",()=>{
  assert.deepEqual(SUITES,["sonara_one","business_builder","creator_studio","growth_studio","unclassified"]);
  assert.equal(classifyHttpJourney("/api/business-builder/businesses/:businessId","POST").suite,"business_builder");
  assert.equal(classifyHttpJourney("/api/creator/generation/jobs/:jobId/retry","POST").journey,"creator_generation");
  assert.equal(classifyHttpJourney("/api/growth/campaigns/:campaignId/send","POST").journey,"growth_campaigns");
  assert.equal(classifyHttpJourney("/account/setup","GET").suite,"sonara_one");
  assert.equal(classifyHttpJourney("/api/business-builder/businesses/:id","DELETE").operation,"write");
 });
 it("never embeds tenant IDs or raw customer query strings in labels",()=>{
  for(const route of ["/api/growth/campaigns/private-tenant?token=abc","https://host/abc","/"+ "a".repeat(170),"/a\\b"]){
   const d=classifyHttpJourney(route,"GET");assert.equal(d.suite,"unclassified");
   assert.doesNotMatch(JSON.stringify(d),/private-tenant|token=abc|https:/);
  }
  const c=classifyHttpJourney("/api/creator/generation/jobs/:jobId","POST");
  assert.equal(c.recovery,"diagnostics_only");
  assert.doesNotMatch(JSON.stringify(c),/jobId/);
 });
 it("denies autonomous sensitive business effects for every company",()=>{
  for(const suite of Object.keys(EFFECT_CLASSES))for(const effect of EFFECT_CLASSES[suite]){
   const d=recoveryPolicyForEffect(suite,effect);assert.equal(d.allowed,false);
   assert.equal(d.action,"owner_approval_required");
  }
  assert.equal(recoveryPolicyForEffect("growth_studio","unknown_effect").allowed,false);
  assert.equal(recoveryPolicyForEffect("unknown","campaign_send").action,"deny_and_review");
 });
 it("requires sufficient samples for customer journey error rates and p95",()=>{
  const low=summarizeProductHttpObservations([{suite:"growth_studio",status:503,latencyMs:29}]);
  assert.equal(low.products.find(x=>x.suite==="growth_studio").errorRate,null);
  const rows=Array.from({length:40},(_,i)=>({suite:"business_builder",status:i<4?503:200,latencyMs:i+1}));
  const r=summarizeProductHttpObservations(rows).products.find(x=>x.suite==="business_builder");
  assert.equal(r.errorRate,.1);assert.equal(r.p95Ms,38);
 });
 it("rejects missing, corrupt and unbounded evidence",()=>{
  assert.equal(summarizeProductHttpObservations(null).status,"invalid_evidence");
  assert.equal(summarizeProductHttpObservations([{suite:"growth_studio",status:0,latencyMs:2}]).status,"invalid_evidence");
  assert.equal(summarizeProductHttpObservations([{suite:"growth_studio",status:200,latencyMs:-4}]).status,"invalid_evidence");
  assert.equal(summarizeProductHttpObservations([],{minimumSamples:0}).status,"invalid_evidence");
 });
});
