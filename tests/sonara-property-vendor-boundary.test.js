// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const {SAFE_VENDOR_ACTIVITIES,REVIEW_BROKERAGE_ACTIVITIES,propertyVendorBoundary}=
  require("../lib/sonara-property-vendor-boundary.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const args=(change={})=>({
  activity:"landlord_owned_lease_drafts",organizationId:ORG,authenticatedOrganizationId:ORG,
  propertyJurisdiction:"OH",jurisdictionEvidenceVerified:true,
  authenticatedLandlordControlsRecord:true,landlordAuthorityVerified:true,
  ...change
});
describe("Ohio software vendor is NOT a broker or landlord",()=>{
  it("keeps private landlord-controlled records in an unexecuted draft state",()=>{
    const d=propertyVendorBoundary(args());
    assert.equal(d.state,"draft_self_service_record_only");
    assert.equal(d.platformIsPropertyManager,false);
    assert.equal(d.leaseExecutionAuthorized,false);
    assert.equal(d.legalNoticeAuthorized,false);
  });
  it("covers mathematical and reporting tools without signing leases",()=>{
    for(const activity of SAFE_VENDOR_ACTIVITIES){
      const d=propertyVendorBoundary(args({activity}));
      assert.equal(d.state,"draft_self_service_record_only");
      assert.equal(d.commissionAuthorized,false);
    }
  });
  it("blocks brokerage listings, matching, rent negotiations and paid tenant referrals",()=>{
    for(const activity of REVIEW_BROKERAGE_ACTIVITIES){
      const d=propertyVendorBoundary(args({activity}));
      assert.ok(d.blockers.includes("brokerage_activity_not_available_in_software_only_mode"));
    }
  });
  it("does not accept apparent license approval as runtime broker permission",()=>{
    const d=propertyVendorBoundary(args({activity:"sonara_collects_rent_for_others",
      propertyBrokerageLicenseVerified:true,licensedCounselReviewed:true}));
    assert.equal(d.state,"blocked_pending_review");
    assert.equal(d.platformIsPropertyManager,false);
  });
  it("rejects platform activity on behalf of a landlord even with SaaS fee",()=>{
    assert.ok(propertyVendorBoundary(args({platformActsForAnotherOwner:true}))
      .blockers.includes("brokerage_activity_not_available_in_software_only_mode"));
  });
  it("rejects per-rental commissions even if called an automation fee",()=>{
    assert.ok(propertyVendorBoundary(args({sonaraChargesReferralOrSuccessFee:true}))
      .blockers.includes("brokerage_activity_not_available_in_software_only_mode"));
  });
  it("refuses cross-tenant or unverified property jurisdiction",()=>{
    assert.ok(propertyVendorBoundary(args({authenticatedOrganizationId:"22222222-2222-4222-8222-222222222222"}))
      .blockers.includes("property_tenant_scope_missing"));
    assert.ok(propertyVendorBoundary(args({jurisdictionEvidenceVerified:false}))
      .blockers.includes("review_jurisdiction_before_property_workflow"));
  });
  it("requires verified landlord's own authority over records",()=>{
    assert.ok(propertyVendorBoundary(args({landlordAuthorityVerified:false}))
      .blockers.includes("self_service_landlord_and_property_authority_missing"));
  });
  it("does not authorize eviction or landlord legal notices",()=>{
    for(const action of ["evict_tenant","issue_legal_notice","collect_deposit","execute_lease"]){
      assert.ok(propertyVendorBoundary(args({action}))
        .blockers.includes("property_legal_action_not_authorized"));
    }
  });
  it("does not treat unsupported property actions as known-safe",()=>{
    assert.ok(propertyVendorBoundary(args({activity:"wildcard"}))
      .blockers.includes("unknown_property_activity"));
  });
});
