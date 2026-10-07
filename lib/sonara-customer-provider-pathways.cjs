// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  validateConnectionRecord
} = require("./sonara-connection-registry.cjs");

// Customer-owned/provider-provided access control. This module is deliberately
// pure policy: it does not perform OAuth, resolve secrets, call providers,
// publish, move money, or grant runtime authority.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_KEY=/^[a-z0-9][a-z0-9._:-]{1,119}$/i;
const SECRET_REF=/^(?:vault|secret|kms|provider|managed):\/\/[A-Za-z0-9._~:/-]{3,240}$/;
const AUTHORITY_SOURCES=Object.freeze([
  "customer_oauth",
  "customer_secret_reference",
  "customer_service_account_reference",
  "provider_managed",
  "manual_export"
]);
const CREDENTIAL_CUSTODY=Object.freeze([
  "server_vault",
  "provider_managed",
  "native_secure_store",
  "none"
]);
const ACTION_CLASSES=Object.freeze([
  "read",
  "sync",
  "reversible_write",
  "external_publish",
  "financial_mutation",
  "security_admin",
  "destructive"
]);
const WRITE_CLASSES=new Set([
  "reversible_write","external_publish","financial_mutation","security_admin","destructive"
]);
const HIGH_IMPACT=new Set([
  "external_publish","financial_mutation","security_admin","destructive"
]);
const SENSITIVE_QUERY_KEYS=new Set([
  "access_token","refresh_token","id_token","token","api_key","apikey","key",
  "secret","client_secret","password","authorization","code"
]);

function uniqueStrings(values){
  if(!Array.isArray(values))return null;
  const out=[];
  const seen=new Set();
  for(const value of values){
    if(typeof value!=="string"||!value.trim())return null;
    const item=value.trim();
    if(!seen.has(item)){seen.add(item);out.push(item);}
  }
  return out;
}
function scopeCoverage(required,granted){
  const need=uniqueStrings(required),have=uniqueStrings(granted);
  if(!need||!have)return {ok:false,missing:[]};
  const set=new Set(have);
  return {ok:need.every(x=>set.has(x)),missing:need.filter(x=>!set.has(x))};
}
function looksLikeIp(hostname){
  if(!hostname)return false;
  if(/^\[.*\]$/.test(hostname))return true;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}
function providerOriginAssessment({
  providerOrigin,expectedProviderOrigin=null,originOwnerVerified=false
}={}){
  const blockers=[];
  let parsed=null;
  try{parsed=new URL(String(providerOrigin||""));}catch{blockers.push("provider_origin_invalid");}
  if(parsed){
    if(parsed.protocol!=="https:")blockers.push("provider_origin_https_required");
    if(parsed.username||parsed.password)blockers.push("provider_origin_embedded_credentials_forbidden");
    if(parsed.hash)blockers.push("provider_origin_fragment_forbidden");
    if(parsed.pathname!=="/"||parsed.search)blockers.push("provider_origin_must_be_origin_only");
    const host=parsed.hostname.toLowerCase();
    if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||
       host.endsWith(".internal")||looksLikeIp(host))blockers.push("provider_origin_local_or_ip_forbidden");
    if(expectedProviderOrigin!==null){
      let expected=null;
      try{expected=new URL(String(expectedProviderOrigin));}catch{blockers.push("expected_provider_origin_invalid");}
      if(expected&&parsed.origin!==expected.origin)blockers.push("provider_origin_exact_match_required");
    }
  }
  if(originOwnerVerified!==true)blockers.push("provider_origin_owner_unverified");
  return Object.freeze({
    ok:blockers.length===0,
    blockers:Object.freeze([...new Set(blockers)]),
    normalizedOrigin:parsed?.origin||null,
    dnsResolutionVerified:false,
    ssrfSafetyProven:false
  });
}

