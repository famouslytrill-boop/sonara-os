// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Data access is always scoped to the signed-in user. Never treat an unreadable
// block list as empty: that would silently re-expose a muted channel.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = Object.freeze(["remove", "restore", "dismiss"]);
const MAX_BLOCKED = 500;

function isUuid(value) { return typeof value === "string" && UUID.test(value); }
function blockState(rows, channelId) {
  if (!Array.isArray(rows) || rows.length > MAX_BLOCKED ||
    rows.some((r) => !r || !isUuid(r.channel_id))) {
    return Object.freeze({ ok: false, blocked: null, code: "blocks_unreadable" });
  }
  if (!isUuid(channelId)) return Object.freeze({ ok: false, blocked: null, code: "channel_invalid" });
  return Object.freeze({ ok: true, blocked: rows.some((r) => r.channel_id.toLowerCase() === channelId.toLowerCase()) });
}
function visibleDirectory(rows, blocks) {
  if (!Array.isArray(rows) || !Array.isArray(blocks) || blocks.length > MAX_BLOCKED ||
      blocks.some((r) => !r || !isUuid(r.channel_id))) {
    return Object.freeze({ ok: false, rows: [], code: "blocks_unreadable" });
  }
  const omitted = new Set(blocks.map((r) => r.channel_id.toLowerCase()));
  return Object.freeze({ ok: true, rows: rows.filter((r) => r && isUuid(r.channel_id) && !omitted.has(r.channel_id.toLowerCase())) });
}
function moderationInput({ action, postId, actorId, organizationId, ownedPostId, ownedOrganizationId } = {}) {
  if (!ACTIONS.includes(action)) return { ok: false, code: "moderation_action_invalid" };
  if (![postId, actorId, organizationId, ownedPostId, ownedOrganizationId].every(isUuid) ||
      postId.toLowerCase() !== ownedPostId.toLowerCase() ||
      organizationId.toLowerCase() !== ownedOrganizationId.toLowerCase()) {
    return { ok: false, code: "moderation_scope_unverified" };
  }
  return Object.freeze({ ok: true, operation: action, postId: postId.toLowerCase(),
    organizationId: organizationId.toLowerCase(), actorId: actorId.toLowerCase() });
}
module.exports = { isUuid, blockState, visibleDirectory, moderationInput, MAX_BLOCKED, ACTIONS };
