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
const { migrationName, assertionMigrationName } = require("../scripts/generate-catalog-sync-migration.cjs");

const read = (name) => fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", name), "utf8");

// The generator owns two files now, and this reads both.
//
// It read only the sync migration, which was right while that file carried the
// updates AND the assertions. The completeness assertion had to move: generated
// from today's catalog and dated 12 August, it demanded rows that nineteen
// migrations dated 18 August had not inserted yet, so a fresh replay always
// failed on it. Reading one file after the split would have left this test
// asserting against half of what the generator writes -- and passing.
const syncMigration = read(migrationName);
const assertionMigration = read(assertionMigrationName);
const migration = `${syncMigration}\n${assertionMigration}`;

describe("the published catalog matches the catalog in code", () => {
  it("carries every product", () => {
    assert.ok(RECOMMENDED_PRODUCT_CATALOG.length >= 20, "the catalog looks empty; the comparison would be vacuous");
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
    // And the generated pair refuses to leave one behind in a row it did not
    // update. Asserted against the assertion migration by name rather than
    // against the pair, so this cannot start passing because the check drifted
    // into whichever file happens to still be read here.
    assert.match(assertionMigration, /a retired public name survives in service_catalog_items/);
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

  it("retires the rows the catalog no longer lists", () => {
    // Removing a product from lib/catalog/*.cjs did not remove it from the
    // page. /service-catalog reads service_catalog_items where status is
    // active and merges those rows over the code defaults, so a row the code
    // had stopped listing carried on being published from the database, with
    // its old name and a route the customer could still click.
    assert.match(migration, /set status = 'retired'/);
    assert.match(migration, /service_key not in/);
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      assert.ok(
        migration.includes(`    '${item.serviceKey}'`),
        `${item.serviceKey} is not in the keep list, so this migration would retire it`
      );
    }
  });

  it("only updates rows, never inserts or deletes them", () => {
    // The rows were seeded by an earlier migration. Re-inserting would
    // duplicate them; deleting would take a product's history with it, which
    // is why an unlisted product is retired by status rather than removed.
    assert.match(migration, /update public\.service_catalog_items/);
    assert.ok(!/insert\s+into\s+public\.service_catalog_items/i.test(migration), "this migration must not insert catalog rows");
    assert.ok(!/delete\s+from\s+public\.service_catalog_items/i.test(migration), "this migration must not delete catalog rows");
  });

  it("fails loudly if the table is not there", () => {
    assert.match(migration, /service_catalog_items is missing/);
  });
});

describe("the deploy gate and the code cannot drift apart unnoticed", () => {
  // This used to parse `rows.length, 34` and the four per-company numbers out
  // of the gate and compare them to the catalog, because the gate held its own
  // copy of both. That is a real class of failure -- four merged PRs once sat
  // unshipped behind exactly this drift -- but the fix for a number kept in two
  // places is one place, not a test reconciling the two. The gate reads the
  // catalog now.
  //
  // So what is left to check is that it still does, because reintroducing a
  // literal is a one-line change that nothing else would notice.
  const gate = fs.readFileSync(path.join(__dirname, "..", "scripts", "verify-production-product-catalog.mjs"), "utf8");

  it("takes its expected counts from the catalog rather than a second copy", () => {
    assert.match(gate, /const expectedTotal = RECOMMENDED_PRODUCT_CATALOG\.length;/);
    assert.match(gate, /assert\.equal\(rows\.length, expectedTotal,/);
    assert.match(gate, /assert\.deepEqual\(companyCounts, countBy\(RECOMMENDED_PRODUCT_CATALOG/);

    const relitigated = [...gate.matchAll(/(business_builder|creator_studio|growth_studio|sonara_industries):\s*(\d+)/g)];
    assert.deepEqual(
      relitigated.map((match) => match[0]),
      [],
      "the gate has gone back to hard-coding a per-company product count; it will drift from the catalog again"
    );
    assert.doesNotMatch(gate, /rows\.length,\s*\d+/, "the gate has gone back to hard-coding the product total");
  });

  it("reads only the rows the catalog still publishes", () => {
    // Retired rows keep product_type = 'software_product' and a service_key,
    // so without the status filter the gate reads every product ever
    // published and fails on each one it cannot find in the code.
    assert.match(gate, /searchParams\.set\("status", "eq\.active"\)/);
  });
});
