// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const {
  ACTIONS, authorizeSocialAction, mediaEvidence, planCustomerNotification
} = require("../lib/sonara-social-interaction-gates.cjs");

const ACTOR = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const BASE = Object.freeze({
  action: "follow", product: "growth_studio", actorId: ACTOR,
  targetId: TARGET, organizationId: TENANT, serverOrganizationId: TENANT,
  actorHasPermission: true, idempotencyKey: "social_action_00000001",
  rateBudgetGranted: true, blockedByActor: false, blockedByTarget: false,
  targetPublicVisible: true, targetModerationApproved: true,
  commentModerationApproved: true
});
const IMAGE = Object.freeze({
  kind: "image", rightsCleared: true, moderationApproved: true,
  depictsIdentifiablePeople: false, altText: "A product on a table"
});
const NOTIFICATION = Object.freeze({
  purpose: "social", channel: "push", recipientId: TARGET, organizationId: TENANT,
  serverOrganizationId: TENANT, deliveryKey: "notification_key_00000001",
  preferenceReadable: true, channelOptedIn: true, optedOut: false,
  senderBlocked: false, suppressed: false, quietHoursActive: false,
  rateBudgetGranted: true, dedupeClaimGranted: true, providerReady: true
});

describe("social interaction safety gates: not connected to a route", () => {
  it("declares the supported action vocabulary without execution", () => {
    assert.equal(new Set(ACTIONS).size, ACTIONS.length);
    assert.equal(authorizeSocialAction(BASE).ok, true);
    assert.equal(authorizeSocialAction(BASE).sideEffectExecuted, false);
    assert.equal(authorizeSocialAction(BASE).publishAuthorized, false);
    assert.equal(authorizeSocialAction(BASE).deliveryAuthorized, false);
    assert.equal(authorizeSocialAction({ ...BASE, action: "delete_everything" }).code, "social_action_unknown");
  });

  it("rejects identity forgery, cross-tenant scope, and missing permission", () => {
    assert.equal(authorizeSocialAction({ ...BASE, actorId: "not-a-uuid" }).code, "login_required");
    assert.equal(authorizeSocialAction({ ...BASE, serverOrganizationId: OTHER }).code, "tenant_scope_unverified");
    assert.equal(authorizeSocialAction({ ...BASE, actorHasPermission: "true" }).code, "surface_permission_required");
    assert.equal(authorizeSocialAction({ ...BASE, product: "not-a-product" }).code, "unknown_free_surface");
    assert.equal(authorizeSocialAction({ ...BASE, targetId: "bad" }).code, "social_target_unverified");
    assert.equal(authorizeSocialAction({ ...BASE, targetId: ACTOR }).code, "social_self_target_forbidden");
  });

  it("requires an atomic budget and a bounded idempotency key for every action", () => {
    assert.equal(authorizeSocialAction({ ...BASE, idempotencyKey: undefined }).code, "idempotency_key_required");
    assert.equal(authorizeSocialAction({ ...BASE, idempotencyKey: "123" }).code, "idempotency_key_required");
    assert.equal(authorizeSocialAction({ ...BASE, rateBudgetGranted: "true" }).code, "social_rate_budget_required");
    assert.equal(authorizeSocialAction({ ...BASE, rateBudgetGranted: false }).ok, false);
  });

  it("denies an unreadable block graph, a blocked relationship and hidden targets", () => {
    assert.equal(authorizeSocialAction({ ...BASE, blockedByActor: undefined }).code, "block_state_unverified");
    assert.equal(authorizeSocialAction({ ...BASE, blockedByTarget: undefined }).code, "block_state_unverified");
    assert.equal(authorizeSocialAction({ ...BASE, blockedByTarget: true }).code, "social_relationship_blocked");
    assert.equal(authorizeSocialAction({ ...BASE, targetPublicVisible: false }).code, "social_target_not_public");
    assert.equal(authorizeSocialAction({ ...BASE, action: "react", targetModerationApproved: false }).code, "social_target_not_approved");
    assert.equal(authorizeSocialAction({ ...BASE, action: "comment", commentModerationApproved: false }).code, "comment_review_required");
  });

  it("lets a person report a blocked or unavailable post without exposing it", () => {
    const report = authorizeSocialAction({
      ...BASE, action: "report", targetPublicVisible: false,
      blockedByTarget: true, reportReason: "harassment"
    });
    assert.equal(report.ok, true);
    assert.equal(report.code, "report_candidate");
    assert.equal(report.sideEffectExecuted, false);
    assert.equal(authorizeSocialAction({ ...BASE, action: "report", reportReason: "invalid" }).code, "report_reason_required");
  });

  it("supports independent block and mute controls without requiring target visibility", () => {
    for (const action of ["block", "unblock", "mute", "unmute"]) {
      const result = authorizeSocialAction({
        ...BASE, action, targetPublicVisible: false,
        blockedByActor: undefined, blockedByTarget: undefined
      });
      assert.equal(result.code, "relationship_control_candidate");
      assert.equal(result.sideEffectExecuted, false);
    }
  });

  it("direct messages are opt-in, and never automatically sent", () => {
    const message = { ...BASE, action: "message", recipientInboxEnabled: true, recipientConsentVerified: true };
    assert.equal(authorizeSocialAction(message).code, "message_candidate");
    assert.equal(authorizeSocialAction({ ...message, recipientConsentVerified: undefined }).code, "recipient_consent_required");
    assert.equal(authorizeSocialAction({ ...message, blockedByActor: true }).code, "social_relationship_blocked");
  });

  it("requires rights, moderation, identifiable-person consent and accessible media", () => {
    const media = { ...BASE, action: "publish_media", ownerPublicationApproved: true, media: IMAGE };
    assert.equal(authorizeSocialAction(media).code, "media_publication_candidate");
    assert.equal(authorizeSocialAction({ ...media, media: { ...IMAGE, rightsCleared: false } }).code, "media_review_required");
    assert.equal(authorizeSocialAction({ ...media, media: { ...IMAGE, depictsIdentifiablePeople: undefined } }).code, "media_release_evidence_missing");
    assert.equal(authorizeSocialAction({ ...media, media: { ...IMAGE, depictsIdentifiablePeople: true } }).code, "media_release_evidence_missing");
    assert.equal(authorizeSocialAction({ ...media, media: { ...IMAGE, altText: "" } }).code, "image_text_alternative_required");
    assert.equal(authorizeSocialAction({ ...media, ownerPublicationApproved: false }).code, "owner_publish_approval_required");
    assert.equal(mediaEvidence({ ...IMAGE, kind: "video", captionsReady: false }, "publish_media"), "video_captions_required");
    assert.equal(mediaEvidence({ ...IMAGE, kind: "audio", transcriptReady: false }, "publish_media"), "audio_transcript_required");
  });

  it("live streaming needs captions, moderation, real transport and an emergency stop", () => {
    const live = {
      ...BASE, action: "start_live", ownerPublicationApproved: true,
      media: { ...IMAGE, kind: "live", liveCaptionsReady: true },
      transportReady: true, moderatorReady: true, killSwitchReady: true
    };
    assert.equal(authorizeSocialAction(live).code, "live_session_candidate");
    assert.equal(authorizeSocialAction({ ...live, media: { ...live.media, liveCaptionsReady: false } }).code, "live_captions_required");
    assert.equal(authorizeSocialAction({ ...live, killSwitchReady: false }).code, "live_safety_infrastructure_required");
    assert.equal(authorizeSocialAction({ ...BASE, action: "join_live", sessionState: "ended" }).code, "live_session_unavailable");
    assert.equal(authorizeSocialAction({ ...BASE, action: "join_live", sessionState: "live" }).ok, true);
  });
});

