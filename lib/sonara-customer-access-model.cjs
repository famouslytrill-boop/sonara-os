// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { CAPABILITIES } = require("./sonara-paid-capabilities.cjs");

// Customer access is intentionally separate from the historical catalog floor.
//
// The database still carries free/starter/core/pro because those values are
// migration history and are used by existing release gates. Customers, however,
// buy the breadth ladder now: Free, One Workspace, All Three, or Team.
//
// Keeping this translation in one module lets us remove retired pricing language
// from the UI without rewriting authorization or silently changing anybody's
// existing access.
const CUSTOMER_ACCESS_BY_PLAN_FLOOR = Object.freeze({
  free: Object.freeze({
    accessClass: "free",
    workspaceScope: "none",
    label: "Free",
    monthlyEntitlement: null,
    annualEntitlement: null
  }),
  starter: Object.freeze({
    accessClass: "workspace",
    workspaceScope: "one",
    label: "One Workspace",
    monthlyEntitlement: "workspace_monthly",
    annualEntitlement: "workspace_annual"
  }),
  core: Object.freeze({
    accessClass: "workspace",
    workspaceScope: "all",
    label: "All Three",
    monthlyEntitlement: "all_three_monthly",
    annualEntitlement: "all_three_annual"
  }),
  pro: Object.freeze({
    accessClass: "team",
    workspaceScope: "all",
    label: "Team",
    monthlyEntitlement: "team_monthly",
    annualEntitlement: "team_annual"
  })
});

const WORKFLOW_STATES = Object.freeze([
  "active",
  "beta",
  "setup_required",
  "disabled",
  "internal",
  "metered"
]);

const METERED_CAPABILITY_KEYS = Object.freeze(Object.keys(CAPABILITIES));

function customerAccessForPlanFloor(planFloor) {
  return CUSTOMER_ACCESS_BY_PLAN_FLOOR[String(planFloor || "").trim().toLowerCase()] || null;
}

function customerPlanLabel(planFloor) {
  return customerAccessForPlanFloor(planFloor)?.label || "Paid";
}

function customerInclusionText(planFloor) {
  const key = String(planFloor || "").trim().toLowerCase();
  if (key === "free") return "Included free.";
  if (key === "starter") return "Included with One Workspace, All Three, or Team.";
  if (key === "core") return "Included with All Three or Team.";
  if (key === "pro") return "Included with Team.";
  return "Available on a paid plan.";
}

function workflowTruth({
  lifecycleStatus,
  executionEnabled = false,
  internal = false,
  metered = false
} = {}) {
  if (internal) return "internal";
  if (metered) return "metered";

  const lifecycle = String(lifecycleStatus || "").trim().toLowerCase();
  if (lifecycle === "setup_required") return "setup_required";
  if (lifecycle === "beta" && executionEnabled) return "beta";
  if (lifecycle === "active" && executionEnabled) return "active";
  return "disabled";
}

function capabilityUsagePolicy(capability) {
  const key = String(capability || "").trim();
  if (!key || !Object.prototype.hasOwnProperty.call(CAPABILITIES, key)) {
    return Object.freeze({ metered: false, capability: key || null, unit: null });
  }
  return Object.freeze({
    metered: true,
    capability: key,
    unit: CAPABILITIES[key].unit
  });
}

module.exports = {
  CUSTOMER_ACCESS_BY_PLAN_FLOOR,
  WORKFLOW_STATES,
  METERED_CAPABILITY_KEYS,
  customerAccessForPlanFloor,
  customerPlanLabel,
  customerInclusionText,
  workflowTruth,
  capabilityUsagePolicy
};
