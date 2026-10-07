// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Low-budget software-provider boundary for Ohio property workflows.
// A vendor license/subscription is not a permit to rent, manage or broker
// another person's real estate. ORC 4735.01(A) broadly addresses leasing,
// negotiating, listing, managing, referring prospects and certain paid tenant
// data services. This code is a conservative internal review, not legal advice.
// Do not automatically invoke the owner/broker exemptions without independent
// documentation or licensed legal review.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_VENDOR_ACTIVITIES=Object.freeze([
  "tenant_owned_private_records", "landlord_owned_lease_drafts",
  "landlord_owned_rent_math", "landlord_owned_maintenance_tickets",
  "landlord_owned_deposit_reconciliation_preview",
  "landlord_owned_internal_schedule", "landlord_owned_reports"
]);
const REVIEW_BROKERAGE_ACTIVITIES=Object.freeze([
  "sonara_lists_properties_for_others", "sonara_matches_tenants_to_listings",
  "sonara_refers_rental_leads_for_fee", "sonara_negotiates_rents",
  "sonara_collects_rent_for_others", "sonara_collects_security_deposits",
  "sonara_signs_leases_for_others", "sonara_manages_property_for_others",
  "sonara_shows_units_for_others", "sonara_makes_screening_decisions",
  "sonara_charges_tenants_for_rental_information",
  "sonara_receives_per_lease_commission"
]);
const RESTRICTED_EXPERIENCES=Object.freeze([
  "screen_applicant", "reject_applicant", "evict_tenant",
  "collect_deposit", "execute_lease", "modify_lease",
  "issue_legal_notice", "withhold_deposit", "transfer_property_funds"
]);
function propertyVendorBoundary({
  activity, organizationId, authenticatedOrganizationId,
  propertyJurisdiction, jurisdictionEvidenceVerified,
  platformActsForAnotherOwner=false, sonaraChargesReferralOrSuccessFee=false,
  authenticatedLandlordControlsRecord=false,
  landlordAuthorityVerified=false, propertyBrokerageLicenseVerified=false,
  licensedCounselReviewed=false, action="draft"
}={}){
  const reasons=[];
  const add=(condition,why)=>{if(!condition)reasons.push(why)};
  add(UUID.test(organizationId||"")&&organizationId===authenticatedOrganizationId,
    "property_tenant_scope_missing");
  add(propertyJurisdiction==="OH" && jurisdictionEvidenceVerified===true,
    "review_jurisdiction_before_property_workflow");
  add([...SAFE_VENDOR_ACTIVITIES,...REVIEW_BROKERAGE_ACTIVITIES].includes(activity),
    "unknown_property_activity");
  const brokerFeature=REVIEW_BROKERAGE_ACTIVITIES.includes(activity)||
    platformActsForAnotherOwner || sonaraChargesReferralOrSuccessFee;
  if(brokerFeature){
    reasons.push("brokerage_activity_not_available_in_software_only_mode");
    // License verification is evidence for legal review, NOT a permit to
    // enable functionality through this advisory function.
    if(!(propertyBrokerageLicenseVerified && licensedCounselReviewed)){
      reasons.push("qualified_ohio_brokerage_scope_review_missing");
    }
  }
  if(SAFE_VENDOR_ACTIVITIES.includes(activity)) {
    add(authenticatedLandlordControlsRecord===true&&landlordAuthorityVerified===true,
      "self_service_landlord_and_property_authority_missing");
  }
  if(RESTRICTED_EXPERIENCES.includes(action)||action!=="draft"){
    reasons.push("property_legal_action_not_authorized");
  }
  return Object.freeze({
    mode:"software_vendor_only",activity,
    state:reasons.length?"blocked_pending_review":"draft_self_service_record_only",
    blockers:Object.freeze(reasons),
    platformIsPropertyManager:false,
    landlordOrBrokerHasLegalObligations:true,
    commissionAuthorized:false, evictionAuthorized:false,
    screeningDecisionAuthorized:false,
    legalNoticeAuthorized:false, leaseExecutionAuthorized:false
  });
}
module.exports={SAFE_VENDOR_ACTIVITIES,REVIEW_BROKERAGE_ACTIVITIES,propertyVendorBoundary};
