// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const register = require("../routes/sonara-creator-profile-routes.cjs");
const USER = "11111111-1111-4111-8111-111111111111";
const PROFILE = "22222222-2222-4222-8222-222222222222";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const noop = (_req, _res, next) => next();

function routes(flag) {
  const results = new Map();
  const app = {
    get: (path,...handlers) => results.set("GET " + path,handlers),
    post: (path,...handlers) => results.set("POST " + path,handlers)
  };
  register(app, {
    layout: ({heading,body,sections=[]}) => [heading,body,...sections].join(" "),
    brandCard: (heading,body) => heading + " " + body,
    linkAction: (href,label) => '<a href="' + href + '">' + label + "</a>",
    escapeHtml: (value) => String(value).replace(/&/g,"&amp;")
      .replace(/</g,"&lt;").replace(/"/g,"&quot;"),
    responsePage: (heading,message) => heading + " " + message,
    requireCustomer: noop,
    resolveCustomerSession: async () => ({ok:true,user:{id:USER}}),
    wantsJson: () => false,
    getSupabaseServerConfig: () => ({ok:true,url:"https://database.invalid"}),
    supabaseHeaders: () => ({}),
    getCustomerPrimaryOrganization: async () => ({ok:true,organizationId:COMPANY}),
    getEnv: (name) => name === "SONARA_SOCIAL_USER_SAFETY_ENABLED"
      ? flag ? "true" : "false" : ""
  });
  return results;
}
function mockDb(log,state){
  return async function(url,init={}){
    const s=String(url); log.push({url:s,method:init.method||"GET",body:init.body});
    let value=[];
    if(s.includes("/creator_artist_profiles?")) value=[{
      id:PROFILE, artist_name:"Nova",public_description:"Artist biography",
      public_handle:"nova",published_at:"2026-10-08T12:00:00Z",status:"active"
    }];
    if(s.includes("/rpc/sonara_social_creator_state")) value=state;
    return {ok:true,status:200,json:async()=>value,headers:{get:()=>null}};
  };
}
async function invoke(route){
  const req={params:{handle:"nova"},headers:{},body:{},query:{}};
  const res={
    statusCode:200,headers:{},
    status(code){this.statusCode=code;return this;},
    type(type){this.contentType=type;return this;},
    setHeader(k,v){this.headers[k]=v;return this;},
    send(content){this.body=content;return this;}
  };
  for(const f of route) await f(req,res,()=>{});
  return res;
}
describe("Creator Studio public profile social user-safety integration",()=>{
  let saved;
  beforeEach(()=>{saved=global.fetch;});
  afterEach(()=>{global.fetch=saved;});

  it("does not query unfinished safety tables when the feature flag is off",async()=>{
    const calls=[];global.fetch=mockDb(calls,"unavailable");
    const res=await invoke(routes(false).get("GET /creator/:handle"));
    assert.equal(res.statusCode,200);
    assert.equal(calls.some(c=>c.url.includes("sonara_social_creator_state")),false);
    assert.match(res.body,/Follow Nova/);
    assert.doesNotMatch(res.body,/Block this creator/);
  });
  it("hides blocked profile text and follow controls for a saved personal block",async()=>{
    const calls=[];global.fetch=mockDb(calls,"blocked_by_me");
    const res=await invoke(routes(true).get("GET /creator/:handle"));
    assert.equal(res.statusCode,200);
    assert.match(res.body,/You blocked this creator/);
    assert.match(res.body,/Unblock creator/);
    assert.match(res.body,/Report this creator/);
    assert.doesNotMatch(res.body,/Artist biography/);
    assert.doesNotMatch(res.body,/Follow Nova/);
    assert.equal(res.headers["Cache-Control"],"private, no-store");
  });
  it("does not reveal that a creator blocked the viewer",async()=>{
    const calls=[];global.fetch=mockDb(calls,"unavailable");
    const res=await invoke(routes(true).get("GET /creator/:handle"));
    assert.equal(res.statusCode,404);
    assert.doesNotMatch(res.body,/Artist biography|blocked you/);
    assert.match(res.body,/Report this creator/);
    assert.doesNotMatch(res.body,/Follow Nova/);
    assert.equal(calls.some(c=>c.url.includes("/creator_follows?")),false);
  });
  it("shows report and block actions only when interaction state is allowed",async()=>{
    const calls=[];global.fetch=mockDb(calls,"allowed");
    const res=await invoke(routes(true).get("GET /creator/:handle"));
    assert.equal(res.statusCode,200);
    assert.match(res.body,/Block this creator/);
    assert.match(res.body,/Report this creator/);
    assert.match(res.body,/name="request_id"/);
    assert.match(res.body,/Follow Nova/);
  });
  it("does not offer self-report or self-block actions",async()=>{
    const calls=[];global.fetch=mockDb(calls,"self");
    const res=await invoke(routes(true).get("GET /creator/:handle"));
    assert.equal(res.statusCode,200);
    assert.doesNotMatch(res.body,/Block this creator|Report this creator/);
  });
  it("fails closed when the database returns an unexpected safety state",async()=>{
    const calls=[];global.fetch=mockDb(calls,"unknown_state");
    const res=await invoke(routes(true).get("GET /creator/:handle"));
    assert.equal(res.statusCode,503);
    assert.doesNotMatch(res.body,/Block this creator|Follow Nova/);
  });
});
