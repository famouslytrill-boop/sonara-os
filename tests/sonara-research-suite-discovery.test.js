"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SUITES = Object.freeze([
  ["sonara-research-formula-blueprints.test.js", "../lib/sonara-research-formula-blueprints.cjs"],
  ["sonara-research-rank-sensitivity.test.js", "../lib/sonara-research-rank-sensitivity.cjs"],
  ["sonara-research-evidence-reconciliation.test.js", "../lib/sonara-research-evidence-reconciliation.cjs"]
]);

describe("SONARA research suite discovery contract", () => {
  it("has runnable test files under the repository's Mocha discovery pattern", () => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", ".mocharc.json"), "utf8"));
    assert.ok(config.spec.includes("tests/**/*.js"), "Mocha must discover recursive .js tests");
    for (const [testName, target] of SUITES) {
      const file = path.join(__dirname, testName);
      assert.ok(fs.statSync(file).isFile(), `${testName} is missing from tests/`);
      const source = fs.readFileSync(file, "utf8");
      assert.ok(source.includes(`require("${target}")`), `${testName} does not import lib/ correctly`);
      assert.ok(/\bdescribe\(/.test(source) && /\bit\(/.test(source), `${testName} has no Mocha test definitions`);
    }
  });
});
