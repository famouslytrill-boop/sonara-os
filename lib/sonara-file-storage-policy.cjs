// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic file/storage policy only. No bytes are uploaded, decrypted,
// scanned, signed, deleted or exposed here. A trusted server must independently
// derive MIME/signature/hash/tenant facts. Client-supplied flags are never proof.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256=/^[a-f0-9]{64}$/i;
const SAFE_NAME=/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,119}$/;
const CLASSIFICATIONS=Object.freeze([
  "public_marketing","tenant_standard","tenant_confidential",
  "restricted_legal","restricted_sensitive_media"
]);
const PLATFORM=Object.freeze(["web_pwa","android_native","ios_native","desktop_native"]);
const TYPE_BY_EXTENSION=Object.freeze({
  png:["image/png"],jpg:["image/jpeg"],jpeg:["image/jpeg"],webp:["image/webp"],
  gif:["image/gif"],mp3:["audio/mpeg"],wav:["audio/wav","audio/x-wav"],
  aac:["audio/aac"],m4a:["audio/mp4"],mp4:["video/mp4"],webm:["video/webm"],
  mov:["video/quicktime"],pdf:["application/pdf"],txt:["text/plain"],
  csv:["text/csv","text/plain"],
  json:["application/json","text/json"],
  xlsx:["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
});
const ACTIVE_OR_LEGACY_BLOCKED=Object.freeze(new Set([
  "xlsm","xlsb","xlam","xls","docm","dotm","pptm","exe","dll","js","mjs","cjs",
  "html","htm","svg","ps1","bat","cmd","sh","jar","apk","ipa"
]));
const LIMITS=Object.freeze({
  public_marketing:10*1024*1024,
  tenant_standard:250*1024*1024,
  tenant_confidential:250*1024*1024,
  restricted_legal:100*1024*1024,
  restricted_sensitive_media:500*1024*1024
});
function extOf(name){
  if(typeof name!=="string")return "";
  const base=name.trim();
  const idx=base.lastIndexOf(".");
  return idx>0?base.slice(idx+1).toLowerCase():"";
}
function safeDisplayName(name){
  if(typeof name!=="string")return null;
  const trimmed=name.trim();
  if(!SAFE_NAME.test(trimmed)||trimmed.includes("..")||trimmed.startsWith(".")||trimmed.startsWith("-"))return null;
  return trimmed;
}
function storagePreflight({
  organizationId,authenticatedOrganizationId,classification,
  originalName,sizeBytes,declaredMime,detectedMime,verifiedSha256,
  fileSignatureVerified=false,malwareScan="pending",
  archiveBombCheck="not_applicable",activeContentDetected=false,
  authenticatedUploader=false,authorizedUploader=false
}={}){
  const blockers=[];
  const warnings=[];
  if(!UUID.test(organizationId||"")||organizationId!==authenticatedOrganizationId)blockers.push("tenant_scope_unverified");
  if(!CLASSIFICATIONS.includes(classification))blockers.push("unknown_data_classification");
  if(authenticatedUploader!==true||authorizedUploader!==true)blockers.push("uploader_authority_unverified");
  if(!Number.isSafeInteger(sizeBytes)||sizeBytes<=0)blockers.push("invalid_file_size");
  if(!SHA256.test(verifiedSha256||""))blockers.push("server_content_hash_missing");
  const extension=extOf(originalName);
  if(!extension||ACTIVE_OR_LEGACY_BLOCKED.has(extension))blockers.push("blocked_or_active_file_type");
  const allowedMimes=TYPE_BY_EXTENSION[extension]||null;
  if(!allowedMimes)blockers.push("file_extension_not_allowlisted");
  if(!allowedMimes?.includes(detectedMime))blockers.push("detected_mime_mismatch");
  if(declaredMime&&declaredMime!==detectedMime)warnings.push("client_mime_did_not_match_detection");
  if(fileSignatureVerified!==true)blockers.push("file_signature_unverified");
  if(activeContentDetected===true)blockers.push("active_content_prohibited");
  const limit=LIMITS[classification];
  if(Number.isSafeInteger(sizeBytes)&&limit&&sizeBytes>limit)blockers.push("classification_size_limit_exceeded");
  // XLSX is a ZIP container. We do not permit macros; still require archive
  // bomb/container inspection before release from quarantine.
  if(extension==="xlsx"&&archiveBombCheck!=="passed")blockers.push("spreadsheet_container_scan_required");
  if(malwareScan!=="clean")blockers.push("malware_scan_not_clean");
  const displayName=safeDisplayName(originalName);
  if(!displayName)warnings.push("original_filename_not_safe_for_display");
  return Object.freeze({
    state:blockers.length?"quarantine_or_reject":"storage_review_ready",
    blockers:Object.freeze(blockers),warnings:Object.freeze(warnings),
    classification,extension:extension||null,detectedMime:detectedMime||null,
    displayName,publicReadAllowed:classification==="public_marketing"&&blockers.length===0,
    executeAllowed:false,storedFilenameFromUser:false,
    storagePathGeneratedServerSide:true,signedUrlRequired:classification!=="public_marketing",
    uploadExecuted:false,scanExecuted:false
  });
}
function generatedObjectKey({organizationId,classification,objectId,sha256}={}){
  if(!UUID.test(organizationId||"")||!CLASSIFICATIONS.includes(classification)||
     !UUID.test(objectId||"")||!SHA256.test(sha256||""))throw new Error("invalid_storage_identity");
  // No user filename and no extension: downstream serving relies on reviewed
  // content metadata and forces download/disposition when appropriate.
  return organizationId+"/"+classification+"/"+sha256.slice(0,2)+"/"+objectId;
}
function localCachePlan({
  classification,platform,offlineRequested=false,
  osSecureKeyStoreVerified=false,deviceBoundKeyRefRecorded=false,
  userAuthenticationRequired=false,managedDevice=false
}={}){
  const blockers=[];
  if(!CLASSIFICATIONS.includes(classification))blockers.push("unknown_data_classification");
  if(!PLATFORM.includes(platform))blockers.push("unknown_client_platform");
  const restricted=["tenant_confidential","restricted_legal","restricted_sensitive_media"].includes(classification);
  if(!offlineRequested)return Object.freeze({
    mode:"network_only",blockers:Object.freeze(blockers),persistentLocalCopy:false,
    localEncryptionRequired:restricted,secretsInLocalFilesAllowed:false
  });
  if(platform==="web_pwa"&&restricted)blockers.push("restricted_data_no_persistent_web_cache");
  if(platform==="web_pwa"&&classification==="tenant_standard")blockers.push("standard_data_web_cache_requires_separate_threat_review");
  if(["android_native","ios_native","desktop_native"].includes(platform)){
    if(!osSecureKeyStoreVerified||!deviceBoundKeyRefRecorded)blockers.push("os_protected_key_unverified");
    if(restricted&&!userAuthenticationRequired)blockers.push("restricted_cache_requires_user_authentication");
  }
  if(classification==="restricted_sensitive_media"&&!managedDevice)blockers.push("sensitive_media_offline_requires_managed_device_policy");
  return Object.freeze({
    mode:blockers.length?"offline_cache_blocked":"encrypted_offline_cache_review_ready",
    blockers:Object.freeze(blockers),
    persistentLocalCopy:blockers.length===0,
    localEncryptionRequired:classification!=="public_marketing",
    secretsInLocalFilesAllowed:false,
    databaseKeyStoredBesideDatabase:false,
    platformKeyStoreRequired:platform!=="web_pwa",
    syncExecutionAuthorized:false
  });
}
function signedAccessPlan({classification,authorizationVerified=false,seconds=300}={}){
  const blockers=[];
  if(!CLASSIFICATIONS.includes(classification))blockers.push("unknown_data_classification");
  if(classification!=="public_marketing"&&authorizationVerified!==true)blockers.push("download_authorization_unverified");
  if(!Number.isSafeInteger(seconds)||seconds<30||seconds>900)blockers.push("signed_url_ttl_out_of_range");
  return Object.freeze({
    blockers:Object.freeze(blockers),
    access:blockers.length?"blocked":classification==="public_marketing"?"public_candidate":"short_lived_signed_url",
    expiresInSeconds:blockers.length?null:classification==="public_marketing"?null:seconds,
    signedUrlCreated:false,authorizationRecheckedPerRequest:classification!=="public_marketing"
  });
}
module.exports={
  CLASSIFICATIONS,TYPE_BY_EXTENSION,ACTIVE_OR_LEGACY_BLOCKED,LIMITS,
  safeDisplayName,storagePreflight,generatedObjectKey,localCachePlan,signedAccessPlan
};
