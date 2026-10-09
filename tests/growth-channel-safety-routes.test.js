// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const register = require("../routes/sonara-growth-channel-routes.cjs");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");
const USER="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const BLOCKED="33333333-3333-4333-8333-333333333333";
const VISIBLE="44444444-4444-4444-8444-444444444444";
const POST="55555555-5555-4555-8555-555555555555";
const middleware=(_req,_res,next)=>next();
function setup() {
  const handlers=new Map();
  const app={
    get:(p,...h)=>handlers.set("GET "+p,h),
    post:(p,...h)=>handlers.set("POST "+p,h)
  };
  register(app,{
    layout:({heading,body,sections=[]})=>[heading,body,...sections].join(" "),
    brandCard:(heading,body)=>heading+": "+body,
    linkAction:(href,label)=>label+" "+href,
    escapeHtml:(s)=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"),
    responsePage:(heading,body)=>heading+" "+body,
    requireCustomer:middleware, resolveCustomerSession:async()=>({ok:true,user:{id:USER}}),
    requireWorkspaceAccess:()=>middleware,
    getCustomerPrimaryOrganization:async()=>({ok:true,organizationId:ORG}),
    getSupabaseServerConfig:()=>({ok:true,url:"https://database.example.invalid"}),
    supabaseHeaders:()=>({}), createRateLimiter:()=>middleware,
    getEnv:(name)=>name==="NEXT_PUBLIC_SITE_URL"?"https://sonara.test":""
  });
  return handlers;
}
function req(params={},overrides={}) {
  const result={
    params,body:{},query:{},protocol:"https",headers:{},
    sonaraUser:{id:USER},get:(key)=>key==="host"?"sonara.test":undefined,
    ...overrides
  };
  result.headers={origin:siteOrigin(result),...result.headers};
  return result;
}
function makeRes(){
  return {
    statusCode:200,headers:{},
    status(v){this.statusCode=v;return this;},
    type(v){this.contentType=v;return this;},
    setHeader(k,v){this.headers[k]=v;return this;},
    send(v){this.body=v;return this;},
    json(v){this.body=v;return this;},
    redirect(code,url){this.statusCode=code;this.redirectTo=url;return this;}
  };
}
async function invoke(handlers,method,path,request){
  const list=handlers.get(method+" "+path);
  assert.ok(list,"missing "+path);
  const res=makeRes();
  for(const handler of list) await handler(request,res,()=>{});
  return res;
}
function mockFetch(calls,result=true,role="owner"){
  return async function(input,init={}){
    const url=new URL(String(input)),method=init.method||"GET";
    calls.push({url:url.pathname,query:url.search,method,body:init.body});
    let data=[];
    if(url.pathname.endsWith("/organization_memberships")){
      data=[{role,status:"active"}];
    }else if(url.pathname.endsWith("/growth_channel_moderation_events")){
      data=[{post_id:POST,actor_user_id:USER,action:"remove",created_at:"2026-10-09T01:00:00Z"}];
    }else if(url.pathname.endsWith("/growth_channel_blocks")){
      data=method==="GET"?[{channel_id:BLOCKED}]:[];
    }else if(url.pathname.endsWith("/growth_channel_directory")){
      data=[{channel_id:BLOCKED,handle:"blocked-news",title:"Hidden from me"},
        {channel_id:VISIBLE,handle:"open-news",title:"Visible to me"}];
    }else if(url.pathname.endsWith("/growth_channels")){
      data=[{id:BLOCKED,organization_id:ORG,handle:"blocked-news",state:"public",title:"Blocked News"}];
    }else if(url.pathname.endsWith("/growth_channel_posts")){
      data=[{id:POST,channel_id:BLOCKED,organization_id:ORG,state:"published"}];
    }else if(url.pathname.endsWith("/rpc/sonara_growth_channel_block_action")){
      data=typeof result === "string" ? result : "blocked";
    }else if(url.pathname.endsWith("/rpc/sonara_moderate_growth_post")){
      data=result;
    }
    return {ok:true,status:200,json:async()=>data,headers:{get:()=>null}};
  };
}
describe("real Growth channel safety routes (isolated database stub)",()=>{
  let originalFetch;
  beforeEach(()=>{originalFetch=global.fetch;});
  afterEach(()=>{global.fetch=originalFetch;});

  it("suppresses an account-blocked channel from directory",async()=>{
    const calls=[];global.fetch=mockFetch(calls);
    const res=await invoke(setup(),"GET","/channels",req());
    assert.match(res.body,/Visible to me/);
    assert.doesNotMatch(res.body,/Hidden from me/);
    assert.equal(res.headers["Cache-Control"],"private, no-store");
    assert.ok(calls.some(c=>c.url.endsWith("/growth_channel_blocks")&&c.query.includes("viewer_user_id=eq."+USER)));
  });

  it("hides posts, offers unblock and never loads blocked posts",async()=>{
    const calls=[];global.fetch=mockFetch(calls);
    const res=await invoke(setup(),"GET","/channels/:handle",req({handle:"blocked-news"}));
    assert.match(res.body,/You blocked this channel/);
    assert.match(res.body,/Unblock this channel/);
    assert.equal(calls.some(c=>c.url.endsWith("/growth_channel_posts")),false);
  });

  it("binds block writes to the authenticated user, not submitted actor metadata",async()=>{
    const calls=[];global.fetch=mockFetch(calls);
    const res=await invoke(setup(),"POST","/api/growth/channels/:id/block",
      req({id:VISIBLE},{body:{viewer_user_id:BLOCKED}}));
    assert.equal(res.statusCode,303);
    assert.equal(res.redirectTo,"/account/blocked-channels");
    const post=calls.find(c=>c.url.endsWith("/rpc/sonara_growth_channel_block_action") && c.method==="POST");
    assert.ok(post);
    assert.deepEqual(JSON.parse(post.body),{
      p_actor_user_id:USER,p_channel_id:VISIBLE,p_action:"block"
    });
    assert.equal(calls.some(c=>c.url.endsWith("/growth_channel_blocks")&&c.method!=="GET"),false);
  });

  it("returns an honest limit error when the atomic block quota is exhausted",async()=>{
    const calls=[];global.fetch=mockFetch(calls,"block_limit_reached");
    const res=await invoke(setup(),"POST","/api/growth/channels/:id/block",req({id:VISIBLE}));
    assert.equal(res.statusCode,409);
    assert.match(res.body,/500 blocked channels/);
    assert.equal(calls.filter(c=>c.url.endsWith("/rpc/sonara_growth_channel_block_action")).length,1);
  });

  it("fails closed if the block database RPC refuses the operation",async()=>{
    const calls=[];global.fetch=mockFetch(calls,"denied");
    const res=await invoke(setup(),"POST","/api/growth/channels/:id/block",req({id:VISIBLE}));
    assert.equal(res.statusCode,404);
    assert.equal(res.redirectTo,undefined);
  });

  it("rejects a forged Host header when the canonical site is different",async()=>{
    const calls=[];global.fetch=mockFetch(calls);
    const request=req({id:VISIBLE});
    request.get=()=> "evil.example";
    request.headers.origin="https://evil.example";
    const res=await invoke(setup(),"POST","/api/growth/channels/:id/block",request);
    assert.equal(res.statusCode,403);
    assert.equal(calls.length,0);
  });

  it("rejects cross-site fetch metadata despite a matching Origin",async()=>{
    const calls=[];global.fetch=mockFetch(calls);
    const request=req({id:VISIBLE});
    request.headers["sec-fetch-site"]="cross-site";
    const res=await invoke(setup(),"POST","/api/growth/channels/:id/block",request);
    assert.equal(res.statusCode,403);
    assert.equal(calls.length,0);
  });

  it("rejects cross-origin block attempts without writes",async()=>{
    const calls=[];global.fetch=mockFetch(calls);
    const res=await invoke(setup(),"POST","/api/growth/channels/:id/block",
      req({id:VISIBLE},{headers:{origin:"https://attacker.invalid"}}));
    assert.equal(res.statusCode,403);assert.equal(calls.length,0);
  });

  it("sends trusted owner and post IDs to one atomic moderation RPC",async()=>{
    const calls=[];global.fetch=mockFetch(calls);
    const res=await invoke(setup(),"POST","/api/growth/channels/posts/remove",
      req({},{body:{post_id:POST,actor_id:BLOCKED,organization_id:BLOCKED}}));
    assert.equal(res.statusCode,303);assert.match(res.redirectTo,/done=removed/);
    const rpc=calls.find(c=>c.url.endsWith("/rpc/sonara_moderate_growth_post"));
    assert.deepEqual(JSON.parse(rpc.body),{
      p_organization_id:ORG,p_post_id:POST,p_actor_user_id:USER,p_action:"remove"
    });
    assert.equal(calls.some(c=>c.method==="PATCH"),false);
  });

  it("does not claim success when the moderation database transaction refuses",async()=>{
    const calls=[];global.fetch=mockFetch(calls,false);
    const res=await invoke(setup(),"POST","/api/growth/channels/reports/dismiss",
      req({},{body:{post_id:POST}}));
    assert.equal(res.statusCode,303);assert.match(res.redirectTo,/problem=save_failed/);
  });
});

