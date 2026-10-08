// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert=require("node:assert/strict");
const {moderationMetrics,reasonCoverage}=require("../lib/sonara-review-moderation-metrics.cjs");
describe("review moderation audit metrics",()=>{
  it("calculates descriptive positive/negative moderation rates",()=>{
    const out=moderationMetrics({
      positiveSubmitted:100,positiveHeld:3,positiveRemoved:2,
      neutralSubmitted:50,neutralHeld:2,neutralRemoved:1,
      negativeSubmitted:100,negativeHeld:8,negativeRemoved:7
    });
    assert.equal(out.actionRateBasisPoints.positive,500);
    assert.equal(out.actionRateBasisPoints.negative,1500);
    assert.equal(out.positiveNegativeActionDisparityBasisPoints,1000);
  });
  it("flags a large disparity for policy-reason audit without declaring illegality",()=>{
    const out=moderationMetrics({
      positiveSubmitted:100,positiveHeld:0,positiveRemoved:1,
      neutralSubmitted:0,neutralHeld:0,neutralRemoved:0,
      negativeSubmitted:100,negativeHeld:10,negativeRemoved:10
    });
    assert.equal(out.requiresPolicyReasonAudit,true);
    assert.equal(out.legalViolationDetermined,false);
    assert.equal(out.sentimentIsRemovalReason,false);
  });
  it("does not invent a rate when one sentiment has no submissions",()=>{
    const out=moderationMetrics({
      positiveSubmitted:0,positiveHeld:0,positiveRemoved:0,
      neutralSubmitted:1,neutralHeld:0,neutralRemoved:0,
      negativeSubmitted:10,negativeHeld:1,negativeRemoved:0
    });
    assert.equal(out.actionRateBasisPoints.positive,null);
    assert.equal(out.state,"insufficient_comparison_volume");
  });
  it("refuses impossible moderation counts",()=>{
    assert.throws(()=>moderationMetrics({
      positiveSubmitted:1,positiveHeld:1,positiveRemoved:1,
      neutralSubmitted:0,neutralHeld:0,neutralRemoved:0,
      negativeSubmitted:0,negativeHeld:0,negativeRemoved:0
    }),/moderation_counts_exceed_submissions/);
  });
  it("measures policy-reason coverage for moderated events",()=>{
    const out=reasonCoverage({moderatedCount:20,eventsWithAllowedReason:19});
    assert.equal(out.coverageBasisPoints,9500);
    assert.equal(out.complete,false);
    assert.equal(out.reviewDeletionAuthorized,false);
  });
  it("treats zero moderation volume as not applicable rather than 100 percent",()=>{
    const out=reasonCoverage({moderatedCount:0,eventsWithAllowedReason:0});
    assert.equal(out.coverageBasisPoints,null);
    assert.equal(out.complete,true);
  });
});
