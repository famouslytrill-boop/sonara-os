"use strict";
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
// Fixture imports must not poison the real module cache for other Mocha suites.
// Capture the pre-existing module (if any), run this unit fixture cold,
// then restore exactly the previous cache state in finally.
const fixtureModulePath = require.resolve("../lib/sonara-research-evidence-reconciliation.cjs");
const cachedRealModule = require.cache[fixtureModulePath];
delete require.cache[fixtureModulePath];
const fakeObservation = (n) => ({entityId:`org_${n}`,evidenceId:`evidence_${n}`});
const comparison = () => ({categoryId:"us_restaurants",metric:"annual_revenue",unit:"usd",
  period:"2025",geography:"US",reviewedAt:"2026-10-09",
  observations:Array.from({length:50},(_,i)=>fakeObservation(i))});
const fakePlan = (c) => ({categoryId:c.categoryId,metric:c.metric,period:c.period,
  unit:c.unit,geography:c.geography,candidateTop50:c.observations.length===51?[]:Array(50).fill(null),
  blockers:["unverified_population"],cutoffTieRequiresReview:c.observations.length===51});
const fakeAudit = ({observations})=>{
  const grouped=new Map();
  for(const r of observations){const x=grouped.get(r.claimId)||{claimId:r.claimId,supports:0,contradicts:0,staleSources:0};x[r.stance]++;grouped.set(r.claimId,x);}
  const claims=[...grouped.values()];
  return {claims,acceptedEvidenceCount:observations.length,rejected:[],
    issueCodes:claims.some(x=>x.contradicts)?["contradictions_found"]:[],
    overallStatus:claims.some(x=>x.contradicts)?"contradictions_found":"human_source_review_required"};
};
let reconcileComparableEvidence;
try {
  Module._load=function(request,parent,isMain){
    if(request==="./sonara-research-comparable-top50.cjs")return {planComparableTop50:fakePlan};
    if(request==="./sonara-research-benchmark-gates.cjs")return {auditEvidencePacket:fakeAudit};
    return originalLoad.call(this,request,parent,isMain);
  };
  ({reconcileComparableEvidence}=require("../lib/sonara-research-evidence-reconciliation.cjs"));
} finally {
  Module._load = originalLoad;
  delete require.cache[fixtureModulePath];
  if (cachedRealModule) require.cache[fixtureModulePath] = cachedRealModule;
}
const receipt=(n,stance="supports",sourceUrl="https://example.org/source")=>({
  entityId:`org_${n}`,evidenceId:`evidence_${n}`,sourceUrl,stance,observedAt:"2026-10-01"});
const make=(n=50)=>Array.from({length:n},(_,i)=>receipt(i));
describe("SONARA sonara-research-evidence-reconciliation", () => {
it("no evidence never gets a reviewer or source approval",()=>{
 const x=reconcileComparableEvidence({comparison:comparison(),receipts:[]});
 assert.equal(x.supportedMeasurements,0);assert.equal(x.unsupportedMeasurements,50);
 assert.equal(x.rankingVerified,false);assert.equal(x.productionAuthorized,false);
 assert.ok(x.blockers.includes("measurements_missing_supporting_receipts"));
});
it("all matched receipts remain unverified and not licensed",()=>{
 const x=reconcileComparableEvidence({comparison:comparison(),receipts:make()});
 assert.equal(x.supportedMeasurements,50);assert.equal(x.acceptedSourceReceipts,50);
 assert.equal(x.evidenceIndependentlyVerified,false);assert.equal(x.publisherRightsVerified,false);
 assert.equal(x.publicationAuthorized,false);
});
it("unexpected personal fields are rejected and never echoed",()=>{
 const receipts=make();receipts[0]={...receipts[0],customerEmail:"secret@example.com"};
 const x=reconcileComparableEvidence({comparison:comparison(),receipts});
 assert.equal(x.malformedOrUnmatchedReceipts,1);
 assert.equal(x.supportedMeasurements,49);
 assert.equal(JSON.stringify(x).includes("secret@example.com"),false);
});
it("unmatched entity and fake evidence id fail closed",()=>{
 const x=reconcileComparableEvidence({comparison:comparison(),receipts:[{...receipt(0),evidenceId:"fabricated"},receipt(999)]});
 assert.equal(x.malformedOrUnmatchedReceipts,2);assert.equal(x.acceptedSourceReceipts,0);
});
it("two sources that contradict one entity are flagged",()=>{
 const list=[...make(),receipt(0,"contradicts","https://different.example/other")];
 const x=reconcileComparableEvidence({comparison:comparison(),receipts:list});
 assert.equal(x.contradictedMeasurements,1);
 assert.ok(x.blockers.includes("contradictions_found"));
});
it("reusing source evidence identifier across entities is flagged",()=>{
 const c=comparison();c.observations[1].evidenceId=c.observations[0].evidenceId;
 const x=reconcileComparableEvidence({comparison:c,receipts:[]});
 assert.equal(x.reusedEvidenceIdentifierCount,1);
 assert.ok(x.blockers.includes("evidence_identifier_reused_across_entities"));
});
it("receipt array size and maxAgeDays are bounded",()=>{
 assert.throws(()=>reconcileComparableEvidence({comparison:comparison(),receipts:Array(501).fill(receipt(0))}),/at most 500/);
 assert.throws(()=>reconcileComparableEvidence({comparison:comparison(),receipts:[],maxAgeDays:1000}),/between 0 and 365/);
});
it("cutoff tie is an explicit blocker and reviewer authority stays false",()=>{
 const c=comparison();c.observations.push(fakeObservation(50));
 const x=reconcileComparableEvidence({comparison:c,receipts:make()});
 assert.ok(x.blockers.includes("cutoff_tie_unresolved"));
 assert.equal(x.candidateCount,0);
 assert.equal(x.reviewerIdentityAuthenticated,false);
 assert.equal(x.customerDecisionAuthorized,false);
});

});
