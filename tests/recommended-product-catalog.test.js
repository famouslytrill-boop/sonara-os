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
    assert.equal(summary.total, 34);
    assert.deepEqual(summary.byCompany, {
      sonara_industries: 10,
      business_builder: 8,
      creator_studio: 8,
      growth_studio: 8
    });
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
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.equal(pkg.scripts["apply:product-catalog"], "node scripts/apply-recommended-product-catalog.cjs");
    assert.equal(pkg.scripts["apply:catalog-fetch-race"], "node scripts/apply-catalog-fetch-race.cjs && node scripts/apply-catalog-compact-directory.cjs && node scripts/apply-catalog-route-boundary.cjs");
    assert.match(pkg.scripts["apply:runtime"], /apply:product-lifecycle && pnpm run apply:product-catalog && pnpm run apply:catalog-fetch-race && pnpm run apply:market-intelligence && pnpm run apply:market-rd$/);
  });

  it("seeds every product through an idempotent service catalog migration", () => {
    const sql = fs.readFileSync(path.join(root, "supabase", "migrations", "20260725180000_recommended_product_catalog.sql"), "utf8");
    assert.match(sql, /add column if not exists service_key text/i);
    assert.match(sql, /on conflict \(service_key\).*do update/is);
    assert.match(sql, /lifecycle_status/i);
    assert.match(sql, /plan_floor/i);
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      assert.match(sql, new RegExp(`'${item.serviceKey}'`), `migration is missing ${item.serviceKey}`);
    }
  });

  it("integrates products without creating fake parent studio lifecycle routes", () => {
    const routes = fs.readFileSync(path.join(root, "routes", "sonara-service-lifecycle-routes.cjs"), "utf8");
    const manifest = fs.readFileSync(path.join(root, "lib", "sonara-ecosystem-manifest.cjs"), "utf8");
    const racePatch = fs.readFileSync(path.join(root, "scripts", "apply-catalog-fetch-race.cjs"), "utf8");
    const directoryPatch = fs.readFileSync(path.join(root, "scripts", "apply-catalog-compact-directory.cjs"), "utf8");
    const routeBoundaryPatch = fs.readFileSync(path.join(root, "scripts", "apply-catalog-route-boundary.cjs"), "utf8");
    assert.match(routes, /getRecommendedProductCatalog/);
    assert.match(routes, /LEGACY_DEFAULT_SERVICE_CATALOG/);
    assert.match(routes, /mergedCatalog/);
    assert.match(routes, /Availability:/);
    assert.match(routes, /Request this service/);
    assert.doesNotMatch(routes, /slug: "products", productKey: "sonara_industries"/);
    assert.match(manifest, /recommendedProductCatalog: getRecommendedProductCatalog\(\)/);
    assert.match(racePatch, /Promise\.race\(\[request, deadline\]\)/);
    assert.match(racePatch, /table === "service_catalog_items"/);
    assert.match(directoryPatch, /function catalogDirectorySections\(items, resolveProduct\)/);
    assert.match(directoryPatch, /catalog-row/);
    assert.match(routeBoundaryPatch, /function registerCatalogRoute\(route, handler\)/);
    assert.match(routeBoundaryPatch, /Catalog temporarily unavailable/);
  });
});
