// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic review/testimonial governance. This does not publish, delete,
// solicit, pay for, or legally certify a review. It separates the customer's
// authorship confirmation from the business's moderation/publishing decision.
// The business cannot approve "for" the customer or rewrite their experience.
const SHA256=/^[a-f0-9]{64}$/i;
const MODERATION_REASONS=Object.freeze(new Set([
  "none","duplicate","off_topic","privacy_or_personal_data","harassment_or_threat",
  "illegal_content","suspected_fraud_or_no_actual_experience","technical_spam"
]));
const RELATIONSHIPS=Object.freeze(new Set([
  "ordinary_customer","employee","owner_or_manager","family_or_close_relation",
  "paid_or_gifted_reviewer","contractor_or_partner"
]));
const AI_ASSISTANCE=Object.freeze(new Set(["none","grammar_suggestion","business_drafted","fully_ai_generated"]));

function reviewAuthorApproval({
  reviewHash,authorApprovedHash,authorAuthenticated=false,
  actualExperienceAttested=false,approvalCapturedAt,reviewChangedAfterApproval=false
}={}){
  const blockers=[];
  if(!SHA256.test(reviewHash||"")||!SHA256.test(authorApprovedHash||""))blockers.push("review_hash_unverified");
  if(reviewHash!==authorApprovedHash)blockers.push("author_did_not_approve_current_text");
  if(authorAuthenticated!==true)blockers.push("review_author_identity_unverified");
  if(actualExperienceAttested!==true)blockers.push("actual_experience_not_attested");
  if(reviewChangedAfterApproval===true)blockers.push("review_changed_after_author_approval");
  const t=typeof approvalCapturedAt==="string"?Date.parse(approvalCapturedAt):NaN;
  if(!Number.isFinite(t))blockers.push("author_approval_timestamp_invalid");
  return Object.freeze({
    state:blockers.length?"author_confirmation_blocked":"exact_text_author_confirmed",
    blockers:Object.freeze(blockers),
    businessApprovalSubstitutesForAuthor:false,
    publishAuthorized:false
  });
}

function reviewPublicationGate({
  reviewHash,authorApprovedHash,authorAuthenticated=false,
  actualExperienceAttested=false,approvalCapturedAt,
  relationship="ordinary_customer",relationshipDisclosed=false,
  incentiveOffered=false,incentiveSentimentConditioned=false,incentiveDisclosed=false,
  aiAssistance="none",authorReapprovedAfterAssistance=false,
  businessEditedAfterApproval=false,
  sentiment="neutral",moderationReason="none",
  positiveAndNegativeModeratedUnderSameRules=false,
  platformRepresentsReviewsAsAllSubmitted=false,
  suppressedOtherwiseGenuineReview=false,
  legalThreatenedToPreventOrRemoveReview=false,legalThreatBasisVerified=false,
  businessControlsPage=false,pageClaimsIndependent=false
}={}){
  const author=reviewAuthorApproval({
    reviewHash,authorApprovedHash,authorAuthenticated,actualExperienceAttested,
    approvalCapturedAt,reviewChangedAfterApproval:businessEditedAfterApproval
  });
  const blockers=[...author.blockers];
  const disclosures=[];
  if(!RELATIONSHIPS.has(relationship))blockers.push("review_relationship_unknown");
  if(!AI_ASSISTANCE.has(aiAssistance))blockers.push("ai_assistance_unknown");
  if(!["positive","neutral","negative"].includes(sentiment))blockers.push("sentiment_unknown");
  if(!MODERATION_REASONS.has(moderationReason))blockers.push("moderation_reason_unknown");

  if(aiAssistance==="business_drafted"||aiAssistance==="fully_ai_generated")
    blockers.push("business_or_ai_cannot_impersonate_consumer_review");
  if(aiAssistance==="grammar_suggestion"&&authorReapprovedAfterAssistance!==true)
    blockers.push("assisted_edit_requires_exact_text_reapproval");

  if(incentiveSentimentConditioned===true)
    blockers.push("sentiment_conditioned_review_incentive_prohibited");
  if(incentiveOffered===true){
    disclosures.push("review_incentive_relationship");
    if(incentiveDisclosed!==true)blockers.push("review_incentive_disclosure_missing");
  }

  if(relationship!=="ordinary_customer"){
    disclosures.push("material_reviewer_relationship");
    if(relationshipDisclosed!==true)blockers.push("reviewer_relationship_disclosure_missing");
  }

  if(positiveAndNegativeModeratedUnderSameRules!==true)
    blockers.push("equal_moderation_policy_unverified");
  if(moderationReason==="none"&&suppressedOtherwiseGenuineReview===true)
    blockers.push("genuine_review_suppression_unexplained");
  if(sentiment==="negative"&&suppressedOtherwiseGenuineReview===true&&moderationReason==="none")
    blockers.push("negative_review_suppression_not_allowed");
  if(platformRepresentsReviewsAsAllSubmitted===true&&suppressedOtherwiseGenuineReview===true)
    blockers.push("all_reviews_representation_would_be_misleading");
  if(legalThreatenedToPreventOrRemoveReview===true&&legalThreatBasisVerified!==true)
    blockers.push("unfounded_legal_threat_review_suppression_prohibited");
  if(businessControlsPage===true&&pageClaimsIndependent===true)
    blockers.push("business_controlled_page_cannot_claim_independent_reviews");

  return Object.freeze({
    state:blockers.length?"hold_for_review":"publication_review_ready",
    blockers:Object.freeze([...new Set(blockers)]),
    requiredDisclosures:Object.freeze([...new Set(disclosures)]),
    authorState:author.state,
    customerApprovedOwnExactText:author.state==="exact_text_author_confirmed",
    moderationMayEditMessage:false,
    publicationAuthorized:false,
    reviewTruthCertified:false,
    aiGeneratedConsumerReviewAllowed:false,
    legalThreatActionExecuted:false
  });
}

function solicitationGate({
  experiencedCustomersEligible=true,
  audienceSelectedForExpectedPositiveSentiment=false,
  incentiveOffered=false,incentiveSentimentConditioned=false,
  incentiveDisclosurePlanned=false
}={}){
  const blockers=[];
  if(experiencedCustomersEligible!==true)blockers.push("solicitation_may_reach_noncustomers");
  if(audienceSelectedForExpectedPositiveSentiment===true)
    blockers.push("positive_sentiment_review_gating_not_allowed");
  if(incentiveSentimentConditioned===true)
    blockers.push("sentiment_conditioned_review_incentive_prohibited");
  if(incentiveOffered===true&&incentiveDisclosurePlanned!==true)
    blockers.push("incentive_disclosure_plan_missing");
  return Object.freeze({
    state:blockers.length?"solicitation_blocked":"solicitation_policy_ready",
    blockers:Object.freeze(blockers),messageSent:false
  });
}

module.exports={MODERATION_REASONS,RELATIONSHIPS,AI_ASSISTANCE,
  reviewAuthorApproval,reviewPublicationGate,solicitationGate};
