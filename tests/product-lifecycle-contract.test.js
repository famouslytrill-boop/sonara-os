"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

describe("Product lifecycle integration contract", () => {
  it("runs lifecycle before the catalog and market decision layers", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.equal(pkg.scripts["apply:product-lifecycle"], "node scripts/apply-product-lifecycle-system.cjs && node scripts/apply-product-lifecycle-openapi-fix.cjs");
    assert.match(pkg.scripts["apply:runtime"], /apply:growth-public && pnpm run apply:product-lifecycle && pnpm run apply:product-catalog && pnpm run apply:catalog-fetch-race && pnpm run apply:market-intelligence && pnpm run apply:market-rd$/);
  });

  it("registers parent and studio lifecycle routes", () => {
    const registry = read("lib/sonara-route-registry.cjs");
    for (const route of ["/product-lifecycle", "/business-builder/product-lifecycle", "/creator-studio/product-lifecycle", "/growth-studio/product-lifecycle"]) {
      assert.match(registry, new RegExp(route.replaceAll("/", "\\/")));
    }
  });

  it("declares all lifecycle tables in the database contract", () => {
    const contract = read("lib/sonara-database-contract.cjs");
    for (const table of [
      "product_lifecycle_initiatives",
      "product_lifecycle_evidence",
      "product_lifecycle_requirements",
      "product_lifecycle_iterations",
      "product_lifecycle_feedback",
      "product_lifecycle_stage_reviews",
      "product_lifecycle_events"
    ]) assert.match(contract, new RegExp(table));
  });

  it("keeps lifecycle writes tenant-scoped and server-controlled", () => {
    const migration = read("supabase/migrations/20260723193000_product_lifecycle_system.sql");
    assert.match(migration, /organization_id uuid not null references public\.organizations/);
    assert.match(migration, /public\.sonara_is_org_member\(organization_id\)/);
    assert.match(migration, /auth\.role\(\) = ''service_role''/);
    assert.match(migration, /revoke insert, update, delete on public\.product_lifecycle_initiatives from anon, authenticated/);
  });

  it("documents iteration APIs after the main lifecycle patch", () => {
    const patch = read("scripts/apply-product-lifecycle-openapi-fix.cjs");
    assert.match(patch, /recordProductLifecycleIteration/);
    assert.match(patch, /Definition of Done/);
  });

  it("documents the seven-stage operating model and research extensions", () => {
    const docs = read("docs/SONARA_PRODUCT_LIFECYCLE.md");
    for (const term of ["Discover", "Validate", "Plan", "Build", "Beta", "Launch", "Learn & Scale", "WCAG 2.2 AA", "OWASP SAMM", "OpenTelemetry", "retention", "churn"]) assert.match(docs, new RegExp(term, "i"));
  });
});
