"use strict";

const parentProducts = require("./catalog/sonara-industries-products.cjs");
const businessProducts = require("./catalog/business-builder-products.cjs");
const creatorProducts = require("./catalog/creator-studio-products.cjs");
const growthProducts = require("./catalog/growth-studio-products.cjs");

const CATALOG_VERSION = "2026-07-25";
const ALLOWED_PRODUCT_KEYS = Object.freeze(["sonara_industries", "business_builder", "creator_studio", "growth_studio"]);
const ALLOWED_PLAN_FLOORS = Object.freeze(["free", "starter", "core", "pro"]);
const ALLOWED_LIFECYCLE_STATUSES = Object.freeze(["active", "beta", "validation_required", "planned", "setup_required"]);
const PRICE_NOTES = Object.freeze({
  free: "Included in Free where available; account setup may still be required.",
  starter: "Starter plan floor; provider accounts or scoped setup may be required.",
  core: "Core plan floor; cost-bearing provider usage remains quota- or setup-gated.",
  pro: "Pro plan floor; advanced execution remains approval- and provider-gated."
});

function expand(productKey, row) {
  const [serviceKey, name, category, summary, customerOutcome, planFloor, lifecycleStatus, route, capabilities, dependencies, safetyBoundary] = row;
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
    deliverableType: "Software product suite and governed workflow",
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
  for (const item of RECOMMENDED_PRODUCT_CATALOG) {
    byCompany[item.productKey] = (byCompany[item.productKey] || 0) + 1;
    byLifecycleStatus[item.lifecycleStatus] = (byLifecycleStatus[item.lifecycleStatus] || 0) + 1;
    byPlanFloor[item.planFloor] = (byPlanFloor[item.planFloor] || 0) + 1;
  }
  return {
    version: CATALOG_VERSION,
    total: RECOMMENDED_PRODUCT_CATALOG.length,
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
  RECOMMENDED_PRODUCT_CATALOG,
  getRecommendedProductCatalog,
  getRecommendedProductCatalogSummary
};
