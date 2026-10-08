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
  // Environment approval is necessary but insufficient: job-level secrets
  // expose live credentials to install/build/test tools and dependencies.
  // Scope each secret to the exact verification step that consumes it.
  const jobHeader = production.split(/^    steps:\s*$/m)[0];
  requireItem(!/\$\{\{\s*secrets\./.test(jobHeader),
    "provider secrets may not be scoped to the entire production job");
  const namedStep = (name) => {
    const marker = "      - name: " + name + "\n";
    const start = production.indexOf(marker);
    if (start < 0) return "";
    const rest = production.slice(start + marker.length);
    const next = /\n      - (?:name:|uses:)/.exec(rest);
    return rest.slice(0, next ? next.index : rest.length);
  };
  const credentials = String.fromCharCode(36) + "{{ secrets.";
  for (const [name, keys] of [
    ["Require protected production credentials without exposing values",
      ["VERCEL_TOKEN", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID", "SUPABASE_DB_PASSWORD", "STRIPE_RUNTIME_SECRET_KEY", "STRIPE_SECRET_KEY"]],
    ["Link and preview production database migrations",
      ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID", "SUPABASE_DB_PASSWORD"]],
    ["Pull production environment for read-only configuration verification",
      ["VERCEL_TOKEN"]],
    ["Verify production project identity", ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"]]
  ]) {
    const body = namedStep(name);
    requireItem(Boolean(body), "required scoped credential step missing: " + name);
    for (const key of keys) {
      const assignment = credentials + key + " }}";
      requireItem(body.includes(assignment),
        "missing scoped secret " + key + " in " + name);
    }
  }
  requireItem(production.includes("SONARA_ALLOWED_PENDING_MIGRATIONS=' >>"),
    "manual main-only dry run must forbid pending/PR-specific migrations");
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
    source.replace("  production-deploy-dry-run:\n", "  removed-production-job:\n"),
    source.replace("    env:\n      VERCEL_ORG_ID:", "    env:\n      VERCEL_TOKEN: " + secretReference.replace("SUPABASE_DB_PASSWORD", "VERCEL_TOKEN") + "\n      VERCEL_ORG_ID:"),
    source.replace("          VERCEL_TOKEN: " + secretReference.replace("SUPABASE_DB_PASSWORD", "VERCEL_TOKEN") + "\n          SUPABASE_ACCESS_TOKEN:",
      "          SUPABASE_ACCESS_TOKEN:")
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
