// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  normalizeCommercialUseStatus,
  readOpenSourceTools
} = require("../lib/sonara-open-source-registry.cjs");

const root = path.join(__dirname, "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function fixtureDirectory(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    ...options
  });
}

function runPnpm(args) {
  if (process.platform !== "win32") return run(pnpmCommand, args);
  const quote = (value) => {
    const text = String(value);
    return /[\s"^&|<>]/.test(text) ? `"${text.replace(/(["^&|<>])/g, "^$1")}"` : text;
  };
  return run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", ["pnpm", ...args].map((value, index) => index === 0 ? String(value) : quote(value)).join(" ")]);
}

function reciprocalLicenceAllowed(record) {
  const contained = new Set([
    "reference_only",
    "research_only",
    "blocked",
    "needs_license_review",
    "needs_security_review"
  ]);
  return record.reciprocalLicense !== true || contained.has(record.integrationStatus);
}

describe("release gates fail closed on representative bad fixtures", () => {
  it("rejects an invalid commercial-use status", () => {
    assert.equal(normalizeCommercialUseStatus("not_a_policy"), null);
    assert.ok(readOpenSourceTools().length >= 100, "fixture would be vacuous without the real registry");
  });

  it("rejects a TypeScript contract violation", () => {
    const directory = fixtureDirectory("sonara-ts-contract-fixture-");
    const fixture = path.join(directory, "invalid-contract.ts");
    const source = fs.readFileSync(path.join(root, "data", "open-source-tools.ts"), "utf8") +
      '\nconst invalid: OpenSourceCommercialUseStatus = "not_a_policy";\n';
    fs.writeFileSync(fixture, source, "utf8");
    const result = runPnpm([
      "exec", "tsc", "--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022",
      "--module", "NodeNext", "--moduleResolution", "NodeNext", fixture
    ]);
    assert.notEqual(result.status, 0, "the compiler accepted an invalid commercial-use status");
    assert.match(`${result.stdout || ""}\n${result.stderr || ""}`, /not assignable|TS\d+/);
  });

  it("rejects a runtime syntax error before startup", () => {
    const directory = fixtureDirectory("sonara-syntax-fixture-");
    const fixture = path.join(directory, "invalid.js");
    fs.writeFileSync(fixture, "const = invalid;\n", "utf8");
    const result = run(process.execPath, ["--check", fixture]);
    assert.notEqual(result.status, 0, "node --check accepted invalid runtime syntax");
  });

  it("rejects a failing test instead of treating the process as green", () => {
    const directory = fixtureDirectory("sonara-test-fixture-");
    const fixture = path.join(directory, "failing.test.js");
    fs.writeFileSync(
      fixture,
      'describe("fixture", () => { it("fails", () => { throw new Error("fixture failure"); }); });\n',
      "utf8"
    );
    const result = runPnpm(["exec", "mocha", "--no-config", "--reporter", "dot", fixture]);
    assert.notEqual(result.status, 0, "the test runner accepted a failing fixture");
  });

  it("rejects a reciprocal-license record placed on an adoption status", () => {
    const fixture = { reciprocalLicense: true, integrationStatus: "adapter_built" };
    assert.equal(reciprocalLicenceAllowed(fixture), false);
    assert.ok(readOpenSourceTools().some((record) => record.reciprocalLicense === true), "fixture would be vacuous without reciprocal records");
  });
});
