// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Research implementation: deterministic, explainable cross-product PUBLIC
// discovery candidate policy. This module is NOT registered as an endpoint.
// The calling server MUST separately verify membership/consent and construct
// candidate rows through a public, moderated, rights-cleared projection.
// These booleans are defense-in-depth checks, not authority from a browser.
//
// Default is chronological, not behavioral personalization. Discovery needs
// an explicit opt-in. This module sends no events, earns no fees, stores no
// location, and never exposes private organization/member/payment records.

const PRODUCTS = Object.freeze(["sonara_industries", "business_builder", "creator_studio", "growth_studio"]);
const MODES = Object.freeze(["latest", "following", "discover"]);
const MAX_CANDIDATES = 250;
const MAX_RESULTS = 40;
// Stable across Node/ICU versions, unlike localeCompare for equal-score ties.
const compareCanonical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HREF = /^\/(?:channels|marketplace|store)\/[a-z0-9][a-z0-9_-]{0,79}$/i;
const CONTROLS = /[\u0000-\u001f\u007f]/g;

const OPTIONS = Object.freeze({
  maxPerPublisher: 2,
  discoveryWeights: Object.freeze({ topic: 0.30, quality: 0.20, recency: 0.20, originality: 0.15, diversity: 0.15 })
});

function words(value, max = 160) {
  return typeof value === "string" ? value.replace(CONTROLS, " ").trim().slice(0, max) : "";
}
function norm(value) { return words(value, 64).toLowerCase(); }
// Normalize whole-word and phrase muting without substring false positives:
// "art" must not hide "party". Unicode letters/digits are retained.
function normalizePhrase(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    : "";
}
function finite01(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : 0;
}
function stringSet(values, normalize = String) {
  if (!Array.isArray(values) || values.length > 200) return new Set();
  return new Set(values.filter(v => typeof v === "string").map(normalize).filter(Boolean));
}
function iso(value) {
  if (typeof value !== "string" || value.length < 20 || value.length > 35) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function selectCommunityCandidates(candidates, {
  mode = "latest", discoveryOptIn = false, topics = [],
  mutedTopics = [], mutedKeywords = [], hiddenContentIds = [], blockedPublishers = [], followedPublishers = [],
  aiContent = "include", ageVerifiedAdult = false, country = null,
  limit = 20, now = new Date()
} = {}) {
  if (!Array.isArray(candidates)) return Object.freeze({ ok: false, code: "candidates_unreadable", items: [] });
  if (candidates.length > MAX_CANDIDATES) return Object.freeze({ ok: false, code: "candidate_limit_exceeded", items: [] });
  if (!MODES.includes(mode)) return Object.freeze({ ok: false, code: "mode_unknown", items: [] });
  if (mode === "discover" && discoveryOptIn !== true) {
    return Object.freeze({ ok: false, code: "discovery_opt_in_required", items: [] });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS) {
    return Object.freeze({ ok: false, code: "limit_out_of_range", items: [] });
  }
  if (!["include", "reduce", "exclude"].includes(aiContent)) {
    return Object.freeze({ ok: false, code: "ai_preference_unknown", items: [] });
  }
  // Bad/oversized input must not silently discard blocks or muted topics.
  // A missing block list means no blocks; an unreadable saved list must
  // return an error instead of displaying formerly blocked publishers.
  if ([topics, mutedTopics, mutedKeywords, hiddenContentIds, blockedPublishers, followedPublishers].some(values =>
    !Array.isArray(values) || values.length > 200 ||
    values.some(value => typeof value !== "string" || !value.trim() || value.length > 256)) ||
    mutedKeywords.some(value => value.length > 64 || !normalizePhrase(value)) ||
    hiddenContentIds.some(value => !UUID.test(value))) {
    return Object.freeze({ ok: false, code: "audience_preferences_invalid", items: [] });
  }
  const nowMs = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) return Object.freeze({ ok: false, code: "clock_invalid", items: [] });
  const interests = stringSet(topics, norm);
  const muted = stringSet(mutedTopics, norm);
  const mutedPhrases = [...new Set(mutedKeywords.map(normalizePhrase))];
  const hidden = stringSet(hiddenContentIds, x => x.toLowerCase());
  const blocked = stringSet(blockedPublishers, x => x.toLowerCase());
  const followed = stringSet(followedPublishers, x => x.toLowerCase());
  const viewerCountry = typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : null;
  const results = [];
  const seen = new Set();

  for (const c of candidates) {
    if (!c || typeof c !== "object" || !UUID.test(c.id) || seen.has(c.id)) continue;
    // Fail closed on missing public, moderation and rights evidence.
    if (c.publicProjection !== true || c.visibility !== "public" || c.status !== "published"
      || c.moderationStatus !== "approved" || c.rightsStatus !== "cleared") continue;
    if (!PRODUCTS.includes(c.product) || !UUID.test(c.publisherId)) continue;
    if (blocked.has(c.publisherId.toLowerCase()) || hidden.has(c.id.toLowerCase())) continue;
    // Disclosure cannot silently default to false if projection metadata is
    // absent or malformed. Publishing authority remains server-side.
    if (typeof c.sponsored !== "boolean" || typeof c.aiGenerated !== "boolean") continue;
    if (c.ageRating !== "general" && !(c.ageRating === "mature" && ageVerifiedAdult === true)) continue;
    if (c.territory !== "global") {
      if (!viewerCountry || !Array.isArray(c.allowedCountries) || !c.allowedCountries.includes(viewerCountry)) continue;
    }
    if (c.aiGenerated === true && aiContent === "exclude") continue;
    if (mode === "following" && !followed.has(c.publisherId.toLowerCase())) continue;
    const href = words(c.href, 120);
    const title = words(c.title, 160);
    const publishedAt = iso(c.publishedAt);
    if (!HREF.test(href) || !title || !publishedAt) continue;
    const stamp = Date.parse(publishedAt);
    if (stamp > nowMs + 5 * 60 * 1000) continue;
    const topic = norm(c.topic);
    if (topic && muted.has(topic)) continue;
    const searchableTitle = ` ${normalizePhrase(title)} `;
    if (mutedPhrases.some(keyword => searchableTitle.includes(` ${keyword} `))) continue;
    seen.add(c.id);

    const hoursOld = Math.max(0, (nowMs - stamp) / 3600000);
    const recency = Math.exp(-hoursOld / 168);
    const topicMatch = topic && interests.has(topic) ? 1 : 0;
    // This score is SONARA's own unvalidated design hypothesis; it must not
    // be described as TikTok's/Meta's algorithm or promoted without tests.
    const score = mode === "discover"
      ? OPTIONS.discoveryWeights.topic * topicMatch
        + OPTIONS.discoveryWeights.quality * finite01(c.quality)
        + OPTIONS.discoveryWeights.recency * recency
        + OPTIONS.discoveryWeights.originality * (c.originalityVerified === true ? 1 : 0)
        + OPTIONS.discoveryWeights.diversity * finite01(c.diversity)
        - (c.aiGenerated === true && aiContent === "reduce" ? 0.2 : 0)
      : 0;
    results.push({
      publisherId: c.publisherId.toLowerCase(),
      timestamp: stamp, score,
      item: Object.freeze({
        id: c.id, title, href, product: c.product, publishedAt,
        sponsored: c.sponsored === true, aiGenerated: c.aiGenerated === true,
        explanation: mode === "discover"
          ? topicMatch ? "Selected topic" : "Public discovery"
          : mode === "following" ? "Following" : "Most recent"
      })
    });
  }

  // Stable ordering; no randomness, private engagement telemetry or covert ads.
  results.sort((a, b) => mode === "discover"
    ? b.score - a.score || b.timestamp - a.timestamp || compareCanonical(a.item.id, b.item.id)
    : b.timestamp - a.timestamp || compareCanonical(a.item.id, b.item.id));

  const used = new Map();
  const items = [];
  let hasMoreCandidates = false;
  for (const record of results) {
    // Diversity cap applies only to discovery, not chronological/following.
    const count = used.get(record.publisherId) || 0;
    if (mode === "discover" && count >= OPTIONS.maxPerPublisher) continue;
    // Inspect at least one *eligible* item after the display limit. The raw
    // candidate count cannot establish another page when the rest are capped.
    if (items.length >= limit) {
      hasMoreCandidates = true;
      break;
    }
    used.set(record.publisherId, count + 1);
    items.push(record.item);
  }
  return Object.freeze({
    ok: true, code: "public_candidates_filtered", mode,
    personalized: mode === "discover", items: Object.freeze(items),
    hasMoreCandidates
  });
}

module.exports = { PRODUCTS, MODES, MAX_CANDIDATES, MAX_RESULTS, OPTIONS, selectCommunityCandidates };
