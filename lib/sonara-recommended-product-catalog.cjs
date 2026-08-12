"use strict";

const parentProducts = require("./catalog/sonara-industries-products.cjs");
const businessProducts = require("./catalog/business-builder-products.cjs");
const creatorProducts = require("./catalog/creator-studio-products.cjs");
const growthProducts = require("./catalog/growth-studio-products.cjs");
const { planFloorOpensProduct } = require("./sonara-paid-access.cjs");

const CATALOG_VERSION = "2026-07-25";
const ALLOWED_PRODUCT_KEYS = Object.freeze(["sonara_industries", "business_builder", "creator_studio", "growth_studio"]);
const ALLOWED_PLAN_FLOORS = Object.freeze(["free", "starter", "core", "pro"]);
const ALLOWED_LIFECYCLE_STATUSES = Object.freeze(["active", "beta", "validation_required", "planned", "setup_required"]);
const EXECUTABLE_LIFECYCLE_STATUSES = Object.freeze(["active", "beta"]);
// Price, and nothing else. Availability and the plan are said elsewhere on the
// card; when these notes repeated them, every card ended with the same sentence
// twice.
const PRICE_NOTES = Object.freeze({
  free: "No charge.",
  starter: "Included in Starter and above.",
  core: "Included in Core and above.",
  pro: "Included in Pro."
});

function expand(productKey, row) {
  const [serviceKey, name, category, summary, customerOutcome, planFloor, lifecycleStatus, route, capabilities, dependencies, safetyBoundary] = row;
  // "Paid access is verified" used to be written as `planFloor === "free"`,
  // which defines verified as free and left every paid product permanently
  // restricted -- thirty-one of thirty-four, by construction rather than by any
  // pending check. A customer could pay and reach none of it.
  //
  // Then it asked whether the product's family enforces any entitlement at
  // all -- `planFloor === "free" || hasEnforcedPaidAccess(productKey)` -- which
  // is a better question and still not the one the customer is asking. Creator
  // Studio enforces core_monthly and pro_monthly; three of its products
  // advertised Starter. Growth Studio enforces pro_monthly alone; four of its
  // products advertised Starter or Core. All seven reported verified access,
  // and all seven would have answered a customer who bought the advertised plan
  // with a 402.
  //
  // It now asks whether the plan this product is sold on is a plan that opens
  // it. lib/sonara-paid-access.cjs holds the one list, shared with the billing
  // code that does the enforcing, so the catalog and the gate cannot disagree
  // about the price.
  //
  // Whether a given customer holds the plan is a per-request question and is not
  // answered here; getCustomerPaidEntitlement answers it against the session.
  // This flag says the gate exists and would let the advertised plan through,
  // not that anybody is through it.
  const entitlementIntegrationVerified = planFloorOpensProduct(productKey, planFloor);
  const executionEnabled = EXECUTABLE_LIFECYCLE_STATUSES.includes(lifecycleStatus) && entitlementIntegrationVerified;
  return {
    productKey,
    serviceKey,
    name,
    category,
    summary,
    customerOutcome,
    planFloor,
    lifecycleStatus,
    route,
    capabilities: capabilities.split("|"),
    dependencies: dependencies.split("|"),
    safetyBoundary,
    tier: planFloor === "free" ? "free" : "paid",
    entitlementIntegrationVerified,
    executionEnabled,
    deliverableType: "A set of tools plus a step-by-step way of working",
    priceNote: PRICE_NOTES[planFloor]
  };
}

const RECOMMENDED_PRODUCT_CATALOG = Object.freeze([
  ...parentProducts.map((row) => expand("sonara_industries", row)),
  ...businessProducts.map((row) => expand("business_builder", row)),
  ...creatorProducts.map((row) => expand("creator_studio", row)),
  ...growthProducts.map((row) => expand("growth_studio", row))
].map((item, index) => Object.freeze({ ...item, sortOrder: (index + 1) * 10 })));

function getRecommendedProductCatalog(filters = {}) {
  const rows = RECOMMENDED_PRODUCT_CATALOG.filter((item) =>
    (!filters.productKey || item.productKey === String(filters.productKey)) &&
    (!filters.lifecycleStatus || item.lifecycleStatus === String(filters.lifecycleStatus)) &&
    (!filters.planFloor || item.planFloor === String(filters.planFloor))
  );
  return JSON.parse(JSON.stringify(rows));
}

function getRecommendedProductCatalogSummary() {
  const byCompany = {};
  const byLifecycleStatus = {};
  const byPlanFloor = {};
  let executionEnabled = 0;
  let entitlementVerificationRequired = 0;
  for (const item of RECOMMENDED_PRODUCT_CATALOG) {
    byCompany[item.productKey] = (byCompany[item.productKey] || 0) + 1;
    byLifecycleStatus[item.lifecycleStatus] = (byLifecycleStatus[item.lifecycleStatus] || 0) + 1;
    byPlanFloor[item.planFloor] = (byPlanFloor[item.planFloor] || 0) + 1;
    if (item.executionEnabled) executionEnabled += 1;
    if (item.planFloor !== "free" && !item.entitlementIntegrationVerified) entitlementVerificationRequired += 1;
  }
  return {
    version: CATALOG_VERSION,
    total: RECOMMENDED_PRODUCT_CATALOG.length,
    executionEnabled,
    executionRestricted: RECOMMENDED_PRODUCT_CATALOG.length - executionEnabled,
    entitlementVerificationRequired,
    byCompany,
    byLifecycleStatus,
    byPlanFloor
  };
}

module.exports = {
  CATALOG_VERSION,
  ALLOWED_PRODUCT_KEYS,
  ALLOWED_PLAN_FLOORS,
  ALLOWED_LIFECYCLE_STATUSES,
  EXECUTABLE_LIFECYCLE_STATUSES,
  RECOMMENDED_PRODUCT_CATALOG,
  getRecommendedProductCatalog,
  getRecommendedProductCatalogSummary
};
