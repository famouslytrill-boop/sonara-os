// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Offline-first policy for future native shells. This file does not create a
// local database, encrypt bytes, sync a device, or write server data. It decides
// which operations MAY enter a local queue and how conflicts must be classified.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const QUEUEABLE=Object.freeze(new Set([
  "append_note","draft_task","update_task_nonfinancial","inventory_count_observation",
  "draft_content","draft_customer_record","attach_local_file_reference"
]));
const NEVER_OFFLINE=Object.freeze(new Set([
  "payment_confirmation","refund","payout_change","bank_destination_change",
  "lease_signature","legal_notice","tenant_rejection","security_deposit_settlement",
  "publish_content","delete_record","permission_change","subscription_change"
]));
const SENSITIVE_FIELD=/^(bank|account_number|routing|card|cvv|ssn|password|secret|token|legal_status|payment_status|payout|refund|deposit_settlement)$/i;
function prepareOfflineMutation({
  organizationId,authenticatedOrganizationId,deviceId,mutationId,operation,
  entityType,entityId,baseVersion,payloadHash,payloadFields=[],
  deviceKeyProtectionVerified=false,localVaultEncrypted=false
}={}){
  const blockers=[];
  if(!UUID.test(organizationId||"")||organizationId!==authenticatedOrganizationId)blockers.push("tenant_scope_unverified");
  if(!UUID.test(deviceId||""))blockers.push("device_identity_unverified");
  if(!UUID.test(mutationId||""))blockers.push("mutation_id_invalid");
  if(NEVER_OFFLINE.has(operation))blockers.push("sensitive_operation_online_only");
  else if(!QUEUEABLE.has(operation))blockers.push("unknown_offline_operation");
  if(typeof entityType!=="string"||!/^[a-z][a-z0-9_]{1,63}$/.test(entityType))blockers.push("entity_type_invalid");
  if(!UUID.test(entityId||""))blockers.push("entity_id_invalid");
  if(!Number.isSafeInteger(baseVersion)||baseVersion<0)blockers.push("base_version_invalid");
  if(!SHA.test(payloadHash||""))blockers.push("payload_hash_missing");
  if(!Array.isArray(payloadFields)||payloadFields.length>100||
     payloadFields.some(x=>typeof x!=="string"||!/^[a-z][a-z0-9_]{0,63}$/.test(x)))
    blockers.push("payload_field_manifest_invalid");
  if(Array.isArray(payloadFields)&&payloadFields.some(x=>SENSITIVE_FIELD.test(x)))
    blockers.push("sensitive_fields_not_allowed_offline");
  if(deviceKeyProtectionVerified!==true||localVaultEncrypted!==true)
    blockers.push("local_encryption_not_verified");
  return Object.freeze({
    state:blockers.length?"offline_mutation_blocked":"queue_candidate",
    blockers:Object.freeze(blockers),operation,
    serverWriteAuthorized:false,conflictResolved:false,
    lastWriteWinsAllowed:false,queuedLocally:false
  });
}
function reconcileOfflineMutation({
  operation,baseVersion,serverVersion,mutationAlreadyApplied=false,
  payloadHashMatchesQueued=false,serverEntityExists=true
}={}){
  const issues=[];
  if(!QUEUEABLE.has(operation))issues.push("operation_not_queueable");
  if(!Number.isSafeInteger(baseVersion)||baseVersion<0||
     !Number.isSafeInteger(serverVersion)||serverVersion<0)issues.push("version_unreadable");
  if(mutationAlreadyApplied)return Object.freeze({
    state:"idempotent_already_applied",issues:Object.freeze(issues),
    applyCandidate:false,humanConflictReview:false
  });
  if(payloadHashMatchesQueued!==true)issues.push("local_payload_integrity_unverified");
  if(serverEntityExists!==true)issues.push("server_entity_missing_or_deleted");
  if(issues.length)return Object.freeze({
    state:"blocked_pending_review",issues:Object.freeze(issues),
    applyCandidate:false,humanConflictReview:true
  });
  // The device cannot know a server revision from the future. This is not
  // an ordinary concurrency conflict and must not enter an append-only merge.
  if(baseVersion>serverVersion)return Object.freeze({
    state:"client_version_ahead_of_server",issues:Object.freeze(["client_version_ahead"]),
    applyCandidate:false,humanConflictReview:true
  });
  if(baseVersion===serverVersion)return Object.freeze({
    state:"clean_apply_candidate",issues:Object.freeze([]),
    applyCandidate:true,humanConflictReview:false,nextVersion:serverVersion+1
  });
  // Only append_note is naturally additive here. It still becomes a new server
  // event and never overwrites an existing note. Every update-style conflict is
  // explicit; legal/financial state never uses last-write-wins.
  if(operation==="append_note")return Object.freeze({
    state:"append_only_merge_candidate",issues:Object.freeze(["base_version_advanced"]),
    applyCandidate:true,humanConflictReview:false,nextVersion:serverVersion+1
  });
  return Object.freeze({
    state:"version_conflict_human_review",issues:Object.freeze(["base_version_advanced"]),
    applyCandidate:false,humanConflictReview:true
  });
}
module.exports={QUEUEABLE,NEVER_OFFLINE,prepareOfflineMutation,reconcileOfflineMutation};
