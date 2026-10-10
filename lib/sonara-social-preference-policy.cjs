// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic, SIDE-EFFECT-FREE social preference mutation planner.
// NOT a route, DB adapter, user authentication, consent issuer, or security
// authority. Future server callers MUST derive verifiedActorId and verified
// consent receipts independently. Commit only through an atomic DB compare-
// and-swap scoped to that authenticated viewer. This module performs NO I/O.
//
// Important separation: a muted/hidden post is NOT an account-level block.
// Reciprocal blocks, follow permissions and age/region verification come from
// independently authorized sources; never let this user-edited record supply them.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOPIC = /^[a-z0-9]+(?:[ _-][a-z0-9]+)*$/;
const KEYS = Object.freeze(["topics", "mutedTopics", "mutedKeywords", "hiddenContentIds"]);
const MAX_VALUES = 200;
const MAX_KEYWORD = 64;
const MAX_TOPIC = 64;
const AI_MODES = Object.freeze(["include", "reduce", "exclude"]);
const COMMANDS = Object.freeze({
  add_topic: ["topics", "add"],
  remove_topic: ["topics", "remove"],
  mute_topic: ["mutedTopics", "add"],
  unmute_topic: ["mutedTopics", "remove"],
  mute_keyword: ["mutedKeywords", "add"],
  unmute_keyword: ["mutedKeywords", "remove"],
  hide_post: ["hiddenContentIds", "add"],
  unhide_post: ["hiddenContentIds", "remove"]
});
const EMPTY = Object.freeze({});
const deny = code => Object.freeze({ ok: false, code, sideEffectExecuted: false });
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const validUuid = v => typeof v === "string" && UUID.test(v);
function normalized(field, value) {
  if (typeof value !== "string") return null;
  if (field === "hiddenContentIds") return validUuid(value) ? value.toLowerCase() : null;
  if (field === "mutedKeywords") {
    if (!value.trim() || value.length > MAX_KEYWORD ||
        /[\u0000-\u001f\u007f]/.test(value)) return null;
    const p = value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    return p && p.length <= MAX_KEYWORD ? p : null;
  }
  const t = value.toLowerCase().trim();
  return t.length > 0 && t.length <= MAX_TOPIC && TOPIC.test(t) ? t : null;
}
function normalizeStoredSettings(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      typeof raw.discoveryOptIn !== "boolean" ||
      !AI_MODES.includes(raw.aiContent) ||
      Object.keys(raw).length !== KEYS.length + 2 ||
      Object.keys(raw).some(key => !KEYS.includes(key) && !["discoveryOptIn", "aiContent"].includes(key))) return null;
  const safe = {};
  for (const field of KEYS) {
    const list = raw[field];
    if (!Array.isArray(list) || list.length > MAX_VALUES) return null;
    const result = [];
    const seen = new Set();
    for (const value of list) {
      const text = normalized(field, value);
      if (text === null || seen.has(text) || text !== value) return null;
      seen.add(text);
      result.push(text);
    }
    safe[field] = result.sort();
  }
  safe.discoveryOptIn = raw.discoveryOptIn;
  safe.aiContent = raw.aiContent;
  return Object.freeze(Object.fromEntries(Object.entries(safe).map(
    ([key, value]) => [key, Array.isArray(value) ? Object.freeze(value) : value]
  )));
}
function emptySettings() {
  return Object.freeze({
    topics: Object.freeze([]), mutedTopics: Object.freeze([]),
    mutedKeywords: Object.freeze([]), hiddenContentIds: Object.freeze([]),
    discoveryOptIn: false, aiContent: "include"
  });
}
function validConsent(evidence, viewerId) {
  return evidence && evidence.verified === true &&
    validUuid(evidence.viewerId) &&
    evidence.viewerId.toLowerCase() === viewerId &&
    typeof evidence.policyVersion === "string" &&
    /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(evidence.policyVersion) &&
    typeof evidence.acceptedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(evidence.acceptedAt) &&
    Number.isFinite(Date.parse(evidence.acceptedAt));
}

