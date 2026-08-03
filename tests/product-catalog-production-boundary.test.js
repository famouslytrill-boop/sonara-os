"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  EXECUTABLE_LIFECYCLE_STATUSES,
  RECOMMENDED_PRODUCT_CATALOG,
  getRecommendedProductCatalogSummary
} = require("../lib/sonara-recommended-product-catalog.cjs");
const { CATALOG_BOUNDARY_TEXT } = require("../lib/sonara-plain-language.cjs");
const { hasEnforcedPaidAccess } = require("../lib/sonara-paid-access.cjs");
const { catalogItemToRow, catalogRowBoundaryViolations } = require("../lib/sonara-catalog-boundary.cjs");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Recommended product catalog production boundary", () => {
  // This used to assert that EVERY paid product stayed unverified and
  // non-executable. It passed because the catalog defined "paid access is
  // verified" as `planFloor === "free"` -- so the assertion was true by
  // construction and could never have failed. Thirty-one of thirty-four
  // products were shut to paying customers, permanently, and the check
  // confirmed it rather than questioning it.
  //
  // The boundary is still real, it is just no longer a tautology: a paid
  // product may execute only where the server enforces an entitlement for its
  // product family. Where it does not, the product stays shut.
  it("opens paid products only where the server actually enforces an entitlement", () => {
    const paid = RECOMMENDED_PRODUCT_CATALOG.filter((item) => item.planFloor !== "free");
    assert.ok(paid.length > 0);
    for (const item of paid) {
      assert.equal(
        item.entitlementIntegrationVerified,
        hasEnforcedPaidAccess(item.productKey),
        `${item.serviceKey} claims a different paid-access state than ${item.productKey} actually enforces`
      );
      if (!hasEnforcedPaidAccess(item.productKey)) {
        assert.equal(item.executionEnabled, false, `${item.serviceKey} has no enforced entitlement and must stay shut`);
      }
      assert.match(item.priceNote, /^Included in (Starter and above|Core and above|Pro)\.$/);
    }
    const summary = getRecommendedProductCatalogSummary();
    assert.equal(summary.total, 34);
    // sonara_industries has no entitlement mapping, so its paid entries are the
    // ones still awaiting one. If that ever reaches zero it should be because a
    // mapping was added, not because the question stopped being asked.
    assert.ok(summary.entitlementVerificationRequired > 0, "no paid product is awaiting entitlement work; check this is deliberate");
    const unmapped = paid.filter((item) => !hasEnforcedPaidAccess(item.productKey));
    assert.equal(summary.entitlementVerificationRequired, unmapped.length);
    assert.deepEqual([...new Set(unmapped.map((item) => item.productKey))], ["sonara_industries"]);
  });

  // The production gate asserts a boundary against the live database. Nothing
  // here could run it, so nothing here could notice when the gate's rule and the
  // catalog's rule stopped agreeing -- and they did. The gate required every
  // paid row to be unverified, forty lines after requiring every row to match
  // the catalog field for field; once the catalog marked thirteen paid products
  // verified, one assertion wanted true and the other wanted false for the same
  // rows. The gate could not pass. The first thing able to say so was a
  // production deploy, by which point the migration had applied and the deploy
  // step was skipped.
  //
  // The rule now lives in lib/sonara-catalog-boundary.cjs and this runs it
  // against the catalog projected into the row shape the sync migration writes
  // -- which is exactly what the next deploy will put in the database. If the
  // gate cannot pass, it cannot pass here either, before the push.
  it("ships a catalog the production gate can actually pass", () => {
    const rows = RECOMMENDED_PRODUCT_CATALOG.map(catalogItemToRow);
    const violations = catalogRowBoundaryViolations(rows);
    assert.deepEqual(
      violations,
      [],
      `The catalog this repository ships would be rejected by the production deploy gate:\n  ${violations.join("\n  ")}`
    );

    // And the gate has to be reading this rule rather than keeping its own copy,
    // which is how the two came apart in the first place.
    const verifier = read("scripts/verify-production-product-catalog.mjs");
    assert.match(verifier, /catalogRowBoundaryViolations/, "the production gate no longer shares the boundary rule");
  });

  it("never enables planned, validation-required, or setup-required products", () => {
    const restricted = RECOMMENDED_PRODUCT_CATALOG.filter((item) => ["planned", "validation_required", "setup_required"].includes(item.lifecycleStatus));
    assert.ok(restricted.length > 0);
    for (const item of restricted) assert.equal(item.executionEnabled, false, `${item.serviceKey} cannot execute`);
  });

  it("enables only active or beta entries that are free or have enforced paid access", () => {
    const enabled = RECOMMENDED_PRODUCT_CATALOG.filter((item) => item.executionEnabled);
    assert.ok(enabled.length > 0);
    for (const item of enabled) {
      assert.equal(item.entitlementIntegrationVerified, true, `${item.serviceKey} executes without verified access`);
      assert.ok(
        item.planFloor === "free" || hasEnforcedPaidAccess(item.productKey),
        `${item.serviceKey} executes on a paid plan with no entitlement the server enforces`
      );
      assert.ok(
        EXECUTABLE_LIFECYCLE_STATUSES.includes(item.lifecycleStatus),
        `${item.serviceKey} executes while still ${item.lifecycleStatus}`
      );
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
    // The old wording said paid execution "remains restricted until positive
    // production entitlement verification", which the deploy printed on every
    // release. It described a wait that could not end, because verification was
    // defined as being free.
    assert.match(verifier, /paid execution is open only where the server enforces an entitlement for the product/);
    assert.match(verifier, /Production catalog page is missing/);
    assert.match(verifier, /starter_monthly/);
    assert.match(verifier, /core_monthly/);
    assert.match(verifier, /pro_monthly/);
  });

  // The test above reads the verifier's text. That is not the same as checking
  // that the contract it asserts still holds, and the difference cost a
  // production deploy: moving getPaidEntitlementKeys into lib/sonara-billing.cjs
  // took three markers with it, the whole suite stayed green, and the deploy
  // failed at the post-deploy gate on code that was present and correct one
  // directory over.
  //
  // So resolve the markers here, against the same source the gate reads. The
  // list is parsed out of the verifier rather than copied, because a copy would
  // drift and then agree with itself.
  it("resolves every entitlement marker the production gate requires", () => {
    const verifier = read("scripts/verify-production-product-catalog.mjs");
    const block = verifier.slice(
      verifier.indexOf("function verifyEntitlementSourceContract()"),
      verifier.indexOf("Paid entitlement fail-closed contract is missing")
    );
    const markers = [...block.matchAll(/^\s*(["'])((?:(?!\1)[^\\]|\\.)+)\1,\s*$/gm)]
      .map((match) => match[2].replace(/\\(["'\\])/g, "$1"));
    assert.ok(markers.length >= 8, `only ${markers.length} markers parsed; the verifier's shape changed and this check has gone blind`);

    const runtimeFiles = [path.join(root, "server.js")];
    for (const dir of ["lib", "routes"]) {
      const walk = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(cjs|js|mjs)$/.test(entry.name)) runtimeFiles.push(full);
        }
      };
      walk(path.join(root, dir));
    }
    const runtime = runtimeFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

    const missing = markers.filter((marker) => !runtime.includes(marker));
    assert.deepEqual(
      missing,
      [],
      `The production deploy gate requires these strings in the shipped runtime, and none of them is there:\n  ${missing.join("\n  ")}\n\n` +
        "If code moved, it is still shipped and this is fine -- but the gate reads server.js plus lib/ and routes/, so anything outside that is invisible to it."
    );
  });

  // The other half of the same deploy failure, and the more serious half.
  //
  // The gate required five literal strings on the live catalog page, among them
  // "execution: restricted until lifecycle evidence and launch approval are
  // complete". That is exactly the vocabulary the plain-language work took off
  // every customer-facing screen, and that AGENTS.md forbids putting back. So
  // the gate demanded copy the codebase is not allowed to have, and failed on a
  // page that states the boundary perfectly well in words a customer can read.
  //
  // Nothing about paid access was actually unguarded. But a gate that can only
  // pass by reintroducing retired wording is worse than no gate: the tempting
  // fix is to delete it.
  it("states the access boundary on the rendered catalog page", async function renderCatalog() {
    this.timeout(30000);
    const request = require("supertest");
    const app = require("../server");
    const response = await request(app).get("/service-catalog").set("accept", "text/html");
    assert.equal(response.status, 200);

    const visible = String(response.text)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .toLowerCase()
      .replace(/\s+/g, " ");

    const missing = CATALOG_BOUNDARY_TEXT.filter((text) => !visible.includes(text.toLowerCase().replace(/\s+/g, " ")));
    assert.deepEqual(
      missing,
      [],
      `The catalog page no longer tells a customer why a product is closed, or how to ask:\n  ${missing.join("\n  ")}\n\n` +
        "If the wording changed, change it in lib/sonara-plain-language.cjs -- the production gate reads the same list."
    );
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
