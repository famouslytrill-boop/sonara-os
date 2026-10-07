// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const {
  SOFTWARE_FEES, MERCHANT_FLOWS, NEVER_SUPPORTED,
  externalPaymentLinkReview, lowCustodyDecision, externalReceiptEvidence
} = require("../lib/sonara-low-custody-policy.cjs");
const { connectReadiness, canAcceptPayments, createAccount, onboardingLink } =
  require("../lib/sonara-connected-payments.cjs");
const { checkoutReadiness, createSession, expireSession, retrieveSession, listSessions } =
  require("../lib/sonara-connected-checkout.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const FOREIGN="22222222-2222-4222-8222-222222222222";
const merchant=(overrides={})=>({
  flow:"merchant_storefront", tenantId:ORG,serverTenantId:ORG,
  merchantIdentityIndependentlyVerified:true,
  externalProviderAccountOwnedByMerchant:true,...overrides
});
const subscription=(overrides={})=>({
  flow:"sonara_subscription",tenantId:ORG,serverTenantId:ORG,
  platformBillingMerchantVerified:true,...overrides
});
const receipt=(overrides={})=>({
  flow:"business_invoice",organizationId:ORG,serverOrganizationId:ORG,
  method:"stripe_independent_merchant",sellerAttested:true,
  amountCents:12500,currency:"USD",externalReference:"seller_ref_123",...overrides
});
describe("SONARA low-budget / no-custody architecture decisions",()=>{
  it("routes only SONARA software revenue into platform merchant",()=>{
    const d=lowCustodyDecision(subscription());
    assert.equal(d.status,"software_fee_draft_ready");
    assert.equal(d.fundsDestination,"sonara_platform_software_revenue_only");
    assert.equal(d.paymentAuthorized,false);
    assert.equal(d.thirdPartyFundsTouched,false);
  });
  it("blocks platform software billing without own processor ownership proof",()=>{
    const d=lowCustodyDecision(subscription({platformBillingMerchantVerified:false}));
    assert.ok(d.blockers.includes("platform_billing_account_unverified"));
  });
  it("refuses to transfer SaaS fees to others",()=>{
    const d=lowCustodyDecision(subscription({callerWantsToTransfer:true}));
    assert.ok(d.blockers.includes("platform_payout_to_third_party_prohibited"));
  });
  it("separates customers' merchant checkout and rents from software billing",()=>{
    for(const flow of MERCHANT_FLOWS) {
      const d=lowCustodyDecision(merchant({flow}));
      assert.equal(d.status,"merchant_external_draft_ready");
      assert.equal(d.architecture,"merchant_managed_outside_sonara");
      assert.equal(d.responsibleMerchant,"customer_business");
      assert.equal(d.paymentAuthorized,false);
    }
  });
  it("does not let a merchant initiate charge/refund/verify through SONARA",()=>{
    for(const key of ["callerWantsToCharge","callerWantsToTransfer","callerWantsToVerifyPayment"]) {
      const d=lowCustodyDecision(merchant({[key]:true}));
      assert.ok(d.blockers.includes("sonara_must_not_execute_or_claim_external_payment"));
    }
  });
  it("never enables escrow, pooled deposits, merchant advances or P2P",()=>{
    for(const flow of NEVER_SUPPORTED) {
      const d=lowCustodyDecision(merchant({flow}));
      assert.equal(d.status,"blocked_pending_review");
      assert.ok(d.blockers.includes("regulated_money_movement_prohibited"));
    }
  });
  it("fails closed on cross-tenant access",()=>{
    assert.ok(lowCustodyDecision(merchant({serverTenantId:FOREIGN})).blockers.includes("tenant_scope_unverified"));
  });
  it("requires evidence that merchant owns an independent processor account",()=>{
    assert.ok(lowCustodyDecision(merchant({externalProviderAccountOwnedByMerchant:false}))
      .blockers.includes("independent_merchant_identity_and_provider_ownership_unverified"));
  });
  it("Connect mode remains blocked until all three reviews are recorded",()=>{
    const d=lowCustodyDecision(merchant({mode:"connect_direct_reviewed"}));
    assert.ok(d.blockers.includes("connect_authorization_missing"));
    assert.equal(d.paymentAuthorized,false);
  });
  it("Connect reviews never let this policy engine transfer money",()=>{
    const d=lowCustodyDecision(merchant({mode:"connect_direct_reviewed",
      explicitOwnerApprovedConnect:true,financeCounselConnectReview:true,
      connectLossConfigurationReviewed:true,callerWantsToTransfer:true}));
    assert.ok(d.blockers.includes("platform_payouts_prohibited"));
    assert.equal(d.paymentAuthorized,false);
  });
  it("invalid money modes remain blocked",()=>{
    assert.ok(lowCustodyDecision(merchant({mode:"pooled_wallet"})).blockers.includes("sonara_customer_money_mode_unverified"));
  });
  it("separates software and merchant revenue flow categories",()=>{
    assert.ok(SOFTWARE_FEES.includes("sonara_subscription"));
    assert.ok(!MERCHANT_FLOWS.includes("sonara_subscription"));
    assert.ok(MERCHANT_FLOWS.includes("rental_security_deposit"));
  });
});
describe("SONARA merchant-owned externally hosted links are not proof of identity",()=>{
  it("allows shape-checking genuine canonical processor links only",()=>{
    const d=externalPaymentLinkReview("https://buy.stripe.com/test_abc123");
    assert.equal(d.ok,true);
    assert.equal(d.verifiedMerchantOwner,false);
    assert.equal(d.executionAuthorized,false);
    assert.equal(d.authenticatedProcessorSession,false);
  });
  it("rejects lookalike domains and social redirect shorteners",()=>{
    for(const url of ["https://buy.stripe.com.phishing.test/pay",
      "https://buy-stripe.com/pay","https://stripe.com.evil.test/x",
      "https://bit.ly/a23","https://paypal.com.attacker.test/pay",
      "http://buy.stripe.com/pay","https://evil.test/pay"]) {
      assert.equal(externalPaymentLinkReview(url).ok,false,url);
    }
  });
  it("rejects credentials, custom ports and non-HTTPS protocols",()=>{
    for(const url of ["https://user:pass@buy.stripe.com/a",
      "https://buy.stripe.com:8080/a", "file:///etc/passwd",
      "javascript:alert(1)","https://buy.stripe.com/a#injected"]) {
      assert.equal(externalPaymentLinkReview(url).ok,false,url);
    }
  });
  it("rejects invalid URL types and overlong references",()=>{
    assert.equal(externalPaymentLinkReview(null).ok,false);
    assert.equal(externalPaymentLinkReview("x".repeat(2100)).ok,false);
    assert.equal(externalPaymentLinkReview("https://").ok,false);
  });
});
describe("SONARA externally reported payment receipts cannot become paid grants",()=>{
  it("preserves seller-reported receipt as unverified, even when all fields valid",()=>{
    const d=externalReceiptEvidence(receipt());
    assert.equal(d.status,"seller_reported_unverified");
    assert.equal(d.merchantSettlementVerified,false);
    assert.equal(d.buyerPaymentConfirmed,false);
    assert.equal(d.licenseDeliveryAuthorized,false);
    assert.equal(d.inventoryFulfillmentAuthorized,false);
    assert.equal(d.journalPosted,false);
  });
  it("cross-tenant external references are not recordable",()=>{
    const d=externalReceiptEvidence(receipt({serverOrganizationId:FOREIGN}));
    assert.ok(d.issues.includes("tenant_scope_unverified"));
  });
  it("wrong amounts and currencies are rejected",()=>{
    for(const bad of [{amountCents:0},{amountCents:22.5},{amountCents:-2},{currency:"JPY"}]) {
      assert.equal(externalReceiptEvidence(receipt(bad)).status,"blocked_pending_review");
    }
  });
  it("refuses self-reporting of SONARA subscription revenue as merchant evidence",()=>{
    assert.ok(externalReceiptEvidence(receipt({flow:"sonara_subscription"}))
      .issues.includes("merchant_flow_required"));
  });
  it("unknown payment methods and missing attestation remain blocked",()=>{
    assert.ok(externalReceiptEvidence(receipt({method:"sonara_escrow"})).issues.includes("external_method_unknown"));
    assert.ok(externalReceiptEvidence(receipt({sellerAttested:false})).issues.includes("seller_attestation_missing"));
  });
});

describe("runtime-reviewed low-custody opt-in switch",()=>{
  it("software-fees-only mode blocks marketplace and storefront checkout readiness",()=>{
    const deps={getEnv:key=>({
      SONARA_CUSTOMER_FUNDS_MODE:"external_only",
      STRIPE_CONNECT_ENABLED:"true",
      STRIPE_CONNECT_WEBHOOK_SECRET:"whsec_"+"a".repeat(40),
      STRIPE_SECRET_KEY:"sk_test_"+"b".repeat(40)
    })[key]};
    const gate=checkoutReadiness(deps);
    assert.equal(gate.ok,false);
    assert.equal(gate.status,"setup_required");
  });
  it("missing mode fails closed even when an old deployment enables Connect",()=>{
    const deps={getEnv:key=>({
      STRIPE_CONNECT_ENABLED:"true",STRIPE_SECRET_KEY:"sk_test_"+"b".repeat(40),
      STRIPE_CONNECT_WEBHOOK_SECRET:"whsec_"+"c".repeat(40)
    })[key]};
    const out=connectReadiness(deps);
    assert.equal(out.ok,false);
    assert.equal(out.status,"setup_required");
    assert.ok(out.detail.includes("only its own software fees"));
    assert.equal(checkoutReadiness(deps).ok,false);
  });
  it("unknown or misspelled funds modes fail closed",()=>{
    for(const SONARA_CUSTOMER_FUNDS_MODE of ["", "other", "custody_escrow", "external-only"]) {
      const deps={getEnv:key=>({
        SONARA_CUSTOMER_FUNDS_MODE, STRIPE_CONNECT_ENABLED:"true",
        STRIPE_SECRET_KEY:"sk_test_"+"a".repeat(40)
      })[key]};
      assert.equal(connectReadiness(deps).ok,false);
    }
  });
  it("Connect checkout requires both reviewed mode AND old feature flag",()=>{
    const deps={getEnv:key=>({
      SONARA_CUSTOMER_FUNDS_MODE:"connect_direct_reviewed",
      STRIPE_CONNECT_ENABLED:"false",
      STRIPE_SECRET_KEY:"sk_test_"+"a".repeat(40)
    })[key]};
    const out=connectReadiness(deps);
    assert.equal(out.ok,false);
    assert.equal(out.status,"setup_required");
  });
  it("external_only blocks Connect even with legacy Connect enabled",()=>{
    const deps={getEnv:name=>({
      SONARA_CUSTOMER_FUNDS_MODE:"external_only",
      STRIPE_CONNECT_ENABLED:"true",STRIPE_SECRET_KEY:"sk_test_"+"a".repeat(38)
    })[name]};
    const decision=connectReadiness(deps);
    assert.equal(decision.ok,false);
    assert.equal(decision.status,"setup_required");
    assert.ok(decision.detail.includes("only its own software fees"));
  });
  it("new merchant checkout session creation is blocked with zero network calls", async ()=>{
    let networkCalls=0;
    const deps={getEnv:key=>({
      SONARA_CUSTOMER_FUNDS_MODE:"external_only",
      STRIPE_CONNECT_ENABLED:"true", STRIPE_SECRET_KEY:"sk_test_"+"b".repeat(40),
      STRIPE_CONNECT_WEBHOOK_SECRET:"whsec_"+"c".repeat(40)
    })[key]};
    const out=await createSession(deps,{
      accountId:"acct_1234567890",orderId:ORG,
      fields:{}, idempotencyKey:"sonara-marketplace-order-"+ORG
    },async()=>{networkCalls++;throw Error("request should never happen")});
    assert.equal(out.ok,false);
    assert.equal(networkCalls,0);
  });
  it("historical session GET can still reconcile a verified connected account after shutdown",async()=>{
    let networkCalls=0;
    const deps={getEnv:key=>({
      SONARA_CUSTOMER_FUNDS_MODE:"external_only",
      STRIPE_CONNECT_ENABLED:"false",STRIPE_SECRET_KEY:"sk_test_"+"b".repeat(40)
    })[key]};
    const result=await retrieveSession(deps,{
      accountId:"acct_1234567890",sessionId:"cs_test_123abc"
    },async(url,init)=>{
      networkCalls++;
      assert.equal(init.method,"GET");
      assert.equal(init.headers["Stripe-Account"],"acct_1234567890");
      assert.ok(url.includes("cs_test_123abc"));
      return {ok:true,json:async()=>({id:"cs_test_123abc",payment_status:"paid"})};
    });
    assert.equal(result.ok,true);
    assert.equal(result.session.payment_status,"paid");
    assert.equal(networkCalls,1);
  });
  it("historical session expiry POST stays disabled under fee-only mode",async()=>{
    let networkCalls=0;
    const deps={getEnv:key=>({
      SONARA_CUSTOMER_FUNDS_MODE:"external_only",
      STRIPE_CONNECT_ENABLED:"true",STRIPE_SECRET_KEY:"sk_test_"+"b".repeat(40)
    })[key]};
    const result=await expireSession(deps,{
      accountId:"acct_1234567890",sessionId:"cs_test_123abc"
    },async()=>{networkCalls++;throw Error("write should not happen")});
    assert.equal(result.ok,false);
    assert.equal(networkCalls,0);
  });
  it("merchant session reconciliation rejects missing provider credentials",async()=>{
    let calls=0;
    const out=await retrieveSession({getEnv:key=>key==="SONARA_CUSTOMER_FUNDS_MODE"?"external_only":""},{
      accountId:"acct_1234567890",sessionId:"cs_test_123abc"
    },async()=>{calls++;throw Error("should not call")});
    assert.equal(out.ok,false);
    assert.equal(out.code,"legacy_reconciliation_key_unavailable");
    assert.equal(calls,0);
  });
  it("Connect-disabled account creation cannot call provider or storage", async ()=>{
    let networkCalls=0;
    const deps={getEnv:key=>key==="SONARA_CUSTOMER_FUNDS_MODE"?"external_only":
      key==="STRIPE_CONNECT_ENABLED"?"true":key==="STRIPE_SECRET_KEY"?"sk_test_"+"a".repeat(38):""};
    const neverFetch=async()=>{networkCalls++;throw Error("network access unexpected")};
    const result=await createAccount(deps,{
      organizationId:ORG,country:"US",email:"merchant@example.com",createdBy:ORG
    },neverFetch);
    assert.equal(result.ok,false);
    assert.equal(networkCalls,0);
  });
  it("Connect-disabled eligibility never attempts Stripe or Supabase reads",async()=>{
    let networkCalls=0;
    const deps={getEnv:key=>key==="SONARA_CUSTOMER_FUNDS_MODE"?"external_only":
      key==="STRIPE_CONNECT_ENABLED"?"true":key==="STRIPE_SECRET_KEY"?"sk_test_"+"a".repeat(38):""};
    const result=await canAcceptPayments(deps,ORG,async()=>{networkCalls++;throw Error("unexpected")});
    assert.equal(result.ok,false);
    assert.equal(networkCalls,0);
  });
});
