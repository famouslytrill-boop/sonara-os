"use strict";
const assert=require("node:assert/strict");
const {planComparableTop50,MEASURES}=require("../lib/sonara-research-comparable-top50.cjs");
const make=(n=50,mutate=(x)=>x)=>Array.from({length:n},(_,i)=>mutate({
  entityId:"firm_"+String(i+1).padStart(3,"0"), value:i+1,
  metric:"annual_revenue",unit:"usd",period:"2025",geography:"US",
  evidenceId:"filing_"+String(i+1), observedAt:"2026-10-01"
}));
const base=(override={})=>({categoryId:"us_restaurants",metric:"annual_revenue",unit:"usd",
  period:"2025",geography:"US",reviewedAt:"2026-10-09",observations:make(),...override});
describe("SONARA comparable Top 50 research candidates",()=>{
  it("produces a draft 50 only from sufficient comparable observations",()=>{
    const r=planComparableTop50(base());
    assert.equal(r.candidateTop50.length,50);assert.equal(r.candidateTop50[0].value,50);
    assert.equal(r.candidateTop50[0].rank,1);assert.equal(r.rankingVerified,false);
    assert.equal(r.officialPublisherRanking,false);assert.equal(r.publicationAuthorized,false);
  });
  it("withholds a top 50 when population is too small",()=>{
    const r=planComparableTop50(base({observations:make(49)}));
    assert.equal(r.candidateTop50.length,0);assert.ok(r.blockers.includes("population_below_50"));
  });
  it("reports a tie across the fiftieth threshold",()=>{
    const rows=make(51).map(x=>({...x,value:x.value===1?2:x.value}));
    const r=planComparableTop50(base({observations:rows}));
    assert.equal(r.cutoffTieRequiresReview,true);
    assert.ok(r.blockers.includes("rank_50_cutoff_tie_requires_review"));
  });
  it("keeps competition rank positions consistent with numeric ties",()=>{
    const rows=make().map(x=>({...x,value:x.value===50?49:x.value}));
    const r=planComparableTop50(base({observations:rows}));
    assert.equal(r.candidateTop50[0].rank,1);assert.equal(r.candidateTop50[1].rank,1);
    assert.equal(r.candidateTop50[2].rank,3);
  });
  it("prohibits replacing official Fortune and Forbes ranking methodologies",()=>{
    assert.throws(()=>planComparableTop50(base({categoryId:"us_revenue_companies"})),/Official publisher/);
    assert.throws(()=>planComparableTop50(base({categoryId:"realtime_billionaires",geography:"GLOBAL"})),/Official publisher/);
  });
  it("rejects cross-currency, period, geography or metric contamination",()=>{
    for(const changes of [
      {unit:"eur"},{period:"2024"},{geography:"EUROPE"},{metric:"patent_count"}]){
      const records=make(50,(x)=>x);
      records[12]={...records[12],...changes};
      assert.throws(()=>planComparableTop50(base({observations:records})),/incomparable/);
    }
  });
  it("rejects future reporting periods and incomplete annual years",()=>{
    assert.throws(()=>planComparableTop50(base({period:"2027"})),/Reporting year/);
    assert.throws(()=>planComparableTop50(base({period:"2026"})),/annual period/);
    const currentYear=make(50,x=>({...x,metric:"employee_count",unit:"persons",period:"2026"}));
    const plan=planComparableTop50(base({metric:"employee_count",unit:"persons",period:"2026",observations:currentYear}));
    assert.equal(plan.sourceVerified,false);
    assert.equal(plan.productionAuthorized,false);
  });
  it("rejects duplicate identities and private extra fields",()=>{
    const records=make();records[2]={...records[2],entityId:records[1].entityId};
    assert.throws(()=>planComparableTop50(base({observations:records})),/index 2/);
    const withEmail=make();withEmail[1]={...withEmail[1],email:"private@example.org"};
    assert.throws(()=>planComparableTop50(base({observations:withEmail})),/index 1/);
  });
  it("rejects future, impossible and malformed observation dates",()=>{
    for(const date of ["2026-13-01","2026-02-30","2026-11-01"]){
      const records=make();records[0]={...records[0],observedAt:date};
      assert.throws(()=>planComparableTop50(base({observations:records})),/index 0/);
    }
  });
  it("rejects infinite, negative, over-range, and inappropriate ratio measures",()=>{
    for(const v of [NaN,Infinity,-3,1e16]){
      const records=make();records[0]={...records[0],value:v};
      assert.throws(()=>planComparableTop50(base({observations:records})),/index 0/);
    }
    const ratio=make(50,x=>({...x,metric:"delivery_on_time_rate",unit:"fraction",value:1.01}));
    assert.throws(()=>planComparableTop50(base({metric:"delivery_on_time_rate",unit:"fraction",observations:ratio})),/index 0/);
  });
  it("requires appropriate metric units and category types",()=>{
    assert.throws(()=>planComparableTop50(base({unit:"kg"})),/Incompatible/);
    assert.throws(()=>planComparableTop50(base({categoryId:"global_scientists",geography:"GLOBAL"})),/Metric is not/);
    assert.throws(()=>planComparableTop50(base({direction:"sideways"})),/Sort direction/);
  });
  it("performs ascending cost ordering without mutating input objects",()=>{
    const o=base({direction:"ascending"}),original=o.observations.map(x=>x.entityId);
    const r=planComparableTop50(o);
    assert.equal(r.candidateTop50[0].value,1);
    assert.deepEqual(o.observations.map(x=>x.entityId),original);
  });
  it("marks small business eligibility and regulated-domain restrictions",()=>{
    const a=planComparableTop50(base({categoryId:"us_small_businesses"}));
    assert.ok(a.blockers.includes("sba_industry_size_eligibility_unverified"));
    const list=make(50,x=>({...x,metric:"annual_revenue"}));
    const b=planComparableTop50(base({categoryId:"us_hedge_funds",observations:list}));
    assert.ok(b.blockers.includes("regulated_specialist_review_required"));
  });
  it("disallows invented request fields and excess samples",()=>{
    assert.throws(()=>planComparableTop50(base({token:"SECRET"})),/Unexpected comparison request/);
    assert.throws(()=>planComparableTop50(base({observations:make(501)})),/at most 500/);
    assert.equal(Object.keys(MEASURES).length,10);
  });
});
