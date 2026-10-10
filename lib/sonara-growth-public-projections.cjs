// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Non-executing, read-only public DISCOVERY projection adapter. No network, SQL,
// payment, send, event emission or route registration. Integrates with the
// separately staged community feed reader *only after* trusted server adapters
// actually verify audience, rights, moderation, disclosures and current state.
//
// DO NOT use public growth_channels or growth_channel_posts alone as a source
// of discovery authority. Their current schema does not carry moderated,
// rights-cleared or AI/sponsor disclosure proof. A source callback must supply
// independently verified, short-lived, content-version-bound attestations.
// The fields of an attestation are NOT proof merely because they say "verified".
//
// Only public title, href, time and disclosure flags leave this boundary.
// Organization IDs, user IDs, raw post bodies, report notes, private creator
// rules, payment/entitlement fields, provider tokens and evidence are omitted.

const { MAX_CANDIDATES, selectCommunityCandidates } =
  require("./sonara-community-discovery.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const TOPIC = /^[a-z0-9][a-z0-9_ -]{0,63}$/;
const COUNTRY = /^[A-Z]{2}$/;
const MAX_PROOF_AGE_MS = 15 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;
const MAX_PROOF_LIFETIME_MS = 60 * 60 * 1000;
const MAX_BODY_CHARS = 2000;
const MAX_COUNTRIES = 50;

function fail(code) {
  return Object.freeze({ ok: false, code, candidates: Object.freeze([]) });
}
function uuid(value) {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}
function instant(value) {
  if (typeof value !== "string" || value.length < 20 || value.length > 35) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value ? ms : null;
}
function score01(value) {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= 0 && value <= 1;
}
function safeTitle(body) {
  if (typeof body !== "string" || !body.trim() || body.length > MAX_BODY_CHARS ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body)) return null;
  const first = body.split(/\r?\n/).map(x => x.trim()).find(Boolean);
  if (!first) return null;
  // The frontend MUST still escape HTML when displaying this plain text.
  const title = first.slice(0, 160).trim();
  return title || null;
}
function audience(proof) {
  if (!["general", "mature"].includes(proof.ageRating)) return null;
  if (proof.territory === "global") return { territory: "global", allowedCountries: [] };
  if (proof.territory !== "restricted" || !Array.isArray(proof.allowedCountries) ||
      proof.allowedCountries.length < 1 || proof.allowedCountries.length > MAX_COUNTRIES ||
      proof.allowedCountries.some(x => typeof x !== "string" || !COUNTRY.test(x)) ||
      new Set(proof.allowedCountries).size !== proof.allowedCountries.length) return null;
  return { territory: "restricted", allowedCountries: [...proof.allowedCountries] };
}
/**
 * Source inputs:
 * - channel/post come from a reviewed joined, bounded source of canonical
 *   public state, not browser-supplied JSON. The org equality check is
 *   defense in depth; it is not an RLS substitute.
 * - proof comes from an independent moderation/rights/disclosure authority
 *   verifying the source post AND channel versions and expiry.
 * - proof checks are contingent on the trusted loader verifying this evidence
 *   before passing it. No mere "verified" boolean authenticates that loader.
 */
