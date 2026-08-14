"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const WORKFLOW = fs.readFileSync(path.join(root, ".github", "workflows", "sonara-validation.yml"), "utf8");
const MOCHARC = JSON.parse(fs.readFileSync(path.join(root, ".mocharc.json"), "utf8"));

// CI ran a different set of tests from `pnpm test` and nobody could see it.
//
// Its invocation passed "tests/**/*.js" on the command line, which overrides
// the spec list. `pnpm test` also passed "tests/**/*.mjs". So four test files --
// brand-assets, brand-registry, brand-routes, platform-prep -- ran locally and
// never ran in the gate people trust. They were green either way, which is why
// it went unnoticed: a check that does not run and a check that passes look
// identical from the outside.
describe("CI runs the same tests as everybody else", () => {
  it("finds every test file, in both extensions", () => {
    const names = fs.readdirSync(path.join(root, "tests"));
    const js = names.filter((name) => name.endsWith(".test.js"));
    const mjs = names.filter((name) => name.endsWith(".test.mjs"));
    assert.ok(js.length > 50, `only ${js.length} .js test files found; this check has gone blind`);
    assert.ok(mjs.length > 0, "no .mjs test files found, so the divergence this guards is untestable");

    const spec = [].concat(MOCHARC.spec);
    assert.ok(spec.some((pattern) => pattern.endsWith("*.js")), ".mocharc.json must match .js tests");
    assert.ok(spec.some((pattern) => pattern.endsWith("*.mjs")), ".mocharc.json must match .mjs tests");
  });

  it("does not let the workflow pass its own spec globs", () => {
    // A glob on the command line overrides .mocharc, which is exactly how the
    // two drifted apart. The workflow must inherit the config rather than
    // restate it.
    const step = WORKFLOW.slice(WORKFLOW.indexOf("Run full test suite"), WORKFLOW.indexOf("Upload test diagnostics"));
    assert.ok(step.includes("mocha"), "the test step was not found; this check is looking at the wrong place");
    assert.doesNotMatch(step, /tests\/\*\*/, "the workflow must not pass spec globs; .mocharc.json owns them");
    assert.doesNotMatch(step, /--file\s/, "the workflow must not pass --file either; .mocharc.json owns require");
  });

  it("bounds how long a test may take, without relying on mocha's default", () => {
    // The 2000ms default is tight for tests that iterate 242 routes, and a
    // slower runner turned that into a failure on a commit that passed on
    // re-run with no change. Generous enough to absorb runner variance,
    // bounded enough to still catch a genuine hang.
    assert.equal(typeof MOCHARC.timeout, "number");
    assert.ok(MOCHARC.timeout >= 10000, `timeout ${MOCHARC.timeout}ms is too tight for CI runner variance`);
    assert.ok(MOCHARC.timeout <= 60000, `timeout ${MOCHARC.timeout}ms is long enough to hide a hang`);
  });

  it("keeps the setup file, which isolates provider credentials", () => {
    assert.equal(MOCHARC.require, "tests/setup-env.cjs", "without this the suite can reach live providers");
  });
});