describe("customer notifications: explicitly chosen channels", () => {
  it("only returns a delivery candidate, never a sent notification", () => {
    const result = planCustomerNotification(NOTIFICATION);
    assert.equal(result.code, "notification_candidate");
    assert.equal(result.sideEffectExecuted, false);
    assert.equal(result.deliveryAuthorized, false);
  });

  it("rejects missing opt-in, unreadable preference and any suppression", () => {
    assert.equal(planCustomerNotification({ ...NOTIFICATION, preferenceReadable: false }).code, "notification_preference_unreadable");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, channelOptedIn: false }).code, "notification_opt_in_required");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, optedOut: true }).code, "notification_opt_in_required");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, senderBlocked: true }).code, "notification_suppressed");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, suppressed: undefined }).code, "notification_suppressed");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, quietHoursActive: true }).code, "notification_quiet_hours");
  });

  it("marketing needs separate consent and a human-approved campaign", () => {
    const marketing = { ...NOTIFICATION, purpose: "marketing" };
    assert.equal(planCustomerNotification(marketing).code, "marketing_authorization_required");
    assert.equal(planCustomerNotification({ ...marketing, marketingConsentVerified: true, ownerCampaignApproved: true }).ok, true);
  });

  it("fails closed on delivery identity, provider, rate and dedupe gaps", () => {
    assert.equal(planCustomerNotification({ ...NOTIFICATION, serverOrganizationId: OTHER }).code, "notification_scope_unverified");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, deliveryKey: "short" }).code, "notification_delivery_key_required");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, rateBudgetGranted: false }).code, "notification_budget_or_dedupe_required");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, dedupeClaimGranted: false }).code, "notification_budget_or_dedupe_required");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, providerReady: false }).code, "notification_transport_unavailable");
    assert.equal(planCustomerNotification({ ...NOTIFICATION, channel: "telepathy" }).code, "notification_type_unknown");
  });
});
