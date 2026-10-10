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


describe("unapplied private SQL proposal contract (static checks only)", () => {
  const sql = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "docs", "sql-proposals",
      "social-feed-viewer-preferences-cas.sql"), "utf8"
  );

  it("is explicitly marked unexecuted, private, and outside the exposed API", () => {
    assert.match(sql, /NOT a numbered migration/);
    assert.match(sql, /create schema if not exists sonara_social_private/);
    assert.match(sql, /revoke all on schema sonara_social_private from public, anon, authenticated/);
    assert.equal(/\bgrant\s+(?:all|select|insert|update|delete|execute)\b[\s\S]{0,150}?\bto\s+(?:anon|authenticated)\b/i.test(
      sql.replace(/--[^\n]*/g, "")), false);
  });

  it("enforces owner-keyed CAS and never uses a privileged definer function", () => {
    assert.match(sql, /viewer_id uuid primary key references auth\.users\(id\)/);
    assert.match(sql, /for update;/);
    assert.match(sql, /p\.viewer_id = p_viewer_id and p\.revision = v_revision/);
    assert.match(sql, /security invoker/);
    assert.equal(/\bsecurity definer\b/i.test(sql.replace(/--[^\n]*/g, "")), false);
  });

  it("requires owner consent evidence and makes the audit insert transactional", () => {
    assert.match(sql, /viewer_feed_consent_required/);
    assert.match(sql, /consent_required/);
    assert.match(sql, /insert into sonara_social_private\.viewer_feed_consent_events/);
    assert.match(sql, /unique \(viewer_id, revision\)/);
    assert.match(sql, /revoke all on function sonara_social_private\.cas_viewer_feed_preferences/);
  });
});


