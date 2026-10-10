// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { assessCheckoutMethod, describePaymentEvent } = require("../lib/sonara-checkout-method-review.cjs");
const ORG="f8ef1eb3-8000-4000-9000-e69941bf5000";
const integration={settings:{governance:{
  commercial:{status:"approved",termsUrl:"https://developer.paypal.com",reviewedAt:"2026-10-09"},
  rateLimit:{mode:"durable_local",maxRequests:100,windowSeconds:60},
  operator:{mode:"human_approval"},ai:{mode:"disabled"},secrets:"server_only",organizationScoped:true
}},providerVerification:{serverDerived:true,connectionAssessmentState:"provider_connection_review_ready",
  providerAccountBindingVerified:true,credentialReferenceVerified:true,originVerified:true,oauthGrantVerified:true}};
const elig={organizationId:ORG,method:"paypal_venmo",eligible:true,serverVerified:true,
  source:"verified_provider_sdk_server_bound",checkedAtUtc:"2026-10-09T15:59:50Z"};
const price={organizationId:ORG,amountCents:2000,currency:"USD",
  serverVerified:true,revision:"rev_1",checkedAtUtc:"2026-10-09T15:59:50Z"};
function review(changes={}){return assessCheckoutMethod({organizationId:ORG,authenticatedOrganizationId:ORG,
  method:"paypal_venmo",flow:"business_invoice",channel:"web",
  merchantCountry:"US",buyerCountry:"US",currency:"USD",amountCents:2000,
  merchantBinding:{organizationId:ORG,provider:"paypal",accountReference:"merchant_1",serverVerified:true},
  priceSnapshot:price,methodEligibility:elig,integration,nowUtc:"2026-10-09T16:00:00Z",...changes});}
const has=(x,s)=>assert.ok(x.blockers.includes(s),s+": "+JSON.stringify(x.blockers));
describe("processor-specific checkout previews",()=>{
  it("reaches technical review, never payment or order authority",()=>{
    const r=review();assert.equal(r.status,"sandbox_integration_review_candidate");
    assert.deepEqual(r.blockers,[]);
    for(const k of ["checkoutEnabled","mayCreatePayment","mayCapture","mayRefund","mayPayout",
      "mayFulfillOrder","executionAuthorized"])assert.equal(r[k],false);
  });
  it("fails on wrong or malformed authenticated tenant",()=>{
    has(review({authenticatedOrganizationId:"foreign"}),"tenant_authority_unverified");
    has(review({organizationId:"not-uuid"}),"tenant_authority_unverified");
  });
  it("refuses non-US or non-USD Venmo",()=>{
    has(review({buyerCountry:"CA"}),"method_geography_or_currency_ineligible");
    has(review({currency:"EUR"}),"method_geography_or_currency_ineligible");
  });
  it("allows Square Cash App candidate only with Square-specific evidence",()=>{
    const r=review({method:"square_cash_app_pay",
      merchantBinding:{organizationId:ORG,provider:"square",accountReference:"square_account",serverVerified:true},
      methodEligibility:{...elig,method:"square_cash_app_pay"}});
    assert.equal(r.status,"sandbox_integration_review_candidate");
    assert.equal(r.checkoutEnabled,false);
    has(review({method:"square_cash_app_pay",buyerCountry:"GB"}),"method_geography_or_currency_ineligible");
  });
  it("blocks unsupported payouts, subscriptions, custody and casino monetary flows",()=>{
    for(const flow of ["casino_wager","wallet_stored_value","sonara_subscription",
      "creator_marketplace","customer_to_customer_transfer"])
      has(review({flow}),"unsupported_money_flow");
  });
  it("blocks Android Auto as a checkout channel",()=>{
    has(review({channel:"android_auto"}),"unsupported_checkout_channel");
  });
  it("refuses mismatched processor account",()=>{
    has(review({merchantBinding:{organizationId:ORG,provider:"square",accountReference:"x",serverVerified:true}}),
      "merchant_provider_binding_unverified");
  });
  it("refuses missing, stale and browser-claimed eligibility",()=>{
    has(review({methodEligibility:null}),"live_method_eligibility_unverified");
    has(review({methodEligibility:{...elig,source:"browser_claim"}}),"live_method_eligibility_unverified");
    has(review({nowUtc:"2026-10-09T16:10:00Z"}),"live_method_eligibility_unverified");
  });
  it("rejects changed and untrusted pricing",()=>{
    has(review({priceSnapshot:{...price,amountCents:3000}}),"price_snapshot_unverified");
    has(review({priceSnapshot:{...price,serverVerified:false}}),"price_snapshot_unverified");
  });
  it("reuses existing commercial and provider-auth review",()=>{
    const r=review({integration:{...integration,providerVerification:{
      ...integration.providerVerification,oauthGrantVerified:false}}});
    has(r,"integration_activation_gate_not_satisfied");
    assert.ok(r.activationBlockers.includes("oauth_grant_verification_required"));
  });
  it("never equates PayPal approval or pending capture to payment completion",()=>{
    const proof={provider:"paypal",signatureVerified:true,providerAccountBound:true,
      organizationVerified:true,eventUnique:true};
    for(const eventType of ["CHECKOUT.ORDER.APPROVED","PAYMENT.CAPTURE.PENDING","PAYMENT.CAPTURE.DENIED"]){
      const r=describePaymentEvent({...proof,eventType});
      assert.equal(r.fulfillAuthorized,false);assert.equal(r.settled,false);
    }
  });
  it("requires reconciliation even on verified completed event",()=>{
    const proof={provider:"paypal",eventType:"PAYMENT.CAPTURE.COMPLETED",
      signatureVerified:true,providerAccountBound:true,organizationVerified:true,eventUnique:true};
    assert.equal(describePaymentEvent(proof).status,"completed_requires_order_reconciliation");
    assert.equal(describePaymentEvent(proof).fulfillAuthorized,false);
    assert.equal(describePaymentEvent({...proof,eventUnique:false}).status,"unverified_event");
  });
});
