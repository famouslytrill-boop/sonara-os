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