function projectGrowthPost(post, channel, proof, now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
  const nowMs = now.getTime();
  const postId = uuid(post?.id), channelId = uuid(channel?.id);
  const orgId = uuid(post?.organization_id);
  if (!postId || !channelId || !orgId || orgId !== uuid(channel?.organization_id) ||
      uuid(post?.channel_id) !== channelId ||
      post?.state !== "published" || channel?.state !== "public" ||
      typeof channel.handle !== "string" || !HANDLE.test(channel.handle)) return null;

  const title = safeTitle(post.body);
  const created = instant(post.created_at);
  const postVersion = instant(post.updated_at);
  const channelVersion = instant(channel.updated_at);
  if (!title || created === null || postVersion === null || channelVersion === null ||
      created > nowMs + MAX_FUTURE_MS || postVersion > nowMs + MAX_FUTURE_MS ||
      channelVersion > nowMs + MAX_FUTURE_MS || postVersion < created) return null;
  if (!proof || typeof proof !== "object" || Array.isArray(proof) ||
      uuid(proof.postId) !== postId || uuid(proof.channelId) !== channelId ||
      uuid(proof.organizationId) !== orgId ||
      proof.postVersion !== post.updated_at ||
      proof.channelVersion !== channel.updated_at ||
      proof.moderationStatus !== "approved" || proof.rightsStatus !== "cleared" ||
      typeof proof.sponsored !== "boolean" ||
      typeof proof.aiGenerated !== "boolean" ||
      typeof proof.originalityVerified !== "boolean" ||
      !score01(proof.quality) || !score01(proof.diversity)) return null;

  const checked = instant(proof.verifiedAt), expiry = instant(proof.expiresAt);
  if (checked === null || expiry === null || checked > nowMs ||
      nowMs - checked > MAX_PROOF_AGE_MS || expiry <= nowMs ||
      expiry - checked > MAX_PROOF_LIFETIME_MS) return null;
  const scope = audience(proof);
  if (!scope || typeof proof.topic !== "string" || !TOPIC.test(proof.topic)) return null;
  const ageRating = proof.ageRating;

  // Strict explicit reconstruction, rather than spreading raw source objects.
  // The listing channel is the "publisher" for feed diversity. Account-level
  // blocks require separate canonical account/channel identity reconciliation.
  return Object.freeze({
    id: postId, publisherId: channelId, product: "growth_studio",
    href: "/channels/" + channel.handle, title, publishedAt: post.created_at,
    publicProjection: true, visibility: "public", status: "published",
    moderationStatus: "approved", rightsStatus: "cleared",
    sponsored: proof.sponsored, aiGenerated: proof.aiGenerated,
    ageRating, territory: scope.territory,
    allowedCountries: Object.freeze(scope.allowedCountries),
    topic: proof.topic, quality: proof.quality,
    originalityVerified: proof.originalityVerified, diversity: proof.diversity
  });
}

/**
 * Completely unmounted integration port. Implementations MUST ensure:
 * - loadGrowthRows: bounded canonical post+channel rows using a reviewed query;
 *   permission, publication state and organization identity verified.
 * - loadAttestations: verified, version-bound, up-to-date moderation, rights,
 *   sponsorship, origin and classifier decisions from a trusted source.
 * - clock: server time; never accept browser time.
 * An error in loading a source fails the entire read. Missing/stale proof
 * excludes *that post*, instead of silently licensing it for discovery.
 */
function createGrowthPublicProjectionSource({ loadGrowthRows, loadAttestations, clock } = {}) {
  if ([loadGrowthRows, loadAttestations, clock].some(x => typeof x !== "function"))
    throw new TypeError("growth source requires independently verified server-only ports");

  return async function loadPublicProjections({ cap, scope } = {}) {
    if (scope !== "moderated_public" || !Number.isInteger(cap) ||
        cap < 1 || cap > MAX_CANDIDATES) return fail("projection_request_invalid");

    let now;
    try { now = clock(); } catch { return fail("projection_clock_unavailable"); }
    if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
      return fail("projection_clock_unavailable");

    let read;
    try { read = await loadGrowthRows({ cap, scope: "public_source_reviewed" }); }
    catch { return fail("growth_source_unavailable"); }
    if (!read || read.ok !== true || !Array.isArray(read.rows) ||
        read.rows.length > cap ||
        read.rows.some(x => !x || typeof x !== "object" || !x.post || !x.channel))
      return fail("growth_source_unavailable");

    const ids = new Set();
    for (const item of read.rows) {
      const id = uuid(item.post.id);
      if (!id || ids.has(id)) return fail("growth_source_ambiguous");
      ids.add(id);
    }
    if (read.rows.length === 0) return Object.freeze({
      ok: true, candidates: Object.freeze([])
    });

    let attested;
    try { attested = await loadAttestations({ postIds: [...ids], scope: "discovery_proof" }); }
    catch { return fail("attestation_source_unavailable"); }
    if (!attested || attested.ok !== true || !Array.isArray(attested.entries) ||
        attested.entries.length > read.rows.length) return fail("attestation_source_unavailable");

    const attestations = new Map();
    for (const proof of attested.entries) {
      const id = uuid(proof?.postId);
      if (!id || !ids.has(id) || attestations.has(id)) return fail("attestation_ambiguous");
      attestations.set(id, proof);
    }
    const candidates = [];
    for (const item of read.rows) {
      const candidate = projectGrowthPost(item.post, item.channel,
        attestations.get(uuid(item.post.id)), now);
      if (candidate) candidates.push(candidate);
    }
    return Object.freeze({ ok: true, candidates: Object.freeze(candidates) });
  };
}

module.exports = {
  MAX_PROOF_AGE_MS, MAX_PROOF_LIFETIME_MS,
  projectGrowthPost, createGrowthPublicProjectionSource
};