function oauthGrantPreflight({
  flow="authorization_code",pkceMethod,stateBound=false,
  redirectUri,registeredRedirectUri,
  providerSupportsIssuer=false,issuerExpected=null,issuerObserved=null,
  requestedScopes=[],approvedScopes=[],
  incrementalAuthorization=false,
  accessTokenStoredByReference=false,refreshTokenExpected=false,
  refreshTokenStoredByReference=false,tokensExposedToBrowser=false,
  implicitGrantUsed=false
}={}){
  const blockers=[];
  if(flow!=="authorization_code")blockers.push("oauth_authorization_code_flow_required");
  if(pkceMethod!=="S256")blockers.push("oauth_pkce_s256_required");
  if(stateBound!==true)blockers.push("oauth_state_binding_required");
  if(typeof redirectUri!=="string"||redirectUri!==registeredRedirectUri)
    blockers.push("oauth_redirect_exact_match_required");
  const coverage=scopeCoverage(requestedScopes,approvedScopes);
  if(!coverage.ok)blockers.push("oauth_scope_not_customer_approved");
  if(incrementalAuthorization!==true)blockers.push("oauth_incremental_authorization_required");
  if(accessTokenStoredByReference!==true)blockers.push("oauth_access_token_reference_storage_required");
  if(refreshTokenExpected===true&&refreshTokenStoredByReference!==true)
    blockers.push("oauth_refresh_token_reference_storage_required");
  if(tokensExposedToBrowser===true)blockers.push("oauth_browser_token_exposure_forbidden");
  if(implicitGrantUsed===true)blockers.push("oauth_implicit_grant_forbidden");
  if(providerSupportsIssuer===true){
    if(typeof issuerExpected!=="string"||!issuerExpected||issuerObserved!==issuerExpected)
      blockers.push("oauth_issuer_binding_required");
  }
  return Object.freeze({
    state:blockers.length?"oauth_grant_blocked":"oauth_grant_review_ready",
    blockers:Object.freeze([...new Set(blockers)]),
    missingScopes:Object.freeze(coverage.missing),
    tokenMaterialReturned:false,
    authorizationExchangeAuthorized:false
  });
}

function customerProviderConnectionPreflight({
  connectionRecord,authoritySource,connectionOwnerUserId,
  externalAccountOwnerAttested=false,
  providerOrigin,expectedProviderOrigin=null,originOwnerVerified=false,
  requestedScopes=[],grantedScopes=[],
  credentialCustody,credentialReference,
  revokeSupported=false,disconnectDeletesLocalReference=false,
  environmentConfirmed=false
}={}){
  const blockers=[];
  const recordCheck=validateConnectionRecord(connectionRecord||{});
  if(!recordCheck.ok)blockers.push(...recordCheck.errors.map(x=>"connection_"+x));
  if(!UUID.test(connectionRecord?.organization_id||""))blockers.push("connection_tenant_uuid_required");
  if(!UUID.test(connectionOwnerUserId||""))blockers.push("connection_owner_identity_required");
  if(!AUTHORITY_SOURCES.includes(authoritySource))blockers.push("authority_source_invalid");
  if(externalAccountOwnerAttested!==true)blockers.push("external_account_ownership_unverified");
  if(!CREDENTIAL_CUSTODY.includes(credentialCustody))blockers.push("credential_custody_invalid");
  const manual=authoritySource==="manual_export";
  if(!manual&&credentialCustody==="none")blockers.push("credential_custody_required");
  if(manual&&credentialCustody!=="none")blockers.push("manual_export_must_not_have_runtime_credentials");
  if(!manual&&(!SECRET_REF.test(String(credentialReference||""))||
      credentialReference!==connectionRecord?.credential_reference))
    blockers.push("opaque_credential_reference_required");
  if(recordCheck.forbiddenSecretPaths.length)blockers.push("raw_provider_secret_in_registry_forbidden");
  const coverage=scopeCoverage(requestedScopes,grantedScopes);
  if(!coverage.ok)blockers.push("requested_scope_not_granted");
  if(environmentConfirmed!==true)blockers.push("provider_environment_unverified");
  if(revokeSupported!==true&&!manual)blockers.push("provider_revocation_path_required");
  if(disconnectDeletesLocalReference!==true&&!manual)blockers.push("disconnect_reference_cleanup_required");
  const origin=manual
    ? Object.freeze({ok:true,blockers:Object.freeze([]),normalizedOrigin:null,
        dnsResolutionVerified:false,ssrfSafetyProven:false})
    : providerOriginAssessment({providerOrigin,expectedProviderOrigin,originOwnerVerified});
  blockers.push(...origin.blockers);
  return Object.freeze({
    state:blockers.length?"provider_connection_blocked":"provider_connection_review_ready",
    blockers:Object.freeze([...new Set(blockers)]),
    missingScopes:Object.freeze(coverage.missing),
    normalizedProviderOrigin:origin.normalizedOrigin,
    customerOwnsExternalAccount:externalAccountOwnerAttested===true,
    sonaraOwnsProviderAccount:false,
    rawSecretStoredInRegistry:false,
    credentialResolutionServerSide:!manual,
    runtimeAuthorityGranted:false,
    providerCallExecuted:false,
    disconnectExecuted:false
  });
}

