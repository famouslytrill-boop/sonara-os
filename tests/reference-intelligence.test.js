"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const {
  FACEBOOK_REFERENCE_CATALOG,
  FACEBOOK_REFERENCE_URLS,
  REFERENCE_PRODUCT_FRAMEWORK
} = require("../data/facebook-reference-catalog.cjs");
const { DATABASE_TABLE_GROUPS } = require("../lib/sonara-database-contract.cjs");

const MIGRATION_PATH = path.join(
  __dirname,
  "../supabase/migrations/20260722201500_reference_intelligence_system.sql"
);

describe("reference intelligence catalog", () => {
  it("catalogs all unique founder-supplied Facebook references without inventing content", () => {
    assert.equal(FACEBOOK_REFERENCE_CATALOG.length, 27);
    assert.equal(new Set(FACEBOOK_REFERENCE_URLS).size, 27);
    assert.ok(FACEBOOK_REFERENCE_CATALOG.every((item) => item.platform === "facebook"));
    assert.ok(FACEBOOK_REFERENCE_CATALOG.every((item) => item.sourceUrl.startsWith("https://www.facebook.com/")));
    assert.ok(FACEBOOK_REFERENCE_CATALOG.every((item) => item.verificationStatus === "requires_authenticated_source_review"));
    assert.ok(FACEBOOK_REFERENCE_CATALOG.every((item) => item.accessStatus === "public_fetch_blocked"));
    assert.ok(FACEBOOK_REFERENCE_CATALOG.every((item) => item.rightsStatus === "unknown"));
    assert.doesNotMatch(JSON.stringify(FACEBOOK_REFERENCE_CATALOG), /verified_content|factual_summary|transcript_text/);
  });

  it("maps the review framework across the three active products", () => {
    assert.deepEqual(Object.keys(REFERENCE_PRODUCT_FRAMEWORK), [
      "business_builder",
      "creator_studio",
      "growth_studio"
    ]);
    assert.ok(Object.values(REFERENCE_PRODUCT_FRAMEWORK).every((item) => item.reviewDimensions.length >= 7));
    assert.ok(Object.values(REFERENCE_PRODUCT_FRAMEWORK).every((item) => item.allowedOutputs.length >= 4));
  });

  it("registers the reference tables in the database contract", () => {
    assert.deepEqual(DATABASE_TABLE_GROUPS.referenceIntelligence, [
      "reference_intelligence_sources",
      "reference_intelligence_insights",
      "reference_intelligence_actions"
    ]);
  });

  it("protects reference intelligence operations behind founder/admin authentication", async () => {
    const response = await request(app)
      .get("/api/admin/reference-intelligence")
      .set("Accept", "application/json");

    assert.notEqual(response.status, 200);
    assert.ok([401, 503].includes(response.status));
    assert.ok(["admin_auth_required", "setup_required"].includes(response.body.code));
  });

  it("seeds only review-required metadata with service-role-only access", () => {
    const migration = fs.readFileSync(MIGRATION_PATH, "utf8");
    for (const item of FACEBOOK_REFERENCE_CATALOG) {
      assert.match(migration, new RegExp(item.externalId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(migration, /enable row level security/);
    assert.match(migration, /grant select, insert, update, delete .* to service_role/);
    assert.match(migration, /content_verified"\s*:\s*false/);
    assert.doesNotMatch(migration, /content_verified"\s*:\s*true/);
  });
});
