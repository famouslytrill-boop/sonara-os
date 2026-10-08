// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

// Descriptive moderation metrics only. They identify review-policy disparities
// for human audit; they do not infer illegality, reviewer truthfulness, intent,
// protected traits, or a lawful basis for removal.
function count(value,name){
  if(!Number.isSafeInteger(value)||value<0)throw new Error("invalid_"+name);
  return value;
}
function rateBps(part,total){
  if(total===0)return null;
  return Math.floor(part*10000/total);
}
function moderationMetrics({
  positiveSubmitted,positiveHeld,positiveRemoved,
  neutralSubmitted,neutralHeld,neutralRemoved,
  negativeSubmitted,negativeHeld,negativeRemoved
}={}){
  const p=count(positiveSubmitted,"positive_submitted"),
    ph=count(positiveHeld,"positive_held"),pr=count(positiveRemoved,"positive_removed");
  const n=count(neutralSubmitted,"neutral_submitted"),
    nh=count(neutralHeld,"neutral_held"),nr=count(neutralRemoved,"neutral_removed");
  const g=count(negativeSubmitted,"negative_submitted"),
    gh=count(negativeHeld,"negative_held"),gr=count(negativeRemoved,"negative_removed");
  if(ph+pr>p||nh+nr>n||gh+gr>g)throw new Error("moderation_counts_exceed_submissions");
  const positiveAction=rateBps(ph+pr,p);
  const neutralAction=rateBps(nh+nr,n);
  const negativeAction=rateBps(gh+gr,g);
  const positiveRemoval=rateBps(pr,p);
  const negativeRemoval=rateBps(gr,g);
  const disparity=positiveAction===null||negativeAction===null?null:
    Math.abs(negativeAction-positiveAction);
  return Object.freeze({
    submitted:Object.freeze({positive:p,neutral:n,negative:g}),
    actionRateBasisPoints:Object.freeze({
      positive:positiveAction,neutral:neutralAction,negative:negativeAction
    }),
    removalRateBasisPoints:Object.freeze({
      positive:positiveRemoval,neutral:rateBps(nr,n),negative:negativeRemoval
    }),
    positiveNegativeActionDisparityBasisPoints:disparity,
    state:disparity===null?"insufficient_comparison_volume":"descriptive_metrics_ready",
    legalViolationDetermined:false,
    sentimentIsRemovalReason:false,
    requiresPolicyReasonAudit:disparity!==null&&disparity>=1000
  });
}
function reasonCoverage({moderatedCount,eventsWithAllowedReason}={}){
  const total=count(moderatedCount,"moderated_count");
  const covered=count(eventsWithAllowedReason,"events_with_allowed_reason");
  if(covered>total)throw new Error("reason_coverage_exceeds_moderated_count");
  return Object.freeze({
    moderatedCount:total,eventsWithAllowedReason:covered,
    coverageBasisPoints:total===0?null:Math.floor(covered*10000/total),
    complete:total===covered,
    reviewDeletionAuthorized:false
  });
}
module.exports={moderationMetrics,reasonCoverage};
