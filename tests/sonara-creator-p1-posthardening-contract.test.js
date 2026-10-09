// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { OPTIONAL_CAPABILITY, REQUIRED } = require("../lib/sonara-environment-classification.cjs");
const SQL = fs.readFileSync(path.resolve(__dirname,
  "./sql/p1-rls-initplan-policy-dedup-rollback.sql"), "utf8");
const rowBlock = SQL.split("INSERT INTO expected_rls_p1 VALUES")[1]?.split("DO $drift$")[0] || "";
const rows = rowBlock.split("\n").filter((line) => /^\s*\('/.test(line));

describe("Post-hardening Creator release-gate contract", () => {
  it("requires experimental story flags to be classified optional, never needed for paid core", () => {
    for (const key of ["SONARA_INTERACTIVE_DRAFT_PREVIEW_ENABLED",
      "SONARA_STORY_REVISION_PERSISTENCE_ENABLED"]) {
      assert.equal(OPTIONAL_CAPABILITY.has(key), true);
      assert.equal(REQUIRED.has(key), false);
    }
  });
  it("pins all 25 policy definitions, including stronger service-only role scoping", () => {
    assert.equal(rows.length, 25);
    const service = rows.filter((row) => row.includes("'{service_role}', 'ALL', 'true', 'true'"));
    const ownership = rows.filter((row) => row.includes("'{authenticated}', 'SELECT', '(( SELECT auth.uid() AS uid) = user_id)', NULL"));
    assert.equal(service.length, 21);
    assert.equal(ownership.length, 4);
    assert.equal(rows.some((row) => row.includes("'{public}'")), false);
    assert.equal(rows.some((row) => row.includes("'(auth.role() = ")), false);
  });
  it("keeps an exact security preflight, postflight, tenant proof and rollback", () => {
    assert.match(SQL, /p\.permissive IS DISTINCT FROM e\.permissive/);
    assert.match(SQL, /p\.roles::text IS DISTINCT FROM e\.roles/);
    assert.match(SQL, /p\.cmd IS DISTINCT FROM e\.cmd/);
    assert.match(SQL, /p\.qual IS DISTINCT FROM e\.qualifier/);
    assert.match(SQL, /p\.with_check IS DISTINCT FROM e\.check_expr/);
    assert.match(SQL, /P1 policy definition drift on % policies; abort/);
    assert.match(SQL, /P1 subscription role or predicate drift; abort/);
    assert.match(SQL, /P1 subscription policy postflight drift/);
    assert.match(SQL, /IF service_count <> 21 OR ownership_count <> 4/);
    assert.match(SQL.trimEnd(), /ROLLBACK;$/);
    assert.equal(SQL.includes("DROP POLICY"), false);
    assert.equal(SQL.includes("ALTER POLICY"), false);
  });
});
