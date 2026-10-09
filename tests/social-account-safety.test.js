// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const safety = require("../lib/sonara-social-account-safety.cjs");
const register = require("../routes/sonara-social-account-safety-routes.cjs");

const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const NONCE="33333333-3333-4333-8333-333333333333";

describe("social account privacy and default-off preflight",()=>{
  const env=(key)=>({
    SONARA_SOCIAL_USER_SAFETY_ENABLED:"true",
    NEXT_PUBLIC_SITE_URL:"https://sonaraindustries.com"
  })[key];
  it("is disabled unless the literal feature flag is true",()=>{
    assert.equal(safety.featureEnabled(()=>undefined),false);
    assert.equal(safety.featureEnabled(()=>"TRUE"),false);
    assert.equal(safety.featureEnabled(env),true);
  });
  it("rejects Host-header origin inference, invalid HTTPS settings and cross-origin writes",()=>{
    assert.equal(safety.canonicalOrigin(env),"https://sonaraindustries.com");
    for(const value of ["http://sonaraindustries.com",
      "https://someone:secret@sonaraindustries.com",
      "https://sonaraindustries.com/other",
      "https://sonaraindustries.com?other=true"]) {
      assert.equal(safety.canonicalOrigin(()=>value),"");
    }
    assert.equal(safety.sameOrigin({headers:{origin:"https://sonaraindustries.com"}},env),true);
    assert.equal(safety.sameOrigin({headers:{origin:"https://attacker.invalid"}},env),false);
    assert.equal(safety.sameOrigin({headers:{origin:"https://sonaraindustries.com",
      "sec-fetch-site":"cross-site"}},env),false);
    assert.equal(safety.sameOrigin({headers:{}},env),false);
  });
  it("validates report reason, server-safe input length and idempotency",()=>{
    const valid=safety.reportInput({reason:"harassment",detail:"Please investigate.",request_id:NONCE});
    assert.equal(valid.ok,true);
    assert.equal(safety.reportInput({reason:"not-a-reason",request_id:NONCE}).ok,false);
    assert.equal(safety.reportInput({reason:"spam",request_id:"123"}).ok,false);
    assert.equal(safety.reportInput({reason:"privacy",detail:"x".repeat(501),request_id:NONCE}).ok,false);
    assert.equal(safety.reportInput({reason:"spam",detail:"\u0000",request_id:NONCE}).ok,false);
  });
  it("never accepts forged or malformed identities and unknown action",()=>{
    assert.equal(safety.actionInput({actorId:A,profileId:B,action:"block"}).ok,true);
    assert.equal(safety.actionInput({actorId:"fake",profileId:B,action:"block"}).ok,false);
    assert.equal(safety.actionInput({actorId:A,profileId:"bad",action:"unblock"}).ok,false);
    assert.equal(safety.actionInput({actorId:A,profileId:B,action:"remove-all"}).ok,false);
    assert.equal(safety.stateInput("blocked_by_me"),"blocked_by_me");
    assert.equal(safety.stateInput("unexpected"),"unavailable");
  });
});