function providerActionPreflight({
  organizationId,connectionOrganizationId,connectionAssessment,
  capability,declaredCapabilities=[],actionClass,
  requiredScopes=[],grantedScopes=[],
  humanApprovalEvidenceReady=false,idempotencyKeyPresent=false,
  providerAccountBindingVerified=false,
  moneyBoundary="external_only"
}={}){
  const blockers=[];
  if(!UUID.test(organizationId||"")||organizationId!==connectionOrganizationId)
    blockers.push("provider_action_tenant_mismatch");
  if(connectionAssessment?.state!=="provider_connection_review_ready")
    blockers.push("provider_connection_not_ready");
  if(!SAFE_KEY.test(capability||""))blockers.push("provider_capability_invalid");
  const capabilities=uniqueStrings(declaredCapabilities);
  if(!capabilities||!capabilities.includes(capability))blockers.push("provider_capability_not_declared");
  if(!ACTION_CLASSES.includes(actionClass))blockers.push("provider_action_class_invalid");
  const coverage=scopeCoverage(requiredScopes,grantedScopes);
  if(!coverage.ok)blockers.push("provider_action_scope_missing");
  if(providerAccountBindingVerified!==true)blockers.push("provider_account_binding_unverified");
  if(WRITE_CLASSES.has(actionClass)&&idempotencyKeyPresent!==true)
    blockers.push("provider_write_idempotency_required");
  if(HIGH_IMPACT.has(actionClass)&&humanApprovalEvidenceReady!==true)
    blockers.push("customer_approval_evidence_required");
  if(actionClass==="financial_mutation"&&moneyBoundary!=="provider_executes_customer_funds")
    blockers.push("sonara_customer_funds_execution_forbidden");
  return Object.freeze({
    state:blockers.length?"provider_action_blocked":"provider_action_review_ready",
    blockers:Object.freeze([...new Set(blockers)]),
    missingScopes:Object.freeze(coverage.missing),
    customerApprovalRequired:HIGH_IMPACT.has(actionClass),
    providerReceiptRequired:WRITE_CLASSES.has(actionClass),
    credentialMaterialExposed:false,
    executionAuthorized:false,
    providerCallExecuted:false
  });
}

function providerDashboardPathway({
  targetUrl,approvedOrigins=[],ownerApproved=false
}={}){
  const blockers=[];
  let url=null;
  try{url=new URL(String(targetUrl||""));}catch{blockers.push("provider_dashboard_url_invalid");}
  const origins=uniqueStrings(approvedOrigins)||[];
  if(url){
    if(url.protocol!=="https:")blockers.push("provider_dashboard_https_required");
    if(url.username||url.password)blockers.push("provider_dashboard_embedded_credentials_forbidden");
    if(url.hash)blockers.push("provider_dashboard_fragment_forbidden");
    if(!origins.includes(url.origin))blockers.push("provider_dashboard_origin_not_approved");
    const host=url.hostname.toLowerCase();
    if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||
       host.endsWith(".internal")||looksLikeIp(host))blockers.push("provider_dashboard_local_or_ip_forbidden");
    for(const key of url.searchParams.keys()){
      if(SENSITIVE_QUERY_KEYS.has(String(key).toLowerCase())){
        blockers.push("provider_dashboard_sensitive_query_forbidden");break;
      }
    }
  }
  if(ownerApproved!==true)blockers.push("provider_dashboard_owner_approval_required");
  return Object.freeze({
    state:blockers.length?"provider_dashboard_blocked":"provider_dashboard_navigation_ready",
    blockers:Object.freeze([...new Set(blockers)]),
    navigationUrl:blockers.length?null:url.toString(),
    opensExternalProvider:true,
    providerCredentialAttached:false,
    serverFetchAuthorized:false
  });
}

module.exports={
  AUTHORITY_SOURCES,CREDENTIAL_CUSTODY,ACTION_CLASSES,
  providerOriginAssessment,oauthGrantPreflight,
  customerProviderConnectionPreflight,providerActionPreflight,
  providerDashboardPathway
};
