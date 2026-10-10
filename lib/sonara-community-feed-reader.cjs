// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// OFFLINE adapter boundary only. NOT registered with Express or wired to a
// database. Real server adapters must independently authenticate the session,
// verify live account permissions, read owner-scoped preferences, and query only
// sanitized moderated public projections. Callback booleans are not proof of
// a production security boundary. Never pass browser-provided viewer IDs,
// preferences, organization IDs, or arbitrary post query filters to these ports.

const {
  MODES, MAX_CANDIDATES, MAX_RESULTS, selectCommunityCandidates
} = require("./sonara-community-discovery.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LISTS = Object.freeze([
  "topics", "mutedTopics", "mutedKeywords", "hiddenContentIds",
  "blockedPublishers", "followedPublishers"
]);
const EMPTY = Object.freeze([]);
const fail = code => Object.freeze({ ok: false, code, items: EMPTY });
const isUuid = value => typeof value === "string" && UUID.test(value);

function validViewer(record) {
  return record && record.ok === true && isUuid(record.userId) &&
    record.accountState === "active" && record.canReadPublicSocial === true;
}

function preferenceSnapshot(record, userId) {
  if (!record || record.ok !== true || !isUuid(record.viewerId) ||
      record.viewerId.toLowerCase() !== userId.toLowerCase() ||
      !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      !record.settings || typeof record.settings !== "object" ||
      Array.isArray(record.settings)) return null;

  const s = record.settings;
  const options = {};
  for (const name of LISTS) {
    const values = s[name];
    if (!Array.isArray(values) || values.length > 200 ||
        values.some(x => typeof x !== "string" || !x.trim() || x.length > 256)) {
      return null;
    }
    options[name] = values.slice();
  }
  if (s.mutedKeywords.some(x => x.length > 64 || !/[\p{L}\p{N}]/u.test(x)) ||
      s.hiddenContentIds.some(x => !isUuid(x)) ||
      typeof s.discoveryOptIn !== "boolean" ||
      typeof s.ageVerifiedAdult !== "boolean" ||
      !["include", "reduce", "exclude"].includes(s.aiContent) ||
      !(s.country === null || (typeof s.country === "string" && /^[A-Z]{2}$/.test(s.country)))) {
    return null;
  }

  options.discoveryOptIn = s.discoveryOptIn;
  options.ageVerifiedAdult = s.ageVerifiedAdult;
  options.aiContent = s.aiContent;
  options.country = s.country;
  // Snapshot only whitelisted viewer policy fields. Do not echo a source row,
  // account UUID, permissions, private content or preference metadata.
  const signature = JSON.stringify({ revision: record.revision, options });
  return { signature, options };
}

/**
 * Create a READ-ONLY policy orchestrator. This is not a customer endpoint.
 * All ports must be implemented by separately security-reviewed server code.
 *
 * resolveAuthenticatedViewer({ request, fresh: true }) -> {
 *   ok, userId, accountState: "active", canReadPublicSocial: true
 * }
 * loadViewerPreferences({ viewerId, fresh: true }) -> {
 *   ok, viewerId, revision: positive integer, settings: complete policy object
 * }
 * loadPublicProjections({ cap, scope: "moderated_public" }) -> {
 *   ok, candidates: array of already sanitized public projection objects
 * }
 * clock() -> Date
 *
 * The second identity + preference read detects revoked sessions, blocks,
 * unconsented discovery, or a changed viewer policy during source retrieval.
 * Missing reads MUST fail closed; there is no fallback empty-block list.
 */
function createCommunityFeedReader(ports = {}) {
  const { resolveAuthenticatedViewer, loadViewerPreferences, loadPublicProjections, clock } = ports;
  if ([resolveAuthenticatedViewer, loadViewerPreferences, loadPublicProjections, clock]
    .some(x => typeof x !== "function")) {
    throw new TypeError("community reader requires trusted server-side ports");
  }

  return async function readCommunityFeed({ request, mode = "latest", limit = 20 } = {}) {
    if (!MODES.includes(mode) || !Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS) {
      return fail("feed_request_invalid");
    }

    let before;
    try { before = await resolveAuthenticatedViewer({ request, fresh: true }); }
    catch { return fail("viewer_unavailable"); }
    if (!validViewer(before)) return fail("viewer_access_denied");
    const viewerId = before.userId.toLowerCase();

    let preference;
    try { preference = preferenceSnapshot(await loadViewerPreferences({ viewerId, fresh: true }), viewerId); }
    catch { return fail("preferences_unavailable"); }
    if (!preference) return fail("preferences_unavailable");
    if (mode === "discover" && preference.options.discoveryOptIn !== true) {
      return fail("discovery_opt_in_required");
    }

    let now;
    try { now = clock(); }
    catch { return fail("clock_unavailable"); }
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return fail("clock_unavailable");

    let projections;
    try {
      projections = await loadPublicProjections({ cap: MAX_CANDIDATES, scope: "moderated_public" });
    } catch { return fail("public_feed_unavailable"); }
    if (!projections || projections.ok !== true || !Array.isArray(projections.candidates) ||
        projections.candidates.length > MAX_CANDIDATES) return fail("public_feed_unavailable");

    let after;
    try { after = await resolveAuthenticatedViewer({ request, fresh: true }); }
    catch { return fail("viewer_unavailable"); }
    if (!validViewer(after) || after.userId.toLowerCase() !== viewerId) {
      return fail("viewer_access_changed");
    }

    let refreshed;
    try { refreshed = preferenceSnapshot(await loadViewerPreferences({ viewerId, fresh: true }), viewerId); }
    catch { return fail("preferences_unavailable"); }
    if (!refreshed || refreshed.signature !== preference.signature) {
      return fail("viewer_preferences_changed");
    }

    const filtered = selectCommunityCandidates(projections.candidates, {
      ...preference.options, mode, limit, now
    });
    if (!filtered.ok) return fail("feed_policy_denied");
    return Object.freeze({
      ok: true, code: "public_feed_preview", mode,
      items: filtered.items, hasMoreCandidates: filtered.hasMoreCandidates,
      personalized: filtered.personalized
    });
  };
}

module.exports = { createCommunityFeedReader };