const middleware=(_req,_res,next)=>next();
function setup(enabled=true){
  const routes=new Map(),app={
    get:(p,...list)=>routes.set("GET "+p,list),
    post:(p,...list)=>routes.set("POST "+p,list)
  };
  register(app,{
    requireCustomer:middleware,
    createRateLimiter:()=>middleware,
    getEnv:(name)=>name==="SONARA_SOCIAL_USER_SAFETY_ENABLED"?(enabled?"true":"false")
      :name==="NEXT_PUBLIC_SITE_URL"?"https://sonaraindustries.com":null,
    getSupabaseServerConfig:()=>({ok:true,url:"https://database.invalid"}),
    supabaseHeaders:()=>({}),
    layout:({heading,body,sections=[]})=>[heading,body,...sections].join(" "),
    brandCard:(heading,body)=>heading+" "+body,
    linkAction:(link,text)=>text+" "+link,
    escapeHtml:(x)=>String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/"/g,"&quot;")
  });
  return routes;
}
function request(params={},body={},other={}){
  return {params,body,sonaraUser:{id:A},query:{},
    headers:{origin:"https://sonaraindustries.com"},...other};
}
function response(){
  return {statusCode:200,headers:{},
    status(code){this.statusCode=code;return this;},
    type(){return this;},send(data){this.body=data;return this;},
    json(data){this.body=data;return this;},
    setHeader(k,v){this.headers[k]=v;return this;},
    redirect(code,url){this.statusCode=code;this.redirectTo=url;return this;}
  };
}
async function invoke(routes,method,route,req){
  const handlers=routes.get(method+" "+route);
  assert.ok(handlers,"missing route "+method+" "+route);
  const res=response();
  for(const fn of handlers) await fn(req,res,()=>{});
  return res;
}
function stub(calls,value="blocked"){
  return async function(url,init={}){
    calls.push({url:String(url),method:init.method||"GET",payload:JSON.parse(init.body||"null")});
    return {ok:true,status:200,json:async()=>value};
  };
}
describe("person-level block and report routes with isolated persistence mock",()=>{
  let savedFetch;
  beforeEach(()=>{savedFetch=global.fetch;});
  afterEach(()=>{global.fetch=savedFetch;});

  it("keeps every new write disabled by default and performs no database request",async()=>{
    const calls=[];global.fetch=stub(calls);
    const res=await invoke(setup(false),"POST","/api/social/creator-profiles/:id/block",
      request({id:B}));
    assert.equal(res.statusCode,503);
    assert.equal(calls.length,0);
  });
  it("passes ONLY the verified session actor, never client actor metadata",async()=>{
    const calls=[];global.fetch=stub(calls);
    const res=await invoke(setup(),"POST","/api/social/creator-profiles/:id/block",
      request({id:B},{p_actor_user_id:B,actor_user_id:B}));
    assert.equal(res.statusCode,303);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url.endsWith("/rpc/sonara_social_profile_action"),true);
    assert.deepEqual(calls[0].payload,{
      p_actor_user_id:A,p_profile_id:B,p_action:"block",
      p_reason:null,p_detail:null,p_request_id:null
    });
  });
  it("requires a same-site request before executing the report",async()=>{
    const calls=[];global.fetch=stub(calls,"reported");
    const res=await invoke(setup(),"POST","/api/social/creator-profiles/:id/report",
      request({id:B},{reason:"spam",request_id:NONCE},
        {headers:{origin:"https://other.invalid"}}));
    assert.equal(res.statusCode,403);
    assert.equal(calls.length,0);
  });
  it("passes bounded report evidence and receipt key to the transactional RPC",async()=>{
    const calls=[];global.fetch=stub(calls,"reported");
    const res=await invoke(setup(),"POST","/api/social/creator-profiles/:id/report",
      request({id:B},{reason:"impersonation",detail:"Misleading profile",request_id:NONCE}));
    assert.equal(res.statusCode,303);
    assert.equal(calls[0].payload.p_request_id,NONCE);
    assert.equal(calls[0].payload.p_reason,"impersonation");
    assert.equal(calls[0].payload.p_detail,"Misleading profile");
  });
  it("does not mark denied, missing or rate-limited writes successful",async()=>{
    const calls=[];global.fetch=stub(calls,"denied");
    const denied=await invoke(setup(),"POST","/api/social/creator-profiles/:id/block",request({id:B}));
    assert.equal(denied.statusCode,404);
    global.fetch=stub(calls,"rate_limited");
    const limited=await invoke(setup(),"POST","/api/social/creator-profiles/:id/report",
      request({id:B},{reason:"spam",request_id:NONCE}));
    assert.equal(limited.statusCode,429);
  });
  it("returns 503 rather than a fake empty list if block persistence is unreadable",async()=>{
    const calls=[];global.fetch=stub(calls,null);
    const res=await invoke(setup(),"GET","/account/social-safety",request());
    assert.equal(res.statusCode,503);
    assert.equal(res.headers["Cache-Control"],"private, no-store");
  });
  it("shows only the user's own saved blocks with scoped unblock actions",async()=>{
    const calls=[];global.fetch=stub(calls,[{blocked_user_id:B,handle:"test-creator",name:"Creator"}]);
    const res=await invoke(setup(),"GET","/account/social-safety",request());
    assert.equal(res.statusCode,200);
    assert.match(res.body,/Creator/);
    assert.match(res.body,/\/api\/social\/blocked-users\/22222222-2222-4222-8222-222222222222\/unblock/);
    assert.equal(calls[0].payload.p_actor_user_id,A);
  });
});
describe("person-level SQL proposal static safety requirements",()=>{
  const source=fs.readFileSync(path.join(__dirname,"..","docs","sql-proposals",
    "2026-10-09-social-user-blocks-and-reports.sql"),"utf8");
  it("documents a draft, not a deployed migration",()=>{
    assert.match(source,/DESIGN PROPOSAL ONLY/);
    assert.match(source,/NOT APPLIED/);
  });
  it("enables RLS, denies direct access and keeps reports private",()=>{
    for(const table of ["sonara_social_user_blocks","sonara_social_profile_reports"]){
      assert.ok(source.includes("alter table public."+table+" enable row level security;"));
      assert.ok(source.includes("revoke all on public."+table+" from PUBLIC, anon, authenticated;"));
    }
  });
  it("blocks direct follower writes, removes existing follows and deduplicates reports",()=>{
    assert.match(source,/before insert on public.creator_follows/);
    assert.match(source,/delete from public.creator_follows/);
    assert.match(source,/unique \(reporter_user_id, request_id\)/);
    assert.match(source,/pg_advisory_xact_lock/);
    assert.doesNotMatch(source,/security definer/i);
  });
});