describe("attested Growth public discovery projection (unmounted, no real source)", () => {
  const { projectGrowthPost, growthContentDigest, createGrowthPublicProjectionSource } =
    require("../lib/sonara-growth-public-projections.cjs");
  const { createCommunityFeedReader } = require("../lib/sonara-community-feed-reader.cjs");
  const VIEWER = "33333333-3333-4333-8333-333333333333";
  const POST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const CHANNEL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const ORG = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const NOW = new Date("2026-10-09T12:03:00.000Z");
  const PG_STAMP = "2026-10-09T12:00:00.123456+00:00";
  const post = (override = {}) => ({
    id: POST, channel_id: CHANNEL, organization_id: ORG,
    state: "published", kind: "post", body: "First line\nSecond line",
    created_at: PG_STAMP, updated_at: PG_STAMP,
    private_token: "never publish this",
    author_user_id: VIEWER, ...override
  });
  const channel = (override = {}) => ({
    id: CHANNEL, organization_id: ORG, state: "public", handle: "studio",
    title: "Private business identity", updated_at: PG_STAMP,
    private_customer_list: ["sensitive"], ...override
  });
  const proof = (override = {}) => ({
    postId: POST, channelId: CHANNEL, organizationId: ORG,
    postVersion: PG_STAMP, channelVersion: PG_STAMP,
    contentDigest: growthContentDigest(post(), channel()),
    moderationStatus: "approved", rightsStatus: "cleared",
    sponsored: false, aiGenerated: false, originalityVerified: true,
    quality: 0.25, diversity: 0.5,
    verifiedAt: "2026-10-09T12:02:00.000Z",
    expiresAt: "2026-10-09T12:10:00.000Z",
    topic: "music", ageRating: "general", territory: "global",
    private_report_notes: ["sensitive"], ...override
  });
  function source({ rows, entries, throwRows, throwProof } = {}) {
    const calls = { growth: 0, attestations: 0 };
    const read = createGrowthPublicProjectionSource({
      clock: () => new Date(NOW),
      loadGrowthRows: async (query) => {
        calls.growth++;
        assert.equal(query.scope, "public_source_reviewed");
        assert.equal(query.cap <= 250, true);
        if (throwRows) throw new Error("private database key");
        return { ok: true, rows: rows || [{ post: post(), channel: channel() }] };
      },
      loadAttestations: async (query) => {
        calls.attestations++;
        assert.equal(query.scope, "discovery_proof");
        if (throwProof) throw new Error("private reviewer details");
        return { ok: true, entries: entries || [proof()] };
      }
    });
    return { read, calls };
  }

  it("accepts canonical PostgreSQL microsecond timestamps and approved public content", () => {
    const item = projectGrowthPost(post(), channel(), proof(), NOW);
    assert.equal(item.title, "First line");
    assert.equal(item.href, "/channels/studio");
    assert.equal(item.product, "growth_studio");
    assert.equal(item.publicProjection, true);
    assert.equal(item.moderationStatus, "approved");
    assert.equal(item.rightsStatus, "cleared");
  });

  it("exposes an explicit public projection allowlist, never user, org or evidence fields", () => {
    const item = projectGrowthPost(post(), channel(), proof(), NOW);
    assert.deepEqual(Object.keys(item).sort(), [
      "id", "publisherId", "product", "href", "title", "publishedAt",
      "publicProjection", "visibility", "status", "moderationStatus",
      "rightsStatus", "sponsored", "aiGenerated", "ageRating", "territory",
      "allowedCountries", "topic", "quality", "originalityVerified", "diversity"
    ].sort());
    assert.equal(JSON.stringify(item).includes("sensitive"), false);
    assert.equal(JSON.stringify(item).includes("never publish"), false);
    assert.equal(JSON.stringify(item).includes(ORG), false);
    assert.equal(JSON.stringify(item).includes(VIEWER), false);
  });

  it("rejects private or removed Growth content even with favorable proof", () => {
    assert.equal(projectGrowthPost(post({ state: "removed" }), channel(), proof(), NOW), null);
    assert.equal(projectGrowthPost(post(), channel({ state: "draft" }), proof(), NOW), null);
    assert.equal(projectGrowthPost(post(), channel({ state: "hidden" }), proof(), NOW), null);
    assert.equal(projectGrowthPost(post({ channel_id: ORG }), channel(), proof(), NOW), null);
    assert.equal(projectGrowthPost(post({ organization_id: VIEWER }), channel(), proof(), NOW), null);
    assert.equal(projectGrowthPost(post(), channel({ handle: "../admin" }), proof(), NOW), null);
  });

  it("rejects missing, pending, denied, or mismatched evidence, never self-attests", () => {
    for (const evidence of [null,
      proof({ postId: VIEWER }), proof({ channelId: VIEWER }),
      proof({ organizationId: VIEWER }), proof({ moderationStatus: "pending" }),
      proof({ rightsStatus: "uncleared" }), proof({ postVersion: "2026-10-09T11:50:00Z" }),
      proof({ channelVersion: "2026-10-09T11:50:00Z" })]) {
      assert.equal(projectGrowthPost(post(), channel(), evidence, NOW), null);
    }
  });

  it("rejects unverified AI/sponsorship metadata, forged scores and age scopes", () => {
    for (const evidence of [
      proof({ sponsored: undefined }), proof({ aiGenerated: undefined }),
      proof({ sponsored: "false" }), proof({ originalityVerified: null }),
      proof({ quality: Number.NaN }), proof({ diversity: 1.2 }),
      proof({ ageRating: "unknown" }), proof({ territory: "other" }),
      proof({ territory: "restricted", allowedCountries: ["X"] }),
      proof({ territory: "restricted", allowedCountries: ["US", "US"] })
    ]) {
      assert.equal(projectGrowthPost(post(), channel(), evidence, NOW), null);
    }
  });

  it("rejects silent post edits despite unchanged updated_at timestamps", () => {
    const approved = proof();
    const modified = post({ body: "Materially altered after moderation approval" });
    assert.equal(modified.updated_at, post().updated_at);
    assert.equal(projectGrowthPost(modified, channel(), approved, NOW), null);
    const changedHandle = channel({ handle: "new-handle" });
    assert.equal(changedHandle.updated_at, channel().updated_at);
    assert.equal(projectGrowthPost(post(), changedHandle, approved, NOW), null);
  });

  it("binds evidence to deterministic canonical SHA-256 source bytes", () => {
    const digest = growthContentDigest(post(), channel());
    assert.match(digest, /^[0-9a-f]{64}$/);
    assert.equal(growthContentDigest(post(), channel()), digest);
    assert.equal(growthContentDigest(post({ body: "altered" }), channel()) === digest, false);
    assert.equal(growthContentDigest(post(), channel({ state: "hidden" })) === digest, false);
    assert.equal(projectGrowthPost(post(), channel(),
      proof({ contentDigest: "0".repeat(64) }), NOW), null);
    assert.equal(projectGrowthPost(post(), channel(),
      proof({ contentDigest: null }), NOW), null);
  });

  it("denies stale, expired, future, or over-long attestation windows", () => {
    for (const evidence of [
      proof({ verifiedAt: "2026-10-09T11:40:00Z" }),
      proof({ verifiedAt: "2026-10-09T12:04:00Z" }),
      proof({ expiresAt: "2026-10-09T12:02:00Z" }),
      proof({ expiresAt: "2026-10-09T13:10:00Z" }),
      proof({ verifiedAt: "impossible" })
    ]) {
      assert.equal(projectGrowthPost(post(), channel(), evidence, NOW), null);
    }
  });

  it("rejects oversized bodies, unsafe text and invalid topic before publishing a title", () => {
    assert.equal(projectGrowthPost(post({ body: "x".repeat(2001) }), channel(), proof(), NOW), null);
    assert.equal(projectGrowthPost(post({ body: "<script>\u0000" }), channel(), proof(), NOW), null);
    assert.equal(projectGrowthPost(post(), channel(), proof({ topic: "\nspam" }), NOW), null);
    assert.equal(projectGrowthPost(post({ created_at: "bad date" }), channel(), proof(), NOW), null);
    const htmlText = projectGrowthPost(post({ body: "<b>Text</b>" }), channel(),
      proof({ contentDigest: growthContentDigest(post({ body: "<b>Text</b>" }), channel()) }), NOW);
    assert.equal(htmlText.title, "<b>Text</b>"); // escape in frontend; never innerHTML
  });

  it("preserves verified disclosure labels and mature/territory gates", () => {
    const attested = projectGrowthPost(post(), channel(),
      proof({ sponsored: true, aiGenerated: true, ageRating: "mature",
        territory: "restricted", allowedCountries: ["US", "CA"] }), NOW);
    assert.equal(attested.sponsored, true);
    assert.equal(attested.aiGenerated, true);
    assert.equal(attested.ageRating, "mature");
    assert.deepEqual(attested.allowedCountries, ["US", "CA"]);
  });

  it("never calls loaders for invalid scopes or caps", async () => {
    const { read, calls } = source();
    for (const query of [{}, { scope: "unreviewed", cap: 10 },
      { scope: "moderated_public", cap: 0 },
      { scope: "moderated_public", cap: 251 }]) {
      assert.equal((await read(query)).code, "projection_request_invalid");
    }
    assert.equal(calls.growth, 0);
    assert.equal(calls.attestations, 0);
  });

  it("returns no discoverable rows when moderation evidence is missing", async () => {
    const { read } = source({ entries: [] });
    const result = await read({ cap: 250, scope: "moderated_public" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.candidates, []);
  });

  it("never treats failed adapters as an empty public feed", async () => {
    for (const reason of ["growth", "attestations"]) {
      const { read } = source({ throwRows: reason === "growth",
        throwProof: reason === "attestations" });
      const result = await read({ cap: 250, scope: "moderated_public" });
      assert.equal(result.ok, false);
      assert.equal(result.candidates.length, 0);
      assert.equal(JSON.stringify(result).includes("private"), false);
    }
  });

  it("denies duplicate, mismatched, over-cap or injected attestation sets", async () => {
    const inputs = [
      { rows: [{ post: post() }, { post: post() }] },
      { rows: Array.from({ length: 3 }, () => ({ post: post(), channel: channel() })) },
      { entries: [proof(), proof()] },
      { entries: [proof({ postId: VIEWER })] }
    ];
    for (const input of inputs) {
      const { read } = source(input);
      assert.equal((await read({ cap: 2, scope: "moderated_public" })).ok, false);
    }
  });

  it("retains bounded order and issues no attestation reads when source is empty", async () => {
    const { read, calls } = source({ rows: [] });
    const result = await read({ cap: 250, scope: "moderated_public" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.candidates, []);
    assert.equal(calls.attestations, 0);
  });

  it("feeds the existing viewer privacy/consent policy without increasing authority", async () => {
    const sourceReader = source().read;
    const opts = { topics: [], mutedTopics: [], mutedKeywords: [],
      hiddenContentIds: [POST], blockedPublishers: [], followedPublishers: [],
      discoveryOptIn: true, ageVerifiedAdult: false, aiContent: "include",
      country: null };
    const read = createCommunityFeedReader({
      resolveAuthenticatedViewer: async () => ({
        ok: true, userId: VIEWER, accountState: "active", canReadPublicSocial: true
      }),
      loadViewerPreferences: async () => ({
        ok: true, viewerId: VIEWER, revision: 2, settings: opts
      }),
      loadPublicProjections: sourceReader,
      clock: () => new Date(NOW)
    });
    const result = await read({ mode: "discover" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.items, []); // hidden still means hidden
  });

  it("does not treat post-visible status as moderation/rights certification", async () => {
    const a = source({ entries: [proof({ rightsStatus: "unknown" })] });
    const result = await a.read({ cap: 250, scope: "moderated_public" });
    assert.equal(result.ok, true);
    assert.equal(result.candidates.length, 0);
  });
});


describe("two-authority Ed25519 discovery review verification (not runtime-wired)", () => {
  const crypto = require("node:crypto");
  const { signingMessage, createVerifiedAttestationLoader } =
    require("../lib/sonara-review-attestation-verifier.cjs");
  const { growthContentDigest, createGrowthPublicProjectionSource } =
    require("../lib/sonara-growth-public-projections.cjs");
  const POST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const CHANNEL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const ORG = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const NOW = new Date("2026-10-10T12:03:00.000Z");
  const STAMP = "2026-10-10T12:00:00.000Z";
  const reviewer = crypto.generateKeyPairSync("ed25519");
  const licensor = crypto.generateKeyPairSync("ed25519");
  const post = (extra = {}) => ({ id: POST, channel_id: CHANNEL, organization_id: ORG,
    state: "published", kind: "post", body: "Approved creative work",
    created_at: STAMP, updated_at: STAMP, ...extra });
  const channel = (extra = {}) => ({ id: CHANNEL, organization_id: ORG,
    state: "public", handle: "creator", updated_at: STAMP, ...extra });
  const claim = (extra = {}) => ({
    attestationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    policyVersion: "ugc-2026.10", postId: POST, channelId: CHANNEL,
    organizationId: ORG, postVersion: STAMP, channelVersion: STAMP,
    contentDigest: growthContentDigest(post(), channel()),
    moderationStatus: "approved", rightsStatus: "cleared",
    sponsored: false, aiGenerated: false, originalityVerified: false,
    quality: 0.5, diversity: 0.5,
    verifiedAt: "2026-10-10T12:02:00.000Z",
    expiresAt: "2026-10-10T12:10:00.000Z",
    topic: "music", ageRating: "general", territory: "global",
    allowedCountries: [], ...extra
  });
  const key = (keyId, role, publicKey) => ({
    keyId, role, publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    enabled: true
  });
  const trust = (extra = {}) => ({
    ok: true, revision: 1, policyVersion: "ugc-2026.10",
    keys: [key("mod-01", "moderation", reviewer.publicKey),
      key("rights-01", "rights", licensor.publicKey)], ...extra
  });
  const safety = (extra = {}) => ({
    ok: true, revision: 1, checkedAt: "2026-10-10T12:02:30.000Z",
    heldPostIds: [], revokedAttestationIds: [], revokedKeyIds: [],
    ...extra
  });
  const envelope = (data = claim(), signatureOverrides = {}) => ({
    claim: data,
    signatures: {
      moderation: {
        keyId: "mod-01",
        signature: crypto.sign(null, signingMessage("moderation", "mod-01", data),
          reviewer.privateKey).toString("base64url")
      },
      rights: {
        keyId: "rights-01",
        signature: crypto.sign(null, signingMessage("rights", "rights-01", data),
          licensor.privateKey).toString("base64url")
      },
      ...signatureOverrides
    }
  });
  const make = ({ proofEntries, trustReads, safetyReads, fault } = {}) => {
    const counts = { trust: 0, safety: 0, attestations: 0 };
    const trusts = trustReads || [trust()];
    const snapshots = safetyReads || [safety()];
    const load = createVerifiedAttestationLoader({
      clock: () => new Date(NOW),
      loadTrustRegistry: async () => {
        counts.trust++;
        if (fault === "trust") throw new Error("private roster");
        return trusts[Math.min(counts.trust - 1, trusts.length - 1)];
      },
      loadSafetyState: async ({ postIds, fresh }) => {
        assert.deepEqual(postIds, [POST]);
        assert.equal(fresh, true);
        counts.safety++;
        if (fault === "safety") throw new Error("private moderation queue");
        return snapshots[Math.min(counts.safety - 1, snapshots.length - 1)];
      },
      loadSignedAttestations: async ({ scope, postIds }) => {
        assert.equal(scope, "signed_discovery_reviews");
        assert.deepEqual(postIds, [POST]);
        counts.attestations++;
        if (fault === "attestations") throw new Error("private evidence");
        return { ok: true, entries: proofEntries === undefined ? [envelope()] : proofEntries };
      }
    });
    return { load, counts };
  };
  const read = (loader) => loader({ postIds: [POST], scope: "discovery_proof" });

  it("validates two real Ed25519 signatures and rereads trust and revocations", async () => {
    const { load, counts } = make();
    const result = await read(load);
    assert.equal(result.ok, true);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].contentDigest, claim().contentDigest);
    assert.deepEqual(counts, { trust: 2, safety: 2, attestations: 1 });
    assert.equal("signatures" in result.entries[0], false);
  });

  it("denies unapproved sources, invalid request scope and missing adapters", async () => {
    const { load, counts } = make();
    for (const options of [undefined, {}, { postIds: [POST], scope: "public" },
      { postIds: ["not-a-uuid"], scope: "discovery_proof" },
      { postIds: [POST, POST], scope: "discovery_proof" }]) {
      assert.equal((await load(options)).code, "attestation_request_invalid");
    }
    assert.deepEqual(counts, { trust: 0, safety: 0, attestations: 0 });
    assert.throws(() => createVerifiedAttestationLoader({}), TypeError);
  });

  it("rejects edits or false disclosure labels after signing", async () => {
    const original = envelope();
    for (const corrupt of [
      { ...original, claim: { ...original.claim, sponsored: true } },
      { ...original, claim: { ...original.claim, contentDigest: "f".repeat(64) } },
      { ...original, claim: { ...original.claim, rightsStatus: "unknown" } },
      { ...original, claim: { ...original.claim, aiGenerated: "false" } }
    ]) {
      const res = await read(make({ proofEntries: [corrupt] }).load);
      assert.equal(res.ok, true);
      assert.equal(res.entries.length, 0);
    }
  });

  it("rejects one signature, substituted keys, and wrong role signing", async () => {
    const signed = envelope();
    const altered = [
      { ...signed, signatures: { moderation: signed.signatures.moderation } },
      { ...signed, signatures: { ...signed.signatures,
        rights: { ...signed.signatures.rights, keyId: "mod-01" } } },
      { ...signed, signatures: { ...signed.signatures,
        moderation: { ...signed.signatures.moderation,
          signature: signed.signatures.rights.signature } } },
      { ...signed, signatures: { ...signed.signatures,
        rights: { ...signed.signatures.rights, signature: "not-valid" } } }
    ];
    for (const entry of altered) {
      assert.deepEqual((await read(make({ proofEntries: [entry] }).load)).entries, []);
    }
  });

  it("refuses content holds, reviewer key revocations and approval revocations", async () => {
    for (const revoked of [
      safety({ heldPostIds: [POST] }),
      safety({ revokedAttestationIds: [claim().attestationId] }),
      safety({ revokedKeyIds: ["rights-01"] }),
      safety({ revokedKeyIds: ["mod-01"] })
    ]) {
      const result = await read(make({ safetyReads: [revoked] }).load);
      assert.equal(result.ok, true);
      assert.deepEqual(result.entries, []);
    }
  });

  it("refuses a safety hold appearing during signature verification", async () => {
    const { load } = make({ safetyReads: [safety(),
      safety({ revision: 2, heldPostIds: [POST] })] });
    const result = await read(load);
    assert.equal(result.code, "attestation_safety_changed");
    assert.deepEqual(result.entries, []);
  });

  it("refuses reviewer roster changes during verification", async () => {
    for (const later of [
      trust({ revision: 2 }),
      trust({ policyVersion: "ugc-2027.01" }),
      trust({ keys: [key("mod-01", "moderation", reviewer.publicKey),
        key("rights-01", "rights", reviewer.publicKey)] })
    ]) {
      const result = await read(make({ trustReads: [trust(), later] }).load);
      assert.equal(result.code, "attestation_safety_changed");
    }
  });

  it("rejects two role identities backed by the same Ed25519 public key", async () => {
    const registry = trust({ keys: [
      key("mod-01", "moderation", reviewer.publicKey),
      key("rights-01", "rights", reviewer.publicKey)
    ] });
    const { load, counts } = make({ trustReads: [registry] });
    const result = await read(load);
    assert.equal(result.code, "attestation_authority_unavailable");
    assert.equal(counts.attestations, 0);
  });

  it("rejects non-Ed25519 and foreign policy keys before reading evidence", async () => {
    const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    for (const registry of [
      trust({ keys: [key("mod-01", "moderation", reviewer.publicKey),
        key("rights-01", "rights", rsa.publicKey)] }),
      trust({ revision: 0 }),
      trust({ keys: [] }),
      trust({ keys: [key("mod-01", "moderation", reviewer.publicKey),
        key("mod-01", "rights", licensor.publicKey)] })
    ]) {
      const { load, counts } = make({ trustReads: [registry] });
      assert.equal((await read(load)).code, "attestation_authority_unavailable");
      assert.equal(counts.attestations, 0);
    }
  });

  it("refuses stale, incomplete or inaccessible safety snapshots", async () => {
    for (const snapshot of [
      safety({ checkedAt: "2026-10-10T11:50:00Z" }),
      safety({ heldPostIds: null }),
      safety({ heldPostIds: [ORG] }),
      safety({ revision: 0 })
    ]) {
      const { load, counts } = make({ safetyReads: [snapshot] });
      assert.equal((await read(load)).code, "attestation_authority_unavailable");
      assert.equal(counts.attestations, 0);
    }
    for (const fault of ["safety", "trust", "attestations"]) {
      const result = await read(make({ fault }).load);
      assert.equal(result.ok, false);
      assert.equal(JSON.stringify(result).includes("private"), false);
    }
  });

  it("rejects stale, expired, wrong-policy or unexpected claim fields", async () => {
    const altered = [
      claim({ expiresAt: "2026-10-10T12:02:00Z" }),
      claim({ verifiedAt: "2026-10-10T11:40:00Z" }),
      claim({ policyVersion: "ugc-2027.01" }),
      claim({ authorEmail: "should-not-exist" })
    ];
    for (const c of altered) {
      const signed = (() => {
        try { return envelope(c); } catch { return { claim: c, signatures: {} }; }
      })();
      const result = await read(make({ proofEntries: [signed] }).load);
      assert.deepEqual(result.entries, []);
    }
  });

  it("denies duplicates or injected post identifiers across a bounded batch", async () => {
    const repeated = await read(make({ proofEntries: [envelope(), envelope()] }).load);
    assert.equal(repeated.code, "attestation_source_unavailable"); // over 1 requested post
    const other = envelope(claim({ postId: ORG }));
    const result = await read(make({ proofEntries: [other] }).load);
    assert.equal(result.code, "attestation_ambiguous");
  });

  it("feeds independently signed evidence into the existing Growth projection", async () => {
    const reviewed = make().load;
    const source = createGrowthPublicProjectionSource({
      clock: () => new Date(NOW),
      loadGrowthRows: async () => ({
        ok: true, rows: [{ post: post(), channel: channel() }]
      }),
      loadAttestations: reviewed
    });
    const result = await source({ cap: 250, scope: "moderated_public" });
    assert.equal(result.ok, true);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].href, "/channels/creator");
    assert.equal(result.candidates[0].contentDigest, undefined);
    assert.equal(result.candidates[0].moderationStatus, "approved");
  });

  it("stops platform-wide recommendations when an active moderation hold exists", async () => {
    const reviewed = make({ safetyReads: [safety({ heldPostIds: [POST] })] }).load;
    const source = createGrowthPublicProjectionSource({
      clock: () => new Date(NOW),
      loadGrowthRows: async () => ({
        ok: true, rows: [{ post: post(), channel: channel() }]
      }),
      loadAttestations: reviewed
    });
    const result = await source({ cap: 250, scope: "moderated_public" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.candidates, []);
  });
});