/**
 * Inputs must be from trustworthy SERVER ports, never an HTTP body:
 * - verifiedActorId: independently authenticated current session user ID.
 * - current.viewerId, revision, settings: one authoritative current owner row.
 * - expectedRevision: explicit write precondition from the last read.
 * - consentEvidence: independently verified, version-bound receipt when
 *   enabling Discover. A {verified:true} test seam is NOT itself proof.
 * A missing stored row is an ERROR, not "the viewer has no blocks."
 *
 * Return: proposed settings, expectedRevision and nextRevision for an atomic
 * database UPDATE ... WHERE user_id=:actor AND revision=:expected ... RETURNING.
 * No automatic retry after a CAS conflict: reread current state and obtain a
 * new user intent so a stale unblock cannot overwrite a newer block.
 */
function planSocialPreferenceChange({ verifiedActorId, current, expectedRevision,
  command, consentEvidence } = {}) {
  if (!validUuid(verifiedActorId)) return deny("viewer_unverified");
  const actor = verifiedActorId.toLowerCase();
  if (!current || !validUuid(current.viewerId) ||
      current.viewerId.toLowerCase() !== actor) return deny("owner_scope_denied");
  if (!Number.isSafeInteger(current.revision) || current.revision < 1 ||
      current.revision >= Number.MAX_SAFE_INTEGER) return deny("revision_invalid");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision) {
    return deny("revision_conflict");
  }
  const existing = normalizeStoredSettings(current.settings);
  if (!existing) return deny("stored_preferences_invalid");
  if (!command || typeof command !== "object" || Array.isArray(command) ||
      typeof command.type !== "string") return deny("command_invalid");
  // Reject arbitrary fields so clients cannot smuggle authority or creator data.
  if (Object.keys(command).some(k => !["type","value"].includes(k))) return deny("command_invalid");
  const next = Object.fromEntries(Object.entries(existing).map(
    ([key, value]) => [key, Array.isArray(value) ? [...value] : value]
  ));
  if (own(COMMANDS, command.type)) {
    const [field, action] = COMMANDS[command.type];
    const value = normalized(field, command.value);
    if (value === null) return deny("value_invalid");
    if (action === "add" && !next[field].includes(value)) {
      if (next[field].length >= MAX_VALUES) return deny("preference_limit_reached");
      next[field].push(value);
    } else if (action === "remove") {
      next[field] = next[field].filter(x => x !== value);
    }
  } else if (command.type === "set_ai_content") {
    if (!AI_MODES.includes(command.value)) return deny("value_invalid");
    next.aiContent = command.value;
  } else if (command.type === "set_discovery_opt_in") {
    if (typeof command.value !== "boolean") return deny("value_invalid");
    if (command.value === true && !validConsent(consentEvidence, actor)) {
      return deny("verified_consent_required");
    }
    next.discoveryOptIn = command.value;
  } else return deny("command_unsupported");

  const normalizedNext = normalizeStoredSettings(next);
  if (!normalizedNext) return deny("candidate_invalid");
  // Canonical sorting avoids false-positive changes caused only by list order
  // and keeps deterministic snapshots for reader race checks.
  const oldSignature = JSON.stringify(existing);
  const nextSignature = JSON.stringify(normalizedNext);
  if (oldSignature === nextSignature) {
    return Object.freeze({ ok: true, code: "no_change", changed: false,
      expectedRevision, nextRevision: expectedRevision,
      sideEffectExecuted: false, settings: existing });
  }
  return Object.freeze({ ok: true, code: "cas_candidate", changed: true,
    expectedRevision, nextRevision: expectedRevision + 1,
    sideEffectExecuted: false, settings: normalizedNext,
    // Consent audit/revocation MUST be recorded transactionally by the writer.
    consentEvent: command.type === "set_discovery_opt_in"
      ? Object.freeze({ optedIn: command.value,
          policyVersion: command.value ? consentEvidence.policyVersion : null })
      : null });
}
module.exports = { MAX_VALUES, KEYS, COMMANDS, AI_MODES,
  emptySettings, normalizeStoredSettings, planSocialPreferenceChange };
