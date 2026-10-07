// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert=require("node:assert/strict");
const {
  AUTHORITY_SOURCES,providerOriginAssessment,oauthGrantPreflight,
  customerProviderConnectionPreflight,providerActionPreflight,
  providerDashboardPathway,providerSecretCustodyPlan,
  customProviderManifestPreflight,knownProviderDirectAccess
}=require("../lib/sonara-customer-provider-pathways.cjs");

const ORG="11111111-1111-4111-8111-111111111111";
const BUSINESS="22222222-2222-4222-8222-222222222222";
const OWNER="33333333-3333-4333-8333-333333333333";
const REF="vault://sonara/customer-providers/connection-1";
function record(overrides={}){
  return {
    organization_id:ORG,business_id:BUSINESS,provider_key:"customer_crm",
    external_account_id:"account_123",auth_type:"oauth2",
    credential_reference:REF,scopes:["contacts.read","contacts.write"],
    environment:"production",capability_state:"available",provider_version:"v1",
    expires_at:"2026-12-01T00:00:00Z",health_state:"healthy",
    deprecation_state:"none",deprecation_at:null,...overrides
  };
}
function connection(overrides={}){
  return customerProviderConnectionPreflight({
    connectionRecord:record(),authoritySource:"customer_oauth",
    connectionOwnerUserId:OWNER,externalAccountOwnerAttested:true,
    providerOrigin:"https://api.customer-crm.example",
    expectedProviderOrigin:"https://api.customer-crm.example",
    originOwnerVerified:true,requestedScopes:["contacts.read"],
    grantedScopes:["contacts.read","contacts.write"],
    credentialCustody:"server_vault",credentialReference:REF,
    revokeSupported:true,disconnectDeletesLocalReference:true,
    environmentConfirmed:true,...overrides
  });
}

