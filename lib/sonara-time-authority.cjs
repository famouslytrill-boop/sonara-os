// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

const RFC3339=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
function instant(value,name){
  if(typeof value!=="string"||!RFC3339.test(value))throw new Error("invalid_"+name);
  const t=Date.parse(value);
  if(!Number.isFinite(t))throw new Error("invalid_"+name);
  return t;
}
function zoneOk(zone){
  if(typeof zone!=="string"||zone.length>80)return false;
  try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format(new Date(0));return true;}
  catch{return false;}
}
function timestampEvidence({
  serverReceivedAt,clientOccurredAt,providerOccurredAt,
  providerVerified=false,maxClientSkewSeconds=300,timeZone="UTC"
}={}){
  const server=instant(serverReceivedAt,"server_received_at");
  if(!zoneOk(timeZone))throw new Error("invalid_time_zone");
  const issues=[];
  let client=null,provider=null,skew=null;
  if(clientOccurredAt){
    client=instant(clientOccurredAt,"client_occurred_at");
    skew=Math.abs(server-client)/1000;
    if(skew>maxClientSkewSeconds)issues.push("client_clock_skew_exceeds_policy");
  }
  if(providerOccurredAt){
    provider=instant(providerOccurredAt,"provider_occurred_at");
    if(providerVerified!==true)issues.push("provider_timestamp_unverified");
  }
  return Object.freeze({
    serverReceivedAt:new Date(server).toISOString(),
    clientOccurredAt:client===null?null:new Date(client).toISOString(),
    providerOccurredAt:provider===null?null:new Date(provider).toISOString(),
    clientClockSkewSeconds:skew,
    issues:Object.freeze(issues),
    deadlineAnchor:"server_received_at",
    providerAnchorTrusted:provider!==null&&providerVerified===true,
    timeZone
  });
}
function deadlineFromAnchor({
  serverReceivedAt,providerOccurredAt,providerVerified=false,
  useProviderAnchor=false,durationSeconds
}={}){
  const server=instant(serverReceivedAt,"server_received_at");
  if(!Number.isSafeInteger(durationSeconds)||durationSeconds<=0||durationSeconds>31536000)
    throw new Error("invalid_duration_seconds");
  let anchor=server,source="server_received_at";
  if(useProviderAnchor){
    if(providerVerified!==true)throw new Error("provider_anchor_unverified");
    anchor=instant(providerOccurredAt,"provider_occurred_at");
    source="verified_provider_occurred_at";
  }
  return Object.freeze({
    anchorAt:new Date(anchor).toISOString(),anchorSource:source,
    dueAt:new Date(anchor+durationSeconds*1000).toISOString(),
    durationSeconds,actionExecuted:false
  });
}
function approvalWindow({requestedAt,ttlSeconds=900,decisionAt}={}){
  const start=instant(requestedAt,"requested_at");
  if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>86400)
    throw new Error("invalid_approval_ttl");
  const expiry=start+ttlSeconds*1000;
  let state="open",decision=null;
  if(decisionAt){
    decision=instant(decisionAt,"decision_at");
    state=decision<start?"invalid_decision_time":decision>expiry?"expired":"within_window";
  }
  return Object.freeze({
    requestedAt:new Date(start).toISOString(),
    expiresAt:new Date(expiry).toISOString(),
    decisionAt:decision===null?null:new Date(decision).toISOString(),state
  });
}
function calendarInterval({startAt,endAt,timeZone="UTC",maxDurationMinutes=10080}={}){
  if(!zoneOk(timeZone))throw new Error("invalid_time_zone");
  const start=instant(startAt,"start_at"),end=instant(endAt,"end_at");
  if(end<=start)throw new Error("end_must_follow_start");
  const minutes=(end-start)/60000;
  if(!Number.isInteger(minutes)||minutes>maxDurationMinutes)
    throw new Error("calendar_duration_out_of_range");
  return Object.freeze({
    startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),
    durationMinutes:minutes,timeZone
  });
}
function overlapMinutes(a,b){
  const x=calendarInterval(a),y=calendarInterval(b);
  const start=Math.max(Date.parse(x.startAt),Date.parse(y.startAt));
  const end=Math.min(Date.parse(x.endAt),Date.parse(y.endAt));
  return Math.max(0,Math.floor((end-start)/60000));
}
function capacityFromCalendar({availableMinutes,minutesPerJob,bufferMinutesPerJob=0}={}){
  if(!Number.isSafeInteger(availableMinutes)||availableMinutes<0)throw new Error("invalid_available_minutes");
  if(!Number.isSafeInteger(minutesPerJob)||minutesPerJob<=0)throw new Error("invalid_minutes_per_job");
  if(!Number.isSafeInteger(bufferMinutesPerJob)||bufferMinutesPerJob<0)throw new Error("invalid_buffer_minutes_per_job");
  const slot=minutesPerJob+bufferMinutesPerJob;
  return Object.freeze({
    maximumWholeJobs:Math.floor(availableMinutes/slot),
    unusedMinutes:availableMinutes%slot,
    schedulingGuaranteed:false
  });
}
module.exports={timestampEvidence,deadlineFromAnchor,approvalWindow,
  calendarInterval,overlapMinutes,capacityFromCalendar};
