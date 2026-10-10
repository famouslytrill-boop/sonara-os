#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const MINIMUM_REQUIRED_CHECKS = Object.freeze([
  "sonara-industries",
  "Build, test, and security",
  "build",
  "Node 24 blocking compatibility",
  "Node 26 blocking compatibility",
  "Node 22 / PostgreSQL 16 replay",
  "Node 22 / PostgreSQL 17 replay",
  "Node 22 / PostgreSQL 18 replay",
  "Node 24 / PostgreSQL 16 replay",
  "Node 24 / PostgreSQL 17 replay",
  "Node 24 / PostgreSQL 18 replay",
  "Node 26 / PostgreSQL 16 replay",
  "Node 26 / PostgreSQL 17 replay",
  "Node 26 / PostgreSQL 18 replay",
  "Architecture, SAST, tenant isolation, and release evidence",
  "frontend-dependencies",
  "agentkit",
  "python-ops",
  "backend-dependencies",
  "tools-python-suites (disposable-domains, 40)",
  "tools-python-suites (voice-clone, 24)",
  "tools-node-suites (serverless-cli, 200)",
  "tools-node-suites (songsmith, 40)",
  "tools-node-suites (aws-emulator, 40)"
]);

function cleanContext(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueChecks(required) {
  const contexts = Array.isArray(required?.contexts) ? required.contexts : [];
  const checks = Array.isArray(required?.checks)
    ? required.checks.map((entry) => entry && entry.context)
    : [];
  return [...new Set([...contexts, ...checks].map(cleanContext).filter(Boolean))].sort();
}

function rulesetStatusPolicies(activeRules) {
  if (!Array.isArray(activeRules)) return [];
  return activeRules
    .filter((rule) => rule?.type === "required_status_checks")
    .map((rule) => ({
      strict: rule?.parameters?.strict_required_status_checks_policy === true,
      checks: Array.isArray(rule?.parameters?.required_status_checks)
        ? [...new Set(rule.parameters.required_status_checks.map((entry) => cleanContext(entry?.context)).filter(Boolean))].sort()
        : []
    }));
}

function missingMinimum(configured) {
  const set = new Set(configured);
  return MINIMUM_REQUIRED_CHECKS.filter((name) => !set.has(name));
}

function evaluateBranchGovernance(branch, expectedName = "main", activeRules = []) {
  const failures = [];
  const name = typeof branch?.name === "string" ? branch.name : "";
  if (name !== expectedName) failures.push(`expected branch ${expectedName}, received ${name || "unknown"}`);
  if (branch?.protected !== true) failures.push(`${expectedName} is not protected by branch protection or an active ruleset`);

  const required = branch?.protection?.required_status_checks;
  const enforcementLevel = typeof required?.enforcement_level === "string" ? required.enforcement_level : "missing";
  const classicChecks = uniqueChecks(required);
  const classicMissing = missingMinimum(classicChecks);
  const classicEnforced = Boolean(required) && enforcementLevel !== "off" && enforcementLevel !== "missing" && classicMissing.length === 0;

  const policies = rulesetStatusPolicies(activeRules);
  const rulesetChecks = [...new Set(policies.flatMap((policy) => policy.checks))].sort();
  const rulesetMissing = missingMinimum(rulesetChecks);
  const rulesetStrict = policies.some((policy) => policy.strict);
  const rulesetEnforced = rulesetMissing.length === 0 && rulesetStrict;

  if (!classicEnforced && !rulesetEnforced) {
    const details = [];
    if (classicMissing.length) details.push(`classic missing: ${classicMissing.join(", ")}`);
    if (rulesetMissing.length) details.push(`ruleset missing: ${rulesetMissing.join(", ")}`);
    if (policies.length && !rulesetStrict) details.push("ruleset status checks are not strict/up-to-date");
    failures.push(`release-critical required checks are not fully enforced${details.length ? ` (${details.join("; ")})` : ""}`);
  }

  const mechanisms = [];
  if (classicEnforced) mechanisms.push("classic");
  if (rulesetEnforced) mechanisms.push("ruleset");
  return {
    ok: failures.length === 0,
    branch: name || expectedName,
    protected: branch?.protected === true,
    enforcementLevel,
    classicRequiredStatusChecks: classicChecks,
    rulesetRequiredStatusChecks: rulesetChecks,
    rulesetStrict,
    mechanisms,
    failures
  };
}

function readJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch (error) {
    throw new Error(`could not read GitHub governance metadata from ${filename}: ${error.message}`);
  }
}

function main(argv = process.argv.slice(2)) {
  const branchFile = argv[0];
  const expectedName = argv[1] || "main";
  const rulesFile = argv[2] || null;
  if (!branchFile) {
    console.error("Usage: node scripts/verify-release-branch-governance.cjs <branch-json> [branch-name] [rules-json]");
    return 2;
  }

  let branch;
  let activeRules = [];
  try {
    branch = readJson(branchFile);
    if (rulesFile) activeRules = readJson(rulesFile);
  } catch (error) {
    console.error(`Release branch governance BLOCKED: ${error.message}`);
    return 1;
  }

  const result = evaluateBranchGovernance(branch, expectedName, activeRules);
  if (!result.ok) {
    console.error(
      `Release branch governance BLOCKED: ${result.failures.join("; ")}. ` +
      "Require the SONARA release-critical status checks before production release."
    );
    return 1;
  }

  console.log(
    `Release branch governance OK: ${result.branch} uses ${result.mechanisms.join("+")} protection ` +
    `with all ${MINIMUM_REQUIRED_CHECKS.length} SONARA release-critical checks required.`
  );
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = {
  MINIMUM_REQUIRED_CHECKS,
  evaluateBranchGovernance,
  missingMinimum,
  rulesetStatusPolicies,
  uniqueChecks
};