describe("moderation audit privacy and reviewer permissions",()=>{
  const originalFetch=global.fetch;
  after(()=>{global.fetch=originalFetch;});

  it("denies a signed-in member moderation without calling the privileged RPC",async()=>{
    const calls=[];global.fetch=mockFetch(calls,true,"member");
    const res=await invoke(setup(),"POST","/api/growth/channels/posts/remove",
      req({},{body:{post_id:POST}}));
    assert.equal(res.statusCode,403);
    assert.equal(calls.some(c=>c.url.endsWith("/rpc/sonara_moderate_growth_post")),false);
  });

  it("never reads or displays reviewer identity to an ordinary workspace member",async()=>{
    const calls=[];global.fetch=mockFetch(calls,true,"member");
    const res=await invoke(setup(),"GET","/growth-studio/owner/channels",req());
    assert.equal(calls.some(c=>c.url.endsWith("/growth_channel_moderation_events")),false);
    assert.equal(calls.some(c=>c.url.endsWith("/growth_post_reports")),false);
    assert.doesNotMatch(res.body,/Moderation decision history/);
  });

  it("allows a verified owner to read the bounded audit history",async()=>{
    const calls=[];global.fetch=mockFetch(calls,true,"owner");
    const res=await invoke(setup(),"GET","/growth-studio/owner/channels",req());
    assert.match(res.body,/Moderation decision history/);
    assert.equal(calls.some(c=>c.url.endsWith("/growth_channel_moderation_events")),true);
  });
});
