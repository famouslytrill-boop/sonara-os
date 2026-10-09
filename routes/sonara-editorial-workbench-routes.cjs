// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { KINDS, draft } = require("../lib/sonara-editorial-workbench.cjs");
const TABLE="module_outputs", PRODUCT="creator_studio", MODULE="editorial_workbench";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE="/creator-studio/editorial";
const API="/api/creator-studio/editorial";
const LIMIT=20;

function parseForm(body) {
  const raw=body||{},input={
    kind:raw.kind,title:raw.title,body:raw.body||"",topic:raw.topic||"",
    language:raw.language||"en",platform:raw.platform||"",style:raw.style||""
  };
  if(typeof raw.comparisonText==="string" && raw.comparisonText.trim())input.comparisonText=raw.comparisonText;
  if(typeof raw.durationSeconds==="string" && raw.durationSeconds.trim()!=="")input.durationSeconds=Number(raw.durationSeconds);
  if(typeof raw.sceneCount==="string" && raw.sceneCount.trim()!=="")input.sceneCount=Number(raw.sceneCount);
  if(raw.assetName){
    input.assets=[{name:raw.assetName,status:raw.assetStatus||"unknown",evidence:raw.assetEvidence||""}];
  }
  if(raw.kind==="travel"){
    const costs=[["Accommodation",raw.accommodation],["Transportation",raw.transportation],
      ["Food and activities",raw.activities]].filter(([,amount])=>amount!==""&&amount!==undefined)
      .map(([category,amount])=>({category,amount:Number(amount)}));
    input.travel={
      destination:raw.destination||"",country:raw.country||"",
      startDate:raw.startDate||"",endDate:raw.endDate||"",currency:raw.currency||"USD",
      stops:String(raw.stops||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean),
      budget:costs
    };
  }
  return input;
}
function savedInput(raw) {
  // Only fields validated by draft() may be persisted. Never copy arbitrary
  // nested user-provided objects or passage comparison source text.
  const clean={
    kind:raw.kind,title:raw.title,body:raw.body||"",language:raw.language||"en",
    topic:raw.topic||"",platform:raw.platform||"",style:raw.style||""
  };
  for(const key of ["durationSeconds","sceneCount"])
    if(raw[key]!==undefined) clean[key]=raw[key];
  if(Array.isArray(raw.assets)){
    clean.assets=raw.assets.map(asset=>({
      name:asset.name,status:asset.status,evidence:asset.evidence||""
    }));
  }
  if(raw.travel){
    const t=raw.travel;
    clean.travel={
      destination:t.destination,country:t.country,startDate:t.startDate,
      endDate:t.endDate,currency:t.currency,
      stops:Array.isArray(t.stops)?t.stops.slice():[],
      budget:Array.isArray(t.budget)?t.budget.map(b=>({category:b.category,amount:b.amount})):[]
    };
  }
  return clean;
}
function exportMarkdown(row) {
  const preview=row.output_payload||{};
  const original=row.input_payload||{};
  const text=(s)=>String(s??"");
  const lines=[
    "# "+text(original.title||"Untitled draft"),
    "",
    "> SONARA Creator Studio — private workspace draft (not published)",
    "> Format: "+text(original.kind||"note"),
    "",
    text(original.body||""), ""
  ];
  if(preview.storyboard?.shotList){
    lines.push("## Storyboard", "",text(preview.storyboard.shotList).split("  ||  ").join("\n"),"");
  }
  if(preview.travel){
    lines.push("## Travel research checklist", "",
      "Destination: "+text(preview.travel.destination)+", "+text(preview.travel.country),
      "Dates: "+text(preview.travel.startDate)+" – "+text(preview.travel.endDate),
      "User-estimated budget: "+text(preview.travel.budget?.total)+" "+text(preview.travel.budget?.currency),
      "No live travel advisories, booking availability, prices or entry rules were verified.", "");
  }
  lines.push("## Copyright and publication review","",
    "Rights status: manual review required. This draft has not been published.","");
  return lines.join("\n");
}

