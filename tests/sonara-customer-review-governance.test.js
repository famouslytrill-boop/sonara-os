// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const {reviewAuthorApproval,reviewPublicationGate,solicitationGate}=
  require("../lib/sonara-customer-review-governance.cjs");
const H="a".repeat(64);
const valid=(o={})=>({
  reviewHash:H,authorApprovedHash:H,authorAuthenticated:true,
  actualExperienceAttested:true,approvalCapturedAt:"2026-10-07T06:30:00Z",
  relationship:"ordinary_customer",relationshipDisclosed:false,
  incentiveOffered:false,incentiveSentimentConditioned:false,incentiveDisclosed:false,
  aiAssistance:"none",authorReapprovedAfterAssistance:false,
  businessEditedAfterApproval:false,sentiment:"negative",moderationReason:"none",
  positiveAndNegativeModeratedUnderSameRules:true,
  platformRepresentsReviewsAsAllSubmitted:false,
  suppressedOtherwiseGenuineReview:false,
  businessControlsPage:false,pageClaimsIndependent:false,...o
});
describe("customer review/testimonial governance",()=>{
  it("lets a customer confirm their own exact review text without publishing it",()=>{
    const out=reviewAuthorApproval(valid());
    assert.equal(out.state,"exact_text_author_confirmed");
    assert.equal(out.publishAuthorized,false);
    assert.equal(out.businessApprovalSubstitutesForAuthor,false);
  });
  it("requires reapproval if the exact review bytes/hash changed",()=>{
    const out=reviewAuthorApproval(valid({authorApprovedHash:"b".repeat(64)}));
    assert.ok(out.blockers.includes("author_did_not_approve_current_text"));
  });
  it("holds a review if the business edited it after customer approval",()=>{
    const out=reviewPublicationGate(valid({businessEditedAfterApproval:true}));
    assert.ok(out.blockers.includes("review_changed_after_author_approval"));
    assert.equal(out.moderationMayEditMessage,false);
  });
  it("blocks business-drafted and fully AI-generated consumer reviews",()=>{
    for(const aiAssistance of ["business_drafted","fully_ai_generated"]){
      const out=reviewPublicationGate(valid({aiAssistance}));
      assert.ok(out.blockers.includes("business_or_ai_cannot_impersonate_consumer_review"));
      assert.equal(out.aiGeneratedConsumerReviewAllowed,false);
    }
  });
  it("allows grammar assistance only after the customer reapproves exact text",()=>{
    assert.ok(reviewPublicationGate(valid({aiAssistance:"grammar_suggestion"}))
      .blockers.includes("assisted_edit_requires_exact_text_reapproval"));
    const out=reviewPublicationGate(valid({aiAssistance:"grammar_suggestion",authorReapprovedAfterAssistance:true}));
    assert.equal(out.state,"publication_review_ready");
  });
  it("blocks incentives conditioned on positive or negative sentiment",()=>{
    const out=reviewPublicationGate(valid({
      incentiveOffered:true,incentiveSentimentConditioned:true,incentiveDisclosed:true
    }));
    assert.ok(out.blockers.includes("sentiment_conditioned_review_incentive_prohibited"));
  });
  it("requires disclosure when an incentive is offered without a sentiment condition",()=>{
    const bad=reviewPublicationGate(valid({incentiveOffered:true,incentiveDisclosed:false}));
    assert.ok(bad.blockers.includes("review_incentive_disclosure_missing"));
    const good=reviewPublicationGate(valid({incentiveOffered:true,incentiveDisclosed:true}));
    assert.ok(good.requiredDisclosures.includes("review_incentive_relationship"));
  });
  it("requires material insider/relationship disclosure",()=>{
    const out=reviewPublicationGate(valid({relationship:"employee",relationshipDisclosed:false}));
    assert.ok(out.blockers.includes("reviewer_relationship_disclosure_missing"));
  });
  it("requires equivalent moderation rules for positive and negative reviews",()=>{
    const out=reviewPublicationGate(valid({positiveAndNegativeModeratedUnderSameRules:false}));
    assert.ok(out.blockers.includes("equal_moderation_policy_unverified"));
  });
  it("blocks unexplained suppression of an otherwise genuine negative review",()=>{
    const out=reviewPublicationGate(valid({suppressedOtherwiseGenuineReview:true}));
    assert.ok(out.blockers.includes("genuine_review_suppression_unexplained"));
    assert.ok(out.blockers.includes("negative_review_suppression_not_allowed"));
  });
  it("blocks a business-controlled page from claiming independent review status",()=>{
    const out=reviewPublicationGate(valid({businessControlsPage:true,pageClaimsIndependent:true}));
    assert.ok(out.blockers.includes("business_controlled_page_cannot_claim_independent_reviews"));
  });
  it("solicits broadly from eligible experienced customers rather than positive-only gating",()=>{
    assert.equal(solicitationGate({experiencedCustomersEligible:true,
      audienceSelectedForExpectedPositiveSentiment:false}).state,"solicitation_policy_ready");
    assert.ok(solicitationGate({experiencedCustomersEligible:true,
      audienceSelectedForExpectedPositiveSentiment:true})
      .blockers.includes("positive_sentiment_review_gating_not_allowed"));
  });
});
