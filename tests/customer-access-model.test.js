"use strict";

const assert = require("node:assert/strict");
const {
  CUSTOMER_ACCESS_BY_PLAN_FLOOR,
  WORKFLOW_STATES,
  METERED_CAPABILITY_KEYS,
  customerAccessForPlanFloor,
  customerPlanLabel,
  customerInclusionText,
  workflowTruth,
  capabilityUsagePolicy
} = require("../lib/sonara-customer-access-model.cjs");

describe("customer access model", () => {
  it("translates retired depth floors into the current breadth ladder", () => {
    assert.equal(customerPlanLabel("free"), "Free");
    assert.equal(customerPlanLabel("starter"), "One Workspace");
    assert.equal(customerPlanLabel("core"), "All Three");
    assert.equal(customerPlanLabel("pro"), "Team");

    assert.deepEqual(customerAccessForPlanFloor("starter"), {
      accessClass: "workspace",
      workspaceScope: "one",
      label: "One Workspace",
      monthlyEntitlement: "workspace_monthly",
      annualEntitlement: "workspace_annual"
    });
    assert.equal(CUSTOMER_ACCESS_BY_PLAN_FLOOR.core.workspaceScope, "all");
    assert.equal(CUSTOMER_ACCESS_BY_PLAN_FLOOR.pro.accessClass, "team");
  });

  it("describes inclusion without exposing retired plan names to customers", () => {
    assert.equal(customerInclusionText("free"), "Included free.");
    assert.equal(customerInclusionText("starter"), "Included with One Workspace, All Three, or Team.");
    assert.equal(customerInclusionText("core"), "Included with All Three or Team.");
    assert.equal(customerInclusionText("pro"), "Included with Team.");

    for (const floor of ["starter", "core", "pro"]) {
      assert.doesNotMatch(customerInclusionText(floor), /Starter|Core|Pro/);
    }
  });

  it("reduces workflow truth to six customer and operator states", () => {
    assert.deepEqual(WORKFLOW_STATES, [
      "active",
      "beta",
      "setup_required",
      "disabled",
      "internal",
      "metered"
    ]);
    assert.equal(workflowTruth({ lifecycleStatus: "active", executionEnabled: true }), "active");
    assert.equal(workflowTruth({ lifecycleStatus: "beta", executionEnabled: true }), "beta");
    assert.equal(workflowTruth({ lifecycleStatus: "setup_required" }), "setup_required");
    assert.equal(workflowTruth({ lifecycleStatus: "planned" }), "disabled");
    assert.equal(workflowTruth({ lifecycleStatus: "active", executionEnabled: false }), "disabled");
    assert.equal(workflowTruth({ internal: true }), "internal");
    assert.equal(workflowTruth({ metered: true }), "metered");
  });

  it("keeps variable-cost execution separate from subscription access", () => {
    assert.ok(METERED_CAPABILITY_KEYS.includes("media_generation"));
    assert.ok(METERED_CAPABILITY_KEYS.includes("telephony"));
    assert.ok(METERED_CAPABILITY_KEYS.includes("campaign_email"));

    const generation = capabilityUsagePolicy("media_generation");
    assert.equal(generation.metered, true);
    assert.equal(generation.unit, "gpu_second");

    assert.deepEqual(capabilityUsagePolicy("not-a-capability"), {
      metered: false,
      capability: "not-a-capability",
      unit: null
    });
  });
});
