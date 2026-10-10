"use strict";

const assert = require("node:assert/strict");
const {
  MINIMUM_REQUIRED_CHECKS,
  evaluateBranchGovernance,
  missingMinimum,
  rulesetStatusPolicies,
  uniqueChecks
} = require("../scripts/verify-release-branch-governance.cjs");

function classic(checks = MINIMUM_REQUIRED_CHECKS) {
  return {
    name: "main",
    protected: true,
    protection: {
      enabled: true,
      required_status_checks: { enforcement_level: "non_admins", contexts: checks, checks: [] }
    }
  };
}

function rules(checks = MINIMUM_REQUIRED_CHECKS, strict = true) {
  return [{
    type: "required_status_checks",
    parameters: {
      strict_required_status_checks_policy: strict,
      required_status_checks: checks.map((context) => ({ context }))
    }
  }];
}

describe("release branch governance", () => {
  it("fails closed for the unprotected shape currently returned by GitHub", () => {
    const result = evaluateBranchGovernance({
      name: "main", protected: false,
      protection: { enabled: false, required_status_checks: { enforcement_level: "off", contexts: [], checks: [] } }
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join(" | "), /not protected/);
    assert.match(result.failures.join(" | "), /release-critical required checks/);
  });

  it("rejects token protection that requires only one easy check", () => {
    const result = evaluateBranchGovernance(classic(["lint"]));
    assert.equal(result.ok, false);
    assert.match(result.failures.join(" | "), /classic missing:/);
    assert.ok(result.failures.join(" | ").includes("sonara-industries"));
  });

  it("accepts classic protection only when every release-critical check is required", () => {
    const result = evaluateBranchGovernance(classic());
    assert.equal(result.ok, true);
    assert.deepEqual(result.mechanisms, ["classic"]);
    assert.deepEqual(missingMinimum(result.classicRequiredStatusChecks), []);
  });

  it("accepts a strict ruleset containing the whole release-critical matrix", () => {
    const result = evaluateBranchGovernance({ name: "main", protected: true, protection: {} }, "main", rules());
    assert.equal(result.ok, true);
    assert.deepEqual(result.mechanisms, ["ruleset"]);
    assert.equal(result.rulesetStrict, true);
  });

  it("rejects a loose ruleset even when all checks are listed", () => {
    const result = evaluateBranchGovernance({ name: "main", protected: true, protection: {} }, "main", rules(MINIMUM_REQUIRED_CHECKS, false));
    assert.equal(result.ok, false);
    assert.match(result.failures.join(" | "), /not strict\/up-to-date/);
  });

  it("rejects metadata for a different branch", () => {
    const result = evaluateBranchGovernance({ ...classic(), name: "release" }, "main");
    assert.equal(result.ok, false);
    assert.match(result.failures[0], /expected branch main/);
  });

  it("normalizes classic and ruleset check representations", () => {
    assert.deepEqual(uniqueChecks({ contexts: ["ci", "lint"], checks: [{ context: "ci" }, { context: "security" }, null] }), ["ci", "lint", "security"]);
    assert.deepEqual(rulesetStatusPolicies(rules(["ci", "security"])), [{ strict: true, checks: ["ci", "security"] }]);
  });
});
