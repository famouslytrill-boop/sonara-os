"use strict";

const assert = require("node:assert/strict");
const { evaluateBranchGovernance, uniqueChecks } = require("../scripts/verify-release-branch-governance.cjs");

describe("release branch governance", () => {
  it("fails closed for the unprotected shape returned by GitHub", () => {
    const result = evaluateBranchGovernance({
      name: "main",
      protected: false,
      protection: {
        enabled: false,
        required_status_checks: { enforcement_level: "off", contexts: [], checks: [] }
      }
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join(" | "), /not protected/);
    assert.match(result.failures.join(" | "), /enforcement is disabled/);
    assert.match(result.failures.join(" | "), /does not enforce required status checks/);
    assert.match(result.failures.join(" | "), /no required status-check contexts/);
  });

  it("does not accept protection without required checks", () => {
    const result = evaluateBranchGovernance({
      name: "main",
      protected: true,
      protection: {
        enabled: true,
        required_status_checks: { enforcement_level: "non_admins", contexts: [], checks: [] }
      }
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, ["main has no required status-check contexts"]);
  });

  it("accepts protected main with enforced required checks", () => {
    const result = evaluateBranchGovernance({
      name: "main",
      protected: true,
      protection: {
        enabled: true,
        required_status_checks: {
          enforcement_level: "non_admins",
          contexts: ["sonara-industries", "Node 24 blocking compatibility"],
          checks: [{ context: "sonara-industries", app_id: 15368 }]
        }
      }
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.requiredStatusChecks, ["Node 24 blocking compatibility", "sonara-industries"]);
  });

  it("rejects metadata for a different branch", () => {
    const result = evaluateBranchGovernance({
      name: "release",
      protected: true,
      protection: {
        enabled: true,
        required_status_checks: { enforcement_level: "everyone", contexts: ["release-gate"] }
      }
    }, "main");
    assert.equal(result.ok, false);
    assert.match(result.failures[0], /expected branch main/);
  });

  it("deduplicates context and checks representations", () => {
    assert.deepEqual(uniqueChecks({
      contexts: ["ci", "lint"],
      checks: [{ context: "ci" }, { context: "security" }, null]
    }), ["ci", "lint", "security"]);
  });
});
