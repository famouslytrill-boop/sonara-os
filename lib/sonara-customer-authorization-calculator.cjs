// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

// Proposed deterministic authorization calculator. It does not replace current
// route guards/RLS and grants no runtime permission. Unknown role/action/resource
// defaults to deny. High-impact actions require separate step-up/board evidence.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLASSES=Object.freeze(["public","tenant_standard","tenant_confidential","restricted"]);
const ACTIONS=Object.freeze([
  "read","create","update","export","approve","publish","delete",
  "security_admin","billing_admin"
]);
const ROLE_ACTIONS=Object.freeze({
  owner:new Set(ACTIONS),
  business_owner:new Set(ACTIONS),
  admin:new Set(["read","create","update","export","approve","publish","delete","billing_admin"]),
  manager:new Set(["read","create","update","export"]),
  employee:new Set(["read","create","update"]),
  creator:new Set(["read","create","update"]),
  member:new Set(["read","create","update"]),
  viewer:new Set(["read"])
});
const HIGH=new Set(["approve","publish","delete","security_admin","billing_admin"]);
function authorizationDecision({
  organizationId,resourceOrganizationId,userId,role,action,resourceClass,
  ownsRecord=false,stepUpVerified=false,boardEvidenceReady=false,
  publicResource=false
}={}){
  const blockers=[];
  if(!ACTIONS.includes(action))blockers.push("unknown_action");
  if(!CLASSES.includes(resourceClass))blockers.push("unknown_resource_class");
  if(publicResource===true&&resourceClass==="public"&&action==="read"){
    return Object.freeze({
      allowed:!blockers.length,blockers:Object.freeze(blockers),
      reason:blockers.length?"invalid_public_request":"public_read",
      runtimePermissionGranted:false,
      anonymousReadAllowed:true,
      rlsStillRequired:false,
      approvalStillRequired:false
    });
  }
  if(!UUID.test(userId||""))blockers.push("user_identity_unverified");
  if(!UUID.test(organizationId||"")||organizationId!==resourceOrganizationId)
    blockers.push("tenant_scope_unverified");
  const permissions=ROLE_ACTIONS[role];
  if(!permissions)blockers.push("unknown_role");
  else if(!permissions.has(action))blockers.push("role_action_not_allowed");

  if(["employee","creator","member"].includes(role)&&["update","export"].includes(action)&&ownsRecord!==true)
    blockers.push("record_ownership_or_elevated_role_required");
  if(resourceClass==="restricted"&&!["owner","business_owner","admin"].includes(role))
    blockers.push("restricted_resource_role_required");
  if(resourceClass==="tenant_confidential"&&role==="viewer"&&action!=="read")
    blockers.push("confidential_resource_write_not_allowed");
  if(HIGH.has(action)){
    if(!["owner","business_owner","admin"].includes(role))blockers.push("owner_or_admin_required");
    if(stepUpVerified!==true)blockers.push("step_up_authentication_required");
    if(["delete","security_admin","billing_admin"].includes(action)&&boardEvidenceReady!==true)
      blockers.push("governance_board_evidence_required");
  }
  return Object.freeze({
    allowed:blockers.length===0,blockers:Object.freeze([...new Set(blockers)]),
    reason:blockers.length?"authorization_denied":"policy_candidate_allows",
    runtimePermissionGranted:false,
    rlsStillRequired:resourceClass!=="public",
    approvalStillRequired:HIGH.has(action)
  });
}
module.exports={CLASSES,ACTIONS,ROLE_ACTIONS,authorizationDecision};
