// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const crypto = require("node:crypto");

const SCOPE_KINDS = Object.freeze(new Set(["ip","user","organization","automation","provider"]));
const OPERATION = /^[a-z0-9_:-]{1,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_UNITS = 1000000000;
const RPC_TIMEOUT_MS = 5000;

function safePositiveInt(value,name,max=MAX_UNITS){
  if(!Number.isSafeInteger(value)||value<1||value>max)throw new Error("invalid_"+name);
  return value;
}
function safeNonnegativeInt(value,name,max=MAX_UNITS){
  if(!Number.isSafeInteger(value)||value<0||value>max)throw new Error("invalid_"+name);
  return value;
}
function budgetBucketKey({scopeKind,subjectId,operationKey}={}){
  if(!SCOPE_KINDS.has(scopeKind))throw new Error("invalid_resource_budget_scope");
  if(typeof subjectId!=="string"||subjectId.length<1||subjectId.length>512)
    throw new Error("invalid_resource_budget_subject");
  if(!OPERATION.test(String(operationKey||"")))throw new Error("invalid_resource_budget_operation");
  return crypto.createHash("sha256")
    .update("sonara-resource-budget:v1\0"+scopeKind+"\0"+operationKey+"\0"+subjectId)
    .digest("hex");
}
function configOf(deps){
  const config=typeof deps?.getSupabaseServerConfig==="function"
    ? deps.getSupabaseServerConfig():null;
  if(!config?.ok||typeof config.url!=="string"||!config.url.startsWith("https://")
    ||typeof config.serviceRoleKey!=="string"||config.serviceRoleKey.length<16){
    return null;
  }
  return config;
}
async function callRpc(config,name,payload,fetchImpl){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),RPC_TIMEOUT_MS);
  let response;
  try{
    response=await fetchImpl(config.url+"/rest/v1/rpc/"+name,{
      method:"POST",
      headers:{
        apikey:config.serviceRoleKey,
        Authorization:"Bearer "+config.serviceRoleKey,
        "Content-Type":"application/json"
      },
      body:JSON.stringify(payload),
      signal:controller.signal
    });
  }catch{
    return {ok:false,code:"resource_budget_store_unreachable"};
  }finally{
    clearTimeout(timer);
  }
  if(!response?.ok)return {ok:false,code:"resource_budget_store_rejected",status:response?.status||0};
  const body=await response.json().catch(()=>null);
  const row=Array.isArray(body)?body[0]:body;
  if(!row||typeof row!=="object")return {ok:false,code:"resource_budget_store_malformed"};
  return {ok:true,row};
}
function numberField(row,key,{nullable=false}={}){
  if(nullable&&row[key]===null)return null;
  const value=Number(row[key]);
  if(!Number.isSafeInteger(value)||value<0)throw new Error("malformed_"+key);
  return value;
}

async function consumeDurableResourceBudget(deps,{
  bucketKey,operationKey,capacityUnits,refillUnitsPerMinute,dailyLimitUnits,costUnits
}={},fetchImpl){
  if(!/^[a-f0-9]{64}$/.test(String(bucketKey||"")))return {ok:false,code:"invalid_resource_budget_bucket"};
  if(!OPERATION.test(String(operationKey||"")))return {ok:false,code:"invalid_resource_budget_operation"};
  try{
    safePositiveInt(capacityUnits,"capacity_units");
    safeNonnegativeInt(refillUnitsPerMinute,"refill_units_per_minute");
    safePositiveInt(dailyLimitUnits,"daily_limit_units");
    safePositiveInt(costUnits,"cost_units");
  }catch(error){
    return {ok:false,code:error.message};
  }
  const config=configOf(deps);
  if(!config)return {ok:false,code:"durable_resource_budget_unavailable"};

  const transport=typeof fetchImpl==="function"?fetchImpl:globalThis.fetch;
  if(typeof transport!=="function")return {ok:false,code:"durable_resource_budget_unavailable"};
  const result=await callRpc(config,"sonara_consume_resource_budget",{
    p_bucket_key:bucketKey,p_operation_key:operationKey,
    p_capacity_units:capacityUnits,p_refill_units_per_minute:refillUnitsPerMinute,
    p_daily_limit_units:dailyLimitUnits,p_cost_units:costUnits
  },transport);
  if(!result.ok)return result;
  try{
    if(typeof result.row.allowed!=="boolean"||typeof result.row.reason!=="string")
      throw new Error("malformed_budget_decision");
    return Object.freeze({
      ok:true,allowed:result.row.allowed,reason:result.row.reason,
      remainingUnits:numberField(result.row,"remaining_units"),
      dailyRemainingUnits:numberField(result.row,"daily_remaining_units"),
      retryAfterSeconds:numberField(result.row,"retry_after_seconds"),
      durable:true,budgetConsumed:result.row.allowed
    });
  }catch{
    return {ok:false,code:"resource_budget_store_malformed"};
  }
}

