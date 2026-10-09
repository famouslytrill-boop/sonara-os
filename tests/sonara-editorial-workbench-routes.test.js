"use strict";
const assert=require("node:assert/strict");
const { registerEditorialWorkbenchRoutes, ROUTE, API, parseForm, savedInput }=
  require("../routes/sonara-editorial-workbench-routes.cjs");

const OWN_ID="00000000-0000-4000-8000-000000000111";
const FOREIGN_ID="00000000-0000-4000-8000-000000000222";
function makeHarness(options={}) {
  const routes=new Map(),calls=[],guards=[],rateConfigs=[],saved=[];
  const fetchMock=async(url,init)=>{
    calls.push({url,init});
    if(options.storageOffline)return {ok:false,status:503,json:async()=>null};
    if(init.method==="POST"){
      const payload=JSON.parse(init.body);
      saved.push(payload);
      return {ok:true,status:201,json:async()=>[{id:OWN_ID,...payload}]};
    }
    if(url.includes("id=eq."+FOREIGN_ID))return {ok:true,status:200,json:async()=>[]};
    const rows=options.records||[];
    return {ok:true,status:200,json:async()=>rows};
  };
  const app={
    get:(path,...handlers)=>routes.set("GET "+path,handlers),
    post:(path,...handlers)=>routes.set("POST "+path,handlers)
  };
  const layout=(page)=>"<html><main><h1>"+page.heading+"</h1>"+page.sections.join("")+"</main></html>";
  const deps={
    layout,linkAction:(url,text)=>'<a href="'+url+'">'+text+"</a>",
    isEnabled:()=>options.enabled!==false,
    requireWorkspaceAccess:(workspace)=>{
      guards.push(workspace);
      return (req,res,next)=>{
        if(req.auth===false)return res.status(401).json({ok:false,code:"unauthorized"});
        if(req.workspace!==workspace)return res.status(403).json({ok:false,code:"wrong_workspace"});
        req.sonaraUser={id:"user-001"};next();
      };
    },
    createRateLimiter:(cfg)=>{
      rateConfigs.push(cfg);
      return (req,res,next)=>{
        if(req.limit===true)return res.status(429).json({ok:false,code:"rate_limited"});
        next();
      };
    },
    getSupabaseServerConfig:()=>({ok:options.storageOffline!==true,url:"https://db.invalid",serviceRoleKey:"test-not-real"}),
    getCustomerPrimaryOrganization:async()=>({ok:true,organizationId:"org-001"}),
    supabaseHeaders:()=>({apikey:"test-not-real"}),
    fetch:fetchMock
  };
  registerEditorialWorkbenchRoutes(app,deps);
  async function call(method,path,body={},extra={}){
    const handlers=routes.get(method+" "+path);
    assert.ok(handlers,"unknown registered path "+method+" "+path);
    const req={
      body,auth:extra.auth??true,workspace:extra.workspace||"creator_studio",limit:extra.limit||false,
      headers:{
        "content-type":extra.contentType||"application/json",
        "sec-fetch-site":extra.site||"same-origin",
        ...(extra.intent?{"x-sonara-intent":extra.intent}:{})
      },
      params:extra.params||{}
    };
    const res={
      statusCode:200,headers:{},body:null,finished:false,
      status(n){this.statusCode=n;return this},
      setHeader(k,v){this.headers[k]=v;return this},
      type(x){this.headers["content-type"]=x;return this},
      send(x){this.body=x;this.finished=true;return this},
      json(x){this.body=x;this.finished=true;return this},
      redirect(n,path){this.statusCode=n;this.body={redirect:path};this.finished=true;return this}
    };
    for(const middleware of handlers){
      if(res.finished)break;
      let next=false;
      await middleware(req,res,()=>{next=true});
      if(!next)break;
    }
    return res;
  }
  return {call,calls,saved,guards,rateConfigs,routes};
}
const doc=(extra={})=>({
  kind:"note",title:"Production notes",body:"Teh camera schedule is here.",
  language:"en",...extra
});

