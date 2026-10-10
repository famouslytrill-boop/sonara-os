// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-last9-routes.cjs"), "utf8");
const first = source.indexOf("  // Staged stock count review:");
const last = source.indexOf("};\n\nfunction registerRestResource(",first);
if (first < 0 || last <= first) throw new Error("staged_stock_review_routes_missing");
const section=source.slice(first,last);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orgId="11111111-1111-4111-8111-111111111111";
const itemId="22222222-2222-4222-8222-222222222222";
const actorId="33333333-3333-4333-8333-333333333333";
const reviewerId="44444444-4444-4444-8444-444444444444";
const requestId="55555555-5555-4555-8555-555555555555";
const reviewId="66666666-6666-4666-8666-666666666666";
const foreign="77777777-7777-4777-8777-777777777777";

function make() {
  const endpoints=[];
  const rpc=[];
  const queries=[];
  const app={
    post:(route,...handlers)=>endpoints.push({method:"POST",route,handler:handlers.at(-1)}),
    get:(route,...handlers)=>endpoints.push({method:"GET",route,handler:handlers.at(-1)})
  };
  const opts={
    getCustomerPrimaryOrganization:async()=>({ok:true,organizationId:orgId,role:"owner"})
  };
  const run=new Function("app","deps","requireBusinessManager","requireCustomer","procurementMutationLimiter",
    "getConfig","supabaseInsert","supabaseList","isUuid","process","URL",section);
  const environment={env:{SONARA_ENABLE_STOCK_COUNT_REVIEW:"true"}};
  run(app,opts,()=>{},()=>{},()=>{},()=>({ok:true,url:"https://database.example",serviceRoleKey:"test"}),
    async(_cfg,endpoint,payload)=>{
      rpc.push({endpoint,payload});
      if(endpoint.includes("submit"))return {ok:true,rows:{ok:true,request_id:requestId,code:"review_requested"}};
      return {ok:true,rows:{ok:true,request_id:requestId,review_id:reviewId,code:"adjustment_recorded",stock_posted:true}};
    },async(_cfg,table,query)=>{queries.push({table,query});return {ok:true,rows:[]}},
    v=>UUID.test(String(v||"")),environment,URL);
  async function hit(method,route,{user=actorId,role="owner",body={},headers={},params={}}={}){
    const target=endpoints.find(e=>e.method===method && e.route===route);
    if(!target)throw new Error("missing route "+method+" "+route);
    opts.getCustomerPrimaryOrganization=async()=>({ok:true,organizationId:orgId,role});
    let code=null,payload=null;
    const res={status(n){code=n;return this},json(v){payload=v;return v}};
    const req={
      sonaraUser:user?{id:user}:null,
      headers:{"content-type":"application/json","host":"sonara.example",
        "origin":"https://sonara.example",...headers},
      body,params
    };
    await target.handler(req,res);
    return {code,payload};
  }
  return {endpoints,rpc,queries,opts,environment,hit};
}
const queue="/api/business/inventory/stock-count-requests";
const review="/api/business/inventory/stock-count-requests/:requestId/review";
const valid={inventory_item_id:itemId,idempotency_key:"count-once-001",
  expected_stock_version:"0",counted_quantity:"5.125"};
