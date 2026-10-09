// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Runtime remains feature-disabled until its reviewed SQL migration, security
// tests and operator canary are complete. Never accept client-supplied user IDs.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS = Object.freeze([
  "spam", "harassment", "hate", "violence", "sexual",
  "illegal", "impersonation", "privacy", "other"
]);
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const MAX_DETAIL = 500;
const STATES = Object.freeze(["allowed", "blocked_by_me", "unavailable", "no_owner"]);

function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}
function featureEnabled(getEnv) {
  return typeof getEnv === "function" &&
    getEnv("SONARA_SOCIAL_USER_SAFETY_ENABLED") === "true";
}
function canonicalOrigin(getEnv) {
  const raw = typeof getEnv === "function" ? getEnv("NEXT_PUBLIC_SITE_URL") : null;
  if (typeof raw !== "string") return "";
  try {
    const u = new URL(raw);
    // Exactly one configured HTTPS origin; never infer trusted hosts from
    // a caller's Host or X-Forwarded-Host header.
    if (u.protocol !== "https:" || u.username || u.password ||
        (u.pathname !== "/" && u.pathname !== "") || u.search || u.hash) return "";
    return u.origin;
  } catch {
    return "";
  }
}
function sameOrigin(req, getEnv) {
  const expected = canonicalOrigin(getEnv);
  return Boolean(expected && req?.headers?.origin === expected &&
    String(req.headers["sec-fetch-site"] || "same-origin") !== "cross-site");
}
function reportInput(body = {}) {
  const reason = body && typeof body.reason === "string" ? body.reason : "";
  const detail = body && typeof body.detail === "string" ? body.detail.replace(/\r\n?/g, "\n").trim() : "";
  const requestId = body && typeof body.request_id === "string" ? body.request_id : "";
  if (!REASONS.includes(reason)) return Object.freeze({ ok: false, code: "report_reason_invalid" });
  if (!isUuid(requestId)) return Object.freeze({ ok: false, code: "report_idempotency_missing" });
  if (detail.length > MAX_DETAIL || CONTROL.test(detail)) {
    return Object.freeze({ ok: false, code: "report_detail_invalid" });
  }
  return Object.freeze({ ok: true, reason, detail, requestId });
}
function actionInput({ actorId, profileId, action, body = {} } = {}) {
  if (!isUuid(actorId)) return Object.freeze({ ok: false, code: "login_required" });
  if (!isUuid(profileId)) return Object.freeze({ ok: false, code: "creator_profile_invalid" });
  if (!["block", "unblock", "report"].includes(action)) return Object.freeze({ ok: false, code: "social_action_unsupported" });
  if (action === "report") {
    const input = reportInput(body);
    if (!input.ok) return input;
    return Object.freeze({ ok: true, actorId, profileId, action, ...input });
  }
  return Object.freeze({ ok: true, actorId, profileId, action });
}
function stateInput(response) {
  if (typeof response === "string" && STATES.includes(response)) return response;
  return "unavailable";
}
module.exports = {
  UUID, REASONS, MAX_DETAIL, STATES, isUuid, featureEnabled,
  canonicalOrigin, sameOrigin, reportInput, actionInput, stateInput
};
