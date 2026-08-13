import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  CATALOG_VERSION,
  RECOMMENDED_PRODUCT_CATALOG,
  getRecommendedProductCatalogSummary
} = require("../lib/sonara-recommended-product-catalog.cjs");
const { CATALOG_BOUNDARY_TEXT } = require("../lib/sonara-plain-language.cjs");
const { RESTRICTED_LIFECYCLE_STATUSES, catalogRowBoundaryViolations } = require("../lib/sonara-catalog-boundary.cjs");
const { PAID_ACCESS_RUNTIME_MARKERS } = require("../lib/sonara-paid-access.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const databaseOnly = args.has("--database-only");
const pagesOnly = args.has("--pages-only");
assert.ok(!(databaseOnly && pagesOnly), "Choose at most one verification mode");

const result = {
  catalogVersion: CATALOG_VERSION,
  expectedRecords: RECOMMENDED_PRODUCT_CATALOG.length,
  database: null,
  pages: null,
  entitlementBoundary: null
};

if (!pagesOnly) result.database = await verifyProductionDatabase();
result.entitlementBoundary = verifyEntitlementSourceContract();
if (!databaseOnly) result.pages = await verifyProductionPages();

console.log(JSON.stringify({ ok: true, ...result }, null, 2));

async function verifyProductionDatabase() {
  const supabaseUrl = firstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = firstEnv("SUPABASE_SERVICE_ROLE_KEY");
  assert.match(supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co$/i, "A valid production SUPABASE_URL is required");
  assert.ok(serviceRoleKey.length >= 20, "SUPABASE_SERVICE_ROLE_KEY is required for production catalog verification");

  const url = new URL(`${supabaseUrl}/rest/v1/service_catalog_items`);
  url.searchParams.set("select", "service_key,product_key,name,product_type,plan_floor,lifecycle_status,route_path,entitlement_integration_verified,execution_enabled,metadata,status,sort_order");
  url.searchParams.set("service_key", "not.is.null");
  url.searchParams.set("product_type", "eq.software_product");
  // Published rows only. Retiring a product sets status to 'retired' rather
  // than deleting the row, because /service-catalog filters on active and the
  // history is worth keeping -- so without this filter the gate reads rows the
  // catalog deliberately stopped listing and fails on every one of them.
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("order", "sort_order.asc");
  url.searchParams.set("limit", "100");

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json"
    }
  });
  const responseText = await response.text();
  assert.equal(response.ok, true, `Production catalog query failed with HTTP ${response.status}: ${safeDiagnostic(responseText)}`);
  const rows = JSON.parse(responseText);
  assert.ok(Array.isArray(rows), "Production catalog response must be an array");
  // Was the literal 34, in four places across this file, the boundary
  // migration and two test files. The number is not something this gate knows
  // independently -- it is however many products the shipped catalog lists --
  // so removing eleven products failed five checks that were only ever
  // repeating each other. The count comes from the catalog now, and the
  // guard below is the part that has to be a number.
  const expectedTotal = RECOMMENDED_PRODUCT_CATALOG.length;
  assert.ok(expectedTotal >= 20, `The shipped catalog is down to ${expectedTotal} products; this gate will not vouch for that without a look`);
  assert.equal(rows.length, expectedTotal, `Production service_catalog_items must contain exactly ${expectedTotal} published software product records; found ${rows.length}`);

  const expectedByKey = new Map(RECOMMENDED_PRODUCT_CATALOG.map((item) => [item.serviceKey, item]));
  const actualByKey = new Map();
  for (const row of rows) {
    assert.ok(row.service_key, "Every software product record must have service_key");
    assert.equal(actualByKey.has(row.service_key), false, `Duplicate production service_key: ${row.service_key}`);
    actualByKey.set(row.service_key, row);
    assert.equal(row.metadata?.catalogVersion, CATALOG_VERSION, `${row.service_key} has the wrong catalogVersion`);
    assert.equal(row.status, "active", `${row.service_key} must remain published through status=active while lifecycle_status carries delivery maturity`);
  }

  for (const [serviceKey, expected] of expectedByKey) {
    const actual = actualByKey.get(serviceKey);
    assert.ok(actual, `Production catalog is missing ${serviceKey}`);
    assert.equal(actual.product_key, expected.productKey, `${serviceKey} product_key mismatch`);
    assert.equal(actual.name, expected.name, `${serviceKey} name mismatch`);
    assert.equal(actual.product_type, "software_product", `${serviceKey} product_type mismatch`);
    assert.equal(actual.plan_floor, expected.planFloor, `${serviceKey} plan_floor mismatch`);
    assert.equal(actual.lifecycle_status, expected.lifecycleStatus, `${serviceKey} lifecycle_status mismatch`);
    assert.equal(actual.route_path, expected.route, `${serviceKey} route_path mismatch`);
    assert.equal(actual.entitlement_integration_verified, expected.entitlementIntegrationVerified, `${serviceKey} entitlement verification mismatch`);
    assert.equal(actual.execution_enabled, expected.executionEnabled, `${serviceKey} execution boundary mismatch`);
  }

  const companyCounts = countBy(rows, "product_key");
  assert.deepEqual(companyCounts, countBy(RECOMMENDED_PRODUCT_CATALOG.map((item) => ({ product_key: item.productKey })), "product_key"));
  assert.ok(Object.keys(companyCounts).length === 4, `Production catalog covers ${Object.keys(companyCounts).length} product families, not four`);

  // This required the production catalog to always hold a restricted product,
  // which reads as a boundary check and is really a requirement that some
  // product stay unfinished. Every remaining product is now either active or
  // beta, and that is the outcome the restriction was tracking towards. What
  // still has to hold is that a restricted row, if one exists, cannot execute
  // -- checked against every row below rather than against a filtered list
  // that may be empty.
  for (const row of rows) {
    if (RESTRICTED_LIFECYCLE_STATUSES.includes(row.lifecycle_status)) {
      assert.equal(row.execution_enabled, false, `${row.service_key} is ${row.lifecycle_status} in production and has execution enabled`);
    }
  }

  const paidRows = rows.filter((row) => row.plan_floor !== "free");
  assert.ok(paidRows.length > 0, "The production catalog must contain paid-plan products");

  // One rule, shared with lib/sonara-catalog-boundary.cjs, so this gate cannot
  // hold a boundary the catalog has stopped holding. It did: this line used to
  // require every paid row to be unverified, forty lines after requiring every
  // row to match the catalog exactly, and the catalog now marks thirteen paid
  // products verified. Both could not be true, and a production deploy was the
  // first thing able to say so.
  const violations = catalogRowBoundaryViolations(rows);
  assert.deepEqual(
    violations,
    [],
    `The production catalog crosses the paid-access boundary:\n  ${violations.join("\n  ")}\n\n` +
      "A paid product may execute only where the server enforces an entitlement for its product family."
  );

  const enabledRows = rows.filter((row) => row.execution_enabled);

  return {
    records: rows.length,
    companyCounts,
    lifecycleCounts: countBy(rows, "lifecycle_status"),
    planFloorCounts: countBy(rows, "plan_floor"),
    executionEnabled: enabledRows.length,
    executionRestricted: rows.length - enabledRows.length,
    paidEntitlementVerificationPending: paidRows.filter((row) => row.entitlement_integration_verified !== true).length
  };
}

