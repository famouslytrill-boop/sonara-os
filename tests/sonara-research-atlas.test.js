"use strict";
const assert=require("node:assert/strict");
const {REFERENCES,ATLAS,listResearchAtlas,planTop50Research,inspectPublishedTop50,summarizeCohortDistribution,getAtlasCoverage}=require("../lib/sonara-research-atlas.cjs");
const {SOURCES}=require("../lib/sonara-research-benchmark-gates.cjs");
describe("SONARA 50-category Research Atlas",()=>{
  it("defines 50 distinct research populations but zero verified rankings",()=>{
    assert.equal(ATLAS.length,50);assert.equal(new Set(ATLAS.map(x=>x.id)).size,50);
    assert.equal(getAtlasCoverage().verifiedLists,0);assert.equal(getAtlasCoverage().verifiedEntityRows,0);
  });
  it("distinguishes four actual publisher list sources from 46 contextual cohorts",()=>{
    assert.equal(getAtlasCoverage().publisherRankingCategories,4);
    assert.equal(getAtlasCoverage().customBenchmarkCategories,46);
  });
  it("does not treat an SBA business-size dataset as top businesses",()=>{
    const p=planTop50Research("us_small_businesses");assert.equal(p.reference.role,"context_only");
    assert.equal(p.entries.length,0);assert.equal(p.rankingValid,false);assert.equal(p.productionAuthorized,false);
  });
  it("supports bounded product and type filters",()=>{
    assert.ok(listResearchAtlas({kind:"individual"}).some(x=>x.id==="global_scientists"));
    assert.ok(listResearchAtlas({product:"creator_studio"}).some(x=>x.id==="us_music_companies"));
    assert.throws(()=>listResearchAtlas({secret:true}),/filters/);
    assert.throws(()=>listResearchAtlas({kind:"unknown"}),/Unknown kind/);
  });
  it("uses population-relevant regulatory/rights context without presenting it as a ranking",()=>{
    assert.equal(planTop50Research("us_painters").reference.id,"copyright_basics");
    assert.equal(planTop50Research("us_philanthropies").reference.id,"irs_990");
    assert.equal(planTop50Research("us_law_firms").reference.id,"aba_directory");
    for(const id of ["us_painters","us_philanthropies","us_law_firms"])
      assert.equal(planTop50Research(id).reference.role,"context_only");
  });
  it("all references default deny auto ingest, republish and cohort verification",()=>{
    assert.equal(Object.keys(REFERENCES).length,15);
    for(const x of Object.values(REFERENCES)){
      assert.ok(x.url.startsWith("https://"));assert.equal(x.ingestionAllowed,false);
      assert.equal(x.republicationRightsCleared,false);assert.equal(x.verifiedForThisCohort,false);
    }
  });
  it("reuses canonical ranking gate to reject incomplete top 50",()=>{
    const r=inspectPublishedTop50({categoryId:"us_revenue_companies",observedAt:"2026-10-09",checkedAt:"2026-10-09",
      records:[{rank:1,name:"Amazon",sourceUrl:SOURCES.us_revenue_2026.url}]});
    assert.equal(r.missingRanks.length,49);assert.equal(r.independentlyVerified,false);
  });
  it("even 50 input entries never count as verified or licensed",()=>{
    const records=Array.from({length:50},(_,i)=>({rank:i+1,name:"Sample "+(i+1),sourceUrl:SOURCES.europe_revenue_2026.url}));
    const r=inspectPublishedTop50({categoryId:"europe_revenue_companies",observedAt:"2026-10-09",checkedAt:"2026-10-09",records});
    assert.equal(r.completeTranscription,true);assert.equal(r.independentlyVerified,false);assert.equal(r.rightsCleared,false);
  });
  it("blocks fabricated official rankings for artists scientists hedge funds restaurants",()=>{
    for(const id of ["us_musicians","global_scientists","us_hedge_funds","us_restaurants"])
      assert.throws(()=>inspectPublishedTop50({categoryId:id,records:[],observedAt:"2026-10-09",checkedAt:"2026-10-09"}),/no registered authoritative/);
  });
  it("models a bounded exploratory cohort using explicit units and quartiles",()=>{
    const r=summarizeCohortDistribution({categoryId:"us_restaurants",values:[2,4,6,8,10],unit:"usd",period:"2026"});
    assert.equal(r.minimum,2);assert.equal(r.q1,4);assert.equal(r.median,6);
    assert.equal(r.q3,8);assert.equal(r.maximum,10);assert.equal(r.sampleSize,5);
    assert.equal(r.independentRanking,false);assert.equal(r.productionAuthorized,false);
  });
  it("rejects mixed or malformed measure inputs rather than inventing statistics",()=>{
    const base={categoryId:"us_restaurants",values:[1,2,3,4,5],unit:"usd",period:"2026"};
    assert.throws(()=>summarizeCohortDistribution({...base,values:[1,2,3,4,NaN]}),/5 to 50/);
    assert.throws(()=>summarizeCohortDistribution({...base,values:[1,2,3,4,-5]}),/5 to 50/);
    assert.throws(()=>summarizeCohortDistribution({...base,unit:"USD $"}),/unit/);
    assert.throws(()=>summarizeCohortDistribution({...base,period:"last year"}),/period/);
    assert.throws(()=>summarizeCohortDistribution({...base,values:Array(51).fill(1)}),/5 to 50/);
  });
  it("unknown categories and dangerous inherited IDs fail closed",()=>{
    assert.throws(()=>planTop50Research("__proto__"),/Unknown research population/);
    assert.equal(getAtlasCoverage().productionAuthorized,false);
  });
});
