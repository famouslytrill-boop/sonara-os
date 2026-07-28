"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  EXECUTABLE_LIFECYCLE_STATUSES,
  RECOMMENDED_PRODUCT_CATALOG,
  getRecommendedProductCatalogSummary
} = require("../lib/sonara-recommended-product-catalog.cjs");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Recommended product catalog production boundary", () => {
  it("keeps every paid product restricted until a positive production entitlement test is recorded", () => {
    const paid = RECOMMENDED_PRODUCT_CATALOG.filter((item) => item.planFloor !== "free");
    assert.ok(paid.length > 0);
    for (const item of paid) {
      assert.equal(item.entitlementIntegrationVerified, false, `${item.serviceKey} must remain unverified`);
      assert.equal(item.executionEnabled, false, `${item.serviceKey} must remain non-executable`);
      // The price note states price and nothing else now. Availability and the
      // plan live on the card via accessNote() and includedFrom(); when this
      // note repeated them, every card ended by saying the same thing twice.
      assert.match(item.priceNote, /^Included in (Starter and above|Core and above|Pro)\.$/);
    }
    const summary = getRecommendedProductCatalogSummary();
    assert.equal(summary.total, 34);
    assert.equal(summary.entitlementVerificationRequired, paid.length);
  });

  it("never enables planned, validation-required, or setup-required products", () => {
    const restricted = RECOMMENDED_PRODUCT_CATALOG.filter((item) => ["planned", "validation_required", "setup_required"].includes(item.lifecycleStatus));
    assert.ok(restricted.length > 0);
    for (const item of restricted) assert.equal(item.executionEnabled, false, `${item.serviceKey} cannot execute`);
  });

  it("enables only free active or beta entries by default", () => {
    const enabled = RECOMMENDED_PRODUCT_CATALOG.filter((item) => item.executionEnabled);
    assert.ok(enabled.length > 0);
    for (const item of enabled) {
      assert.equal(item.planFloor, "free");
      assert.equal(item.entitlementIntegrationVerified, true);
      assert.ok(EXECUTABLE_LIFECYCLE_STATUSES.includes(item.lifecycleStatus));
    }
  });

  it("enforces the same boundary in the production database", () => {
    const sql = read("supabase/migrations/20260725193000_product_catalog_production_boundary.sql");
    assert.match(sql, /entitlement_integration_verified boolean not null default false/i);
    assert.match(sql, /execution_enabled boolean not null default false/i);
    assert.match(sql, /service_catalog_items_execution_lifecycle_check/i);
    assert.match(sql, /service_catalog_items_execution_entitlement_check/i);
    assert.match(sql, /catalog_total <> 34/i);
    assert.match(sql, /parent_total <> 10 or business_total <> 8 or creator_total <> 8 or growth_total <> 8/i);
    assert.match(sql, /lifecycle_status in \('planned', 'validation_required', 'setup_required'\)[\s\S]*execution_enabled = true/i);
    assert.match(sql, /plan_floor <> 'free'[\s\S]*entitlement_integration_verified = false[\s\S]*execution_enabled = true/i);
  });

  it("removes direct catalog execution links and aborts stalled database reads", () => {
    const routes = read("routes/sonara-service-lifecycle-routes.cjs");
    const server = read("server.js");
    assert.match(routes, /function catalogActions\(item, product\)/);
    assert.match(routes, /function catalogAccessReason\(item\)/);
    assert.match(routes, /Ask about this one/);
    assert.match(routes, /Ask us to open access/);
    assert.match(routes, /See what is ready now/);
    assert.match(routes, /item\.executionEnabled !== true/);
    assert.match(routes, /entitlementIntegrationVerified !== true/);
    // The customer sees the reason in plain words; the reasons themselves live
    // in lib/sonara-plain-language.cjs so both the card body and its buttons
    // read from one place.
    assert.match(routes, /plainLanguage\.accessNote\(catalogAccessReason\(item\)\)/);
    assert.match(routes, /productCatalogItems/);
    assert.match(server, /const timeoutMs = process\.env\.NODE_ENV === "test" \? 100 : 1200/);
    assert.match(server, /const controller = new AbortController\(\)/);
    assert.match(server, /signal: controller\.signal/);
    assert.match(server, /clearTimeout\(timeout\)/);
  });

  it("verifies exact production rows, configured plans, pages, and fail-closed entitlement source", () => {
    const verifier = read("scripts/verify-production-product-catalog.mjs");
    assert.match(verifier, /rows\.length, 34/);
    assert.match(verifier, /sonara_industries: 10/);
    assert.match(verifier, /business_builder: 8/);
    assert.match(verifier, /creator_studio: 8/);
    assert.match(verifier, /growth_studio: 8/);
    assert.match(verifier, /billing_entitlements/);
    assert.match(verifier, /billing_subscriptions/);
    assert.match(verifier, /positiveSubscribedUserTest: "pending"/);
    assert.match(verifier, /paid execution remains restricted until positive production entitlement verification/);
    assert.match(verifier, /Production catalog page is missing/);
    assert.match(verifier, /starter_monthly/);
    assert.match(verifier, /core_monthly/);
    assert.match(verifier, /pro_monthly/);
  });

  it("runs database proof before deployment and page proof after deployment without retaining production env material", () => {
    const workflow = read(".github/workflows/controlled-production-deploy.yml");
    const applyIndex = workflow.indexOf("Apply production database migrations");
    const databaseProofIndex = workflow.indexOf("Verify production catalog database boundary");
    const cleanupIndex = workflow.indexOf("Remove temporary production environment material");
    const deployIndex = workflow.indexOf("Deploy validated source to Vercel production");
    const pageProofIndex = workflow.indexOf("Verify production catalog pages and configured plan infrastructure");
    assert.ok(applyIndex >= 0 && applyIndex < databaseProofIndex);
    assert.ok(databaseProofIndex < cleanupIndex && cleanupIndex < deployIndex);
    assert.ok(deployIndex < pageProofIndex);
    assert.match(workflow, /vercel@latest env pull \.env\.production\.catalog-verification/);
    assert.match(workflow, /node --env-file=\.env\.production\.catalog-verification scripts\/verify-production-product-catalog\.mjs --database-only/);
    assert.match(workflow, /rm -f \.env\.production\.catalog-verification/);
    assert.match(workflow, /test ! -e \.env\.production\.catalog-verification/);
    assert.match(workflow, /EXPECTED_COMMIT_SHA="\$GITHUB_SHA"/);
    assert.match(workflow, /verify-production-product-catalog\.mjs --pages-only/);
  });
});
