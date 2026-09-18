"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const WORKFLOWS = path.join(ROOT, ".github", "workflows");
const COMPATIBILITY_WORKFLOW = "node-runtime-compatibility.yml";

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

function workflowFiles() {
  return fs
    .readdirSync(WORKFLOWS)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
}

function literalNodePins(name) {
  const source = fs.readFileSync(path.join(WORKFLOWS, name), "utf8");
  return [...source.matchAll(/node-version:\s*["']?([0-9]+)(?:\.[0-9.x]+)?["']?/g)].map((match) => Number(match[1]));
}

describe("the production runtime and CI compatibility contract", () => {
  const files = workflowFiles();

  it("reads a plausible workflow population instead of passing over nothing", () => {
    assert.ok(files.length >= 10, `only ${files.length} workflow files found; runtime policy has gone blind`);
    assert.ok(files.includes(COMPATIBILITY_WORKFLOW), "the dedicated runtime compatibility workflow is missing");
  });

  it("pins the deployed application to Vercel's documented Node 24 major", () => {
    assert.equal(
      packageJson.engines?.node,
      "24.x",
      "package.json engines.node must stay 24.x until the production host explicitly supports a newer major"
    );
  });

  it("runs every ordinary Node-backed workflow on Node 24", () => {
    let pins = 0;

    for (const name of files) {
      if (name === COMPATIBILITY_WORKFLOW) continue;
      for (const version of literalNodePins(name)) {
        pins += 1;
        assert.equal(version, 24, `${name} pins Node ${version}; ordinary CI and deployment workflows must match production Node 24`);
      }
    }

    assert.ok(pins >= 10, `only ${pins} ordinary node-version pins found; the check has stopped seeing the runtime surface`);
  });

  it("tests Node 24 and Node 26 as blocking compatibility lanes", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS, COMPATIBILITY_WORKFLOW), "utf8");

    assert.match(
      source,
      /blocking-compatibility:[\s\S]*?matrix:[\s\S]*?node:\s*\[24,\s*26\]/,
      "blocking compatibility must cover both Node 24 and Node 26"
    );

    const blocking = source.slice(
      source.indexOf("blocking-compatibility:"),
      source.indexOf("node-27-forward-compatibility:")
    );
    assert.doesNotMatch(
      blocking,
      /continue-on-error:\s*true/,
      "Node 24/26 compatibility is blocking and must not be weakened with continue-on-error"
    );
  });

  it("keeps Node 27 explicitly forward-compatible, manual, and non-blocking until it exists", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS, COMPATIBILITY_WORKFLOW), "utf8");
    const start = source.indexOf("node-27-forward-compatibility:");
    assert.ok(start >= 0, "Node 27 forward-compatibility job is missing");
    const future = source.slice(start);

    assert.match(future, /name:\s*Node 27 forward compatibility \(manual, non-blocking\)/);
    assert.match(future, /github\.event_name == 'workflow_dispatch' && inputs\.test_node27/);
    assert.match(future, /continue-on-error:\s*true/);
    assert.match(future, /node-version:\s*27/);
    assert.match(
      source,
      /alpha on[\s\S]*2026-10-28[\s\S]*normal release on[\s\S]*2027-04-22/,
      "the reason Node 27 is not an automatic lane must remain documented in the workflow"
    );
  });

  it("does not accidentally put Node 27 into the blocking matrix", () => {
    const source = fs.readFileSync(path.join(WORKFLOWS, COMPATIBILITY_WORKFLOW), "utf8");
    const blocking = source.slice(
      source.indexOf("blocking-compatibility:"),
      source.indexOf("node-27-forward-compatibility:")
    );
    assert.doesNotMatch(blocking, /\b27\b/, "Node 27 is not released and must not be a blocking runtime yet");
  });
});
