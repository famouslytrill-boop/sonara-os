"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");
const originalLoad = Module._load;
const fixturePlan = comparison => ({
  categoryId: comparison.categoryId, unit: comparison.unit, metric: comparison.metric,
  direction: comparison.direction || "descending", geography: comparison.geography,
  period: comparison.period, blockers: ["publisher_rights_unverified"]
});
let analyze;
try {
  Module._load = function(request, parent, isMain) {
    if (request === "./sonara-research-comparable-top50.cjs") return { planComparableTop50: fixturePlan };
    return originalLoad.call(this, request, parent, isMain);
  };
  ({ assessTop50RankSensitivity: analyze } = require("./sonara-research-rank-sensitivity.cjs"));
} finally { Module._load = originalLoad; }
const rows = n => Array.from({ length: n }, (_, i) => ({
  entityId: "company_" + String(i+1).padStart(3,"0"), value: i+1,
  evidenceId: "source_" + (i+1)
}));
const comparison = (n=51, extras={}) => ({
  categoryId: "us_restaurants", unit: "usd", metric: "annual_revenue",
  period: "2025", geography: "US", direction: "descending",
  observations: rows(n), ...extras
});
const intervals = (c, widen=()=>[0,0]) => c.observations.map((row,i) => {
  const [minus,plus] = widen(i,row);
  return { entityId: row.entityId, evidenceId: row.evidenceId,
    lower: row.value-minus, upper: row.value+plus,
    intervalType: "scenario_bounds" };
});
test("exact disjoint measurements classify 50 inside and 1 outside", () => {
  const c = comparison(); const x = analyze({comparison:c,intervals:intervals(c)});
  assert.equal(x.withinSampleTop50Count,50); assert.equal(x.outsideSampleTop50Count,1);
  assert.equal(x.ambiguousBoundaryCount,0);
  assert.equal(x.entities[0].bestPossibleRank,1);
  assert.equal(x.entities[0].worstPossibleRank,1);
  assert.equal(x.rankingVerified,false); assert.equal(x.productionAuthorized,false);
});
test("interval overlap around cutoff marks both involved rankings ambiguous", () => {
  const c = comparison();
  const x=analyze({comparison:c,intervals:intervals(c,(i)=>i<3?[0,2]:[0,0])});
  assert.ok(x.ambiguousBoundaryCount>=2);
  assert.ok(x.blockers.includes("uncertainty_overlaps_top50_cutoff"));
});
test("ambiguous intervals never claim a confidence level",()=>{
  const c=comparison(); const x=analyze({comparison:c,intervals:intervals(c)});
  assert.match(x.interpretation,/not a probabilistic confidence interval/);
  assert.equal(x.uncertaintyMethodValidated,false);
  assert.equal(x.sourceIntervalsAuthenticated,false);
});
test("ascending intervals reverse rank priority and preserve exact bounds",()=>{
  const c=comparison(51,{direction:"ascending"});
  const x=analyze({comparison:c,intervals:intervals(c)});
  assert.equal(x.entities[0].observedValue,1);
  assert.equal(x.entities[0].bestPossibleRank,1);
  assert.equal(x.withinSampleTop50Count,50);
});
test("requires exact one-to-one evidence and excludes private extra fields",()=>{
  const c=comparison(); const input=intervals(c);
  input[1]={...input[1],email:"hidden@example.com"};
  assert.throws(()=>analyze({comparison:c,intervals:input}),/index 1/);
  const absent=intervals(c).slice(1);
  assert.throws(()=>analyze({comparison:c,intervals:absent}),/Exactly one/);
  const duplicate=intervals(c);duplicate[5]={...duplicate[5],entityId:duplicate[3].entityId};
  assert.throws(()=>analyze({comparison:c,intervals:duplicate}),/index 5/);
});
test("rejects finite errors, reversed bounds, missing source link and point outside interval",()=>{
  const c=comparison();
  for(const modified of [{lower:-1},{lower:3,upper:1},{upper:Infinity},{evidenceId:"wrong"},{lower:2,upper:3}]){
    const inputs=intervals(c);inputs[0]={...inputs[0],...modified};
    assert.throws(()=>analyze({comparison:c,intervals:inputs}),/index 0/);
  }
});
test("count metrics require integer bounds and fractions remain in [0,1]",()=>{
  const people=comparison(51,{unit:"persons",metric:"employee_count"});
  const p=intervals(people);p[1].lower=1.5;
  assert.throws(()=>analyze({comparison:people,intervals:p}),/index 1/);
  const ratios=comparison(51,{unit:"fraction",metric:"gross_margin_rate",
    observations:rows(51).map((r,i)=>({...r,value:i/100}))});
  const q=intervals(ratios);q[0].upper=2;
  assert.throws(()=>analyze({comparison:ratios,intervals:q}),/index 0/);
});
test("50-record sample does not establish whether any unobserved entity outranks them",()=>{
  const c=comparison(50); const x=analyze({comparison:c,intervals:intervals(c)});
  assert.ok(x.blockers.includes("only_50_observed_no_exclusion_test"));
  assert.equal(x.sampleRepresentative,false);
  assert.equal(x.publicationAuthorized,false);
});
test("comparison validator is invoked before consuming intervals",()=>{
  const c=comparison(); const x=analyze({comparison:c,intervals:intervals(c)});
  assert.ok(x.blockers.includes("publisher_rights_unverified"));
});