async function claimDurableConcurrency(deps,{
  bucketKey,leaseId,concurrencyLimit,leaseSeconds=300
}={},fetchImpl){
  if(!/^[a-f0-9]{64}$/.test(String(bucketKey||"")))return {ok:false,code:"invalid_resource_budget_bucket"};
  if(!UUID.test(String(leaseId||"")))return {ok:false,code:"invalid_resource_budget_lease"};
  try{
    safePositiveInt(concurrencyLimit,"concurrency_limit",100);
    if(!Number.isSafeInteger(leaseSeconds)||leaseSeconds<30||leaseSeconds>3600)
      throw new Error("invalid_lease_seconds");
  }catch(error){return {ok:false,code:error.message};}
  const config=configOf(deps);
  if(!config)return {ok:false,code:"durable_resource_budget_unavailable"};
  const transport=typeof fetchImpl==="function"?fetchImpl:globalThis.fetch;
  if(typeof transport!=="function")return {ok:false,code:"durable_resource_budget_unavailable"};
  const result=await callRpc(config,"sonara_claim_resource_concurrency",{
    p_bucket_key:bucketKey,p_lease_id:leaseId,
    p_concurrency_limit:concurrencyLimit,p_lease_seconds:leaseSeconds
  },transport);
  if(!result.ok)return result;
  try{
    if(typeof result.row.allowed!=="boolean"||typeof result.row.reason!=="string")
      throw new Error("malformed_concurrency_decision");
    const expires=result.row.lease_expires_at;
    if(expires!==null&&(!Number.isFinite(Date.parse(expires))))throw new Error("malformed_lease_expiry");
    return Object.freeze({
      ok:true,allowed:result.row.allowed,reason:result.row.reason,
      activeLeases:numberField(result.row,"active_leases"),
      leaseExpiresAt:expires||null,durable:true,
      leaseAcquired:result.row.allowed
    });
  }catch{
    return {ok:false,code:"resource_budget_store_malformed"};
  }
}

async function releaseDurableConcurrency(deps,{bucketKey,leaseId}={},fetchImpl){
  if(!/^[a-f0-9]{64}$/.test(String(bucketKey||"")))return {ok:false,code:"invalid_resource_budget_bucket"};
  if(!UUID.test(String(leaseId||"")))return {ok:false,code:"invalid_resource_budget_lease"};
  const config=configOf(deps);
  if(!config)return {ok:false,code:"durable_resource_budget_unavailable"};
  const transport=typeof fetchImpl==="function"?fetchImpl:globalThis.fetch;
  if(typeof transport!=="function")return {ok:false,code:"durable_resource_budget_unavailable"};
  const result=await callRpc(config,"sonara_release_resource_concurrency",{
    p_bucket_key:bucketKey,p_lease_id:leaseId
  },transport);
  if(!result.ok)return result;
  if(typeof result.row.released!=="boolean")return {ok:false,code:"resource_budget_store_malformed"};
  return Object.freeze({ok:true,released:result.row.released,durable:true});
}

async function acquireDurableRunEnvelope(deps,{
  bucketKey,leaseId,operationKey,capacityUnits,refillUnitsPerMinute,
  dailyLimitUnits,costUnits,concurrencyLimit,leaseSeconds=300
}={},fetchImpl){
  const lease=await claimDurableConcurrency(deps,{
    bucketKey,leaseId,concurrencyLimit,leaseSeconds
  },fetchImpl);
  if(!lease.ok||!lease.allowed){
    return Object.freeze({
      ok:lease.ok,allowed:false,reason:lease.reason||lease.code,
      lease,budget:null,leaseHeld:false,budgetConsumed:false,
      cleanupPending:false,externalSideEffectAuthorized:false
    });
  }

  const budget=await consumeDurableResourceBudget(deps,{
    bucketKey,operationKey,capacityUnits,refillUnitsPerMinute,dailyLimitUnits,costUnits
  },fetchImpl);
  if(!budget.ok||!budget.allowed){
    const cleanup=await releaseDurableConcurrency(deps,{bucketKey,leaseId},fetchImpl);
    return Object.freeze({
      ok:budget.ok,allowed:false,reason:budget.reason||budget.code,
      lease,budget,leaseHeld:cleanup.ok?false:true,
      budgetConsumed:false,
      cleanupPending:!cleanup.ok,
      cleanupResult:cleanup,
      externalSideEffectAuthorized:false
    });
  }

  return Object.freeze({
    ok:true,allowed:true,reason:"resource_envelope_acquired",
    lease,budget,leaseHeld:true,budgetConsumed:true,
    cleanupPending:false,externalSideEffectAuthorized:false
  });
}

module.exports={SCOPE_KINDS,RPC_TIMEOUT_MS,budgetBucketKey,consumeDurableResourceBudget,
  claimDurableConcurrency,releaseDurableConcurrency,acquireDurableRunEnvelope};
