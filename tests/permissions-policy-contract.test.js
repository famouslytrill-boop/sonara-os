"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  FEATURE_ORDER,
  PRESETS,
  permissionsPolicyFor,
  serializePolicy
} = require("../lib/sonara-permissions-policy.cjs");

const ROOT = path.join(__dirname, "..");

describe("complete browser permissions policy", () => {
  it("declares every controlled feature in every preset", () => {
    assert.deepEqual(FEATURE_ORDER, [
      "camera", "microphone", "geolocation", "payment", "accelerometer", "gyroscope"
    ]);
    for (const [name, preset] of Object.entries(PRESETS)) {
      assert.deepEqual(Object.keys(preset).sort(), [...FEATURE_ORDER].sort(), name);
      const policy = permissionsPolicyFor(name);
      for (const feature of FEATURE_ORDER) {
        assert.match(policy, new RegExp(`(?:^|, )${feature}=\\([^,]*\\)(?:, |$)`), `${name} omits ${feature}`);
      }
      assert.doesNotMatch(policy, /=\*/, `${name} widens a controlled feature to every origin`);
    }
  });

  it("denies motion sensors globally while preserving explicit same-origin features", () => {
    const policy = permissionsPolicyFor("default");
    assert.match(policy, /camera=\(\)/);
    assert.match(policy, /microphone=\(self\)/);
    assert.match(policy, /geolocation=\(self\)/);
    assert.match(policy, /payment=\(self\)/);
    assert.match(policy, /accelerometer=\(\)/);
    assert.match(policy, /gyroscope=\(\)/);
  });

  it("opens motion only on device feedback and keeps camera denied there", () => {
    const policy = permissionsPolicyFor("device_feedback");
    assert.match(policy, /accelerometer=\(self\)/);
    assert.match(policy, /gyroscope=\(self\)/);
    assert.match(policy, /camera=\(\)/);
  });

  it("opens creator camera/microphone without silently reopening motion sensors", () => {
    const policy = permissionsPolicyFor("creator_generation");
    assert.match(policy, /camera=\(self\)/);
    assert.match(policy, /microphone=\(self\)/);
    assert.match(policy, /accelerometer=\(\)/);
    assert.match(policy, /gyroscope=\(\)/);
  });

  it("refuses partial, wildcard, and unknown policy construction", () => {
    assert.throws(() => serializePolicy({ camera: "()" }), /explicitly declare every controlled feature/);
    assert.throws(() => serializePolicy({
      ...PRESETS.default,
      camera: "*"
    }), /unsupported allowlist/);
    assert.throws(() => permissionsPolicyFor("invented"), /unknown permissions policy preset/);
  });

  it("routes use named complete presets instead of ad-hoc header strings", () => {
    const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
    const creator = fs.readFileSync(path.join(ROOT, "routes", "creator-generation-routes.cjs"), "utf8");
    const device = fs.readFileSync(path.join(ROOT, "routes", "sonara-last9-routes.cjs"), "utf8");

    assert.match(server, /setHeader\("Permissions-Policy", permissionsPolicyFor\("default"\)\)/);
    assert.match(creator, /res\.set\("Permissions-Policy", permissionsPolicyFor\("creator_generation"\)\)/);
    assert.match(device, /res\.set\("Permissions-Policy", permissionsPolicyFor\("device_feedback"\)\)/);
  });

  it("has no literal Permissions-Policy header in server or route modules", () => {
    const files = [
      path.join(ROOT, "server.js"),
      ...fs.readdirSync(path.join(ROOT, "routes"))
        .filter((name) => name.endsWith(".cjs"))
        .map((name) => path.join(ROOT, "routes", name))
    ];
    const offenders = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      if (/(?:setHeader|\.set)\(\s*["']Permissions-Policy["']\s*,\s*["'`]/.test(source)) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    assert.deepEqual(offenders, [], `ad-hoc Permissions-Policy headers bypass the complete preset: ${offenders.join(", ")}`);
  });
});
