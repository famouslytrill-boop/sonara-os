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
    assert.equal(summary.total, RECOMMENDED_PRODUCT_CATALOG.length);
    // Was `summary.total === 34`, and the number was repeated in five places.
    // Removing eleven products that pointed at pages which did not do what
    // they said failed all five, none of which was measuring anything the
    // number could be wrong about. The count that matters is the one below.
    assert.ok(summary.total >= 20, `only ${summary.total} products in the catalog; check this is deliberate`);

    // sonara_industries has no entitlement mapping, so any paid entry of its
    // own is one that cannot open. There are none left -- the platform entries
    // were repriced to free rather than left describing a plan that bought
    // nothing -- so this now asserts that state rather than a positive count.
    // It was `> 0`, which is the right guard while such products exist and the
    // wrong one once the answer is deliberately zero.
    const unmapped = paid.filter((item) => !hasEnforcedPaidAccess(item.productKey));
    assert.equal(summary.entitlementVerificationRequired, unmapped.length);
    assert.deepEqual(
      [...new Set(unmapped.map((item) => item.productKey))],
      [],
      "a paid product belongs to a family the server enforces no entitlement for; either map it in lib/sonara-paid-access.cjs or price it free"
    );
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

  // The `restricted.length > 0` guard here was the right instinct -- a loop
  // over an empty list proves nothing -- and it failed honestly when the last
  // validation_required product was either fixed or removed. Asserting the
  // catalog still ships a restricted product would be asserting the catalog
  // stays incomplete, so the non-vacuity moved to where it belongs: the rule
  // is checked against a product built to break it.
  it("never enables planned, validation-required, or setup-required products", () => {
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      if (["planned", "validation_required", "setup_required"].includes(item.lifecycleStatus)) {
        assert.equal(item.executionEnabled, false, `${item.serviceKey} cannot execute while ${item.lifecycleStatus}`);
      }
    }

    // And the rule refuses one, so a green result above is not just an empty
    // list. EXECUTABLE_LIFECYCLE_STATUSES is what the catalog builds
    // executionEnabled from, and it is the thing that would have to be widened
    // for a planned product to run.
    for (const status of ["planned", "validation_required", "setup_required"]) {
      assert.ok(
        !EXECUTABLE_LIFECYCLE_STATUSES.includes(status),
        `${status} has been added to EXECUTABLE_LIFECYCLE_STATUSES, so an unfinished product can now execute`
      );
    }
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
    // The row total and the four per-company counts were asserted here as
    // literals, which meant this test held a third copy of a number already
    // written in the gate and the catalog. tests/published-catalog-sync.test.js
    // now checks the gate derives them instead.
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
  // This asserted the five boundary strings appear on the rendered page, and
  // for as long as some product was closed that was a real check. Then the
  // catalog was cut to the products that actually work and every survivor
  // became executable -- so no card had a reason to print any of it, and the
  // check failed on a page that was correct.
  //
  // Which is the same shape as the bug it was written to catch, one step
  // further on: a page-level assertion about copy that only appears in a state
  // the data no longer reaches. Relaxing it to "skip when nothing is closed"
  // would leave the wording unguarded, and the wording is what the production
  // gate reads.
  //
  // So it is asked of the code that decides it instead. Every closed reason
  // must still produce its sentence and its button, whether or not a shipped
  // product is currently in that state -- and if one is, the page must still
  // say so.
  it("still tells a customer why a product is closed, and how to ask", () => {
    const { catalogAccessReason, catalogRequestLabel } = require("../routes/sonara-service-lifecycle-routes.cjs");
    const plainLanguage = require("../lib/sonara-plain-language.cjs");

    const closed = [
      { serviceKey: "test-planned", lifecycleStatus: "planned", planFloor: "free", reason: "awaiting_review" },
      { serviceKey: "test-validation", lifecycleStatus: "validation_required", planFloor: "core", reason: "awaiting_review" },
      { serviceKey: "test-setup", lifecycleStatus: "setup_required", planFloor: "free", reason: "awaiting_review" },
      { serviceKey: "test-unmapped-paid", lifecycleStatus: "active", planFloor: "pro", entitlementIntegrationVerified: false, reason: "awaiting_paid_access" }
    ];
    for (const item of closed) {
      assert.equal(catalogAccessReason(item), item.reason, `${item.serviceKey} is no longer classified as closed`);
    }
    // And an open one, so this is not a classifier that says closed to anything.
    assert.equal(
      catalogAccessReason({ serviceKey: "test-open", lifecycleStatus: "active", planFloor: "free", entitlementIntegrationVerified: true, executionEnabled: true }),
      "open"
    );

    const produced = new Set();
    for (const reason of ["awaiting_review", "awaiting_paid_access"]) {
      produced.add(plainLanguage.accessNote(reason));
      produced.add(catalogRequestLabel(reason));
    }
    produced.add("See what is ready now");

    const missing = CATALOG_BOUNDARY_TEXT.filter((text) => ![...produced].some((value) => String(value).includes(text)));
    assert.deepEqual(
      missing,
      [],
      `Nothing in the catalog code produces this wording any more:\n  ${missing.join("\n  ")}\n\n` +
        "The production gate reads the same list from lib/sonara-plain-language.cjs, so the deploy fails on it too."
    );
  });

  // "See what is ready now" is a label in routes/sonara-service-lifecycle-routes.cjs
  // rather than a value returned by anything, so the set above takes it as a
  // literal. That is a copy, and a copy drifts. This is the part that notices.
  it("has not renamed the button the check above hard-codes", () => {
    const routes = read("routes/sonara-service-lifecycle-routes.cjs");
    assert.match(routes, /linkAction\("\/service-catalog", "See what is ready now"\)/);
  });

  // The page itself, for as long as it has anything to say it about. When the
  // shipped catalog closes nothing, this asserts that positively rather than
  // passing on an empty filter.
  it("prints the boundary on the page whenever a shipped product is closed", async function renderCatalog() {
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

    // The page has to have rendered the catalog at all, or everything below is
    // measuring an error page.
    assert.ok(visible.includes("one connected account"), "the catalog did not render, so nothing here was measured");

    const closed = RECOMMENDED_PRODUCT_CATALOG.filter((item) => item.executionEnabled !== true);
    if (closed.length === 0) {
      const summary = getRecommendedProductCatalogSummary();
      assert.equal(summary.executionRestricted, 0, "products are closed but the summary does not say so");
      return;
    }

    const missing = CATALOG_BOUNDARY_TEXT.filter((text) => !visible.includes(text.toLowerCase().replace(/\s+/g, " ")));
    assert.deepEqual(
      missing,
      [],
      `${closed.length} products are closed and the page does not say why:\n  ${missing.join("\n  ")}`
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
