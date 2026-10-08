#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Production credentials must NEVER be available to pull-request-controlled jobs.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const workflowPath = path.resolve(__dirname, "../.github/workflows/controlled-production-deploy-dry-run.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

function jobBlocks(source) {
  const start = source.search(/^jobs:\s*$/m);
  if (start < 0) return new Map();
  const all = source.slice(start);
  const found = [...all.matchAll(/^  ([a-z][a-z0-9-]*):\s*$/gm)];
  return new Map(found.map((entry, i) => [
    entry[1],
    all.slice(entry.index, found[i + 1]?.index ?? all.length)
  ]));
}

function failures(source) {
  const issues = [];
  const jobs = jobBlocks(source);
  const contract = jobs.get("pull-request-contract") || "";
  const admission = jobs.get("verify-current-main") || "";
  const production = jobs.get("production-deploy-dry-run") || "";
  const on = source.slice(0, source.search(/^jobs:\s*$/m));
  const requireItem = (ok, why) => { if (!ok) issues.push(why); };
  const line = (text, key) => (text.match(new RegExp("^    " + key + ":\\s*(.+)$", "m")) || [])[1] || "";
  const hasAll = (text, snippets) => snippets.every((part) => text.includes(part));

  requireItem(on.includes("pull_request:") && on.includes("workflow_dispatch:"), "PR and dispatch events must be explicit");
  requireItem(/approve_read_only_production_validation:[\s\S]*?type: boolean[\s\S]*?required: true[\s\S]*?default: false/.test(on),
    "manual approval must be a required boolean defaulting to false");
  requireItem(on.includes("scripts/verify-production-dry-run-boundary.cjs"), "security contract must run on changes to itself");

  requireItem(Boolean(contract), "credential-free pull-request job missing");
  requireItem(hasAll(line(contract, "if"), ["github.event_name == 'pull_request'"]), "PR job must require pull_request");
  requireItem(!/^\s+environment:\s*/m.test(contract), "PR job must not reference any deployment environment");
  requireItem(!/\$\{\{\s*secrets\./.test(contract), "PR job must not reference secrets");
  requireItem(contract.includes("verify-production-dry-run-boundary.cjs --self-test"), "PR security regression probe not wired");

  requireItem(Boolean(admission), "protected-main preflight missing");
  requireItem(hasAll(line(admission, "if"), [
    "github.event_name == 'workflow_dispatch'",
    "github.ref == 'refs/heads/main'",
    "inputs.approve_read_only_production_validation == true"
  ]), "preflight must require explicit manually approved main dispatch");
  requireItem(!/^\s+environment:\s*/m.test(admission), "preflight may not request a deployment environment");
  requireItem(!/\$\{\{\s*secrets\./.test(admission), "preflight may not use production secrets");
  requireItem(hasAll(admission, [
    "/branches/main", "current.protected !== true",
    "current.commit?.sha !== process.env.GITHUB_SHA"
  ]), "preflight must verify current protected main at dispatch SHA");

  requireItem(Boolean(production), "credential-bearing job missing");
  requireItem(/^\s+environment:\s*production\s*$/m.test(production), "production secrets need protected environment");
  requireItem(/^\s+needs:\s*\[verify-current-main\]\s*$/m.test(production),
    "production job must depend on protected-main preflight");
  requireItem(hasAll(line(production, "if"), [
    "github.event_name == 'workflow_dispatch'",
    "github.ref == 'refs/heads/main'",
    "inputs.approve_read_only_production_validation == true",
    "needs.verify-current-main.result == 'success'"
  ]), "production job must require approved dispatch, main and successful preflight");
  requireItem(production.includes("verify-production-environment-governance.cjs"), "production governance verifier missing");
  requireItem(production.includes("verify-production-dry-run-boundary.cjs --self-test"),
    "production job must verify event isolation from checked-out code");
  for (const [name, body] of jobs) {
    if (name !== "production-deploy-dry-run") {
      if (/\$\{\{\s*secrets\./.test(body)) issues.push(name + " must never use production secrets");
      if (/^\s+environment:\s*production\s*$/m.test(body)) issues.push(name + " must never request production");
    }
  }
  return issues;
}

function selfTest(source) {
  assert.deepEqual(failures(source), [], "checked-in workflow must satisfy production/PR isolation");
  const secretReference = String.fromCharCode(36) + "{{ secrets.SUPABASE_DB_PASSWORD }}";
  const mutants = [
    source.replace("github.event_name == 'workflow_dispatch'", "github.event_name == 'pull_request'"),
    source.replace("github.ref == 'refs/heads/main'", "github.ref == 'refs/heads/feature'"),
    source.replace("    needs: [verify-current-main]", "    needs: []"),
    source.replace("        default: false", "        default: true"),
    source.replace("  pull-request-contract:\n", "  pull-request-contract:\n    env:\n      PASSWORD: " + secretReference + "\n"),
    source.replace("current.protected !== true", "current.protected === true"),
    source.replace("  production-deploy-dry-run:\n", "  removed-production-job:\n")
  ];
  for (const [i, mutant] of mutants.entries()) {
    assert.notEqual(mutant, source, "mutation " + (i + 1) + " was ineffective");
    assert.ok(failures(mutant).length, "mutation " + (i + 1) + " evaded production credential boundary");
  }
  return mutants.length;
}

const issues = failures(workflow);
if (issues.length) {
  console.error("Production dry-run credential boundary FAILED:\n- " + issues.join("\n- "));
  process.exitCode = 1;
} else if (process.argv.includes("--self-test")) {
  try {
    const count = selfTest(workflow);
    console.log("Production dry-run credential boundary passed; " + count + " negative mutations rejected.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
} else {
  console.log("Production dry-run credential boundary passed.");
}

module.exports = { failures, selfTest };
