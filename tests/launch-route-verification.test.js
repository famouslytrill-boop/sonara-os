"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");

function runVerifier(relativePath) {
  try {
    return execFileSync(process.execPath, [path.join(root, relativePath)], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const stdout = error.stdout ? String(error.stdout) : "";
    const stderr = error.stderr ? String(error.stderr) : "";
    assert.fail(`${relativePath} failed\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  }
}

describe("Launch and route verification", () => {
  it("passes deployment configuration verification", () => {
    assert.match(runVerifier("scripts/verify-launch-config.mjs"), /Launch configuration verification passed/);
  });

  it("passes canonical route registry verification", () => {
    assert.match(runVerifier("scripts/verify-route-registry.cjs"), /Route registry verification passed/);
  });
});