// The runtime that Vercel actually serves, which is what this contract is about.
//
// This used to read server.js alone. That was accurate while server.js was the
// whole application, and stopped being accurate the moment the split started
// moving code into lib/ -- getPaidEntitlementKeys went to lib/sonara-billing.cjs
// and three markers went with it, so a deploy gate failed on code that was
// present and correct, one directory over.
//
// The markers are unchanged and every one is still required. Only where they may
// live has widened, to the same set vercel.json bundles.
function runtimeSource() {
  const files = [path.join(root, "server.js")];
  for (const dir of ["lib", "routes"]) {
    const base = path.join(root, dir);
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(cjs|js|mjs)$/.test(entry.name)) files.push(full);
      }
    };
    if (fs.existsSync(base)) walk(base);
  }
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

function verifyEntitlementSourceContract() {
  const server = runtimeSource();
  // The two entry points, plus the query and mapping markers shared with
  // lib/sonara-paid-access.cjs. They were all literals here, which meant this
  // file held a second copy of PAID_ENTITLEMENT_KEYS and had to be edited by
  // hand whenever the owner changed what a plan buys.
  assert.ok(PAID_ACCESS_RUNTIME_MARKERS.length >= 6, `only ${PAID_ACCESS_RUNTIME_MARKERS.length} paid-access markers; the shared list has gone empty`);
  for (const marker of [
    "function requirePaidOrOwnerAccess(productKey)",
    "async function getCustomerPaidEntitlement(user, productKey)",
    ...PAID_ACCESS_RUNTIME_MARKERS
  ]) assert.ok(server.includes(marker), `Paid entitlement fail-closed contract is missing from the deployed runtime: ${marker}`);

  const summary = getRecommendedProductCatalogSummary();
  assert.equal(summary.total, RECOMMENDED_PRODUCT_CATALOG.length);
  // Was `> 0`: at least one paid product must still be waiting on entitlement
  // work. That is true while a paid product belongs to a family the server
  // enforces nothing for, and it is now zero on purpose -- the platform
  // products that were priced without an entitlement behind them were repriced
  // to free. The rule underneath it is what this checks: a product waiting on
  // entitlement work must not be running.
  assert.equal(
    summary.entitlementVerificationRequired,
    RECOMMENDED_PRODUCT_CATALOG.filter((item) => item.planFloor !== "free" && !item.entitlementIntegrationVerified).length
  );
  for (const item of RECOMMENDED_PRODUCT_CATALOG) {
    if (item.planFloor !== "free" && !item.entitlementIntegrationVerified) {
      assert.equal(item.executionEnabled, false, `${item.serviceKey} is paid, unverified, and executing`);
    }
  }

  return {
    serverEnforcement: "verified",
    // Still true, and still worth reporting: nobody has completed a paid
    // signup in production and confirmed the entitlement carried through end to
    // end. What changed is that the catalog no longer treats that as a reason
    // to shut every paid product, which it did by defining verified access as
    // free access.
    positiveSubscribedUserTest: "pending",
    advertisingBoundary: "paid execution is open only where the server enforces an entitlement for the product; products with no entitlement mapping stay restricted"
  };
}