describe("Feature-flagged SONARA two-person stock count review",()=>{
  it("does not register an exposed, unprotected stock mutation shortcut",()=>{
    const e=make();
    assert.equal(e.endpoints.length,3);
    assert.equal(e.endpoints.filter(x=>x.method==="POST").length,2);
    assert.ok(section.includes("requireCustomer, procurementMutationLimiter"));
    assert.ok(!section.includes("requireBusinessManager, procurementMutationLimiter"));
    assert.ok(section.includes("getCustomerPrimaryOrganization"));
    assert.ok(!section.includes("resolveOrganization(req, deps)"));
    assert.ok(section.includes("autoBootstrap: false"));
  });
  it("allows a verified business employee to submit but never approve a count",async()=>{
    const e=make();
    const request=await e.hit("POST",queue,{role:"employee",body:valid});
    assert.equal(request.code,201);
    const forbidden=await e.hit("POST",review,{
      user:reviewerId,role:"employee",params:{requestId},body:{action:"approve"}
    });
    assert.equal(forbidden.code,403);
    assert.equal(forbidden.payload.code,"independent_owner_review_required");
    assert.equal(e.rpc.length,1);
    assert.equal(e.rpc[0].endpoint,"rpc/sonara_submit_stock_count_request");
  });
  it("is unavailable until the explicitly scoped release flag is enabled",async()=>{
    const e=make();e.environment.env.SONARA_ENABLE_STOCK_COUNT_REVIEW="false";
    const r=await e.hit("POST",queue,{body:valid});
    assert.equal(r.code,503);
    assert.equal(r.payload.code,"stock_review_not_activated");
    assert.equal(e.rpc.length,0);
  });
  it("refuses cross-origin submissions and non-JSON form POSTs",async()=>{
    const e=make();
    const wrong=await e.hit("POST",queue,{body:valid,headers:{origin:"https://hostile.example"}});
    assert.equal(wrong.code,403);
    const form=await e.hit("POST",queue,{body:valid,headers:{"content-type":"application/x-www-form-urlencoded"}});
    assert.equal(form.code,403);
    assert.equal(e.rpc.length,0);
  });
  it("binds the count actor and organization to the verified session, not the request",async()=>{
    const e=make();
    const body={...valid,actor_user_id:foreign,organization_id:foreign,
      reviewer_user_id:foreign,role:"owner"};
    const r=await e.hit("POST",queue,{body});
    assert.equal(r.code,201);
    assert.equal(e.rpc.length,1);
    assert.deepEqual(e.rpc[0],{
      endpoint:"rpc/sonara_submit_stock_count_request",
      payload:{p_organization_id:orgId,p_inventory_item_id:itemId,
        p_actor_user_id:actorId,p_idempotency_key:"count-once-001",
        p_expected_version:"0",p_counted_quantity:5.125}
    });
  });
  it("never accepts an anonymous actor or a manually entered tenant ID",async()=>{
    const e=make();
    const r=await e.hit("POST",queue,{user:null,body:{...valid,organization_id:orgId}});
    assert.equal(r.code,403);
    assert.equal(r.payload.code,"verified_session_required");
    assert.equal(e.rpc.length,0);
  });
  it("rejects invalid quantity precision and malformed approval requests before RPC",async()=>{
    const e=make();
    for(const counted_quantity of ["5.1234","-1","NaN","1e2","1\\.234","01.00"]){
      const r=await e.hit("POST",queue,{body:{...valid,counted_quantity}});
      assert.equal(r.code,400,counted_quantity);
    }
    assert.equal(e.rpc.length,0);
  });
  it("requires an independently authenticated owner/admin review",async()=>{
    const e=make();
    const denied=await e.hit("POST",review,{
      user:reviewerId,role:"manager",
      params:{requestId},body:{action:"approve",reviewer_user_id:foreign}
    });
    assert.equal(denied.code,403);
    const good=await e.hit("POST",review,{
      user:reviewerId,role:"owner",
      params:{requestId},body:{action:"approve",reviewer_user_id:foreign}
    });
    assert.equal(good.code,200);
    assert.deepEqual(e.rpc[0],{endpoint:"rpc/sonara_review_stock_count_request",
      payload:{p_organization_id:orgId,p_request_id:requestId,p_reviewer_user_id:reviewerId}});
  });
  it("lets employees read only their own count requests, while owners can review the whole tenant queue",async()=>{
    const e=make();
    const staff=await e.hit("GET",queue,{role:"employee",user:actorId});
    assert.equal(staff.code,200);
    assert.equal(e.queries.length,1);
    assert.ok(e.queries[0].query.includes("organization_id=eq."+orgId));
    assert.ok(e.queries[0].query.includes("actor_user_id=eq."+actorId));
    const owner=await e.hit("GET",queue,{role:"owner",user:reviewerId});
    assert.equal(owner.code,200);
    assert.equal(e.queries.length,2);
    assert.ok(e.queries[1].query.includes("organization_id=eq."+orgId));
    assert.ok(!e.queries[1].query.includes("actor_user_id=eq."));
  });
  it("refuses implicit approval and filters the read queue to the current organization",async()=>{
    const e=make();
    const no=await e.hit("POST",review,{user:reviewerId,params:{requestId},body:{action:"preview"}});
    assert.equal(no.code,400);
    assert.equal(e.rpc.length,0);
    const yes=await e.hit("GET",queue,{user:reviewerId});
    assert.equal(yes.code,200);
    assert.equal(e.queries.length,1);
    assert.equal(e.queries[0].table,"inventory_stock_count_requests");
    assert.ok(e.queries[0].query.includes("organization_id=eq."+orgId));
    assert.ok(e.queries[0].query.includes("limit=50"));
  });
});
