// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure, fail-closed social interaction and communications preflight.
// This does NOT perform authorization, send notifications, publish content,
// initiate a live session or execute a database write. All "verified" booleans
// MUST come from server-controlled authorization, consent, moderation and
// transactionally consumed rate/idempotency records, never request JSON.

const { surfacePolicy } = require("./sonara-free-platform-surface-policy.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELIVERY_KEY = /^[a-zA-Z0-9][a-zA-Z0-9_-]{15,127}$/;
const ACTIONS = Object.freeze([
  "follow", "unfollow", "react", "comment", "report",
  "block", "unblock", "mute", "unmute", "message",
  "publish_media", "start_live", "join_live"
]);
const TARGET_ACTIONS = new Set(ACTIONS.filter((action) =>
  action !== "publish_media" && action !== "start_live"
));
const CONTROL_ACTIONS = new Set(["block", "unblock", "mute", "unmute"]);
const AUDIENCE_ACTIONS = new Set(["follow", "unfollow", "react", "comment", "join_live"]);
const MEDIA_ACTIONS = new Set(["publish_media", "start_live"]);
const REPORT_REASONS = Object.freeze([
  "spam", "harassment", "hate", "violence", "sexual", "illegal", "misleading", "other"
]);
const CHANNELS = Object.freeze(["in_app", "push", "email", "sms"]);
const PURPOSES = Object.freeze(["security", "transactional", "social", "marketing"]);

function uuid(value) {
  return typeof value === "string" && UUID.test(value);
}

function denied(code) {
  return Object.freeze({
    ok: false, code, sideEffectExecuted: false, publishAuthorized: false,
    deliveryAuthorized: false
  });
}

function candidate(code) {
  return Object.freeze({
    ok: true, code, state: "preflight_only", sideEffectExecuted: false,
    publishAuthorized: false, deliveryAuthorized: false
  });
}

function mediaEvidence(media, action) {
  if (!media || typeof media !== "object" || Array.isArray(media)) return "media_evidence_missing";
  const kind = media.kind;
  if (action === "start_live" ? kind !== "live" : !["image", "audio", "video"].includes(kind)) {
    return "media_kind_invalid";
  }
  if (media.rightsCleared !== true || media.moderationApproved !== true) {
    return "media_review_required";
  }
  // Unknown whether identifiable people appear is not equivalent to "no".
  if (typeof media.depictsIdentifiablePeople !== "boolean") return "media_release_evidence_missing";
  if (media.depictsIdentifiablePeople && media.releaseConsentVerified !== true) {
    return "media_release_evidence_missing";
  }
  if (kind === "image" && (typeof media.altText !== "string" || !media.altText.trim() || media.altText.length > 500)) {
    return "image_text_alternative_required";
  }
  if (kind === "audio" && media.transcriptReady !== true) return "audio_transcript_required";
  if (kind === "video" && media.captionsReady !== true) return "video_captions_required";
  if (kind === "live" && media.liveCaptionsReady !== true) return "live_captions_required";
  return null;
}

/**
 * Input is a trusted context assembled by a server after re-reading the
 * authoritative actor, tenant, target, block and moderation records.
 * No result is permission to execute; the caller must recheck the same
 * predicates in its tenant-scoped transaction and atomically claim its budget
 * and idempotency key. Strict booleans prevent undefined from passing.
 */
function authorizeSocialAction(input = {}) {
  const action = input.action;
  if (!ACTIONS.includes(action)) return denied("social_action_unknown");
  const mapped = action === "comment" ? "comment"
    : MEDIA_ACTIONS.has(action) ? "publish"
      : action === "report" ? "report"
        : ["follow", "unfollow", "react", "join_live"].includes(action) ? "follow" : "manage";
  const baseline = surfacePolicy({
    product: input.product, service: "social", action: mapped,
    userId: input.actorId, organizationId: input.organizationId,
    serverOrganizationId: input.serverOrganizationId,
    actorHasPermission: input.actorHasPermission,
    moderationApproved: true
  });
  if (!baseline.ok) return denied(baseline.code);
  if (!DELIVERY_KEY.test(input.idempotencyKey || "")) return denied("idempotency_key_required");
  if (input.rateBudgetGranted !== true) return denied("social_rate_budget_required");

  if (TARGET_ACTIONS.has(action) && !uuid(input.targetId)) return denied("social_target_unverified");
  if (TARGET_ACTIONS.has(action) && input.actorId.toLowerCase() === input.targetId.toLowerCase()) {
    return denied("social_self_target_forbidden");
  }

  if (action === "report") {
    if (!REPORT_REASONS.includes(input.reportReason)) return denied("report_reason_required");
    // A blocked or hidden target must still be reportable. Review the record
    // securely by ID; do not make reporting depend on public feed visibility.
    return candidate("report_candidate");
  }
  if (CONTROL_ACTIONS.has(action)) return candidate("relationship_control_candidate");

  // Both directions of the block graph must have been read successfully.
  if (typeof input.blockedByActor !== "boolean" || typeof input.blockedByTarget !== "boolean") {
    return denied("block_state_unverified");
  }
  if (input.blockedByActor || input.blockedByTarget) return denied("social_relationship_blocked");

  if (AUDIENCE_ACTIONS.has(action) && input.targetPublicVisible !== true) {
    return denied("social_target_not_public");
  }
  if (["react", "comment", "join_live"].includes(action) && input.targetModerationApproved !== true) {
    return denied("social_target_not_approved");
  }
  if (action === "comment" && input.commentModerationApproved !== true) {
    return denied("comment_review_required");
  }
  if (action === "message") {
    if (input.recipientConsentVerified !== true || input.recipientInboxEnabled !== true) {
      return denied("recipient_consent_required");
    }
    return candidate("message_candidate");
  }
  if (MEDIA_ACTIONS.has(action)) {
    const error = mediaEvidence(input.media, action);
    if (error) return denied(error);
    if (input.ownerPublicationApproved !== true) return denied("owner_publish_approval_required");
    if (action === "start_live") {
      if (input.transportReady !== true || input.moderatorReady !== true || input.killSwitchReady !== true) {
        return denied("live_safety_infrastructure_required");
      }
      return candidate("live_session_candidate");
    }
    return candidate("media_publication_candidate");
  }
  if (action === "join_live" && input.sessionState !== "live") {
    return denied("live_session_unavailable");
  }
  return candidate("social_interaction_candidate");
}

/**
 * Notification planning only; no delivery and no silent opt-in.
 * Even transactional and security alerts require an explicit saved channel
 * preference in this initial policy. Statutory messaging exceptions must be
 * reviewed separately rather than inferred from this preflight.
 */
function planCustomerNotification(input = {}) {
  if (!PURPOSES.includes(input.purpose) || !CHANNELS.includes(input.channel)) {
    return denied("notification_type_unknown");
  }
  if (!uuid(input.recipientId) || !uuid(input.organizationId)
    || input.organizationId !== input.serverOrganizationId) {
    return denied("notification_scope_unverified");
  }
  if (!DELIVERY_KEY.test(input.deliveryKey || "")) return denied("notification_delivery_key_required");
  if (input.preferenceReadable !== true) return denied("notification_preference_unreadable");
  if (input.channelOptedIn !== true || input.optedOut === true) {
    return denied("notification_opt_in_required");
  }
  if (input.senderBlocked !== false || input.suppressed !== false) {
    return denied("notification_suppressed");
  }
  if (["social", "marketing"].includes(input.purpose) && input.quietHoursActive !== false) {
    return denied("notification_quiet_hours");
  }
  if (input.purpose === "marketing"
    && (input.marketingConsentVerified !== true || input.ownerCampaignApproved !== true)) {
    return denied("marketing_authorization_required");
  }
  if (input.rateBudgetGranted !== true || input.dedupeClaimGranted !== true) {
    return denied("notification_budget_or_dedupe_required");
  }
  if (input.providerReady !== true) return denied("notification_transport_unavailable");
  return candidate("notification_candidate");
}

module.exports = {
  ACTIONS, REPORT_REASONS, CHANNELS, PURPOSES,
  authorizeSocialAction, mediaEvidence, planCustomerNotification
};