async function verifyProductionPages() {
  const baseUrl = firstEnv("PRODUCTION_BASE_URL", "APEX_URL", "PUBLIC_SITE_URL", "NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  assert.match(baseUrl, /^https:\/\//, "PRODUCTION_BASE_URL is required for production page verification");

  const health = await fetchJson(`${baseUrl}/api/health`);
  assert.equal(health.ok, true, "Production health must report ok=true");
  assert.equal(health.deployment?.branch, "main", "Production must report branch=main");
  const expectedCommit = String(process.env.EXPECTED_COMMIT_SHA || "").trim();
  if (expectedCommit) assert.equal(health.deployment?.commitSha, expectedCommit, "Production deployment commit does not match the verified main commit");

  const readiness = await fetchJson(`${baseUrl}/api/readiness`);
  assert.equal(readiness.services?.supabase, "configured", "Production Supabase must be configured");
  assert.equal(readiness.services?.stripe, "configured", "Production Stripe must be configured");
  assert.equal(readiness.services?.stripeWebhook, "configured", "Production Stripe webhook must be configured");
  assert.equal(readiness.services?.checkout, "enabled", "Production checkout must be enabled");
  for (const plan of ["starter_monthly", "core_monthly", "pro_monthly"]) {
    assert.equal(readiness.checkoutPlans?.[plan]?.checkout, "enabled", `${plan} checkout must be configured`);
  }
  // The setup package is quoted rather than sold self-serve -- it is
  // done-for-you work whose scope varies, and it previously carried a Stripe
  // price while the page advertised no amount. Asserting the state rather than
  // dropping the plan, so it cannot drift back into checkout unnoticed.
  assert.equal(
    readiness.checkoutPlans?.business_builder_one_time?.checkout,
    "quoted",
    "the Business Builder setup package must stay quoted, not sold through checkout"
  );

  const catalogResponse = await fetch(`${baseUrl}/service-catalog`, { headers: { Accept: "text/html" } });
  const html = await catalogResponse.text();
  assert.equal(catalogResponse.status, 200, `Production service catalog returned HTTP ${catalogResponse.status}`);
  const visibleText = normalizeHtmlText(html);

  for (const product of RECOMMENDED_PRODUCT_CATALOG) {
    assert.ok(visibleText.includes(normalizeText(product.name)), `Production catalog page is missing ${product.name}`);
  }

  for (const forbiddenFallback of [
    "no custom catalog is published yet",
    "the service_catalog_items catalog isn't connected yet",
    "the standard services are shown"
  ]) assert.equal(visibleText.includes(forbiddenFallback), false, `Production catalog is using fallback content: ${forbiddenFallback}`);

  // The catalog page must still tell a customer, in the open, that a governed
  // product is not available and why -- and still offer them a way to ask.
  //
  // These used to be five literal strings: "execution: restricted until
  // lifecycle evidence and launch approval are complete" and four like it. That
  // is the vocabulary the plain-language work removed from every customer-facing
  // screen, so this gate was requiring copy that AGENTS.md forbids putting back.
  // It failed on a page that states the boundary perfectly well, in words a
  // customer can read.
  //
  // The list now lives in lib/sonara-plain-language.cjs, read by this gate and
  // by tests/product-catalog-production-boundary.test.js, so the gate follows
  // the vocabulary instead of pinning it and the two cannot disagree.
  for (const requiredBoundary of CATALOG_BOUNDARY_TEXT) {
    const needle = normalizeText(requiredBoundary);
    assert.ok(visibleText.includes(needle), `Production catalog is missing boundary text: ${needle}`);
  }

  return {
    baseUrl,
    deploymentCommit: health.deployment?.commitSha,
    catalogStatus: catalogResponse.status,
    productsVisible: RECOMMENDED_PRODUCT_CATALOG.length,
    readiness: {
      supabase: readiness.services?.supabase,
      stripe: readiness.services?.stripe,
      stripeWebhook: readiness.services?.stripeWebhook,
      checkout: readiness.services?.checkout
    }
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await response.text();
  assert.equal(response.ok, true, `${url} returned HTTP ${response.status}: ${safeDiagnostic(body)}`);
  return JSON.parse(body);
}

function firstEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function countBy(rows, key) {
  return Object.fromEntries(Object.entries(rows.reduce((counts, row) => {
    const value = String(row[key] || "unknown");
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {})).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeHtmlText(html) {
  return normalizeText(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">"));
}

function normalizeText(value) {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function safeDiagnostic(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").slice(0, 300);
}