describe("independent moderator queue and decision controls (database stub)",()=>{
  let oldFetch;
  beforeEach(()=>{oldFetch=global.fetch;});
  afterEach(()=>{global.fetch=oldFetch;});

  it("requires explicit platform review grant, not ordinary account login",async()=>{
    const calls=[];
    global.fetch=stub(calls,{authorized:false,reports:[]});
    const res=await invoke(setup(),"GET","/owner/social-moderation",request());
    assert.equal(res.statusCode,403);
    assert.equal(calls[0].payload.p_reviewer_user_id,A);
  });
  it("shows verified staff only an allowlisted, escaped report queue",async()=>{
    const calls=[];
    global.fetch=stub(calls,{authorized:true,reports:[{
      id:NONCE,profile_id:B,reason:"harassment",state:"open",
      detail:"<script>evil()</script>",created_at:"2026-10-09T01:00:00Z"
    }]});
    const res=await invoke(setup(),"GET","/owner/social-moderation",request());
    assert.equal(res.statusCode,200);
    assert.match(res.body,/Platform moderation/);
    assert.doesNotMatch(res.body,/<script>/);
    assert.equal(res.headers["Cache-Control"],"private, no-store");
  });
  it("refuses unreadable moderation rows instead of a false empty queue",async()=>{
    const calls=[];
    global.fetch=stub(calls,{authorized:true,reports:[{id:"bad"}]});
    const res=await invoke(setup(),"GET","/owner/social-moderation",request());
    assert.equal(res.statusCode,503);
  });
  it("posts independent reviewer decisions only from session ID and same-origin",async()=>{
    const calls=[];
    global.fetch=stub(calls,"reviewed");
    const req=request({id:NONCE},
      {decision:"escalate",explanation:"Second investigation required.",p_reviewer_user_id:B});
    const res=await invoke(setup(),"POST",
      "/api/social/moderation/reports/:id/decision",req);
    assert.equal(res.statusCode,303);
    assert.deepEqual(calls[0].payload,{
      p_reviewer_user_id:A,p_report_id:NONCE,
      p_decision:"escalate",p_explanation:"Second investigation required."
    });
  });
  it("never executes an empty, invalid or cross-origin moderation decision",async()=>{
    const calls=[];global.fetch=stub(calls,"reviewed");
    const invalid=await invoke(setup(),"POST",
      "/api/social/moderation/reports/:id/decision",
      request({id:NONCE},{decision:"ban_all",explanation:"Because"}));
    assert.equal(invalid.statusCode,400);
    const forged=await invoke(setup(),"POST",
      "/api/social/moderation/reports/:id/decision",
      request({id:NONCE},{decision:"dismiss",explanation:"Reviewed"},
        {headers:{origin:"https://attacker.invalid"}}));
    assert.equal(forged.statusCode,403);
    assert.equal(calls.length,0);
  });
  it("rejects a reviewer denied by the database even if the UI says moderator",async()=>{
    const calls=[];global.fetch=stub(calls,"denied");
    const res=await invoke(setup(),"POST",
      "/api/social/moderation/reports/:id/decision",
      request({id:NONCE},{decision:"dismiss",explanation:"Reviewed"}));
    assert.equal(res.statusCode,403);
  });
});
describe("independent moderation SQL grant and audit contract",()=>{
  const source=fs.readFileSync(path.join(__dirname,"..","docs","sql-proposals",
    "2026-10-09-social-user-blocks-and-reports.sql"),"utf8");
  it("defaults reviewer grant to inactive and denies client writes",()=>{
    assert.match(source,/create table if not exists public\.sonara_social_moderator_grants/);
    assert.match(source,/active boolean not null default false/);
    assert.match(source,/revoke all on public\.sonara_social_moderator_grants from PUBLIC, anon, authenticated/);
    assert.doesNotMatch(source,/grant (insert|update) on public\.sonara_social_moderator_grants to service_role/i);
  });
  it("checks the separate moderator roster and atomically logs each decision",()=>{
    assert.match(source,/sonara_social_decide_report/);
    assert.match(source,/from public\.sonara_social_moderator_grants/);
    assert.match(source,/for update/);
    assert.match(source,/insert into public\.sonara_social_report_review_events/);
    assert.match(source,/not active or \(approved_by_user_id is not null/);
  });
});