describe("customer-owned and customer-provided provider pathways",()=>{
  it("supports explicit customer authority sources without granting runtime authority",()=>{
    assert.ok(AUTHORITY_SOURCES.includes("customer_oauth"));
    assert.ok(AUTHORITY_SOURCES.includes("customer_secret_reference"));
    assert.ok(AUTHORITY_SOURCES.includes("provider_managed"));
    const out=connection();
    assert.equal(out.state,"provider_connection_review_ready");
    assert.equal(out.customerOwnsExternalAccount,true);
    assert.equal(out.sonaraOwnsProviderAccount,false);
    assert.equal(out.runtimeAuthorityGranted,false);
  });

  it("requires exact HTTPS provider origin ownership and refuses local/IP destinations",()=>{
    assert.equal(providerOriginAssessment({
      providerOrigin:"https://api.customer-crm.example",
      expectedProviderOrigin:"https://api.customer-crm.example",
      originOwnerVerified:true
    }).ok,true);
    assert.ok(providerOriginAssessment({
      providerOrigin:"http://localhost:9000",originOwnerVerified:true
    }).blockers.includes("provider_origin_https_required"));
    assert.ok(providerOriginAssessment({
      providerOrigin:"https://127.0.0.1",originOwnerVerified:true
    }).blockers.includes("provider_origin_local_or_ip_forbidden"));
    assert.ok(providerOriginAssessment({
      providerOrigin:"https://evil.example",
      expectedProviderOrigin:"https://api.customer-crm.example",
      originOwnerVerified:true
    }).blockers.includes("provider_origin_exact_match_required"));
  });

  it("requires authorization-code OAuth with S256 PKCE, state and exact redirect binding",()=>{
    const good=oauthGrantPreflight({
      flow:"authorization_code",pkceMethod:"S256",stateBound:true,
      redirectUri:"https://sonaraindustries.com/oauth/callback/customer-crm",
      registeredRedirectUri:"https://sonaraindustries.com/oauth/callback/customer-crm",
      providerSupportsIssuer:true,issuerExpected:"https://auth.customer-crm.example",
      issuerObserved:"https://auth.customer-crm.example",
      requestedScopes:["contacts.read"],approvedScopes:["contacts.read"],
      incrementalAuthorization:true,accessTokenStoredByReference:true,
      refreshTokenExpected:true,refreshTokenStoredByReference:true,
      tokensExposedToBrowser:false,implicitGrantUsed:false
    });
    assert.equal(good.state,"oauth_grant_review_ready");
    assert.equal(good.authorizationExchangeAuthorized,false);

    const bad=oauthGrantPreflight({
      flow:"implicit",pkceMethod:null,stateBound:false,
      redirectUri:"https://attacker.example/cb",
      registeredRedirectUri:"https://sonaraindustries.com/oauth/callback/customer-crm",
      requestedScopes:["contacts.write"],approvedScopes:["contacts.read"],
      incrementalAuthorization:false,accessTokenStoredByReference:false,
      tokensExposedToBrowser:true,implicitGrantUsed:true
    });
    for(const code of [
      "oauth_authorization_code_flow_required","oauth_pkce_s256_required",
      "oauth_state_binding_required","oauth_redirect_exact_match_required",
      "oauth_scope_not_customer_approved","oauth_incremental_authorization_required",
      "oauth_access_token_reference_storage_required","oauth_browser_token_exposure_forbidden",
      "oauth_implicit_grant_forbidden"
    ]) assert.ok(bad.blockers.includes(code),code);
  });

  it("accepts an opaque customer secret reference but rejects raw secret fields",()=>{
    const good=connection({
      connectionRecord:record({auth_type:"api_key"}),
      authoritySource:"customer_secret_reference"
    });
    assert.equal(good.state,"provider_connection_review_ready");

    const bad=connection({
      connectionRecord:record({
        settings:{api_key:"raw-do-not-store"}
      })
    });
    assert.ok(bad.blockers.includes("connection_raw_secret_material_forbidden"));
    assert.ok(bad.blockers.includes("raw_provider_secret_in_registry_forbidden"));
  });

  it("requires requested scopes to be inside the provider grant",()=>{
    const out=connection({
      requestedScopes:["contacts.read","contacts.delete"],
      grantedScopes:["contacts.read"]
    });
    assert.ok(out.blockers.includes("requested_scope_not_granted"));
    assert.deepEqual(out.missingScopes,["contacts.delete"]);
  });

  it("requires a revocation and local-reference cleanup path for live credentials",()=>{
    let out=connection({revokeSupported:false});
    assert.ok(out.blockers.includes("provider_revocation_path_required"));
    out=connection({disconnectDeletesLocalReference:false});
    assert.ok(out.blockers.includes("disconnect_reference_cleanup_required"));
  });

  it("allows manual export handoff without pretending SONARA has provider credentials",()=>{
    const out=connection({
      connectionRecord:record({
        auth_type:"manual_export",credential_reference:null,
        scopes:["orders.read"]
      }),
      authoritySource:"manual_export",credentialCustody:"none",
      credentialReference:null,providerOrigin:null,expectedProviderOrigin:null,
      originOwnerVerified:false,requestedScopes:["orders.read"],
      grantedScopes:["orders.read"],revokeSupported:false,
      disconnectDeletesLocalReference:false
    });
    assert.equal(out.state,"provider_connection_review_ready");
    assert.equal(out.credentialResolutionServerSide,false);
  });

  it("keeps read/sync actions scoped to the exact tenant, capability and provider account",()=>{
    const assessed=connection();
    const out=providerActionPreflight({
      organizationId:ORG,connectionOrganizationId:ORG,
      connectionAssessment:assessed,capability:"contacts.read",
      declaredCapabilities:["contacts.read","contacts.write"],actionClass:"read",
      requiredScopes:["contacts.read"],grantedScopes:["contacts.read","contacts.write"],
      providerAccountBindingVerified:true
    });
    assert.equal(out.state,"provider_action_review_ready");
    assert.equal(out.executionAuthorized,false);
    assert.equal(out.providerCallExecuted,false);
  });

  it("requires idempotency and customer approval before consequential provider writes",()=>{
    const assessed=connection();
    const out=providerActionPreflight({
      organizationId:ORG,connectionOrganizationId:ORG,
      connectionAssessment:assessed,capability:"campaign.publish",
      declaredCapabilities:["campaign.publish"],actionClass:"external_publish",
      requiredScopes:["campaign.write"],grantedScopes:["campaign.write"],
      providerAccountBindingVerified:true,idempotencyKeyPresent:false,
      humanApprovalEvidenceReady:false
    });
    assert.ok(out.blockers.includes("provider_write_idempotency_required"));
    assert.ok(out.blockers.includes("customer_approval_evidence_required"));
    assert.equal(out.providerReceiptRequired,true);
  });

  it("blocks SONARA money mutation in external-only mode even on a customer-owned provider",()=>{
    const assessed=connection();
    let out=providerActionPreflight({
      organizationId:ORG,connectionOrganizationId:ORG,
      connectionAssessment:assessed,capability:"payment.refund",
      declaredCapabilities:["payment.refund"],actionClass:"financial_mutation",
      requiredScopes:["payments.write"],grantedScopes:["payments.write"],
      providerAccountBindingVerified:true,idempotencyKeyPresent:true,
      humanApprovalEvidenceReady:true,moneyBoundary:"external_only"
    });
    assert.ok(out.blockers.includes("sonara_customer_funds_execution_forbidden"));

    out=providerActionPreflight({
      organizationId:ORG,connectionOrganizationId:ORG,
      connectionAssessment:assessed,capability:"payment.refund",
      declaredCapabilities:["payment.refund"],actionClass:"financial_mutation",
      requiredScopes:["payments.write"],grantedScopes:["payments.write"],
      providerAccountBindingVerified:true,idempotencyKeyPresent:true,
      humanApprovalEvidenceReady:true,moneyBoundary:"provider_executes_customer_funds"
    });
    assert.equal(out.state,"provider_action_review_ready");
    assert.equal(out.executionAuthorized,false);
  });

  it("uses curated official destinations for one-click provider access",()=>{
    const stripe=knownProviderDirectAccess("stripe");
    assert.equal(stripe.ok,true);
    assert.equal(stripe.navigationUrl,"https://dashboard.stripe.com/");
    assert.equal(stripe.credentialAttached,false);
    assert.equal(stripe.customerReauthenticatesAtProvider,true);

    const custom=knownProviderDirectAccess("customer_erp");
    assert.equal(custom.ok,false);
    assert.equal(custom.code,"verified_provider_destination_unavailable");
    assert.equal(custom.navigationUrl,null);
  });

  it("gives customers a direct provider-dashboard pathway without attaching credentials",()=>{
    const out=providerDashboardPathway({
      targetUrl:"https://dashboard.customer-crm.example/accounts/account_123",
      approvedOrigins:["https://dashboard.customer-crm.example"],
      ownerApproved:true
    });
    assert.equal(out.state,"provider_dashboard_navigation_ready");
    assert.equal(out.providerCredentialAttached,false);
    assert.equal(out.serverFetchAuthorized,false);

    const unsafe=providerDashboardPathway({
      targetUrl:"https://dashboard.customer-crm.example/account?access_token=secret",
      approvedOrigins:["https://dashboard.customer-crm.example"],
      ownerApproved:true
    });
    assert.ok(unsafe.blockers.includes("provider_dashboard_sensitive_query_forbidden"));
    assert.equal(unsafe.navigationUrl,null);
  });

  it("admits a reviewed custom provider manifest without enabling runtime automatically",()=>{
    const good=customProviderManifestPreflight({
      providerKey:"customer_erp",label:"Customer ERP",
      apiOrigin:"https://api.customer-erp.example",providerIdentityVerified:true,
      documentationUrl:"https://docs.customer-erp.example/api",
      authTypes:["oauth2"],capabilities:["orders.read","inventory.read"],
      dashboardOrigins:["https://app.customer-erp.example"],
      commercialReview:"approved",securityReview:"approved_read_only",
      rateLimitMode:"provider_headers",ownerApproved:true,requestedMode:"read_only"
    });
    assert.equal(good.state,"custom_provider_manifest_review_ready");
    assert.equal(good.readOnlyCandidate,true);
    assert.equal(good.runtimeEnabled,false);
    assert.equal(good.serverFetchAuthorized,false);
    assert.equal(good.financialMutationCandidate,false);

    const bad=customProviderManifestPreflight({
      providerKey:"anything",label:"Anything",
      apiOrigin:"http://127.0.0.1:9000",providerIdentityVerified:false,
      documentationUrl:"http://127.0.0.1/docs",
      authTypes:["unknown_auth"],capabilities:["*"],
      dashboardOrigins:["http://localhost"],
      commercialReview:"review_required",securityReview:"review_required",
      rateLimitMode:"unlimited",ownerApproved:false,requestedMode:"scoped_write"
    });
    for(const code of [
      "custom_provider_origin_https_required",
      "custom_provider_origin_local_or_ip_forbidden",
      "custom_provider_origin_owner_unverified",
      "custom_provider_docs_https_required",
      "custom_provider_auth_type_invalid",
      "custom_provider_capability_invalid",
      "custom_provider_dashboard_origin_invalid",
      "custom_provider_commercial_review_required",
      "custom_provider_security_review_required",
      "custom_provider_rate_limit_review_required",
      "custom_provider_owner_approval_required",
      "custom_provider_write_security_review_required"
    ]) assert.ok(bad.blockers.includes(code),code);
  });

  it("routes per-tenant provider secrets to a vault candidate instead of shared env storage",()=>{
    const tenant=providerSecretCustodyPlan({
      secretScope:"tenant_provider",supabaseVaultAvailable:true
    });
    assert.equal(tenant.state,"provider_secret_custody_review_ready");
    assert.equal(tenant.custody,"supabase_vault_candidate");
    assert.equal(tenant.rawSecretStoredInConnectionTable,false);
    assert.equal(tenant.decryptedVaultViewBrowserAccessible,false);
    assert.equal(tenant.pgsodiumDirectUseRecommended,false);

    const blocked=providerSecretCustodyPlan({
      secretScope:"tenant_provider",supabaseVaultAvailable:false,projectWide:true
    });
    assert.ok(blocked.blockers.includes("tenant_secret_vault_required"));
    assert.ok(blocked.blockers.includes("tenant_secret_must_not_use_shared_project_credential"));

    const global=providerSecretCustodyPlan({secretScope:"project_provider",projectWide:true});
    assert.equal(global.custody,"deployment_secret_store");
  });

  it("fails cross-tenant provider action replay",()=>{
    const out=providerActionPreflight({
      organizationId:ORG,
      connectionOrganizationId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      connectionAssessment:connection(),capability:"contacts.read",
      declaredCapabilities:["contacts.read"],actionClass:"read",
      requiredScopes:["contacts.read"],grantedScopes:["contacts.read"],
      providerAccountBindingVerified:true
    });
    assert.ok(out.blockers.includes("provider_action_tenant_mismatch"));
  });
});
