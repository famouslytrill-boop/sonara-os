#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

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

function rulesetChecks(activeRules) {
  if (!Array.isArray(activeRules)) return [];
  const contexts = [];
  for (const rule of activeRules) {
    if (rule?.type !== "required_status_checks") continue;
    const required = rule?.parameters?.required_status_checks;
    if (!Array.isArray(required)) continue;
    for (const entry of required) {
      const context = cleanContext(entry?.context);
      if (context) contexts.push(context);
    }
  }
  return [...new Set(contexts)].sort();
}

function evaluateBranchGovernance(branch, expectedName = "main", activeRules = []) {
  const failures = [];
  const name = typeof branch?.name === "string" ? branch.name : "";
  if (name !== expectedName) failures.push(`expected branch ${expectedName}, received ${name || "unknown"}`);
  if (branch?.protected !== true) failures.push(`${expectedName} is not protected by branch protection or an active ruleset`);

  const required = branch?.protection?.required_status_checks;
  const enforcementLevel = typeof required?.enforcement_level === "string"
    ? required.enforcement_level
    : "missing";
  const classicChecks = uniqueChecks(required);
  const classicEnforced = Boolean(required) && enforcementLevel !== "off" && enforcementLevel !== "missing" && classicChecks.length > 0;
  const activeRulesetChecks = rulesetChecks(activeRules);
  const rulesetEnforced = activeRulesetChecks.length > 0;

  if (!classicEnforced && !rulesetEnforced) {
    failures.push(`${expectedName} has no enforced required status checks in classic protection or active rulesets`);
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
    rulesetRequiredStatusChecks: activeRulesetChecks,
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
      "Enable branch protection or an active ruleset with required status checks before production release."
    );
    return 1;
  }

  const count = new Set([...result.classicRequiredStatusChecks, ...result.rulesetRequiredStatusChecks]).size;
  console.log(
    `Release branch governance OK: ${result.branch} is protected by ${result.mechanisms.join("+")}; ` +
    `${count} required status check(s) are enforced.`
  );
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { evaluateBranchGovernance, rulesetChecks, uniqueChecks };
