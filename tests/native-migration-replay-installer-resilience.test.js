"use strict";

// Native migration replay must distinguish infrastructure provisioning failures
// from SQL replay failures. All jobs must retain enough evidence to diagnose either.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "native-migration-replay.yml"),
  "utf8"
);

describe("native PostgreSQL replay infrastructure resilience", () => {
  it("initializes failure evidence before any network package installation", () => {
    const init = source.indexOf("- name: Initialize native replay evidence");
    const install = source.indexOf("- name: Install native PostgreSQL");
    assert.ok(init >= 0 && install > init, "evidence must exist when install fails");
    assert.match(source, /mkdir -p replay-evidence/);
    assert.match(source, /git rev-parse HEAD > replay-evidence\/commit\.txt/);
    assert.match(source, /PostgreSQL major:/);
    assert.match(source, /if: always\(\)/);
    assert.match(source, /path: replay-evidence\//);
    assert.match(source, /if-no-files-found: error/);
  });

  it("retries external key downloads and OS packages, logging errors", () => {
    assert.match(source, /--retry 5 --retry-all-errors --retry-delay 3/);
    assert.match(source, /--connect-timeout 15 --max-time 120/);
    assert.match(source, /-o "\$RUNNER_TEMP\/postgresql-signing-key\.asc"/);
    assert.match(source, /sudo install -m 0644 "\$RUNNER_TEMP\/postgresql-signing-key\.asc"/);
    assert.match(source, /apt-get -o Acquire::Retries=5 update/);
    assert.match(source, /apt-get -o Acquire::Retries=5 install/);
    assert.match(source, /2>&1 \| tee replay-evidence\/install\.log/);
    assert.match(source, /set -euo pipefail/);
  });

  it("keeps required replay strict and does not hide failures", () => {
    assert.match(source, /if \[ "\$POSTGRES_MAJOR" != "16" \]; then/);
    assert.match(source, /postgresql-\$POSTGRES_MAJOR/);
    assert.match(source, /SONARA_MIGRATION_REPLAY_REQUIRED: "1"/);
    assert.match(source, /node scripts\/verify-migration-replay\.mjs --postgres-bin "\$POSTGRES_BIN"/);
    assert.doesNotMatch(source, /continue-on-error:\s*true/);
  });
});
