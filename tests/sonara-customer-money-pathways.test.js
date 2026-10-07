// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const {PATHS,PROHIBITED,pathway,customerLedgerEntryClass,assertLaunchInvariant}=
  require("../lib/sonara-customer-money-pathways.cjs");
describe("clear launch-time customer money pathways",()=>{
  it("keeps SONARA's own subscription as the only company-revenue path",()=>{
    const own=pathway("sonara_software_subscription");
    assert.equal(own.sonaraRevenue,true);
    assert.equal(own.merchant,"sonara_industries");
    assert.equal(own.destination,"sonara_company_bank");
    for(const flow of Object.keys(PATHS).filter(x=>x!=="sonara_software_subscription")){
      assert.equal(pathway(flow,{customerProviderOwnershipVerified:true}).sonaraRevenue,false,flow);
    }
  });
  it("keeps customer merchant funds out of SONARA accounts and processor",()=>{
    for(const [flow,p] of Object.entries(PATHS)){
      if(flow==="sonara_software_subscription")continue;
      assert.notEqual(p.destination,"sonara_company_bank");
      assert.notEqual(p.processor,"sonara_platform_processor");
      assert.notEqual(p.merchant,"sonara_industries");
    }
  });
  it("does not claim external payment destination is verified from a product record",()=>{
    const out=pathway("creator_sale");
    assert.equal(out.state,"record_only_destination_unverified");
    assert.ok(out.blockers.includes("customer_external_payment_destination_unverified"));
    assert.equal(out.paymentExecuted,false);
  });
  it("maps rent to landlord-controlled money, not SONARA property management",()=>{
    const out=pathway("rental_rent",{customerProviderOwnershipVerified:true});
    assert.equal(out.destination,"landlord_controlled_account");
    assert.equal(out.sonaraMoneyRole,"rental_record_only");
    assert.equal(out.custody,false);
  });
  it("maps refundable security deposits to a customer liability",()=>{
    const entry=customerLedgerEntryClass("rental_security_deposit");
    assert.equal(entry.entryClass,"refundable_deposit_liability");
    assert.equal(entry.mirroredIntoSonaraBooks,false);
  });
  it("maps ad spend directly from customer account to external platform",()=>{
    const out=pathway("advertising_spend",{customerProviderOwnershipVerified:true});
    assert.equal(out.payer,"customer_business");
    assert.equal(out.destination,"external_ad_platform");
    assert.equal(out.sonaraMoneyRole,"budget_and_analytics_only");
  });
  it("refuses launch models involving wallets, escrow, rent custody or split payouts",()=>{
    for(const flow of PROHIBITED){
      const out=pathway(flow);
      assert.equal(out.state,"prohibited_launch_model");
      assert.equal(out.custody,false);
      assert.equal(out.paymentExecuted,false);
    }
  });
  it("fails closed on unregistered money flows",()=>{
    assert.equal(pathway("crypto_exchange").state,"blocked_unknown_flow");
    assert.equal(customerLedgerEntryClass("crypto_exchange").ok,false);
  });
  it("self-audits every registered pathway for company-money contamination",()=>{
    const check=assertLaunchInvariant();
    assert.equal(check.ok,true);
    assert.equal(check.checked,8);
    assert.deepEqual(check.violations,[]);
  });
});
