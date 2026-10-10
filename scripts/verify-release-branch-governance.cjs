#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

function uniqueChecks(required) {
  const contexts = Array.isArray(required?.contexts) ? required.contexts : [];
  const checks = Array.isArray(required?.checks)
    ? required.checks.map((entry) => entry && entry.context)
    : [];
  return [...new Set([...contexts, ...checks].filter((value) => typeof value === "string" && value.trim()))].sort();
}

function evaluateBranchGovernance(branch, expectedName = "main") {
  const failures = [];
  const name = typeof branch?.name === "string" ? branch.name : "";
  if (name !== expectedName) failures.push(`expected branch ${expectedName}, received ${name || "unknown"}`);

  if (branch?.protected !== true) failures.push(`${expectedName} is not protected`);

  const protection = branch?.protection;
  if (protection?.enabled === false) failures.push(`${expectedName} branch-protection enforcement is disabled`);

  const required = protection?.required_status_checks;
  const enforcementLevel = typeof required?.enforcement_level === "string"
    ? required.enforcement_level
    : "missing";
  const checks = uniqueChecks(required);

  if (!required || enforcementLevel === "off" || enforcementLevel === "missing") {
    failures.push(`${expectedName} does not enforce required status checks`);
  }
  if (checks.length === 0) failures.push(`${expectedName} has no required status-check contexts`);

  return {
    ok: failures.length === 0,
    branch: name || expectedName,
    protected: branch?.protected === true,
    enforcementLevel,
    requiredStatusChecks: checks,
    failures
  };
}

function readJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch (error) {
    throw new Error(`could not read branch metadata from ${filename}: ${error.message}`);
  }
}

function main(argv = process.argv.slice(2)) {
  const filename = argv[0];
  const expectedName = argv[1] || "main";
  if (!filename) {
    console.error("Usage: node scripts/verify-release-branch-governance.cjs <branch-json> [branch-name]");
    return 2;
  }

  let branch;
  try {
    branch = readJson(filename);
  } catch (error) {
    console.error(`Release branch governance BLOCKED: ${error.message}`);
    return 1;
  }

  const result = evaluateBranchGovernance(branch, expectedName);
  if (!result.ok) {
    console.error(
      `Release branch governance BLOCKED: ${result.failures.join("; ")}. ` +
      "Enable branch protection and required status checks before production release."
    );
    return 1;
  }

  console.log(
    `Release branch governance OK: ${result.branch} is protected; ` +
    `required-status enforcement=${result.enforcementLevel}; ` +
    `${result.requiredStatusChecks.length} required check(s).`
  );
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { evaluateBranchGovernance, uniqueChecks };
