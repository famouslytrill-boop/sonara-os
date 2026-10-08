// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
// Diagnostic classification only, NEVER an authorization or repair grant.
const SUITES=Object.freeze(["sonara_one","business_builder","creator_studio","growth_studio","unclassified"]);
const JOURNEYS=Object.freeze(["platform","identity","business_management","field_operations","merchant_commerce","creator_generation","creator_delivery","growth_campaigns","growth_connectors","other"]);
const EFFECT_CLASSES=Object.freeze({
 business_builder:Object.freeze(["work_order_write","dispatch","inventory_write","pos_payment","storefront_publish"]),
 creator_studio:Object.freeze(["paid_generation","voice_clone","rights_release","marketplace_delivery","publication"]),
 growth_studio:Object.freeze(["campaign_send","social_publish","lead_write","provider_connect","consent_change"]),
 sonara_one:Object.freeze(["billing","identity","security","deployment","tenant_permissions"])
});
const METHODS=new Set(["GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"]);
const prefix=(r,p)=>r===p||r.startsWith(p+"/");
function classifyHttpJourney(routeTemplate,method="GET"){
 if(typeof routeTemplate!=="string"||routeTemplate.length>160||
    !routeTemplate.startsWith("/")||/[?#\\]/.test(routeTemplate))
   return Object.freeze({suite:"unclassified",journey:"other",operation:"unknown",recovery:"diagnostics_only"});
 // Input MUST be an Express-declared template, never req.originalUrl.
 const route=routeTemplate.replace(/\/+$/,"")||"/";
 const verb=typeof method==="string"?method.toUpperCase():"UNKNOWN";
 const operation=METHODS.has(verb)?(["GET","HEAD","OPTIONS"].includes(verb)?"read":"write"):"unknown";
 let suite="unclassified",journey="other";
 if(prefix(route,"/api/business-builder")||prefix(route,"/business-builder")){
   suite="business_builder";
   journey=route.includes("/checkout")||route.includes("/payments")||prefix(route,"/api/business-builder/merchant")?"merchant_commerce":
     route.includes("/work-orders")||route.includes("/dispatch")?"field_operations":"business_management";
 }else if(prefix(route,"/api/creator")||prefix(route,"/creator-studio")){
   suite="creator_studio";
   journey=route.includes("/generation")||route.includes("/studio")?"creator_generation":"creator_delivery";
 }else if(prefix(route,"/api/growth")||prefix(route,"/growth-studio")){
   suite="growth_studio";
   journey=route.includes("/campaign")||route.includes("/content")?"growth_campaigns":"growth_connectors";
 }else if(prefix(route,"/api/sonara")||prefix(route,"/api/account")||
          prefix(route,"/account")||prefix(route,"/api/owner")||
          prefix(route,"/api/auth")||route==="/"){
   suite="sonara_one";journey=route.includes("/account")||route.includes("/auth")?"identity":"platform";
 }
 return Object.freeze({suite,journey,operation,recovery:"diagnostics_only"});
}
function recoveryPolicyForEffect(suite,effect){
 if(!Object.hasOwn(EFFECT_CLASSES,suite)||typeof effect!=="string"||!EFFECT_CLASSES[suite].includes(effect))
  return Object.freeze({allowed:false,action:"deny_and_review",reason:"unknown_or_unclassified_effect"});
 return Object.freeze({allowed:false,action:"owner_approval_required",reason:"sensitive_business_effect"});
}
function summarizeProductHttpObservations(rows,{minimumSamples=30}={}){
 if(!Array.isArray(rows)||rows.length>10000||!Number.isSafeInteger(minimumSamples)||
    minimumSamples<1||minimumSamples>10000)return Object.freeze({status:"invalid_evidence",products:[]});
 const groups=new Map(SUITES.map(s=>[s,[]]));
 for(const r of rows){
  if(!r||!SUITES.includes(r.suite)||!Number.isInteger(r.status)||r.status<100||r.status>599||
     !Number.isFinite(r.latencyMs)||r.latencyMs<0||r.latencyMs>600000)
    return Object.freeze({status:"invalid_evidence",products:[]});
  groups.get(r.suite).push({failed:r.status>=500,ms:r.latencyMs});
 }
 return Object.freeze({status:"measured",products:Object.freeze(SUITES.map(suite=>{
  const data=groups.get(suite),failures=data.filter(x=>x.failed).length;
  const sorted=data.map(x=>x.ms).sort((a,b)=>a-b);
  const sufficient=data.length>=minimumSamples;
  return Object.freeze({suite,sampleCount:data.length,failures,
   status:sufficient?"measured":"insufficient_evidence",
   errorRate:sufficient?failures/data.length:null,
   p95Ms:sufficient?sorted[Math.ceil(sorted.length*.95)-1]:null});
 }))});
}
module.exports={SUITES,JOURNEYS,EFFECT_CLASSES,classifyHttpJourney,
 recoveryPolicyForEffect,summarizeProductHttpObservations};
