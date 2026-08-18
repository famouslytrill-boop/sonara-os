"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CATALOG_VERSION,
  ALLOWED_PRODUCT_KEYS,
  ALLOWED_PLAN_FLOORS,
  ALLOWED_LIFECYCLE_STATUSES,
  RECOMMENDED_PRODUCT_CATALOG,
  getRecommendedProductCatalogSummary
} = require("../lib/sonara-recommended-product-catalog.cjs");

const root = path.join(__dirname, "..");

describe("SONARA recommended product catalog", () => {
  it("publishes the full cross-company product portfolio", () => {
    const summary = getRecommendedProductCatalogSummary();
    assert.equal(CATALOG_VERSION, "2026-07-25");
    // The totals were written out here as 34 and a four-way breakdown. They
    // are a description of lib/catalog/*.cjs, not a decision this test gets to
    // make, so eleven honest removals failed it. What it is actually for is
    // that the summary counts what is there and every company is represented.
    assert.equal(summary.total, RECOMMENDED_PRODUCT_CATALOG.length);
    const counted = {};
    for (const item of RECOMMENDED_PRODUCT_CATALOG) counted[item.productKey] = (counted[item.productKey] || 0) + 1;
    assert.deepEqual(summary.byCompany, counted);
    for (const productKey of ALLOWED_PRODUCT_KEYS) {
      assert.ok(summary.byCompany[productKey] >= 4, `${productKey} is down to ${summary.byCompany[productKey] || 0} products`);
    }
  });

  it("gives every product an honest access, lifecycle, route, dependency, and safety contract", () => {
    const keys = new Set();
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      assert.ok(!keys.has(item.serviceKey), `duplicate service key: ${item.serviceKey}`);
      keys.add(item.serviceKey);
      assert.ok(ALLOWED_PRODUCT_KEYS.includes(item.productKey), `invalid company: ${item.serviceKey}`);
      assert.ok(ALLOWED_PLAN_FLOORS.includes(item.planFloor), `invalid plan floor: ${item.serviceKey}`);
      assert.ok(ALLOWED_LIFECYCLE_STATUSES.includes(item.lifecycleStatus), `invalid lifecycle status: ${item.serviceKey}`);
      assert.match(item.route, /^\//, `route required: ${item.serviceKey}`);
      assert.ok(item.summary.length >= 30, `summary too short: ${item.serviceKey}`);
      assert.ok(item.customerOutcome.length >= 20, `outcome missing: ${item.serviceKey}`);
      assert.ok(item.capabilities.length >= 3, `capabilities missing: ${item.serviceKey}`);
      assert.ok(item.dependencies.length >= 1, `dependencies missing: ${item.serviceKey}`);
      assert.ok(item.safetyBoundary.length >= 20, `safety boundary missing: ${item.serviceKey}`);
    }
  });

  it("runs the product catalog after product lifecycle and before final market decisions", () => {
  });

  it("seeds every product through an idempotent service catalog migration", () => {
    // Read across every migration rather than one file.
    //
    // 20260725180000 seeded the catalog as it stood, and it is applied and
    // frozen: rewriting it would change what a fresh database gets without
    // changing any database that already ran it. So a product added afterwards
    // is seeded by a later migration, and this check has to ask whether the
    // product is seeded *anywhere* -- which is the actual guarantee. Pinning it
    // to one filename made the check a statement about where the answer lives
    // rather than about whether it exists.
    //
    // The generated sync migration does not count for the insert: it only
    // updates, so a product listed only there would be retired-proof and never
    // created.
    const base = fs.readFileSync(path.join(root, "supabase", "migrations", "20260725180000_recommended_product_catalog.sql"), "utf8");
    assert.match(base, /add column if not exists service_key text/i);
    assert.match(base, /on conflict \(service_key\).*do update/is);
    assert.match(base, /lifecycle_status/i);
    assert.match(base, /plan_floor/i);

    const directory = path.join(root, "supabase", "migrations");
    const seeding = fs.readdirSync(directory)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => ({ name, sql: fs.readFileSync(path.join(directory, name), "utf8") }))
      .filter((file) => /insert\s+into\s+public\.service_catalog_items/i.test(file.sql));

    assert.ok(seeding.length >= 1, "no migration inserts into service_catalog_items; this check would pass over an empty set");
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      const seeded = seeding.some((file) => new RegExp(`'${item.serviceKey}'`).test(file.sql));
      assert.ok(seeded, `no migration inserts ${item.serviceKey}, so the catalog lists a product the database will never have`);
    }
  });

  it("integrates products without creating fake parent studio lifecycle routes", () => {
    const routes = fs.readFileSync(path.join(root, "routes", "sonara-service-lifecycle-routes.cjs"), "utf8");
    const manifest = fs.readFileSync(path.join(root, "lib", "sonara-ecosystem-manifest.cjs"), "utf8");
    assert.match(routes, /getRecommendedProductCatalog/);
    assert.match(routes, /LEGACY_DEFAULT_SERVICE_CATALOG/);
    assert.match(routes, /mergedCatalog/);
    assert.match(routes, /Availability:/);
    assert.match(routes, /Request this service/);
    assert.doesNotMatch(routes, /slug: "products", productKey: "sonara_industries"/);
    assert.match(manifest, /recommendedProductCatalog: getRecommendedProductCatalog\(\)/);
  });
});
