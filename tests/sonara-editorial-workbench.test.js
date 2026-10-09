"use strict";

const assert=require("node:assert/strict");
const { KINDS, draft, editorialSuggestions, overlapSignals, travelPlan, wordCount }=
  require("../lib/sonara-editorial-workbench.cjs");

const input=(kind="note",extra={})=>({kind,title:"Planning journal",body:"Teh first first idea  matters.",language:"en",...extra});
const success=(value)=>{assert.equal(value.ok,true,JSON.stringify(value));return value};
const refusal=(value,code)=>{assert.equal(value.ok,false,JSON.stringify(value));assert.equal(value.code,code)};

describe("SONARA bounded editorial workbench",()=>{
  it("supports exactly six creator formats without inventing a story",()=>{
    assert.deepEqual(KINDS,["note","blog","storyboard","vlog","gaming","travel"]);
    for(const kind of KINDS.filter(x=>x!=="travel")){
      const out=success(draft(input(kind)));
      assert.equal(out.title,"Planning journal");
      assert.equal(out.body,"Teh first first idea  matters.");
      assert.equal(out.publication.status,"not_published");
      assert.equal(out.publication.requiresHumanApproval,true);
      assert.ok(out.formatSections.length>=3);
    }
  });
  it("counts words and provides explicit English-only proofreading suggestions",()=>{
    assert.equal(wordCount("Hello it's nice"),3);
    const out=success(draft(input()));
    assert.ok(out.proofreading.issues.some(v=>v.kind==="possible_spelling"&&v.suggestion==="the"));
    assert.ok(out.proofreading.issues.some(v=>v.kind==="repeated_word"&&v.suggestion.toLowerCase()==="first"));
    assert.ok(out.proofreading.issues.some(v=>v.kind==="extra_spaces"));
    assert.equal(out.proofreading.note.includes("not comprehensive"),true);
  });
  it("never rewrites user text automatically",()=>{
    const text="I recieve alot of notes.";
    const out=success(draft(input("note",{body:text})));
    assert.equal(out.body,text);
    assert.ok(out.proofreading.issues.some(v=>v.suggestion==="receive"));
    assert.ok(out.proofreading.issues.some(v=>v.suggestion==="a lot"));
  });
  it("does not claim comprehensive grammar support across languages",()=>{
    const result=success(draft(input("blog",{body:"Bonjour tout le monde",language:"fr"})));
    assert.equal(result.proofreading.supported,false);
    assert.deepEqual(result.proofreading.issues,[]);
  });
  it("uses existing storyboard runtime arithmetic rather than guessing shot seconds",()=>{
    const out=success(draft(input("storyboard",{topic:"Behind the scenes",durationSeconds:30,sceneCount:8})));
    assert.ok(out.storyboard);
    assert.match(out.storyboard.durationsAddUp,/total 30 seconds/);
    const segments=out.storyboard.shotList.split("  ||  ").map(v=>Number(v.match(/— (\d+)s/)[1]));
    assert.equal(segments.reduce((s,v)=>s+v,0),30);
  });
  it("supports vlogs and gaming briefs without gaming publisher permission claims",()=>{
    const vlog=success(draft(input("vlog",{durationSeconds:60,topic:"Weekend travel vlog"})));
    assert.match(vlog.rightsReview.focus,/music/);
    assert.ok(vlog.storyboard);
    const gamer=success(draft(input("gaming",{topic:"Game recap",platform:"YouTube"})));
    assert.match(gamer.rightsReview.focus,/publisher/);
    assert.equal(gamer.storyboard,undefined);
  });
  it("requires assets to disclose missing licences and never clears copyright",()=>{
    const rights=[{name:"Track A",status:"unknown",evidence:""},
      {name:"My photo",status:"owned",evidence:"original capture notes"}];
    const out=success(draft(input("blog",{assets:rights})));
    assert.equal(out.rightsReview.status,"evidence_missing");
    assert.equal(out.rightsReview.assets[0].blockers.length>0,true);
    assert.equal(out.rightsReview.assets[1].needsManualReview,true);
    assert.match(out.rightsReview.disclaimer,/No content-fingerprint registry/);
    const claimed=success(draft(input("blog",{assets:[{name:"Historic image",status:"public_domain_claimed",evidence:"source record"}]})));
    assert.ok(claimed.rightsReview.assets[0].blockers.some(x=>x.includes("jurisdiction")));
  });
  it("only compares user-supplied passages by explicit five-token phrase overlap",()=>{
    const text="The long journey begins with a quiet morning in town.";
    const one=success(draft(input("blog",{body:text,comparisonText:"I wrote: the long journey begins with a quiet morning"})));
    assert.ok(one.comparison.exactFiveTokenMatches>=1);
    assert.equal(one.comparison.comparisonSupplied,true);
    assert.match(one.comparison.note,/Does not search the internet/);
    const two=overlapSignals(text,"Nothing related to that script");
    assert.equal(two.exactFiveTokenMatches,0);
  });
  it("builds a destination budget from user inputs without live advisory claims",()=>{
    const out=success(draft(input("travel",{body:"Pack light.",travel:{
      destination:"Lisbon",country:"Portugal",startDate:"2026-11-02",endDate:"2026-11-04",
      currency:"USD",stops:["Museum","Food market"],budget:[{category:"Hotel",amount:200},{category:"Train",amount:50}]
    }})));
    assert.equal(out.travel.days,3);
    assert.equal(out.travel.budget.total,250);
    assert.deepEqual(out.travel.userSuppliedStops,["Museum","Food market"]);
    assert.equal(out.travel.advisory.checked,false);
    assert.equal(out.travel.advisory.level,null);
    assert.equal(out.publication.status,"not_published");
  });
  it("refuses invalid travel day ranges, forged amounts and guessed destinations",()=>{
    const trip={destination:"City",country:"Country",startDate:"2026-03-04",endDate:"2026-03-03",currency:"USD"};
    refusal(draft(input("travel",{travel:trip})),"invalid_date_range");
    refusal(draft(input("travel",{travel:{...trip,startDate:"2026-02-30",endDate:"2026-03-03"}})),"invalid_startDate");
    refusal(draft(input("travel",{travel:{...trip,startDate:"2026-03-01",budget:[{category:"Train",amount:-5}]}})),"invalid_budget");
    refusal(draft(input("travel",{travel:{...trip,startDate:"2026-03-01",destination:""}})),"invalid_destination");
  });
  it("refuses oversized text, unknown draft kind and invalid evidence structures",()=>{
    refusal(draft(input("note",{title:"",body:"A"})),"invalid_text");
    refusal(draft(input("note",{body:"x".repeat(12001)})),"invalid_text");
    refusal(draft(input("audiobook")),"unsupported_kind");
    refusal(draft(input("blog",{assets:[{name:"Music",status:"copyright_free",evidence:"site"}]})),"invalid_asset");
    refusal(draft(input("note",{comparisonText:25})),"invalid_reference_text");
  });
  it("bounds storyboard duration and supports long notes without an agent call",()=>{
    refusal(draft(input("storyboard",{durationSeconds:1801})),"invalid_runtime");
    const long="One. ".repeat(800);
    const out=success(draft(input("note",{body:long})));
    assert.equal(out.metrics.wordCount,800);
    assert.equal(out.storyboard,undefined);
  });
  it("does not expose reference comparison text in returned notes",()=>{
    const secret="private source paragraph only for review";
    const out=success(draft(input("blog",{comparisonText:secret})));
    assert.equal(JSON.stringify(out).includes(secret),false);
    assert.equal(out.comparison.comparisonSupplied,true);
  });
});
