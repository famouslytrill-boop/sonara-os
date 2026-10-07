// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  AUTH_TYPES,validateConnectionRecord
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
const KNOWN_PROVIDER_ACCESS=Object.freeze({
  stripe:Object.freeze({label:"Stripe",navigationUrl:"https://dashboard.stripe.com/"}),
  hubspot:Object.freeze({label:"HubSpot",navigationUrl:"https://app.hubspot.com/login"}),
  google_analytics:Object.freeze({label:"Google Analytics",navigationUrl:"https://analytics.google.com/"}),
  google_ads:Object.freeze({label:"Google Ads",navigationUrl:"https://ads.google.com/"}),
  google_search_console:Object.freeze({label:"Google Search Console",navigationUrl:"https://search.google.com/search-console"}),
  youtube_data:Object.freeze({label:"YouTube Studio",navigationUrl:"https://studio.youtube.com/"}),
  meta_marketing:Object.freeze({label:"Meta Business",navigationUrl:"https://business.facebook.com/"}),
  linkedin_marketing:Object.freeze({label:"LinkedIn Campaign Manager",navigationUrl:"https://business.linkedin.com/advertise/sign-in"}),
  shopify:Object.freeze({label:"Shopify Admin",navigationUrl:"https://shopify.com/admin"}),
  supabase:Object.freeze({label:"Supabase",navigationUrl:"https://supabase.com/dashboard"}),
  github:Object.freeze({label:"GitHub",navigationUrl:"https://github.com/"})
});

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


function providerSecretCustodyPlan({
  secretScope,providerManaged=false,supabaseVaultAvailable=false,
  nativeDeviceOnly=false,projectWide=false
}={}){
  const blockers=[];
  if(!["tenant_provider","project_provider","native_device","provider_managed"].includes(secretScope))
    blockers.push("provider_secret_scope_invalid");
  let custody=null;
  if(secretScope==="provider_managed"||providerManaged===true)custody="provider_managed";
  else if(secretScope==="native_device"||nativeDeviceOnly===true)custody="native_secure_store";
  else if(secretScope==="tenant_provider"){
    if(supabaseVaultAvailable===true)custody="supabase_vault_candidate";
    else blockers.push("tenant_secret_vault_required");
  }else if(secretScope==="project_provider"||projectWide===true){
    custody="deployment_secret_store";
  }
  if(secretScope==="tenant_provider"&&projectWide===true)
    blockers.push("tenant_secret_must_not_use_shared_project_credential");
  return Object.freeze({
    state:blockers.length?"provider_secret_custody_blocked":"provider_secret_custody_review_ready",
    blockers:Object.freeze([...new Set(blockers)]),
    custody,
    rawSecretReturned:false,
    rawSecretStoredInConnectionTable:false,
    decryptedVaultViewBrowserAccessible:false,
    pgsodiumDirectUseRecommended:false,
    secretWriteExecuted:false
  });
}


function customProviderManifestPreflight({
  providerKey,label,apiOrigin,providerIdentityVerified=false,
  documentationUrl,authTypes=[],capabilities=[],dashboardOrigins=[],
  commercialReview="review_required",securityReview="review_required",
  rateLimitMode,ownerApproved=false,requestedMode="read_only"
}={}){
  const blockers=[];
  if(!SAFE_KEY.test(providerKey||""))blockers.push("custom_provider_key_invalid");
  if(typeof label!=="string"||!label.trim()||label.trim().length>120)
    blockers.push("custom_provider_label_invalid");
  const origin=providerOriginAssessment({
    providerOrigin:apiOrigin,expectedProviderOrigin:apiOrigin,
    originOwnerVerified:providerIdentityVerified
  });
  blockers.push(...origin.blockers.map(x=>"custom_"+x));
  let docs=null;
  try{docs=new URL(String(documentationUrl||""));}catch{blockers.push("custom_provider_docs_url_invalid");}
  if(docs&&docs.protocol!=="https:")blockers.push("custom_provider_docs_https_required");
  const auth=uniqueStrings(authTypes);
  if(!auth||!auth.length||auth.some(x=>!AUTH_TYPES.includes(x)))
    blockers.push("custom_provider_auth_type_invalid");
  const caps=uniqueStrings(capabilities);
  if(!caps||!caps.length||caps.some(x=>!SAFE_KEY.test(x)))
    blockers.push("custom_provider_capability_invalid");
  const dashboards=uniqueStrings(dashboardOrigins);
  if(!dashboards)blockers.push("custom_provider_dashboard_origins_invalid");
  else for(const value of dashboards){
    const check=providerOriginAssessment({
      providerOrigin:value,expectedProviderOrigin:value,originOwnerVerified:providerIdentityVerified
    });
    if(!check.ok){blockers.push("custom_provider_dashboard_origin_invalid");break;}
  }
  if(!["approved","not_required"].includes(commercialReview))
    blockers.push("custom_provider_commercial_review_required");
  if(!["approved_read_only","approved_scoped_write"].includes(securityReview))
    blockers.push("custom_provider_security_review_required");
  if(!["provider_headers","durable_local","manual_only"].includes(rateLimitMode))
    blockers.push("custom_provider_rate_limit_review_required");
  if(ownerApproved!==true)blockers.push("custom_provider_owner_approval_required");
  if(!["read_only","scoped_write"].includes(requestedMode))
    blockers.push("custom_provider_requested_mode_invalid");
  if(requestedMode==="scoped_write"&&securityReview!=="approved_scoped_write")
    blockers.push("custom_provider_write_security_review_required");
  return Object.freeze({
    state:blockers.length?"custom_provider_manifest_blocked":"custom_provider_manifest_review_ready",
    blockers:Object.freeze([...new Set(blockers)]),
    providerKey:SAFE_KEY.test(providerKey||"")?providerKey:null,
    normalizedApiOrigin:origin.normalizedOrigin,
    readOnlyCandidate:blockers.length===0,
    scopedWriteCandidate:blockers.length===0&&requestedMode==="scoped_write",
    financialMutationCandidate:false,
    serverFetchAuthorized:false,
    runtimeEnabled:false
  });
}

function knownProviderDirectAccess(providerKey){
  const item=KNOWN_PROVIDER_ACCESS[String(providerKey||"").trim()]||null;
  if(!item)return Object.freeze({
    ok:false,code:"verified_provider_destination_unavailable",
    providerKey:String(providerKey||"").trim()||null,
    navigationUrl:null,credentialAttached:false
  });
  const checked=providerDashboardPathway({
    targetUrl:item.navigationUrl,
    approvedOrigins:[new URL(item.navigationUrl).origin],
    ownerApproved:true
  });
  if(checked.state!=="provider_dashboard_navigation_ready")return Object.freeze({
    ok:false,code:"provider_destination_policy_failed",
    providerKey:String(providerKey||"").trim(),navigationUrl:null,
    credentialAttached:false
  });
  return Object.freeze({
    ok:true,code:"official_provider_access_ready",
    providerKey:String(providerKey||"").trim(),
    label:item.label,navigationUrl:checked.navigationUrl,
    credentialAttached:false,customerReauthenticatesAtProvider:true
  });
}

module.exports={
  AUTHORITY_SOURCES,CREDENTIAL_CUSTODY,ACTION_CLASSES,KNOWN_PROVIDER_ACCESS,
  providerOriginAssessment,oauthGrantPreflight,
  customerProviderConnectionPreflight,providerActionPreflight,
  providerDashboardPathway,providerSecretCustodyPlan,
  customProviderManifestPreflight,knownProviderDirectAccess
};
