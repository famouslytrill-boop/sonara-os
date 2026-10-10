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

  it("surfaces bounded P1 policy drift diagnostics without logging all replay query output", () => {
    const replay = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "verify-migration-replay.mjs"), "utf8"
    );
    assert.match(replay, /const p1 = what === "P1 RLS initplan and policy-overlap guarded rollback proof"/);
    assert.match(replay, /String\(result\.stdout \|\| ""\)\.split\(\/\\r\?\\n\/\)/);
    assert.match(replay, /\.filter\(\(line\) => line\.includes\("\|"\) && line\.length <= 320\)/);
    assert.match(replay, /\.slice\(0, 30\)\.join\("\\n"\)/);
    assert.match(replay, /Policy attribute differences \(staging only\)/);
    assert.match(replay, /String\(result\.stderr \|\| "SQL replay command failed without stderr\."\)/);
    assert.doesNotMatch(replay, /continue-on-error:\\s*true/);
  });

  it("guards 25 already-optimized policies and only rolls back an identical duplicate", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "..", "tests", "sql", "p1-rls-initplan-policy-dedup-rollback.sql"), "utf8"
    );
    const entries = sql.split("INSERT INTO expected_rls_p1 VALUES")[1].split(";")[0];
    const rows = entries.split("\n").filter((line) => /^\s*\('/.test(line));
    assert.equal(rows.length, 25, "all 25 reviewed policy contracts must be pinned");
    assert.equal(rows.filter((line) => line.includes("'{service_role}'") && line.includes("'ALL'")).length, 21);
    assert.equal(rows.filter((line) => line.includes("'{authenticated}'") && line.includes("'SELECT'")).length, 4);
    assert.equal(rows.filter((line) => line.includes("'true', 'true'")).length, 21);
    assert.equal(rows.filter((line) => line.includes("'(( SELECT auth.uid() AS uid) = user_id)', NULL")).length, 4);
    assert.match(sql, /RAISE EXCEPTION 'P1 policy definition drift on % policies; abort'/);
    assert.match(sql, /RAISE EXCEPTION 'subscriptions duplicate policy definitions drifted; abort'/);
    assert.match(sql, /RAISE EXCEPTION 'P1 postflight changed % unrelated policy definitions; abort'/);
    assert.match(sql, /DROP POLICY "Users can view their own subscription" ON public\.subscriptions;/);
    assert.equal((sql.match(/^DROP POLICY /gm) || []).length, 1);
    assert.doesNotMatch(sql, /^ALTER POLICY |^GRANT |^REVOKE |DISABLE ROW LEVEL SECURITY/mi);
    assert.match(sql, /SELECT 'p1_rls_hygiene_staging_passed';\s*ROLLBACK;\s*$/);
  });

  it("does not accept a loose policy role or predicate as equivalent to the reviewed baseline", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "..", "tests", "sql", "p1-rls-initplan-policy-dedup-rollback.sql"), "utf8"
    );
    for (const check of ["p.roles::text IS DISTINCT FROM e.roles", "p.qual IS DISTINCT FROM e.qualifier",
      "p.with_check IS DISTINCT FROM e.check_expr", "p.cmd IS DISTINCT FROM e.cmd",
      "p.permissive IS DISTINCT FROM e.permissive"]) {
      assert.ok(sql.split(check).length >= 4, `missing preflight, diagnostic or postflight guard: ${check}`);
    }
    assert.match(sql, /SELECT count\(\*\) FROM expected_rls_p1 WHERE roles='\{service_role\}' AND cmd='ALL'/);
    assert.match(sql, /SELECT count\(\*\) FROM expected_rls_p1 WHERE roles='\{authenticated\}' AND cmd='SELECT'/);
  });
});