describe("Creator Studio editorial access, preview and draft persistence",()=>{
  it("registers authoring, preview, save, list and reopen routes",()=>{
    const h=makeHarness();
    for(const k of ["GET "+ROUTE,"GET "+ROUTE+"/drafts/:id","GET "+API+"/drafts",
      "POST "+API+"/preview","POST "+API+"/save",
      "POST "+ROUTE+"/preview","POST "+ROUTE+"/save"]) {
      assert.ok(h.routes.has(k),k);
    }
    assert.ok(h.guards.every(x=>x==="creator_studio"));
    assert.equal(h.rateConfigs.length,1);
    assert.deepEqual(h.rateConfigs[0].scopes,["ip","subject"]);
  });
  it("disables every endpoint when operator flag is absent, before any persistence",async()=>{
    const h=makeHarness({enabled:false});
    const r=await h.call("POST",API+"/save",doc(),{intent:"save-editorial-draft"});
    assert.equal(r.statusCode,404);
    assert.equal(r.body.code,"not_found");
    assert.equal(h.calls.length,0);
  });
  it("denies anonymous and wrong-workspace users before computing or saving",async()=>{
    const h=makeHarness();
    assert.equal((await h.call("POST",API+"/preview",doc(),{auth:false})).statusCode,401);
    assert.equal((await h.call("POST",API+"/save",doc(),{workspace:"business_builder",intent:"save-editorial-draft"})).statusCode,403);
    assert.equal(h.calls.length,0);
  });
  it("previews spelling and rights findings without storing customer content",async()=>{
    const h=makeHarness();
    const r=await h.call("POST",API+"/preview",doc());
    assert.equal(r.statusCode,200);
    assert.equal(r.body.kind,"note");
    assert.ok(r.body.proofreading.issues.some(x=>x.suggestion==="the"));
    assert.equal(r.body.publication.status,"not_published");
    assert.equal(h.calls.length,0);
  });
  it("enforces JSON API format, reviewable publishing and rate limits",async()=>{
    const h=makeHarness();
    assert.equal((await h.call("POST",API+"/preview",doc(),{contentType:"text/plain"})).statusCode,415);
    assert.equal((await h.call("POST",API+"/preview",doc(),{limit:true})).statusCode,429);
    assert.equal(h.saved.length,0);
  });
  it("requires explicit non-simple intent header before JSON draft writes",async()=>{
    const h=makeHarness();
    const denied=await h.call("POST",API+"/save",doc());
    assert.equal(denied.statusCode,403);
    assert.equal(denied.body.code,"explicit_save_intent_required");
    assert.equal(h.calls.length,0);
  });
  it("saves only a reviewed draft under creator product and server-resolved organization",async()=>{
    const h=makeHarness();
    const v=await h.call("POST",API+"/save",doc({
      comparisonText:"secret third party source",assets:[{name:"licensed track",status:"unknown",evidence:""}]
    }),{intent:"save-editorial-draft"});
    assert.equal(v.statusCode,201);
    assert.equal(v.body.saved,true);
    assert.equal(v.body.visibility,"authorized_workspace_members_only");
    assert.equal(h.saved.length,1);
    assert.equal(h.saved[0].organization_id,"org-001");
    assert.equal(h.saved[0].module_key,"editorial_workbench");
    assert.equal(h.saved[0].product_key,"creator_studio");
    assert.equal(h.saved[0].output_payload.publication.status,"not_published");
    assert.equal(JSON.stringify(h.saved[0]).includes("secret third party source"),false);
  });
  it("does not claim a save when the account database is missing",async()=>{
    const h=makeHarness({storageOffline:true});
    const r=await h.call("POST",API+"/save",doc(),{intent:"save-editorial-draft"});
    assert.equal(r.statusCode,503);
    assert.equal(r.body.ok,false);
    assert.equal(r.body.code,"setup_required");
  });
  it("reads saved drafts using explicit organization, product and module filters",async()=>{
    const h=makeHarness({records:[{id:OWN_ID,created_at:"2026-10-09",
      input_payload:doc(),output_payload:{ok:true}}]});
    const res=await h.call("GET",API+"/drafts");
    assert.equal(res.statusCode,200);
    assert.equal(res.body.records.length,1);
    assert.match(h.calls[0].url,/organization_id=eq.org-001/);
    assert.match(h.calls[0].url,/product_key=eq.creator_studio/);
    assert.match(h.calls[0].url,/module_key=eq.editorial_workbench/);
  });
  it("does not retrieve an unknown or other tenant's draft by guessing a UUID",async()=>{
    const h=makeHarness();
    const bad=await h.call("GET",ROUTE+"/drafts/:id",{},{
      params:{id:"../../../customer-data"}
    });
    assert.equal(bad.statusCode,400);
    assert.equal(h.calls.length,0);
    const foreign=await h.call("GET",ROUTE+"/drafts/:id",{},{
      params:{id:FOREIGN_ID}
    });
    assert.equal(foreign.statusCode,404);
    assert.match(h.calls[0].url,/organization_id=eq.org-001/);
    assert.match(h.calls[0].url,/id=eq.00000000/);
  });
  it("renders real HTML input fields with both wired preview and save destinations",async()=>{
    const h=makeHarness();
    const r=await h.call("GET",ROUTE);
    assert.equal(r.statusCode,200);
    assert.match(r.body,/<textarea/);
    assert.match(r.body,/formaction="\/creator-studio\/editorial\/save"/);
    assert.match(r.body,/action="\/creator-studio\/editorial\/preview"/);
    assert.match(r.body,/storyboard/);
    assert.match(r.body,/travel/);
  });
  it("escapes user HTML in saved titles to prevent stored HTML injection",async()=>{
    const h=makeHarness({records:[{id:OWN_ID,created_at:"2026-10-09",
      input_payload:doc({title:"<script>alert(1)</script>"}),output_payload:{}}]});
    const r=await h.call("GET",ROUTE);
    assert.equal(r.statusCode,200);
    assert.equal(r.body.includes("<script>alert(1)</script>"),false);
    assert.match(r.body,/&lt;script&gt;/);
  });
  it("renders browser preview and refuses cross-site browser form submissions",async()=>{
    const h=makeHarness();
    const r=await h.call("POST",ROUTE+"/preview",{kind:"note",title:"test",body:"teh writing",language:"en"});
    assert.equal(r.statusCode,200);
    assert.match(r.body,/Review your draft/);
    const refused=await h.call("POST",ROUTE+"/save",{kind:"note",title:"test",body:"text",language:"en"},{site:"cross-site"});
    assert.equal(refused.statusCode,403);
    assert.equal(h.saved.length,0);
  });
  it("browser draft saves redirect only after confirmed storage and preserve editability",async()=>{
    const h=makeHarness();
    const r=await h.call("POST",ROUTE+"/save",{kind:"note",title:"test",body:"text",language:"en"});
    assert.equal(r.statusCode,303);
    assert.equal(r.body.redirect,ROUTE+"/drafts/"+OWN_ID);
    const input=savedInput({kind:"blog",title:"x",body:"hello",comparisonText:"secret"});
    assert.equal(input.comparisonText,undefined);
    assert.equal(parseForm({kind:"gaming",title:"gameplay",body:"script"}).durationSeconds,undefined);
  });
});