function esc(v) {
  return String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function field(name,label,value="",type="text",additional="") {
  const id="editorial-"+name;
  return '<label for="'+id+'">'+esc(label)+'</label><input id="'+id+'" name="'+name+'" type="'+type+
    '" value="'+esc(value)+'" '+additional+'>';
}
function form(input={}) {
  const kind=input.kind||"note";
  const options=KINDS.map(x=>'<option value="'+x+'"'+(kind===x?' selected':'')+'>'+esc(x.replace(/_/g," "))+'</option>').join("");
  const asset=input.assets?.[0]||{};
  const trip=input.travel||{};
  const amounts=Object.fromEntries((trip.budget||[]).map(x=>[x.category,x.amount]));
  return '<form action="'+ROUTE+'/preview" method="post">'+
    '<p>Nothing publishes automatically. Save creates a new workspace draft revision. '+
    'Content in this workspace may be accessible to your authorized teammates.</p>'+
    '<label for="editorial-kind">Format</label><select id="editorial-kind" name="kind">'+options+'</select>'+
    field("title","Title",input.title||"","text",'maxlength="160" required')+
    field("topic","Topic or story idea",input.topic||"","text",'maxlength="240"')+
    '<label for="editorial-body">Your notes, blog, script or raw draft</label>'+
    '<textarea id="editorial-body" name="body" rows="10" maxlength="12000" lang="en" spellcheck="true">'+esc(input.body||"")+'</textarea>'+
    '<p>Storyboards, vlogs and gaming videos can use the existing timed shot planner:</p>'+
    field("durationSeconds","Runtime in seconds (optional)",input.durationSeconds??"","number",'min="3" max="1800" step="1"')+
    field("sceneCount","Number of storyboard shots (3–8)",input.sceneCount??"","number",'min="3" max="8" step="1"')+
    field("platform","Platform",input.platform||"","text",'maxlength="80"')+
    field("style","Style or visual reference (your words)",input.style||"","text",'maxlength="160"')+
    '<label for="editorial-comparisonText">Optional passage comparison — text you supply, not a web copyright scan</label>'+
    '<textarea id="editorial-comparisonText" name="comparisonText" rows="3" maxlength="12000">'+esc(input.comparisonText||"")+'</textarea>'+
    '<p>Comparison text is used for this preview only; it is not saved in draft history.</p>'+
    '<fieldset><legend>Optional rights record — human review required</legend>'+
    field("assetName","Asset name",asset.name||"","text",'maxlength="160"')+
    '<label for="editorial-assetStatus">Rights position</label><select id="editorial-assetStatus" name="assetStatus">'+
    ["unknown","owned","licensed","permission","public_domain_claimed"].map(x=>
      '<option value="'+x+'"'+(asset.status===x?' selected':'')+'>'+x+'</option>').join("")+'</select>'+
    field("assetEvidence","Evidence reference (do not enter secrets)",asset.evidence||"","text",'maxlength="500"')+
    '</fieldset>'+
    '<fieldset><legend>Optional travel planning — user-entered details, no live booking or advisory lookup</legend>'+
    field("destination","Destination",trip.destination||"","text",'maxlength="120"')+
    field("country","Country",trip.country||"","text",'maxlength="120"')+
    field("startDate","Start date",trip.startDate||"","date")+
    field("endDate","End date",trip.endDate||"","date")+
    field("currency","Budget currency",trip.currency||"USD","text",'maxlength="3"')+
    '<label for="editorial-stops">Places you have chosen, one per line</label>'+
    '<textarea id="editorial-stops" name="stops" rows="3">'+esc((trip.stops||[]).join("\n"))+'</textarea>'+
    field("accommodation","Accommodation estimate",amounts.Accommodation??"","number",'min="0" step="0.01"')+
    field("transportation","Transportation estimate",amounts.Transportation??"","number",'min="0" step="0.01"')+
    field("activities","Food and activities estimate",amounts["Food and activities"]??"","number",'min="0" step="0.01"')+
    '</fieldset>'+
    '<button type="submit">Preview and review</button> '+
    '<button type="submit" formaction="'+ROUTE+'/save">Save a workspace draft</button>'+
    '</form>';
}
function renderResult(result) {
  if(!result)return "";
  if(!result.ok)return '<article class="card"><h2>Not ready</h2><p>'+esc(result.message)+'</p></article>';
  const suggestions=result.proofreading.issues.map(x=>
    '<li>'+esc(x.kind)+': '+esc(x.original)+' → '+esc(x.suggestion)+'</li>').join("");
  const sections=result.formatSections.map(x=>'<li>'+esc(x.heading)+': '+esc(x.prompt)+'</li>').join("");
  const rights=result.rightsReview.assets.map(x=>'<li>'+esc(x.name)+': '+esc(x.status)+
      (x.blockers.length?' — '+esc(x.blockers.join("; ")):' — review evidence')+'</li>').join("");
  return '<article class="card"><h2>Review your draft</h2>'+
    '<p>Words: '+result.metrics.wordCount+'. Not published or transmitted to an outside provider.</p>'+
    '<h3>Suggested outline</h3><ol>'+sections+'</ol>'+
    '<h3>Rule-based writing suggestions</h3>'+
    (suggestions?'<ul>'+suggestions+'</ul>':'<p>No matches in the small English rule set; this does not prove correctness.</p>')+
    '<p>'+esc(result.proofreading.note)+'</p>'+
    (result.storyboard?'<h3>Timed shot list</h3><p>'+esc(result.storyboard.durationsAddUp)+'</p>'+
      '<pre>'+esc(result.storyboard.shotList)+'</pre>':'')+
    (result.travel?'<h3>Travel planning</h3><p>'+esc(result.travel.destination)+', '+
      esc(result.travel.country)+' · '+result.travel.days+' day(s) · budget: '+
      esc(result.travel.budget.total)+' '+esc(result.travel.budget.currency)+'</p>'+
      '<p>'+esc(result.travel.advisory.note)+'</p>'+
      '<a href="'+esc(result.travel.advisory.checkOfficialSource)+'">Check official advisories</a>':'')+
    '<h3>Copyright and permissions</h3>'+ (rights?'<ul>'+rights+'</ul>':'')+
    '<p>'+esc(result.rightsReview.focus)+'</p><p>'+esc(result.rightsReview.disclaimer)+'</p>'+
    '</article>';
}
function registerEditorialWorkbenchRoutes(app,deps={}) {
  const required=["layout","linkAction","requireWorkspaceAccess",
    "getSupabaseServerConfig","getCustomerPrimaryOrganization","supabaseHeaders","createRateLimiter"];
  for(const key of required)if(typeof deps[key]!=="function")throw new TypeError("Editorial workbench requires "+key);
  const enabled=typeof deps.isEnabled==="function"?deps.isEnabled:()=>false;
  const doFetch=typeof deps.fetch==="function"?deps.fetch:fetch;
  const on=(req,res,next)=>enabled()===true?next():res.status(404).json({ok:false,code:"not_found"});
  const creator=deps.requireWorkspaceAccess(PRODUCT);
  const limiter=deps.createRateLimiter({
    name:"creator_editorial_workbench",windowSeconds:3600,maxAttempts:30,
    degradedMaxAttempts:30,scopes:["ip","subject"],
    subjectFrom:req=>req.sonaraUser?.id||req.sonaraAccess?.user?.id,
    getSupabaseServerConfig:deps.getSupabaseServerConfig
  });
  const noCache=(req,res,next)=>{res.setHeader("Cache-Control","no-store");next();};
  const jsonOnly=(req,res,next)=>{
    if(!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers?.["content-type"]||""))) {
      return res.status(415).json({ok:false,code:"json_required"});
    }
    next();
  };
  async function scope(req) {
    const config=deps.getSupabaseServerConfig();
    if(!config?.ok)return {ok:false,code:"setup_required"};
    const user=req.sonaraUser||req.sonaraAccess?.user;
    if(!user?.id)return {ok:false,code:"customer_auth_required"};
    const org=await deps.getCustomerPrimaryOrganization(user,{autoBootstrap:false}).catch(()=>null);
    if(!org?.ok||!org.organizationId)return {ok:false,code:"organization_setup_required"};
    return {ok:true,config,organizationId:org.organizationId,userId:user.id};
  }
  const recordFilter=(ctx)=>"organization_id=eq."+encodeURIComponent(ctx.organizationId)+
    "&product_key=eq."+PRODUCT+"&module_key=eq."+MODULE;
  async function requestRows(config,tail,method="GET",payload=null) {
    const opts={method,headers:deps.supabaseHeaders(config,method==="POST"?{prefer:"return=representation"}:{})};
    if(payload!==null){opts.headers={...opts.headers,"Content-Type":"application/json"};opts.body=JSON.stringify(payload)}
    const response=await doFetch(config.url+"/rest/v1/"+TABLE+tail,opts).catch(()=>null);
    if(!response?.ok)return {ok:false,status:response?.status||503};
    const rows=await response.json().catch(()=>null);
    if(!Array.isArray(rows))return {ok:false,status:502};
    return {ok:true,rows};
  }
  async function list(req) {
    const ctx=await scope(req);
    if(!ctx.ok)return {ok:false,code:ctx.code,status:503};
    const read=await requestRows(ctx.config,"?select=id,created_at,input_payload,output_payload&"+
      recordFilter(ctx)+"&order=created_at.desc&limit="+(LIMIT+1));
    return read.ok?{ok:true,records:read.rows.slice(0,LIMIT),truncated:read.rows.length>LIMIT}:
      {ok:false,code:"read_failed",status:503};
  }
  async function readOne(req,id) {
    if(!UUID.test(String(id||"")))return {ok:false,code:"invalid_id",status:400};
    const ctx=await scope(req);
    if(!ctx.ok)return {ok:false,code:ctx.code,status:503};
    const rows=await requestRows(ctx.config,
      "?select=id,created_at,input_payload,output_payload&"+recordFilter(ctx)+
      "&id=eq."+encodeURIComponent(id)+"&limit=1");
    if(!rows.ok)return {ok:false,code:"read_failed",status:503};
    return rows.rows.length?{ok:true,record:rows.rows[0]}:{ok:false,code:"not_found",status:404};
  }
  async function save(req,input,preview) {
    const ctx=await scope(req);
    if(!ctx.ok)return {ok:false,code:ctx.code,status:503};
    // Every explicit save creates a revision; no silent destructive updates.
    const result=await requestRows(ctx.config,"", "POST", {
      organization_id:ctx.organizationId,product_key:PRODUCT,module_key:MODULE,
      input_payload:savedInput(input),output_payload:preview
    });
    if(!result.ok||!result.rows[0]?.id)return {ok:false,code:"not_saved",status:503};
    return {ok:true,saved:true,id:result.rows[0].id,visibility:"authorized_workspace_members_only"};
  }
  function htmlPage(input,result,savedNotice,records=null,downloadId=null) {
    const sections=[savedNotice?'<p>'+esc(savedNotice)+'</p>':"",renderResult(result),
      downloadId?'<p><a href="'+ROUTE+'/drafts/'+esc(downloadId)+'/export.md">Download Markdown revision</a></p>':"",
      form(input)];
    if(records?.ok){
      sections.push('<article class="card"><h2>Recent workspace drafts</h2><ul>'+
        records.records.map(row=>'<li><a href="'+ROUTE+'/drafts/'+esc(row.id)+'">'+
          esc(row.input_payload?.title||"Untitled")+'</a> — '+esc(row.input_payload?.kind||"note")+'</li>').join("")+
        '</ul>'+(records.truncated?'<p>Showing the latest '+LIMIT+'.</p>':'')+'</article>');
    }else if(records)sections.push('<p>Saved drafts could not be loaded; nothing was deleted.</p>');
    return deps.layout({title:"Editorial Workbench",eyebrow:"Creator Studio",
      heading:"Write, plan and review",body:"Notes, blogs, storyboards, vlogs, gaming content and travel drafts. No automatic publishing.",
      sections:sections.filter(Boolean),actions:[
        deps.linkAction("/creator-studio/dashboard","Creator Studio"),
        deps.linkAction("/creator-studio/tools/storyboard","Storyboard Builder"),
        deps.linkAction("/creator-studio/scroll","Scroll sites")
      ]});
  }
  app.get(ROUTE,on,creator,noCache,async(req,res)=>{
    const recent=await list(req);
    res.status(200).type("html").send(htmlPage({},null,null,recent));
  });
  app.get(ROUTE+"/drafts/:id",on,creator,noCache,async(req,res)=>{
    const found=await readOne(req,req.params.id);
    if(!found.ok)return res.status(found.status).type("html").send(htmlPage({},null,"Draft not available.",null));
    return res.status(200).type("html").send(htmlPage(found.record.input_payload,
      found.record.output_payload,"Saved revision from "+String(found.record.created_at||"the workspace"),null,req.params.id));
  });
  app.get(API+"/drafts",on,creator,noCache,async(req,res)=>{
    const read=await list(req);res.status(read.ok?200:read.status).json(read);
  });
  app.get(API+"/drafts/:id",on,creator,noCache,async(req,res)=>{
    const record=await readOne(req,req.params.id);
    return res.status(record.ok?200:record.status).json(record);
  });
  app.get(ROUTE+"/drafts/:id/export.md",on,creator,noCache,async(req,res)=>{
    const record=await readOne(req,req.params.id);
    if(!record.ok)return res.status(record.status).json({ok:false,code:record.code});
    res.setHeader("Content-Disposition",'attachment; filename="sonara-editorial-draft.md"');
    return res.status(200).type("text/markdown; charset=utf-8").send(exportMarkdown(record.record));
  });
  app.post(API+"/preview",on,creator,limiter,noCache,jsonOnly,(req,res)=>{
    const result=draft(req.body);
    res.status(result.ok?200:400).json(result);
  });
  app.post(API+"/save",on,creator,limiter,noCache,jsonOnly,async(req,res)=>{
    // Non-simple custom header prevents cross-site HTML form submits; regular
    // CORS remains disabled by the application's existing policy.
    if(req.headers?.["x-sonara-intent"]!=="save-editorial-draft")
      return res.status(403).json({ok:false,code:"explicit_save_intent_required"});
    const site=String(req.headers?.["sec-fetch-site"]||"");
    if(site==="cross-site" || site==="same-site")
      return res.status(403).json({ok:false,code:"cross_site_write_denied"});
    const result=draft(req.body);
    if(!result.ok)return res.status(400).json(result);
    const outcome=await save(req,req.body,result);
    res.status(outcome.ok?201:outcome.status).json(outcome);
  });
  // A browser form save requires a same-origin Fetch Metadata
  // signal. Unknown origin is refused instead of trusting a cookie alone.
  const formPost= () => (req,res,next)=>{
    const site=String(req.headers?.["sec-fetch-site"]||"");
    if(site!=="same-origin")
      return res.status(403).json({ok:false,code:"cross_site_write_denied"});
    next();
  };
  app.post(ROUTE+"/preview",on,creator,limiter,noCache,formPost(),async(req,res)=>{
    const input=parseForm(req.body),result=draft(input);
    res.status(result.ok?200:400).type("html").send(htmlPage(input,result,null,null));
  });
  app.post(ROUTE+"/save",on,creator,limiter,noCache,formPost(),async(req,res)=>{
    const input=parseForm(req.body),preview=draft(input);
    if(!preview.ok)return res.status(400).type("html").send(htmlPage(input,preview,null,null));
    const result=await save(req,input,preview);
    if(result.ok)return res.redirect(303,ROUTE+"/drafts/"+result.id);
    res.status(result.status).type("html").send(htmlPage(input,preview,"Nothing was saved. Workspace storage is unavailable.",null));
  });
}
module.exports={registerEditorialWorkbenchRoutes,ROUTE,API,parseForm,savedInput};
