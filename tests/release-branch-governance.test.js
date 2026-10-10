"use strict";

const assert = require("node:assert/strict");
const { evaluateBranchGovernance, rulesetChecks, uniqueChecks } = require("../scripts/verify-release-branch-governance.cjs");

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
    assert.match(result.failures.join(" | "), /no enforced required status checks/);
  });

  it("does not accept protection without required checks", () => {
    const result = evaluateBranchGovernance({
      name: "main", protected: true,
      protection: { enabled: true, required_status_checks: { enforcement_level: "non_admins", contexts: [], checks: [] } }
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, ["main has no enforced required status checks in classic protection or active rulesets"]);
  });

  it("accepts classic protected main with enforced required checks", () => {
    const result = evaluateBranchGovernance({
      name: "main", protected: true,
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
    assert.deepEqual(result.mechanisms, ["classic"]);
    assert.deepEqual(result.classicRequiredStatusChecks, ["Node 24 blocking compatibility", "sonara-industries"]);
  });

  it("accepts active ruleset required checks without classic status-check enforcement", () => {
    const result = evaluateBranchGovernance({
      name: "main", protected: true,
      protection: { enabled: false, required_status_checks: { enforcement_level: "off", contexts: [], checks: [] } }
    }, "main", [{
      type: "required_status_checks",
      parameters: { required_status_checks: [{ context: "release-gate", integration_id: 15368 }] }
    }]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.mechanisms, ["ruleset"]);
    assert.deepEqual(result.rulesetRequiredStatusChecks, ["release-gate"]);
  });

  it("rejects metadata for a different branch", () => {
    const result = evaluateBranchGovernance({
      name: "release", protected: true,
      protection: { enabled: true, required_status_checks: { enforcement_level: "everyone", contexts: ["release-gate"] } }
    }, "main");
    assert.equal(result.ok, false);
    assert.match(result.failures[0], /expected branch main/);
  });

  it("deduplicates classic and ruleset context representations", () => {
    assert.deepEqual(uniqueChecks({ contexts: ["ci", "lint"], checks: [{ context: "ci" }, { context: "security" }, null] }), ["ci", "lint", "security"]);
    assert.deepEqual(rulesetChecks([
      { type: "required_status_checks", parameters: { required_status_checks: [{ context: "ci" }, { context: "security" }] } },
      { type: "pull_request", parameters: {} }
    ]), ["ci", "security"]);
  });
});
