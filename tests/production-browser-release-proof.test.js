"use strict";

// Exercise the exact inline JavaScript that the production workflow executes;
// static regex tests alone cannot prove an old browser pass will not override
// a newer failed run, or that a PR check cannot count as manual release proof.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const SHA = "1234567890abcdef1234567890abcdef12345678";
const OTHER_SHA = "abcdef1234567890abcdef1234567890abcdef12";
const REQUIRED = [
  "SONARA Industries CI",
  "Docker Image CI",
  "Node Runtime Compatibility",
  "Native migration replay",
  "Engineering Intelligence and Security Evidence",
  "dependency-scan"
];

function releaseVerifierCode() {
  const workflow = fs.readFileSync(
    path.join(ROOT, ".github/workflows/controlled-production-deploy.yml"), "utf8"
  );
  const begin = 'REQUIRED_WORKFLOWS="$required" node <<\'NODE\'';
  const start = workflow.indexOf(begin);
  assert.ok(start >= 0, "no executable exact-SHA verifier in production");
  const codeStart = start + begin.length;
  const end = workflow.indexOf("\n          NODE", codeStart);
  assert.ok(end > codeStart, "the verifier heredoc is unterminated");
  return { code: workflow.slice(codeStart, end), workflow };
}

function run(name, overrides = {}) {
  return {
    name, head_sha: SHA, head_branch: "main", event: "push",
    status: "completed", conclusion: "success",
    created_at: "2026-10-08T15:00:00.000Z",
    ...overrides
  };
}
const browser = (overrides) => run("Browser Quality", {
  event: "workflow_dispatch", ...overrides
});
const sixCore = () => REQUIRED.map((name) => run(name));

function evaluate({ records = [...sixCore(), browser()], current = SHA, protectedMain = true } = {}) {
  const { code } = releaseVerifierCode();
  const messages = [];
  const files = {
    "exact-sha-runs.json": JSON.stringify({ workflow_runs: records }),
    "main-branch.json": JSON.stringify({ commit: { sha: current }, protected: protectedMain })
  };
  let outcome = null;
  const environment = {
    require: (name) => {
      assert.equal(name, "node:fs", "release verifier loads unexpected modules");
      return { readFileSync: (filename) => {
        assert.ok(Object.hasOwn(files, filename), "unexpected data read: " + filename);
        return files[filename];
      } };
    },
    process: {
      env: { REQUIRED_WORKFLOWS: JSON.stringify(REQUIRED), GITHUB_SHA: SHA },
      exit: (codeValue) => {
        outcome = codeValue;
        throw new Error("EXPECTED_GATE_EXIT");
      }
    },
    console: {
      log: (...args) => messages.push(args.join(" ")),
      error: (...args) => messages.push(args.join(" "))
    }
  };
  try {
    vm.runInNewContext(code, environment, { timeout: 1000, filename: "exact-sha-production-verifier.js" });
    assert.fail("release verifier never returned a verdict");
  } catch (error) {
    if (error.message !== "EXPECTED_GATE_EXIT") throw error;
  }
  return { code: outcome, messages: messages.join("\n") };
}

describe("production exact-SHA browser release proof", () => {
  it("is an on-demand release prerequisite before any secret or migration", () => {
    const { workflow } = releaseVerifierCode();
    const gate = workflow.indexOf("- name: Require exact-SHA post-merge green matrix");
    const secrets = workflow.indexOf("- name: Require protected production credentials");
    const apply = workflow.indexOf("- name: Apply production database migrations");
    assert.ok(gate >= 0 && gate < secrets && gate < apply);
    assert.ok(workflow.includes("actions/runs?head_sha=$GITHUB_SHA&per_page=100"),
      "push-only API filtering would hide the manually dispatched browser proof");
    assert.ok(workflow.includes('item.event === "workflow_dispatch"'),
      "PR browser runs must not be accepted for the production release");
    assert.match(workflow, /item\.head_branch === "main"/);
  });

  it("approves only a protected exact-SHA release with all seven required proofs", () => {
    assert.equal(evaluate().code, 0);
  });

  it("waits rather than pretending an absent browser proof is success", () => {
    const result = evaluate({ records: sixCore() });
    assert.equal(result.code, 2);
    assert.match(result.messages, /Browser Quality=missing_manually_dispatched_proof/);
  });

  it("rejects a failed browser matrix even when six other workflows passed", () => {
    const result = evaluate({ records: [...sixCore(), browser({ conclusion: "failure" })] });
    assert.equal(result.code, 3);
    assert.match(result.messages, /cross-browser production release is blocked/);
  });

  it("does not treat a browser PR check or push run as manual release proof", () => {
    for (const event of ["pull_request", "push"]) {
      assert.equal(evaluate({ records: [...sixCore(), browser({ event })] }).code, 2);
    }
  });

  it("does not reuse a successful browser proof from another SHA or branch", () => {
    assert.equal(evaluate({ records: [...sixCore(), browser({ head_sha: OTHER_SHA })] }).code, 2);
    assert.equal(evaluate({ records: [...sixCore(), browser({ head_branch: "other" })] }).code, 2);
  });

  it("refuses a newer failed rerun even if an older browser run succeeded", () => {
    const records = [
      ...sixCore(),
      browser({ created_at: "2026-10-08T14:00:00.000Z" }),
      browser({ created_at: "2026-10-08T16:00:00.000Z", conclusion: "failure" })
    ];
    assert.equal(evaluate({ records }).code, 3);
  });

  it("waits on an in-progress browser run and rejects skipped/cancelled runs", () => {
    assert.equal(evaluate({ records: [...sixCore(), browser({
      status: "in_progress", conclusion: null
    })] }).code, 2);
    for (const conclusion of ["skipped", "cancelled", "neutral"]) {
      assert.equal(evaluate({ records: [...sixCore(), browser({ conclusion })] }).code, 3);
    }
  });

  it("still refuses unprotected or overtaken main, and failed migration checks", () => {
    assert.equal(evaluate({ protectedMain: false }).code, 3);
    assert.equal(evaluate({ current: OTHER_SHA }).code, 3);
    const checks = sixCore();
    checks.find((record) => record.name === "Native migration replay").conclusion = "failure";
    assert.equal(evaluate({ records: [...checks, browser()] }).code, 3);
  });
});
