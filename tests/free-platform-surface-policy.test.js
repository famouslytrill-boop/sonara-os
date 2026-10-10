// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CATALOG, surfacePolicy, freeSurfaceSummary } = require("../lib/sonara-free-platform-surface-policy.cjs");
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const U = "33333333-3333-4333-8333-333333333333";
describe("free login-based SONARA platform surface policy", () => {
  it("covers the parent and all 3 studios across social, marketplace and storefront", () => {
    assert.equal(CATALOG.length, 12);
    assert.equal(new Set(CATALOG.map((x) => x.key)).size, 12);
    for (const item of CATALOG) {
      assert.equal(item.access, "free_with_authenticated_writes");
      assert.equal(item.platformSubscriptionRequired, false);
      assert.equal(item.platformListingFeeCents, 0);
      assert.equal(item.platformPostingFeeCents, 0);
      assert.equal(item.launchState, "policy_only", "catalog policy is not proof of shipped product");
    }
  });
  it("allows browsing without login but not posting without identity", () => {
    assert.equal(surfacePolicy({ product: "sonara_industries", service: "social", action: "browse" }).ok, true);
    assert.equal(surfacePolicy({ product: "growth_studio", service: "social", action: "publish" }).code, "login_required");
  });
  it("denies unauthorized or foreign-tenant posts regardless of paid plan", () => {
    const x = { product: "growth_studio", service: "social", action: "create",
      userId: U, organizationId: A, serverOrganizationId: B,
      actorHasPermission: true, paidEntitlement: true };
    assert.equal(surfacePolicy(x).code, "tenant_scope_unverified");
    assert.equal(surfacePolicy({ ...x, serverOrganizationId: A, actorHasPermission: false }).code,
      "surface_permission_required");
  });
  it("requires moderation before publishing or commenting", () => {
    const x = { product: "creator_studio", service: "marketplace", action: "publish",
      userId: U, organizationId: A, serverOrganizationId: A, actorHasPermission: true };
    assert.equal(surfacePolicy(x).code, "moderation_check_required");
    const approved = surfacePolicy({ ...x, moderationApproved: true });
    assert.equal(approved.ok, true);
    assert.equal(approved.subscriptionRequired, false);
    assert.equal(approved.checkoutAuthorized, false);
    assert.equal(approved.sideEffectExecuted, false);
    assert.equal(surfacePolicy({ ...x, action: "comment", moderationApproved: false }).ok, false);
  });
  it("requires an independent server-derived moderator grant", () => {
    const scope = { product: "sonara_industries", service: "social", action: "moderate",
      userId: U, organizationId: A, serverOrganizationId: A, actorHasPermission: true };
    assert.equal(surfacePolicy(scope).code, "moderator_permission_required");
    assert.equal(surfacePolicy({ ...scope, actorCanModerate: "true" }).ok, false);
    const allowed = surfacePolicy({ ...scope, actorCanModerate: true });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.sideEffectExecuted, false);
  });
  it("refuses malformed user UUIDs, tenant UUIDs and scope spoofing on every free write", () => {
    const base = { product: "sonara_industries", service: "social", action: "create",
      userId: U, organizationId: A, serverOrganizationId: A,
      actorHasPermission: true, paidEntitlement: false };
    assert.equal(surfacePolicy(base).ok, true);
    for (const userId of ["x".repeat(36), "1".repeat(36), "11111111--111-4111-8111-111111111111", null]) {
      assert.equal(surfacePolicy({ ...base, userId }).code, "login_required");
    }
    for (const organizationId of ["x".repeat(36), "1".repeat(36), "11111111--111-4111-8111-111111111111", null]) {
      assert.equal(surfacePolicy({ ...base, organizationId, serverOrganizationId: organizationId }).code,
        "tenant_scope_unverified");
    }
    assert.equal(surfacePolicy({ ...base, organizationId: B }).code, "tenant_scope_unverified");
    assert.equal(surfacePolicy({ ...base, actorHasPermission: "true" }).code, "surface_permission_required");
    assert.equal(surfacePolicy({ ...base, action: "publish", moderationApproved: "true" }).code,
      "moderation_check_required");
  });
  it("uses the shared policy in Growth Studio's real authenticated channel screen", () => {
    const code = fs.readFileSync(path.join(__dirname, "..", "routes",
      "sonara-growth-channel-routes.cjs"), "utf8");
    assert.ok(code.includes('require("../lib/sonara-free-platform-surface-policy.cjs")'));
    assert.ok(code.includes('channelSurface.platformSubscriptionRequired === false'));
    assert.ok(code.includes('channelSurface.platformPostingFeeCents === 0'));
    assert.ok(code.includes('const guard = requireWorkspaceAccess("growth_studio")'));
    assert.ok(code.includes("Your channel is free"));
    assert.ok(!code.includes("requirePaidOrOwnerAccess"));
  });
  it("does not make seller charges into SONARA membership charges", () => {
    const summary = freeSurfaceSummary();
    assert.equal(summary.platformSubscriptionRequired, false);
    assert.equal(summary.platformFeesCharged, false);
    assert.match(summary.commerceTerms, /payment processor may charge fees/);
    assert.equal(surfacePolicy({ product: "business_builder", service: "storefront", action: "unknown" }).code,
      "unsupported_surface_action");
  });

  describe("opt-in cross-product public discovery policy (not runtime-wired)", () => {
    const { selectCommunityCandidates } = require("../lib/sonara-community-discovery.cjs");
    const TIME = new Date("2026-10-08T12:00:00.000Z");
    const base = (override = {}) => ({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      publisherId: U, publicProjection: true, visibility: "public",
      status: "published", moderationStatus: "approved", rightsStatus: "cleared",
      product: "creator_studio", topic: "music", title: "Rights-cleared sample",
      href: "/marketplace/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      publishedAt: "2026-10-08T11:00:00.000Z", territory: "global",
      ageRating: "general", aiGenerated: false, sponsored: false,
      originalityVerified: true, quality: 0.8, diversity: 0.5, ...override
    });

    it("refuses unreadable, excessive, and unconsented personalized feeds", () => {
      assert.equal(selectCommunityCandidates(null).code, "candidates_unreadable");
      assert.equal(selectCommunityCandidates(Array(251).fill(base())).code, "candidate_limit_exceeded");
      assert.equal(selectCommunityCandidates([base()], { mode: "discover", now: TIME }).code,
        "discovery_opt_in_required");
      assert.equal(selectCommunityCandidates([base()], { mode: "unknown", now: TIME }).code, "mode_unknown");
      assert.equal(selectCommunityCandidates([base()], { limit: 100, now: TIME }).code, "limit_out_of_range");
    });

    it("fails closed instead of discarding an oversized privacy block or mute list", () => {
      const tooMany = Array.from({ length: 201 }, (_, i) => `publisher_${i}`);
      for (const options of [
        { blockedPublishers: tooMany }, { mutedTopics: tooMany },
        { followedPublishers: tooMany }, { topics: tooMany },
        { blockedPublishers: null }
      ]) {
        const result = selectCommunityCandidates([base()], { now: TIME, ...options });
        assert.equal(result.ok, false);
        assert.equal(result.code, "audience_preferences_invalid");
        assert.deepEqual(result.items, []);
      }
    });
    it("accepts canonical UUIDs but rejects short four-segment identifiers", () => {
      const valid = base();
      const short = "aaaaaaaa-aaaa-4aaa-aaaaaaaaaaaa";
      assert.deepEqual(selectCommunityCandidates([valid], { now: TIME }).items.map(x => x.id), [valid.id]);
      assert.deepEqual(selectCommunityCandidates([base({ id: short })], { now: TIME }).items, []);
      assert.deepEqual(selectCommunityCandidates([base({ publisherId: short })], { now: TIME }).items, []);
    });

    it("never recommends drafts, blocked publishers, unmoderated work, or unlicensed listings", () => {
      const rows = [
        base(), base({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "draft" }),
        base({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", moderationStatus: "pending" }),
        base({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", rightsStatus: "unknown" }),
        base({ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", publicProjection: false }),
        base({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", href: "https://example.test/" }),
        base({ id: "99999999-9999-4999-8999-999999999999", ageRating: "mature" })
      ];
      const result = selectCommunityCandidates(rows, { now: TIME });
      assert.equal(result.ok, true);
      assert.deepEqual(result.items.map(x => x.id), [rows[0].id]);
      assert.equal(Object.hasOwn(result.items[0], "publisherId"), false);
      assert.equal(Object.hasOwn(result.items[0], "organizationId"), false);
      assert.equal(Object.hasOwn(result.items[0], "quality"), false);
      assert.equal(selectCommunityCandidates([base()], { now: TIME,
        blockedPublishers: [U] }).items.length, 0);
    });

    it("requires verified age and permitted country, respects topic and AI controls", () => {
      const scoped = base({ territory: "regional", allowedCountries: ["US"], ageRating: "mature" });
      assert.equal(selectCommunityCandidates([scoped], { now: TIME }).items.length, 0);
      assert.equal(selectCommunityCandidates([scoped], { now: TIME,
        ageVerifiedAdult: true, country: "GB" }).items.length, 0);
      assert.equal(selectCommunityCandidates([scoped], { now: TIME,
        ageVerifiedAdult: true, country: "US" }).items.length, 1);
      assert.equal(selectCommunityCandidates([base()], { now: TIME,
        mutedTopics: ["MUSIC"] }).items.length, 0);
      assert.equal(selectCommunityCandidates([base({ aiGenerated: true })], {
        now: TIME, aiContent: "exclude" }).items.length, 0);
    });

    it("does not lose blocking when a saved block list is oversized or malformed", () => {
      const entry = base();
      for (const options of [
        { blockedPublishers: Array(201).fill(U) },
        { mutedTopics: Array(201).fill("music") },
        { blockedPublishers: "not-an-array" },
        { followedPublishers: [null] },
        { topics: [""] }
      ]) {
        const result = selectCommunityCandidates([entry], { now: TIME, ...options });
        assert.equal(result.ok, false);
        assert.equal(result.code, "audience_preferences_invalid");
        assert.equal(result.items.length, 0);
      }
      const blocked = selectCommunityCandidates([entry], {
        now: TIME, blockedPublishers: [U]
      });
      assert.equal(blocked.ok, true);
      assert.equal(blocked.items.length, 0);
    });

    it("enforces explicit Following and deterministic opt-in discovery with publisher diversity", () => {
      const second = base({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        href: "/channels/creator2", publishedAt: "2026-10-08T10:00:00.000Z" });
      const third = base({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        href: "/store/creator3", publishedAt: "2026-10-08T09:00:00.000Z" });
      const fourth = base({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        publisherId: B, href: "/channels/other", topic: "food",
        publishedAt: "2026-10-08T08:00:00.000Z" });
      const rows = [third, fourth, base(), second];
      assert.equal(selectCommunityCandidates(rows, { mode: "following", now: TIME,
        followedPublishers: [B] }).items.length, 1);
      const run = () => selectCommunityCandidates(rows, {
        mode: "discover", discoveryOptIn: true, topics: ["music"], now: TIME
      });
      assert.deepEqual(run().items, run().items);
      assert.equal(run().items.filter(item => item.id === third.id).length, 0);
      assert.equal(run().items.length, 3);
      assert.equal(run().personalized, true);
      assert.equal(run().items.every(x => typeof x.explanation === "string"), true);
    });

    it("honors hidden content, full-word muted keywords and case-insensitive phrases", () => {
      const post = base({ title: "Live ART Gallery show", topic: "visual" });
      assert.equal(selectCommunityCandidates([post], { now: TIME,
        hiddenContentIds: [post.id.toUpperCase()] }).items.length, 0);
      assert.equal(selectCommunityCandidates([post], { now: TIME,
        mutedKeywords: ["art"] }).items.length, 0);
      assert.equal(selectCommunityCandidates([post], { now: TIME,
        mutedKeywords: ["ART gallery"] }).items.length, 0);
      assert.equal(selectCommunityCandidates([post], { now: TIME,
        mutedKeywords: ["artist"] }).items.length, 1);
      assert.equal(selectCommunityCandidates([base({ title: "Party invitation" })], { now: TIME,
        mutedKeywords: ["art"] }).items.length, 1);
      assert.equal(selectCommunityCandidates([post], { now: TIME,
        mutedKeywords: ["sports"] }).items.length, 1);
    });

    it("fails closed on unreadable or oversized hidden-post and keyword preferences", () => {
      for (const options of [
        { hiddenContentIds: null },
        { hiddenContentIds: ["not-a-uuid"] },
        { hiddenContentIds: Array(201).fill(base().id) },
        { mutedKeywords: null },
        { mutedKeywords: [""] },
        { mutedKeywords: ["###"] },
        { mutedKeywords: ["x".repeat(65)] },
        { mutedKeywords: Array(201).fill("music") }
      ]) {
        const result = selectCommunityCandidates([base()], { now: TIME, ...options });
        assert.equal(result.code, "audience_preferences_invalid");
        assert.equal(result.ok, false);
        assert.deepEqual(result.items, []);
      }
    });

    it("rejects public projections with absent or malformed sponsor and generated-media labels", () => {
      for (const row of [
        base({ sponsored: undefined }), base({ sponsored: "false" }),
        base({ sponsored: null }), base({ aiGenerated: undefined }),
        base({ aiGenerated: "false" }), base({ aiGenerated: null })
      ]) {
        assert.equal(selectCommunityCandidates([row], { now: TIME }).items.length, 0);
      }
      assert.equal(selectCommunityCandidates([base({ sponsored: true, aiGenerated: true })], {
        now: TIME, aiContent: "include"
      }).items[0].sponsored, true);
    });

    it("does not promise another page when every remaining post fails the publisher cap", () => {
      const one = base();
      const two = base({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        publishedAt: "2026-10-08T10:00:00.000Z" });
      const three = base({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        publishedAt: "2026-10-08T09:00:00.000Z" });
      const discover = selectCommunityCandidates([one, two, three], {
        now: TIME, mode: "discover", discoveryOptIn: true, limit: 2
      });
      assert.equal(discover.items.length, 2);
      assert.equal(discover.hasMoreCandidates, false);
      const differentPublisher = base({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        publisherId: B, publishedAt: "2026-10-08T08:00:00.000Z" });
      const latest = selectCommunityCandidates([one, differentPublisher], {
        now: TIME, limit: 1
      });
      assert.equal(latest.items.length, 1);
      assert.equal(latest.hasMoreCandidates, true);
    });
  });
});

describe("SONARA authenticated read-only public feed boundary (not a route)", () => {
  const { createCommunityFeedReader } = require("../lib/sonara-community-feed-reader.cjs");
  const VIEWER = "33333333-3333-4333-8333-333333333333";
  const OTHER = "22222222-2222-4222-8222-222222222222";
  const POST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const NOW = new Date("2026-10-08T12:00:00.000Z");
  const settings = (override = {}) => ({
    topics: [], mutedTopics: [], mutedKeywords: [], hiddenContentIds: [],
    blockedPublishers: [], followedPublishers: [], discoveryOptIn: false,
    ageVerifiedAdult: false, aiContent: "include", country: null, ...override
  });
  const projection = (override = {}) => ({
    id: POST, publisherId: OTHER,
    product: "creator_studio", publicProjection: true,
    visibility: "public", status: "published", moderationStatus: "approved",
    rightsStatus: "cleared", topic: "music", title: "Original music",
    href: "/channels/artist", publishedAt: "2026-10-08T11:00:00.000Z",
    territory: "global", ageRating: "general", aiGenerated: false,
    sponsored: false, ...override
  });

  function setup({ viewers, preferences, projections, brokenPort } = {}) {
    const counts = { auth: 0, preferences: 0, public: 0 };
    const principal = { ok: true, userId: VIEWER,
      accountState: "active", canReadPublicSocial: true };
    const defaults = { ok: true, viewerId: VIEWER, revision: 1, settings: settings() };
    const source = { ok: true, candidates: [projection()] };
    const identityReads = viewers || [principal];
    const preferenceReads = preferences || [defaults];
    const read = createCommunityFeedReader({
      resolveAuthenticatedViewer: async () => {
        if (brokenPort === "auth") throw new Error("private auth credentials");
        return identityReads[Math.min(counts.auth++, identityReads.length - 1)];
      },
      loadViewerPreferences: async () => {
        if (brokenPort === "preferences") throw new Error("private database key");
        return preferenceReads[Math.min(counts.preferences++, preferenceReads.length - 1)];
      },
      loadPublicProjections: async (options) => {
        counts.public++;
        assert.deepEqual(options, { cap: 250, scope: "moderated_public" });
        if (brokenPort === "public") throw new Error("private DB connection");
        return projections || source;
      },
      clock: () => new Date(NOW)
    });
    return { read, counts };
  }

  it("validates request shape before contacting any provider", async () => {
    const { read, counts } = setup();
    for (const input of [null, false, "latest", [], { mode: "unknown" },
      { limit: 0 }, { limit: "20" }, { limit: 41 }]) {
      assert.equal((await read(input)).code, "feed_request_invalid");
    }
    assert.deepEqual(counts, { auth: 0, preferences: 0, public: 0 });
  });

  it("reads viewer identity and preferences twice before releasing public items", async () => {
    const { read, counts } = setup();
    const result = await read({ request: {}, mode: "latest", limit: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.items.length, 1);
    assert.deepEqual(counts, { auth: 2, preferences: 2, public: 1 });
    assert.equal(Object.hasOwn(result, "userId"), false);
    assert.equal(Object.hasOwn(result.items[0], "organizationId"), false);
    assert.equal(Object.hasOwn(result.items[0], "publisherId"), false);
  });

  it("does not read settings or projections for anonymous and suspended identities", async () => {
    for (const identity of [null, { ok: false }, {
      ok: true, userId: VIEWER, accountState: "suspended", canReadPublicSocial: true
    }, { ok: true, userId: VIEWER, accountState: "active", canReadPublicSocial: "true" }]) {
      const { read, counts } = setup({ viewers: [identity] });
      assert.equal((await read({})).code, "viewer_access_denied");
      assert.equal(counts.preferences, 0);
      assert.equal(counts.public, 0);
    }
  });

  it("requires owner-matching, versioned, fully legible preferences", async () => {
    const invalid = [
      { ok: true, viewerId: OTHER, revision: 1, settings: settings() },
      { ok: true, viewerId: VIEWER, revision: 0, settings: settings() },
      { ok: true, viewerId: VIEWER, revision: 1,
        settings: settings({ blockedPublishers: undefined }) },
      { ok: true, viewerId: VIEWER, revision: 1,
        settings: settings({ hiddenContentIds: ["bad-id"] }) },
      { ok: true, viewerId: VIEWER, revision: 1,
        settings: settings({ mutedKeywords: ["###"] }) }
    ];
    for (const item of invalid) {
      const { read, counts } = setup({ preferences: [item] });
      assert.equal((await read({})).code, "preferences_unavailable");
      assert.equal(counts.public, 0);
    }
  });

  it("does not fetch public candidates without explicit Discover consent", async () => {
    const { read, counts } = setup();
    assert.equal((await read({ mode: "discover" })).code, "discovery_opt_in_required");
    assert.equal(counts.public, 0);
  });

  it("supports explicit, current discover consent without expanding privacy fields", async () => {
    const authorized = { ok: true, viewerId: VIEWER, revision: 3,
      settings: settings({ discoveryOptIn: true, topics: ["music"] }) };
    const { read } = setup({ preferences: [authorized] });
    const result = await read({ mode: "discover" });
    assert.equal(result.ok, true);
    assert.equal(result.personalized, true);
    assert.equal(result.items[0].explanation, "Selected topic");
  });

  it("prevents a browser-supplied viewer identity or block-list from taking authority", async () => {
    const authorized = { ok: true, viewerId: VIEWER, revision: 2,
      settings: settings({ blockedPublishers: [OTHER] }) };
    const { read } = setup({ preferences: [authorized] });
    const result = await read({ userId: OTHER, organizationId: OTHER,
      preferences: settings({ blockedPublishers: [] }) });
    assert.equal(result.ok, true);
    assert.equal(result.items.length, 0);
  });

  it("denies mid-read account revocation or switching identity", async () => {
    const active = { ok: true, userId: VIEWER,
      accountState: "active", canReadPublicSocial: true };
    for (const changed of [null, { ...active, accountState: "suspended" },
      { ...active, userId: OTHER }]) {
      const { read } = setup({ viewers: [active, changed] });
      const result = await read({});
      assert.equal(result.code, "viewer_access_changed");
      assert.deepEqual(result.items, []);
    }
  });

  it("denies preference changes even if the provider forgets to increment revision", async () => {
    const first = { ok: true, viewerId: VIEWER, revision: 1, settings: settings() };
    for (const second of [
      { ...first, revision: 2 },
      { ...first, settings: settings({ mutedKeywords: ["music"] }) },
      { ...first, settings: settings({ blockedPublishers: [OTHER] }) }
    ]) {
      const { read } = setup({ preferences: [first, second] });
      const result = await read({});
      assert.equal(result.code, "viewer_preferences_changed");
      assert.equal(result.items.length, 0);
    }
  });

  it("does not confuse an unavailable database with an empty social feed", async () => {
    for (const source of [{ ok: false, candidates: [] },
      { ok: true, candidates: null }, { ok: true, candidates: Array(251).fill(projection()) }]) {
      const { read } = setup({ projections: source });
      assert.equal((await read({})).code, "public_feed_unavailable");
    }
  });

  it("applies secondary public, rights, moderation, blocked, and hidden filters", async () => {
    const restricted = { ok: true, viewerId: VIEWER, revision: 1,
      settings: settings({ hiddenContentIds: [POST] }) };
    const { read } = setup({ preferences: [restricted] });
    assert.equal((await read({})).items.length, 0);
    for (const restriction of [
      { visibility: "private" }, { moderationStatus: "pending" },
      { rightsStatus: "uncleared" }, { sponsored: undefined },
      { aiGenerated: undefined }
    ]) {
      const { read: each } = setup({ projections: {
        ok: true, candidates: [projection(restriction)]
      } });
      assert.equal((await each({})).items.length, 0);
    }
  });

  it("redacts provider exceptions instead of exposing secrets to the client", async () => {
    for (const brokenPort of ["auth", "preferences", "public"]) {
      const { read } = setup({ brokenPort });
      const result = await read({});
      assert.equal(result.ok, false);
      assert.equal(JSON.stringify(result).includes("private"), false);
      assert.deepEqual(result.items, []);
    }
  });

  it("rejects missing trusted adapters; no implicit production activation", () => {
    let refused = false;
    try { createCommunityFeedReader({}); } catch (error) {
      refused = error instanceof TypeError;
    }
    assert.equal(refused, true);
  });
});


describe("personal social preferences: bounded CAS proposal, not persisted", () => {
  const { emptySettings, normalizeStoredSettings, planSocialPreferenceChange } =
    require("../lib/sonara-social-preference-policy.cjs");
  const VIEWER = "33333333-3333-4333-8333-333333333333";
  const OTHER = "22222222-2222-4222-8222-222222222222";
  const POST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const current = (overrides = {}) => ({ viewerId: VIEWER, revision: 5,
    settings: emptySettings(), ...overrides });
  const request = (command, overrides = {}) => ({
    verifiedActorId: VIEWER, current: current(), expectedRevision: 5, command, ...overrides
  });
  const cmd = (type, value) => ({ type, value });

  it("requires server-derived viewer identity, ownership and exact revision", () => {
    assert.equal(planSocialPreferenceChange(request(cmd("hide_post", POST),
      { verifiedActorId: "request.userId" })).code, "viewer_unverified");
    assert.equal(planSocialPreferenceChange(request(cmd("hide_post", POST),
      { current: current({ viewerId: OTHER }) })).code, "owner_scope_denied");
    assert.equal(planSocialPreferenceChange(request(cmd("hide_post", POST),
      { expectedRevision: 4 })).code, "revision_conflict");
    assert.equal(planSocialPreferenceChange(request(cmd("hide_post", POST),
      { current: current({ revision: 6 }) })).code, "revision_conflict");
  });

  it("proposes hiding posts without executing database writes", () => {
    const result = planSocialPreferenceChange(request(cmd("hide_post", POST.toUpperCase())));
    assert.equal(result.ok, true);
    assert.equal(result.code, "cas_candidate");
    assert.equal(result.sideEffectExecuted, false);
    assert.equal(result.expectedRevision, 5);
    assert.equal(result.nextRevision, 6);
    assert.deepEqual(result.settings.hiddenContentIds, [POST]);
  });

  it("does not allow privacy changes to be swallowed by stale updates", () => {
    const blocked = current({ revision: 6, settings: {
      ...emptySettings(), hiddenContentIds: [POST]
    } });
    const oldUnhide = planSocialPreferenceChange(request(cmd("unhide_post", POST),
      { current: blocked, expectedRevision: 5 }));
    assert.equal(oldUnhide.code, "revision_conflict");
    assert.equal(oldUnhide.ok, false);
  });

  it("uses normalized whole-word phrases with no duplicate state", () => {
    const first = planSocialPreferenceChange(request(cmd("mute_keyword", "  Jazz & SOUL!")));
    assert.deepEqual(first.settings.mutedKeywords, ["jazz soul"]);
    const same = planSocialPreferenceChange(request(cmd("mute_keyword", "JAZZ SOUL"),
      { current: current({ settings: { ...emptySettings(),
        mutedKeywords: ["jazz soul"] } }) }));
    assert.equal(same.code, "no_change");
    assert.equal(same.nextRevision, 5);
    assert.equal(same.changed, false);
    const sorted = normalizeStoredSettings({ ...emptySettings(),
      mutedKeywords: ["zebra", "alpha"] });
    assert.deepEqual(sorted.mutedKeywords, ["alpha", "zebra"]);
  });

  it("rejects corrupt or secret-smuggling stored values instead of dropping them", () => {
    for (const settings of [
      { ...emptySettings(), hiddenContentIds: undefined },
      { ...emptySettings(), blockedPublishers: [OTHER] },
      { ...emptySettings(), mutedKeywords: ["bad\u0000word"] },
      { ...emptySettings(), mutedKeywords: ["zebra", "zebra"] },
      { ...emptySettings(), discoveryOptIn: "true" },
      { ...emptySettings(), aiContent: "train_on_me" }
    ]) {
      const result = planSocialPreferenceChange(request(cmd("hide_post", POST),
        { current: current({ settings }) }));
      assert.equal(result.code, "stored_preferences_invalid");
    }
  });

  it("restricts preference changes to an explicit, personal allowlist", () => {
    for (const command of [
      cmd("block_user", OTHER), cmd("publish", POST),
      { type: "hide_post", value: POST, viewerId: OTHER },
      cmd("hide_post", "not-a-uuid"), cmd("mute_keyword", "???"),
      cmd("set_ai_content", "unrestricted"), cmd("set_discovery_opt_in", 1)
    ]) {
      assert.equal(planSocialPreferenceChange(request(command)).ok, false);
    }
  });

  it("requires a separate version-bound receipt to opt in", () => {
    const without = planSocialPreferenceChange(request(cmd("set_discovery_opt_in", true)));
    assert.equal(without.code, "verified_consent_required");
    const foreign = planSocialPreferenceChange(request(cmd("set_discovery_opt_in", true),
      { consentEvidence: { verified: true, viewerId: OTHER,
        policyVersion: "ugc-2026.10", acceptedAt: "2026-10-09T10:00:00Z" } }));
    assert.equal(foreign.code, "verified_consent_required");
    const valid = planSocialPreferenceChange(request(cmd("set_discovery_opt_in", true),
      { consentEvidence: { verified: true, viewerId: VIEWER,
        policyVersion: "ugc-2026.10", acceptedAt: "2026-10-09T10:00:00Z" } }));
    assert.equal(valid.code, "cas_candidate");
    assert.equal(valid.settings.discoveryOptIn, true);
    assert.equal(valid.consentEvent.policyVersion, "ugc-2026.10");
    assert.equal(valid.sideEffectExecuted, false);
  });

  it("permits opt-out without a receipt and explicitly plans revocation", () => {
    const result = planSocialPreferenceChange(request(cmd("set_discovery_opt_in", false),
      { current: current({ settings: { ...emptySettings(), discoveryOptIn: true } }) }));
    assert.equal(result.code, "cas_candidate");
    assert.equal(result.settings.discoveryOptIn, false);
    assert.equal(result.consentEvent.optedIn, false);
    assert.equal(result.consentEvent.policyVersion, null);
  });

  it("enforces 200 values and rejects revision overflows or foreign objects", () => {
    const full = Array.from({ length: 200 }, (_, i) =>
      "aaaaaaaa-aaaa-4aaa-8aaa-" + i.toString(16).padStart(12, "0"));
    const limit = planSocialPreferenceChange(request(cmd("hide_post", POST),
      { current: current({ settings: { ...emptySettings(), hiddenContentIds: full } }) }));
    assert.equal(limit.code, "preference_limit_reached");
    const overflow = planSocialPreferenceChange(request(cmd("hide_post", POST),
      { current: current({ revision: Number.MAX_SAFE_INTEGER }), expectedRevision: Number.MAX_SAFE_INTEGER }));
    assert.equal(overflow.code, "revision_invalid");
    assert.equal(planSocialPreferenceChange(request(null)).ok, false);
  });

  it("does not confuse personal mutes with reciprocal account blocking", () => {
    const personal = planSocialPreferenceChange(request(cmd("mute_topic", "local-music")));
    assert.deepEqual(personal.settings.mutedTopics, ["local-music"]);
    assert.equal(Object.hasOwn(personal.settings, "blockedPublishers"), false);
    assert.equal(Object.hasOwn(personal.settings, "followedPublishers"), false);
    assert.equal(Object.hasOwn(personal.settings, "ageVerifiedAdult"), false);
  });
});
