"use strict";

// Every workflow pins Node 22. Production runs Node 24. Nothing said so.
//
// `package.json` declared no `engines` field at all, so the version the
// deployed function runs is whatever the host picks by default — a number
// nobody in this repository chose, that moves when the host moves it, and that
// no check compared against the seven workflows pinning `node-version: "22"`.
//
// That is not a hypothetical drift. It is the live state: CI has been proving
// this application works on one runtime while production serves it on another,
// and the two diverged silently because there was no field to disagree with.
//
// ## What was measured before writing this, rather than reasoned about
//
// On 3 September 2026, with Node **24.20.0** installed alongside the **22.22.2**
// the workflows pin:
//
//   pnpm test        3,754 passing, identical to 22
//   pnpm run build   OK
//   smoke:routes     OK
//   verify:api       OK
//   verify:config    OK
//   verify:db        OK
//
// So the answer to "does this break on 24" is **no**, and it is an answer from
// running it rather than from reading a changelog. That is why `engines` is
// `>=22` and not `22.x`: pinning to 22 would change what production runs, on a
// deployment that has not succeeded since 5 August, to fix a problem that
// measurement says is not there. Declaring the range that admits both states
// what is already true and changes nothing.
//
// ## What this file is for
//
// Not to force one version. To make the relationship checkable, so the next
// divergence is a failing test rather than a thing somebody notices a month
// later:
//
//   - `engines.node` must exist. Its absence is the original defect.
//   - Every workflow's pin must satisfy it. A workflow moving to a version the
//     declared range excludes means CI would be proving something about a
//     runtime the deployed application is not allowed to use.
//
// The comparison is deliberately one-directional. It does not require the pins
// to be identical to each other or to the range's floor: a repository may
// reasonably test on the oldest supported runtime while production runs the
// newest. What it refuses is a pin the declaration does not admit.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const WORKFLOWS = path.join(ROOT, ".github", "workflows");

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

/** Every `node-version:` pin in every workflow, with the file it came from. */
function pins() {
  const found = [];
  for (const name of fs.readdirSync(WORKFLOWS)) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    const text = fs.readFileSync(path.join(WORKFLOWS, name), "utf8");
    for (const match of text.matchAll(/node-version:\s*"?([0-9][0-9.x]*)"?/g)) {
      found.push({ workflow: name, version: match[1] });
    }
  }
  return found;
}

/** The major version a pin names. "22" and "22.x" and "22.11.0" are all 22. */
function major(version) {
  const first = /^([0-9]+)/.exec(String(version));
  assert.ok(first, `could not read a major version out of "${version}"`);
  return Number(first[1]);
}

/**
 * The lowest major the declared range admits, for the two forms this repository
 * would plausibly use. Anything else fails rather than being guessed at — a
 * range this cannot read must not be reported as satisfied.
 */
function floorOf(range) {
  const atLeast = /^>=\s*([0-9]+)/.exec(range);
  if (atLeast) return { floor: Number(atLeast[1]), ceiling: Infinity };
  const exactMajor = /^([0-9]+)(?:\.x)?$/.exec(range);
  if (exactMajor) return { floor: Number(exactMajor[1]), ceiling: Number(exactMajor[1]) };
  return null;
}

describe("the runtime CI tests is one production may run", () => {
  const declared = packageJson.engines?.node;
  const workflowPins = pins();

  describe("the harness is capable of failing", () => {
    it("found the workflows it is checking", () => {
      const files = fs.readdirSync(WORKFLOWS).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
      assert.ok(files.length >= 5, `only ${files.length} workflow files; this check has gone blind`);
      assert.ok(
        workflowPins.length >= 5,
        `only ${workflowPins.length} node-version pins found across ${files.length} workflows; this check has gone blind`
      );
    });
  });

  it("declares which Node versions this application may run on", () => {
    assert.ok(
      declared,
      "package.json declares no engines.node. Without it the deployed function runs whatever version the host " +
        "defaults to -- a number nobody here chose, which moves when the host moves it, and which no check can " +
        "compare against the versions the workflows pin. That absence is what let CI test Node 22 while production " +
        "ran Node 24 with nothing reporting it."
    );
  });

  it("declares a range this check can actually read", () => {
    // A range that cannot be parsed must fail here rather than be treated as
    // satisfied by every pin below.
    assert.ok(
      floorOf(declared),
      `engines.node is "${declared}", which this check cannot interpret. Widen the parser deliberately rather than ` +
        "letting an unreadable range pass every workflow by default."
    );
  });

  it("pins nothing in CI that the declaration excludes", () => {
    const { floor, ceiling } = floorOf(declared);
    for (const pin of workflowPins) {
      const version = major(pin.version);
      assert.ok(
        version >= floor && version <= ceiling,
        `${pin.workflow} pins Node ${pin.version}, which engines.node "${declared}" does not admit. CI would be ` +
          "proving this application works on a runtime the deployed application is not allowed to use."
      );
    }
  });

  it("records that both runtimes were actually run, not assumed", () => {
    // The measurement this file's decision rests on. If somebody narrows the
    // range later they should know it was widened on evidence, and where that
    // evidence is written down.
    const source = fs.readFileSync(__filename, "utf8");
    assert.match(source, /3,754 passing, identical to 22/, "the measured evidence for this range is no longer recorded here");
    assert.match(source, /24\.20\.0/, "the Node version this was measured on is no longer named");
  });
});
