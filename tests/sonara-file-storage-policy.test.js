// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const {
  storagePreflight,generatedObjectKey,localCachePlan,signedAccessPlan,
  retentionDecision,restoreIntegrityCheck
}=require("../lib/sonara-file-storage-policy.cjs");
const ORG="11111111-1111-4111-8111-111111111111";
const OBJ="22222222-2222-4222-8222-222222222222";
const hash="a".repeat(64);
const valid=(o={})=>({
  organizationId:ORG,authenticatedOrganizationId:ORG,
  classification:"tenant_confidential",originalName:"invoice.pdf",
  sizeBytes:1000,declaredMime:"application/pdf",detectedMime:"application/pdf",
  verifiedSha256:hash,fileSignatureVerified:true,malwareScan:"clean",
  archiveBombCheck:"not_applicable",activeContentDetected:false,
  authenticatedUploader:true,authorizedUploader:true,...o
});
describe("secure customer filing/storage policy",()=>{
  it("allows a fully verified private document only as review-ready, never executed",()=>{
    const out=storagePreflight(valid());
    assert.equal(out.state,"storage_review_ready");
    assert.equal(out.signedUrlRequired,true);
    assert.equal(out.executeAllowed,false);
    assert.equal(out.uploadExecuted,false);
  });
  it("does not trust client-declared MIME alone",()=>{
    const out=storagePreflight(valid({declaredMime:"application/pdf",detectedMime:"text/plain"}));
    assert.ok(out.blockers.includes("detected_mime_mismatch"));
    assert.ok(out.warnings.includes("client_mime_did_not_match_detection"));
  });
  it("blocks legacy and macro-enabled spreadsheets",()=>{
    for(const name of ["book.xls","book.xlsm","book.xlsb","book.xlam"]){
      assert.ok(storagePreflight(valid({originalName:name,detectedMime:"application/octet-stream"}))
        .blockers.includes("blocked_or_active_file_type"));
    }
  });
  it("requires container scanning for ordinary XLSX before storage release",()=>{
    const out=storagePreflight(valid({
      originalName:"budget.xlsx",
      declaredMime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      detectedMime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      archiveBombCheck:"pending"
    }));
    assert.ok(out.blockers.includes("spreadsheet_container_scan_required"));
  });
  it("accepts XLSX only after MIME/signature/malware/container checks",()=>{
    const out=storagePreflight(valid({
      originalName:"budget.xlsx",
      declaredMime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      detectedMime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      archiveBombCheck:"passed"
    }));
    assert.equal(out.state,"storage_review_ready");
  });
  it("generates object paths without the customer filename",()=>{
    const key=generatedObjectKey({organizationId:ORG,classification:"tenant_confidential",objectId:OBJ,sha256:hash});
    assert.equal(key,ORG+"/tenant_confidential/aa/"+OBJ);
    assert.equal(key.includes("invoice"),false);
  });
  it("blocks unsafe display filenames but can still use generated storage identity",()=>{
    const out=storagePreflight(valid({originalName:"../../invoice.pdf"}));
    assert.equal(out.displayName,null);
    assert.ok(out.warnings.includes("original_filename_not_safe_for_display"));
    assert.equal(out.storagePathGeneratedServerSide,true);
  });
  it("blocks restricted persistent web caching",()=>{
    const out=localCachePlan({classification:"restricted_legal",platform:"web_pwa",offlineRequested:true});
    assert.equal(out.mode,"offline_cache_blocked");
    assert.ok(out.blockers.includes("restricted_data_no_persistent_web_cache"));
  });
  it("requires OS protected keys and user auth for sensitive native cache",()=>{
    let out=localCachePlan({classification:"restricted_legal",platform:"android_native",offlineRequested:true});
    assert.ok(out.blockers.includes("os_protected_key_unverified"));
    assert.ok(out.blockers.includes("restricted_cache_requires_user_authentication"));
    out=localCachePlan({classification:"restricted_legal",platform:"android_native",offlineRequested:true,
      osSecureKeyStoreVerified:true,deviceBoundKeyRefRecorded:true,userAuthenticationRequired:true});
    assert.equal(out.mode,"encrypted_offline_cache_review_ready");
    assert.equal(out.databaseKeyStoredBesideDatabase,false);
  });
  it("requires managed-device policy before offline sensitive media",()=>{
    const out=localCachePlan({classification:"restricted_sensitive_media",platform:"ios_native",
      offlineRequested:true,osSecureKeyStoreVerified:true,deviceBoundKeyRefRecorded:true,
      userAuthenticationRequired:true,managedDevice:false});
    assert.ok(out.blockers.includes("sensitive_media_offline_requires_managed_device_policy"));
  });
  it("short-lived private download links require authorization and bounded TTL",()=>{
    assert.equal(signedAccessPlan({classification:"tenant_confidential",authorizationVerified:false}).access,"blocked");
    const out=signedAccessPlan({classification:"tenant_confidential",authorizationVerified:true,seconds:300});
    assert.equal(out.access,"short_lived_signed_url");
    assert.equal(out.expiresInSeconds,300);
    assert.equal(out.signedUrlCreated,false);
  });
  it("uses authenticated streaming instead of signed URLs for legal and sensitive media",()=>{
    for(const classification of ["restricted_legal","restricted_sensitive_media"]){
      const out=signedAccessPlan({classification,authorizationVerified:true,seconds:300});
      assert.equal(out.access,"authenticated_stream");
      assert.equal(out.expiresInSeconds,null);
      assert.equal(out.authorizationRecheckedPerRequest,true);
      assert.equal(out.legalHoldMustOverrideDeletion,true);
    }
  });
  it("legal hold overrides a customer deletion request without silently deleting evidence",()=>{
    const out=retentionDecision({classification:"restricted_legal",
      createdAt:"2026-01-01T00:00:00Z",now:"2026-10-07T06:00:00Z",
      reviewedRetentionDueAt:"2026-02-01T00:00:00Z",retentionRuleRef:"rule_case_2026",
      legalHold:true,customerDeletionRequested:true});
    assert.equal(out.state,"retain_legal_or_incident_hold");
    assert.equal(out.deletionAuthorized,false);
    assert.equal(out.holdOverridesCustomerDeletion,true);
  });
  it("expired retention plus deletion request creates a purge candidate, not automatic deletion",()=>{
    const out=retentionDecision({classification:"tenant_standard",
      createdAt:"2026-01-01T00:00:00Z",now:"2026-10-07T06:00:00Z",
      reviewedRetentionDueAt:"2026-06-01T00:00:00Z",retentionRuleRef:"rule_records_2026",
      customerDeletionRequested:true});
    assert.equal(out.state,"purge_candidate_review_required");
    assert.equal(out.deletionAuthorized,false);
    assert.equal(out.purgeExecuted,false);
  });
  it("retention cannot run from an invented or missing policy reference",()=>{
    const out=retentionDecision({classification:"tenant_standard",
      createdAt:"2026-01-01T00:00:00Z",now:"2026-10-07T06:00:00Z",
      reviewedRetentionDueAt:"2026-06-01T00:00:00Z",retentionRuleRef:"bad"});
    assert.ok(out.blockers.includes("reviewed_retention_rule_missing"));
    assert.equal(out.deletionAuthorized,false);
  });
  it("restore proof requires both byte count and SHA-256 to match",()=>{
    assert.equal(restoreIntegrityCheck({expectedSha256:"a".repeat(64),
      restoredSha256:"a".repeat(64),expectedBytes:100,restoredBytes:100}).verified,true);
    assert.equal(restoreIntegrityCheck({expectedSha256:"a".repeat(64),
      restoredSha256:"b".repeat(64),expectedBytes:100,restoredBytes:100}).code,"restore_hash_mismatch");
    assert.equal(restoreIntegrityCheck({expectedSha256:"a".repeat(64),
      restoredSha256:"a".repeat(64),expectedBytes:100,restoredBytes:99}).code,"restore_size_mismatch");
  });

  it("refuses long-lived private signed URL suggestions",()=>{
    assert.ok(signedAccessPlan({classification:"tenant_confidential",authorizationVerified:true,seconds:86400})
      .blockers.includes("signed_url_ttl_out_of_range"));
  });
});
