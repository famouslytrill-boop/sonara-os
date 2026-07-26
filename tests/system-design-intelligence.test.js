"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const {
  SYSTEM_DESIGN_REFERENCE_SOURCE,
  SYSTEM_DESIGN_PATTERNS
} = require("../data/system-design-reference-catalog.cjs");
const {
  getSystemDesignSummary,
  reviewSystemDesign
} = require("../lib/sonara-system-design-engine.cjs");
const { getManifest } = require("../lib/sonara-ecosystem-manifest.cjs");
const { ADMIN_ROUTES, findRoute } = require("../lib/sonara-route-registry.cjs");

const OPENAPI_PATH = path.join(__dirname, "..", "openapi", "sonara.yaml");
const ENGINE_PATH = path.join(__dirname, "..", "lib", "sonara-system-design-engine.cjs");
const CATALOG_PATH = path.join(__dirname, "..", "data", "system-design-reference-catalog.cjs");

function slugs(review) {
  return review.recommendedPatterns.map((item) => item.slug);
}

describe("System Design Intelligence", () => {
  it("registers exactly 28 unique upstream topics as original SONARA mappings", () => {
    assert.equal(SYSTEM_DESIGN_PATTERNS.length, 28);
    assert.equal(new Set(SYSTEM_DESIGN_PATTERNS.map((item) => item.slug)).size, 28);
    assert.deepEqual(SYSTEM_DESIGN_PATTERNS.map((item) => item.order), Array.from({ length: 28 }, (_, index) => index + 1));
    assert.ok(SYSTEM_DESIGN_PATTERNS.every((item) => item.sonaraModules.length >= 1));
    assert.ok(SYSTEM_DESIGN_PATTERNS.every((item) => item.reviewQuestions.length >= 3));
    assert.ok(SYSTEM_DESIGN_PATTERNS.every((item) => item.guardrails.length >= 1));
    assert.ok(SYSTEM_DESIGN_PATTERNS.every((item) => item.sourceReference.copiedContent === false));
  });

  it("pins provenance and blocks copying because no upstream license file was detected", () => {
    assert.equal(SYSTEM_DESIGN_REFERENCE_SOURCE.repository, "liquidslr/system-design-notes");
    assert.equal(SYSTEM_DESIGN_REFERENCE_SOURCE.pinnedCommit, "aa7ac69e206bca659020baa5954bb65cfd70ab99");
    assert.equal(SYSTEM_DESIGN_REFERENCE_SOURCE.licenseStatus, "no_license_file_detected");
    assert.equal(SYSTEM_DESIGN_REFERENCE_SOURCE.rightsStatus, "reference_only");
    assert.equal(SYSTEM_DESIGN_REFERENCE_SOURCE.copiedUpstreamContent, false);
    assert.equal(SYSTEM_DESIGN_REFERENCE_SOURCE.remoteRuntimeDependency, false);
    assert.match(SYSTEM_DESIGN_REFERENCE_SOURCE.commercialUseStatus, /blocked/);
  });

  it("keeps the engine local and free of runtime cloning or upstream fetching", () => {
    const source = `${fs.readFileSync(ENGINE_PATH, "utf8")}\n${fs.readFileSync(CATALOG_PATH, "utf8")}`;
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /git\s+clone/i);
    assert.doesNotMatch(source, /child_process|execSync|spawnSync/);
    assert.doesNotMatch(source, /images\//);
    assert.match(source, /copiedUpstreamContent:\s*false/);
  });

  it("maps Business Builder bookings, payments, notifications, and inventory holds", () => {
    const review = reviewSystemDesign({
      moduleKey: "business-builder-booking-checkout",
      product: "business_builder",
      summary: "Customer appointments with inventory holds, Stripe payment, confirmation email, cancellation, and operator dashboard.",
      capabilities: ["booking availability", "payment webhook", "email notification", "inventory hold"],
      risks: ["double booking", "duplicate payment", "provider outage"],
      scaleTier: "launch"
    });

    assert.equal(review.ok, true);
    assert.equal(review.decision, "review_required");
    assert.ok(slugs(review).includes("reservation-system"));
    assert.ok(slugs(review).includes("payment-system"));
    assert.ok(slugs(review).includes("notification-system") || slugs(review).includes("distributed-email-service"));
    assert.ok(slugs(review).includes("unique-id-generator"));
    assert.ok(slugs(review).includes("metrics-monitoring-alerting"));
    assert.ok(review.requiredGates.some((item) => /double booking|capacity check/i.test(item)));
    assert.equal(review.referenceBoundary.copiedUpstreamContent, false);
  });

  it("maps Creator Studio video work to queues, storage, monitoring, and media delivery", () => {
    const review = reviewSystemDesign({
      moduleKey: "creator-video-processing",
      product: "creator_studio",
      summary: "Upload creator video, store assets, queue transcoding, generate thumbnails, and deliver finished renditions.",
      capabilities: ["video upload", "background job queue", "object storage", "cdn delivery"],
      risks: ["large file", "job retry", "storage egress"],
      scaleTier: "growth"
    });

    assert.equal(review.ok, true);
    assert.ok(slugs(review).includes("video-platform"));
    assert.ok(slugs(review).includes("object-storage"));
    assert.ok(slugs(review).includes("distributed-message-queue"));
    assert.ok(slugs(review).includes("metrics-monitoring-alerting"));
  });

  it("blocks wallet and exchange concepts behind specialist review", () => {
    const wallet = reviewSystemDesign({
      moduleKey: "customer-digital-wallet",
      product: "business_builder",
      summary: "Hold stored customer balances and permit transfers."
    });
    const exchange = reviewSystemDesign({
      moduleKey: "stock-exchange-matching-engine",
      product: "research_lab",
      summary: "Trading order book and securities settlement."
    });

    assert.equal(wallet.decision, "blocked_requires_specialist_review");
    assert.ok(wallet.blockedPatterns.includes("digital-wallet"));
    assert.equal(exchange.decision, "blocked_requires_specialist_review");
    assert.ok(exchange.blockedPatterns.includes("stock-exchange"));
  });

  it("produces deterministic review fingerprints for the same architecture input", () => {
    const input = {
      moduleKey: "growth-event-attribution",
      product: "growth_studio",
      capabilities: ["event aggregation", "campaign attribution", "deduplication"],
      risks: ["late events", "consent"],
      scaleTier: "growth"
    };
    const first = reviewSystemDesign(input);
    const second = reviewSystemDesign(input);
    assert.equal(first.reviewFingerprint, second.reviewFingerprint);
    assert.deepEqual(slugs(first), slugs(second));
  });

  it("registers the engine across ecosystem, route, and OpenAPI contracts", () => {
    const summary = getSystemDesignSummary();
    assert.equal(summary.patternCount, 28);
    assert.equal(summary.executionMode, "deterministic_local_reference_engine");

    const manifest = getManifest();
    assert.equal(manifest.externalInspirationAndAdapters.systemDesignIntelligence.patternCount, 28);
    assert.equal(manifest.externalInspirationAndAdapters.systemDesignIntelligence.licenseStatus, "no_license_file_detected");
    assert.ok(manifest.adminControlPlane.routes.includes("/admin/system-design-intelligence"));
    assert.ok(manifest.externalInspirationAndAdapters.openSourceAndResearchQueue.some((item) => item.name === "liquidslr/system-design-notes"));

    assert.ok(ADMIN_ROUTES.includes("/admin/system-design-intelligence"));
    assert.equal(findRoute("/admin/system-design-intelligence").visibility, "admin");

    const openapi = fs.readFileSync(OPENAPI_PATH, "utf8");
    assert.match(openapi, /\/api\/admin\/system-design-intelligence:/);
    assert.match(openapi, /\/api\/admin\/system-design-intelligence\/review:/);
    assert.match(openapi, /operationId: reviewAdminSystemDesignArchitecture/);
  });

  it("protects catalog and architecture review behind founder/admin authentication", async () => {
    const catalog = await request(app)
      .get("/api/admin/system-design-intelligence")
      .set("Accept", "application/json");
    const review = await request(app)
      .post("/api/admin/system-design-intelligence/review")
      .set("Accept", "application/json")
      .send({ moduleKey: "public-test" });

    assert.notEqual(catalog.status, 200);
    assert.notEqual(review.status, 200);
    assert.ok([401, 503].includes(catalog.status));
    assert.ok([401, 503].includes(review.status));
  });
});
