"use strict";

// The published catalog rows and the catalog in code must agree.
//
// This test exists because of a specific, expensive failure. The product names
// were rewritten in lib/catalog/*.cjs. service_catalog_items in production kept
// the old ones. Two things followed:
//
//   * /service-catalog merges the database rows over the code defaults, so
//     production went on serving "SONARA Nexus Shared Operating Spine" -- a
//     retired public name AGENTS.md forbids in active UI.
//   * scripts/verify-production-product-catalog.mjs gates the production
//     deploy on those rows matching the code. It started failing, and four
//     merged pull requests stopped reaching production. The site sat on an
//     older commit while every PR check stayed green.
//
// The whole test suite passed throughout. It could not have caught it: the
// disagreement was between this repository and a live database, and nothing
// local was looking at both.
//
// This is the local check. It compares the sync migration against the catalog
// in code, so a rename that has not been carried into the database fails here
// in seconds instead of at the deploy gate an hour later.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { RECOMMENDED_PRODUCT_CATALOG, CATALOG_VERSION } = require("../lib/sonara-recommended-product-catalog.cjs");
const { migrationName } = require("../scripts/generate-catalog-sync-migration.cjs");

const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", migrationName), "utf8");

describe("the published catalog matches the catalog in code", () => {
  it("carries every product", () => {
    assert.ok(RECOMMENDED_PRODUCT_CATALOG.length >= 30, "the catalog looks empty; the comparison would be vacuous");
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      assert.ok(
        migration.includes(`'${item.serviceKey}'`),
        `${item.serviceKey} is in the catalog but not in the migration that publishes it`
      );
    }
  });

  it("carries the name a customer will actually read", () => {
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      const escaped = item.name.replace(/'/g, "''");
      assert.ok(
        migration.includes(`'${escaped}'`),
        `"${item.name}" is the name in code; the migration would leave the database showing something else`
      );
    }
  });

  it("publishes no retired public name", () => {
    // AGENTS.md: retired names must not appear in active UI, navigation,
    // metadata or manifests. The database is metadata that renders as UI.
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      assert.doesNotMatch(item.name, /\bnexus\b/i, `${item.serviceKey} still carries a retired public name`);
      assert.doesNotMatch(item.summary, /\bnexus\b/i, `${item.serviceKey}'s summary still carries a retired public name`);
    }
    // And the migration refuses to leave one behind in a row it did not update.
    assert.match(migration, /a retired public name survives in service_catalog_items/);
  });

  it("agrees on the fields the deploy gate compares", () => {
    // scripts/verify-production-product-catalog.mjs asserts on exactly these.
    // Anything it checks that the migration does not set is a deploy failure
    // waiting to happen.
    for (const column of [
      "product_key",
      "name",
      "plan_floor",
      "lifecycle_status",
      "route_path",
      "product_type",
      "status"
    ]) {
      assert.match(migration, new RegExp(`\\b${column}\\b`), `the migration must set ${column}; the deploy gate compares it`);
    }
    assert.ok(migration.includes(`'${CATALOG_VERSION}'`), "the migration must stamp the catalog version the gate expects");
  });

  it("only updates rows, never inserts or deletes them", () => {
    // The rows were seeded by an earlier migration. Re-inserting would
    // duplicate them; deleting would unpublish a product mid-release.
    assert.match(migration, /update public\.service_catalog_items/);
    assert.ok(!/insert\s+into\s+public\.service_catalog_items/i.test(migration), "this migration must not insert catalog rows");
    assert.ok(!/delete\s+from\s+public\.service_catalog_items/i.test(migration), "this migration must not delete catalog rows");
  });

  it("fails loudly if the table is not there", () => {
    assert.match(migration, /service_catalog_items is missing/);
  });
});

describe("the deploy gate and the code cannot drift apart unnoticed", () => {
  it("counts the products the gate expects", () => {
    // The gate asserts exactly 34 rows and a per-company breakdown. If the
    // catalog grows in code without the gate being updated, the deploy fails
    // after the merge -- which is how four PRs got stranded.
    const gate = fs.readFileSync(path.join(__dirname, "..", "scripts", "verify-production-product-catalog.mjs"), "utf8");

    const expectedTotal = Number((gate.match(/rows\.length,\s*(\d+)/) || [])[1]);
    assert.equal(
      RECOMMENDED_PRODUCT_CATALOG.length,
      expectedTotal,
      `the catalog has ${RECOMMENDED_PRODUCT_CATALOG.length} products but the production gate expects ${expectedTotal}. ` +
        "Update scripts/verify-production-product-catalog.mjs, or the next deploy fails after merging."
    );

    const counts = {};
    for (const item of RECOMMENDED_PRODUCT_CATALOG) counts[item.productKey] = (counts[item.productKey] || 0) + 1;
    const gateCounts = {};
    for (const match of gate.matchAll(/(business_builder|creator_studio|growth_studio|sonara_industries):\s*(\d+)/g)) {
      gateCounts[match[1]] = Number(match[2]);
    }
    assert.deepEqual(counts, gateCounts, "the per-company product counts the gate expects no longer match the catalog");
  });
});
