// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A read-only, business-scoped operating overview. The route supplies data only
// after membership, organization and business.read authorization. This module
// does not read storage, mutate settings, run workflows or assert live readiness.
const { INDUSTRY_PACKS, validateWorkflow } = require("./sonara-workflow-planner.cjs");

const RECORDS = Object.freeze([
  ["services", "Offers and services"],
  ["customers", "Customers"],
  ["orders", "Orders and sales"],
  ["bookings", "Bookings"],
  ["employees", "Team"],
  ["inventory", "Inventory"],
  ["locations", "Locations"]
]);

const INDUSTRY_NAMES = Object.freeze({
  restaurant: "Restaurants", food_truck: "Food trucks", trades: "Trades",
  trucking: "Trucking", cleaning: "Cleaning", retail: "Retail",
  rentals: "Rentals", venues: "Venues", manufacturing: "Manufacturing",
  real_estate: "Real estate", professional_services: "Professional services",
  delivery: "Delivery", salon: "Salons", ecommerce: "Online stores",
  nonprofit: "Nonprofits", construction: "Construction", facilities: "Facilities"
});

const INDUSTRIES = Object.freeze(INDUSTRY_PACKS.map((pack) => Object.freeze({
  key: pack.industry,
  label: INDUSTRY_NAMES[pack.industry] || pack.industry
})));

function industryKey(value) {
  if (typeof value !== "string" || value.length > 100) return null;
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, "_");
  return Object.prototype.hasOwnProperty.call(INDUSTRY_NAMES, normalized) ? normalized : null;
}

function makeOverview({ business, organizationId, userId, snapshot, selectedIndustry } = {}) {
  if (!business?.id || !organizationId || business.organization_id !== organizationId) {
    return { ok: false, code: "business_scope_unverified" };
  }
  // No profile data or role asserted by the browser can grant ownership.
  const isOwner = Boolean(userId && business.owner_user_id === userId);
  const explicitIndustry = selectedIndustry !== undefined;
  const selected = explicitIndustry ? industryKey(selectedIndustry)
    : industryKey(business.industry) || industryKey(business.business_type);
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const counts = source.counts || {};
  const readable = source.readable || {};
  const truncated = source.truncated || {};
  const records = RECORDS.map(([key, label]) => {
    const count = counts[key];
    const validCount = Number.isSafeInteger(count) && count >= 0;
    const available = readable[key] === true && validCount;
    const partial = available && truncated[key] === true;
    return Object.freeze({
      key, label,
      state: !available ? "unavailable" : partial ? "partial" : "readable",
      count: available ? count : null,
      lowerBound: partial,
      note: !available ? "These records could not be confirmed."
        : partial ? "More records may exist than this page shows."
          : "Source records were readable at the time of this check."
    });
  });
  const incomplete = records.filter((record) => record.state !== "readable");
  const industryPlans = selected ? INDUSTRY_PACKS.filter((pack) => pack.industry === selected).map((pack) => {
    const validated = validateWorkflow(pack);
    return Object.freeze({
      key: pack.key, name: pack.name, industry: pack.industry,
      status: "template_only", trigger: pack.trigger,
      requiredRecords: pack.requiredRecords.slice(),
      approvalRequired: !validated.ok || validated.workflow.approvalRequired,
      steps: validated.ok ? validated.workflow.steps.length : 0,
      disclosure: pack.disclosure,
      externalActionsExecuted: false
    });
  }) : [];
  const id = encodeURIComponent(business.id);
  return {
    ok: true,
    businessId: business.id,
    organizationId,
    industry: {
      selected: selected || null,
      selectionValid: !explicitIndustry || Boolean(selected),
      savedToBusinessProfile: !explicitIndustry,
      choices: INDUSTRIES
    },
    permission: {
      canReadBusiness: true,
      isBusinessOwner: isOwner,
      canEditProfile: isOwner,
      canManagePermissions: isOwner
    },
    metrics: records,
    checks: {
      status: incomplete.length ? "incomplete" : "sources_readable",
      confirmedSources: records.length - incomplete.length,
      totalSources: records.length,
      unavailableSources: records.filter((r) => r.state === "unavailable").map((r) => r.key),
      partialSources: records.filter((r) => r.state === "partial").map((r) => r.key),
      note: "These are source-read checks, not full-suite CI results or live provider tests."
    },
    industryPlans,
    execution: {
      status: "not_activated_by_preview",
      userApprovalRequiredForSensitiveActions: true,
      providerActivityPerformed: false,
      workflowRunsStarted: 0
    },
    destinations: {
      business: `/business-builder/businesses/${id}`,
      customers: `/business-builder/businesses/${id}/manage/customers`,
      bookings: `/business-builder/businesses/${id}/manage/bookings`,
      settings: isOwner ? `/business-builder/businesses/${id}` : null,
      permissions: isOwner ? `/business-builder/businesses/${id}/manage/permissions` : null
    }
  };
}

module.exports = { INDUSTRIES, RECORDS, industryKey, makeOverview };
