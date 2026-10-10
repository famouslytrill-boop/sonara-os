// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Bounded, deterministic editorial previews. Content remains user-authored.
// No language model, external scanning, legal ruling, destination lookup,
// website publishing, copyright registry query, or background job.
const { buildStoryboard } = require("./sonara-storyboard-tool.cjs");

const KINDS = Object.freeze(["note", "blog", "storyboard", "vlog", "gaming", "travel"]);
const RIGHTS = Object.freeze(["owned", "licensed", "permission", "public_domain_claimed", "unknown"]);
const SPELLING = Object.freeze({
  "teh": "the", "recieve": "receive", "recieved": "received",
  "definately": "definitely", "seperate": "separate",
  "occured": "occurred", "untill": "until", "adress": "address",
  "wich": "which", "becuase": "because", "alot": "a lot"
});
const PROMPTS = Object.freeze({
  note: ["Key idea", "Supporting information", "Follow-up or action"],
  blog: ["Opening", "Context and sources", "Main points", "Counterpoint or limitations", "Conclusion and next step"],
  storyboard: ["Hook", "Scene progression", "Audio and captions", "Final action"],
  vlog: ["Opening hook", "Location or subject", "B-roll and narration", "Audience takeaway", "End card"],
  gaming: ["Game and permission to show footage", "Opening moment", "Gameplay sequence", "Commentary and community rules", "Clip highlights and wrap-up"],
  travel: ["Destination and dates", "User-confirmed places to visit", "Travel logistics", "Travel-advisory and entry checks", "Budget and next action"]
});
const MAX_TEXT=12000;
function fail(code,message){return {ok:false,code,message};}
function inputText(value,max=MAX_TEXT) {
  return typeof value === "string" && value.length <= max ? value.trim() : null;
}
function boundedArray(value,limit,key) {
  if(value === undefined || value === null) return [];
  if(!Array.isArray(value) || value.length>limit) throw new Error("invalid_" + key);
  return value;
}
function wordCount(value) {
  return (value.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)||[]).length;
}
function normalizeText(value) {
  return (value.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu)||[]);
}
function editorialSuggestions(text,language="en") {
  if(language!=="en") return {supported:false,language,issues:[],note:"English-only bounded rule checker; no assessment of other languages."};
  const issues=[];
  const add=(kind,start,end,suggestion)=> {
    if(issues.length<50) issues.push({kind,start,end,original:text.slice(start,end),suggestion});
  };
  const re=/\b(?:teh|recieve|recieved|definately|seperate|occured|untill|adress|wich|becuase|alot)\b/gi;
  for(const m of text.matchAll(re))add("possible_spelling",m.index,m.index+m[0].length,SPELLING[m[0].toLowerCase()]);
  const duplicate=/\b([\p{L}]+)(\s+)\1\b/giu;
  for(const m of text.matchAll(duplicate))add("repeated_word",m.index,m.index+m[0].length,m[1]);
  const spaces=/ {2,}/g;
  for(const m of text.matchAll(spaces))add("extra_spaces",m.index,m.index+m[0].length," ");
  const punctuation=/[!?.,]{3,}/g;
  for(const m of text.matchAll(punctuation))add("repeated_punctuation",m.index,m.index+m[0].length,m[0][0]);
  issues.sort((a,b)=>a.start-b.start||a.end-b.end);
  return {supported:true,language,issues,note:"Limited rule suggestions only; not comprehensive proofreading. Changes require human approval."};
}
function overlapSignals(text,comparisonText) {
  const reference=inputText(comparisonText,MAX_TEXT);
  if(reference===null)return {ok:false,code:"invalid_reference_text"};
  const tokens=normalizeText(text),refs=normalizeText(reference);
  const referenceNgrams=new Set();
  for(let i=0;i+5<=refs.length;i++)referenceNgrams.add(refs.slice(i,i+5).join(" "));
  let matches=0;
  for(let i=0;i+5<=tokens.length;i++)if(referenceNgrams.has(tokens.slice(i,i+5).join(" ")))matches++;
  return {ok:true,comparisonSupplied:reference.length>0,exactFiveTokenMatches:matches,
    note:"Matches only supplied comparison text. Does not search the internet or decide plagiarism, copyright ownership, substantial similarity, infringement or fair use."};
}
function rightsChecklist(value,kind) {
  const assets=boundedArray(value,20,"assets");
  const entries=assets.map((raw,index)=>{
    if(!raw || typeof raw!=="object" || Array.isArray(raw))throw new Error("invalid_asset");
    const label=inputText(raw.name,160),status=raw.status;
    const evidence=inputText(raw.evidence||"",500);
    if(!label||!RIGHTS.includes(status)||evidence===null)throw new Error("invalid_asset");
    const blockers=[];
    if(status==="unknown")blockers.push("Permission or provenance unknown");
    if(status!=="unknown"&&!evidence)blockers.push("Ownership/licence evidence not provided");
    if(status==="public_domain_claimed")blockers.push("Public-domain status and jurisdiction require independent review");
    return {index,name:label,status,evidenceProvided:!!evidence,needsManualReview:true,blockers};
  });
  const focus={
    gaming:"Review game publisher gameplay/streaming terms, soundtrack licences, branding and third-party clips.",
    vlog:"Review music, recognizable people, private locations and third-party media.",
    storyboard:"Review music, recognizable people, third-party images and reference frames.",
    travel:"Review photos, maps, music and venue filming permissions.",
    blog:"Review illustrations, quotations, photographs and embeds.",
    note:"Keep private notes private; verify third-party material before publication."
  }[kind];
  return {status:entries.some(x=>x.blockers.length)?"evidence_missing":"manual_rights_review_required",
    assets:entries,focus,
    disclaimer:"Rights inventory only. No content-fingerprint registry, infringement detection, legal clearance, copyright ownership guarantee or fair-use judgment."};
}
function dateValue(raw,key) {
  if(typeof raw!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new Error("invalid_"+key);
  const stamp=Date.parse(raw+"T00:00:00.000Z");
  if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==raw)throw new Error("invalid_"+key);
  return stamp;
}
function travelPlan(raw) {
  if(!raw || typeof raw!=="object"||Array.isArray(raw))throw new Error("invalid_travel");
  const destination=inputText(raw.destination,120),country=inputText(raw.country,120);
  if(!destination||!country)throw new Error("invalid_destination");
  const begin=dateValue(raw.startDate,"startDate"),end=dateValue(raw.endDate,"endDate");
  const days=(end-begin)/86400000+1;
  if(days<1||days>60)throw new Error("invalid_date_range");
  const stops=boundedArray(raw.stops,20,"stops").map(v=>{
    const t=inputText(v,150);if(!t)throw new Error("invalid_stop");return t;
  });
  const currency=inputText(raw.currency,3);
  if(!currency||!/^[A-Z]{3}$/.test(currency))throw new Error("invalid_currency");
  const buckets=boundedArray(raw.budget,12,"budget").map(v=>{
    if(!v || typeof v!=="object" || Array.isArray(v))throw new Error("invalid_budget");
    const category=inputText(v.category,80);
    if(!category||typeof v.amount!=="number"||!Number.isFinite(v.amount)||v.amount<0||v.amount>10000000)throw new Error("invalid_budget");
    return {category,amount:v.amount};
  });
  const total=buckets.reduce((sum,x)=>sum+x.amount,0);
  return {destination,country,startDate:raw.startDate,endDate:raw.endDate,days,
    userSuppliedStops:stops,budget:{currency,items:buckets,total},
    advisory:{checked:false,level:null,checkedAt:null,
      checkOfficialSource:"https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html",
      note:"Live advisories, entry/visa rules, operating hours, reservations, transport times and prices were not checked. Verify before travel."},
    note:"These places and cost figures come from the user, not a live travel provider. No itinerary routing or bookings."};
}
function draft(input) {
  if(!input||typeof input!=="object"||Array.isArray(input))return fail("invalid_input","Expected a JSON object");
  const kind=input.kind,title=inputText(input.title,160),body=inputText(input.body||"",MAX_TEXT);
  const language=inputText(input.language||"en",12);
  if(!KINDS.includes(kind))return fail("unsupported_kind","Choose a supported editorial format");
  if(!title||body===null||!language)return fail("invalid_text","Title and bounded writing text are required");
  if(body.length===0&&kind!=="travel"&&kind!=="storyboard")return fail("missing_text","Enter your own words or notes first");
  const topic=inputText(input.topic||"",240);
  if(topic===null)return fail("invalid_topic","Topic is too long");
  const platform=inputText(input.platform||"",80),style=inputText(input.style||"",160);
  if(platform===null||style===null)return fail("invalid_media_fields","Platform or style field exceeds its limit");
  if(input.sceneCount!==undefined && input.sceneCount!==null && input.sceneCount!==""){
    if(typeof input.sceneCount!=="number" || !Number.isInteger(input.sceneCount) ||
       input.sceneCount<3 || input.sceneCount>8) return fail("invalid_scene_count","Shot count must be an integer from 3 to 8");
  }
  let assets,plan,storyboard,comparison;
  try {
    assets=rightsChecklist(input.assets,kind);
    if(kind==="travel")plan=travelPlan(input.travel);
    if(kind==="storyboard"||kind==="vlog"||kind==="gaming") {
      const seconds=input.durationSeconds;
      if(kind==="storyboard" && (seconds===undefined||seconds===null||seconds===""))
        return fail("missing_runtime","Storyboards need an explicit runtime in whole seconds");
      if(typeof seconds==="number" && Number.isInteger(seconds) && seconds>=3 && seconds<=1800) {
        const result=buildStoryboard({
          videoIdea:topic||title,durationSeconds:String(seconds),
          sceneCount:String(input.sceneCount??8),
          platform,style
        });
        if(result.couldNotCalculate)return fail("invalid_storyboard",result.couldNotCalculate);
        storyboard={runtime:result.runtime,shotList:result.shotList,
          durationsAddUp:result.durationsAddUp,rights:result.rights,shortestShot:result.shortestShot};
      } else if(seconds!==undefined && seconds!==null && seconds!=="")return fail("invalid_runtime","Runtime must be 3–1,800 whole seconds");
    }
    if(input.comparisonText!==undefined){
      comparison=overlapSignals(body,input.comparisonText);
      if(!comparison.ok)return fail(comparison.code,"Comparison text must be a bounded string");
    }
  } catch(err) {
    if(typeof err.message==="string"&&/^invalid_/.test(err.message))return fail(err.message,"Invalid structured editorial input");
    throw err;
  }
  const suggestions=editorialSuggestions(body,language);
  const sections=PROMPTS[kind].map((heading,index)=>({index,heading,prompt:"User to write or approve this section"}));
  return {ok:true,status:"draft",version:1,kind,title,language,topic:topic||title,
    body,formatSections:sections,
    metrics:{wordCount:wordCount(body),characterCount:[...body].length,estimatedReadingMinutes:body?Math.ceil(wordCount(body)/200):0},
    proofreading:suggestions,rightsReview:assets,
    ...(comparison?{comparison}:{}),...(storyboard?{storyboard}:{}),
    ...(plan?{travel:plan}:{}),
    publication:{status:"not_published",requiresHumanApproval:true,
      note:"No posts, copyright complaints, game streams, bookings or external calls were made."}};
}
module.exports={KINDS,RIGHTS,draft,editorialSuggestions,overlapSignals,travelPlan,wordCount};
