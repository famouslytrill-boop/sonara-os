"use strict";

// Every command in the release chain has to run somewhere automatic.
//
// `verify:launch` is what this repository calls its gate, and
// docs/owner/WHAT-IS-LEFT.md quotes its length at whoever is deciding whether
// this is shippable. **Twenty-one of its thirty-one commands ran in no
// workflow at all**: verify:doc-counts, verify:source-licence, verify:csp,
// verify:margins, verify:orphan-tables, verify:stale-claims and fifteen more.
//
// A pull request could be green on every check GitHub displayed while two
// thirds of the gate had never executed. That is this repository's recurring
// defect at the largest scale it comes in -- a signal reporting success without
// being true -- and it had the obvious consequence: on 27 August two green
// pull requests merged into a main that was red on verify:doc-counts, and
// nothing noticed until the chain was run by hand.
//
// This file is not satisfied by the workflow naming `verify:launch` either. It
// resolves what a workflow runs through package.json, so a step running one
// script that runs another counts the inner one, and a chain command that
// nothing reaches is named.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const scripts = require("../package.json").scripts;

const workflowDir = path.join(root, ".github", "workflows");
const workflows = fs.readdirSync(workflowDir).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));

// One implementation of "what does the chain reach", in
// lib/sonara-release-chain.cjs.
//
// Three separate checks grew their own copy of this expansion and all three
// broke on the day the chain nested -- each reporting something that looked
// like a real finding and was an artefact of reading a string. A fourth copy
// here would have been the fourth to break.
const { reaches, chainCommands } = require("../lib/sonara-release-chain.cjs");

/** Every script name any workflow reaches, directly or through another script. */
function scriptsCiReaches() {
  const reached = new Set();
  for (const file of workflows) {
    const body = fs.readFileSync(path.join(workflowDir, file), "utf8");
    // Comments are stripped first. A workflow comment explaining why a check is
    // NOT run would otherwise count as running it -- the same defect that let a
    // report measure a smaller file than the one on disk.
    const yaml = body.replace(/^\s*#.*$/gm, "");
    for (const match of yaml.matchAll(/pnpm (?:run )?([a-z0-9:-]+)/g)) {
      if (!scripts[match[1]]) continue;
      for (const name of reaches(scripts, match[1])) reached.add(name);
    }
  }
  return reached;
}

describe("the release gate is actually the gate", () => {
  const chain = chainCommands(scripts);
  const reached = scriptsCiReaches();

  it("found a chain and some workflows, so this is not passing on nothing", () => {
    assert.ok(scripts["verify:launch"], "verify:launch is gone; this check has no subject");
    assert.ok(chain.length >= 25, `the chain expanded to ${chain.length} commands; that is too few to be right`);
    assert.ok(workflows.length >= 4, `only ${workflows.length} workflows found; this check has gone blind`);
    assert.ok(reached.size >= 10, `workflows reach only ${reached.size} scripts; the pattern has stopped matching`);
  });

  // The gate.
  it("runs every chain command in some workflow", () => {
    const unrun = chain.filter((name) => !reached.has(name)).sort();
    assert.deepEqual(
      unrun,
      [],
      `these release-chain commands run in no workflow, so a pull request can be green without them: ${unrun.join(", ")}`
    );
  });

  // One definition, so the two cannot drift into disagreeing about what a gate
  // is. Before this, the workflow listed four verify commands by hand and the
  // chain listed thirty-one; keeping those in step was nobody's job.
  it("defines the gates once and builds the chain from that", () => {
    assert.ok(scripts["verify:gates"], "verify:gates is gone; the workflow and the chain are two lists again");
    assert.match(
      scripts["verify:launch"],
      /pnpm run verify:gates/,
      "verify:launch must be defined in terms of verify:gates, not repeat it"
    );
    const gates = chainCommands(scripts, "verify:gates");
    assert.ok(gates.length >= 20, `verify:gates expands to ${gates.length} commands; that is too few to be the gate`);
  });

  it("runs the gates where a missing database is a failure, not a notice", () => {
    // verify:migration-replay is the only check that executes the migrations,
    // and without PostgreSQL it prints a notice and passes. That is right on a
    // contributor's machine and wrong in CI: a check whose skip path is the one
    // that always runs is not a check.
    const industries = fs.readFileSync(path.join(workflowDir, "sonara-industries-ci.yml"), "utf8");
    const step = industries.slice(industries.indexOf("Run every release gate"));
    assert.match(step.slice(0, 400), /SONARA_MIGRATION_REPLAY_REQUIRED: "1"/);
  });

  it("names the chain length correctly where it is quoted at the owner", () => {
    // docs/owner/WHAT-IS-LEFT.md states this figure to somebody deciding
    // whether to ship. verify-doc-counts checks the number; this checks that
    // the number still means every command, now that the chain nests.
    const stated = scripts["verify:launch"].split("&&").length;
    assert.ok(
      chain.length > stated,
      "the chain no longer nests, so verify:gates has been inlined and the two-list problem is back"
    );
  });
});
