// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {timestampEvidence,deadlineFromAnchor,approvalWindow,
  calendarInterval,overlapMinutes,capacityFromCalendar}=
  require("../lib/sonara-time-authority.cjs");
describe("trusted time and calendar math",()=>{
  it("anchors deadlines to server receipt rather than a client clock",()=>{
    const out=timestampEvidence({
      serverReceivedAt:"2026-10-07T06:00:00Z",
      clientOccurredAt:"2026-10-07T05:40:00-04:00",
      timeZone:"America/New_York"
    });
    assert.equal(out.deadlineAnchor,"server_received_at");
    assert.ok(out.issues.includes("client_clock_skew_exceeds_policy"));
  });
  it("only trusts provider time when provider verification is explicit",()=>{
    let out=timestampEvidence({serverReceivedAt:"2026-10-07T06:00:00Z",
      providerOccurredAt:"2026-10-07T05:59:58Z",providerVerified:false});
    assert.equal(out.providerAnchorTrusted,false);
    assert.ok(out.issues.includes("provider_timestamp_unverified"));
    out=timestampEvidence({serverReceivedAt:"2026-10-07T06:00:00Z",
      providerOccurredAt:"2026-10-07T05:59:58Z",providerVerified:true});
    assert.equal(out.providerAnchorTrusted,true);
  });
  it("calculates deadline from trusted server anchor",()=>{
    const out=deadlineFromAnchor({serverReceivedAt:"2026-10-07T06:00:00Z",durationSeconds:172800});
    assert.equal(out.dueAt,"2026-10-09T06:00:00.000Z");
    assert.equal(out.actionExecuted,false);
  });
  it("refuses use of an unverified provider timestamp as deadline authority",()=>{
    assert.throws(()=>deadlineFromAnchor({serverReceivedAt:"2026-10-07T06:00:00Z",
      providerOccurredAt:"2026-10-07T05:59:00Z",providerVerified:false,
      useProviderAnchor:true,durationSeconds:60}),/provider_anchor_unverified/);
  });
  it("marks approval decisions inside or outside immutable windows",()=>{
    assert.equal(approvalWindow({requestedAt:"2026-10-07T06:00:00Z",
      ttlSeconds:900,decisionAt:"2026-10-07T06:14:59Z"}).state,"within_window");
    assert.equal(approvalWindow({requestedAt:"2026-10-07T06:00:00Z",
      ttlSeconds:900,decisionAt:"2026-10-07T06:16:00Z"}).state,"expired");
  });
  it("requires offset-aware RFC3339 calendar timestamps",()=>{
    assert.throws(()=>calendarInterval({startAt:"2026-10-07 09:00",
      endAt:"2026-10-07T10:00:00-04:00",timeZone:"America/New_York"}),/invalid_start_at/);
  });
  it("calculates actual elapsed minutes across offset changes",()=>{
    const out=calendarInterval({startAt:"2026-11-01T01:00:00-04:00",
      endAt:"2026-11-01T01:00:00-05:00",timeZone:"America/New_York"});
    assert.equal(out.durationMinutes,60);
  });
  it("calculates calendar overlap without double-booking assumptions",()=>{
    const a={startAt:"2026-10-07T09:00:00-04:00",endAt:"2026-10-07T10:00:00-04:00",
      timeZone:"America/New_York"};
    const b={startAt:"2026-10-07T09:30:00-04:00",endAt:"2026-10-07T11:00:00-04:00",
      timeZone:"America/New_York"};
    assert.equal(overlapMinutes(a,b),30);
  });
  it("turns available minutes into whole-job capacity without promising a schedule",()=>{
    const out=capacityFromCalendar({availableMinutes:480,minutesPerJob:90,bufferMinutesPerJob:15});
    assert.equal(out.maximumWholeJobs,4);
    assert.equal(out.schedulingGuaranteed,false);
  });
  it("refuses impossible intervals and unsupported zones",()=>{
    assert.throws(()=>calendarInterval({startAt:"2026-10-07T10:00:00Z",
      endAt:"2026-10-07T09:00:00Z"}),/end_must_follow_start/);
    assert.throws(()=>calendarInterval({startAt:"2026-10-07T09:00:00Z",
      endAt:"2026-10-07T10:00:00Z",timeZone:"Mars\/Olympus"}),/invalid_time_zone/);
  });
});
