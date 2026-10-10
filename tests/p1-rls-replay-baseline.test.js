// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const replay = read("tests/sql/p1-rls-initplan-policy-dedup-rollback.sql");
const migration = read("supabase/migrations/011_sonara_saas_launch_system.sql");
const audit = read("scripts/sql/postgres-subscriptions-policy-reconciliation.sql");
const sqlCode = (source) => source.replace(/--[^\n]*/g, "");

describe("native P1 RLS replay uses migration-defined policy baselines", () => {
  it("keeps exactly 21 service role and four owner policies without broadening anything", () => {
    const begin = replay.indexOf("INSERT INTO expected_rls_p1 VALUES");
    const end = replay.indexOf("\n\nDO $drift$", begin);
    assert.ok(begin >= 0 && end > begin, "missing expected policy table");
    const rows = replay.slice(begin, end).split("\n").filter((line) => /^\s+\('/.test(line));
    assert.equal(rows.length, 25, "the 25 hardened policy contracts cannot drift");
    assert.equal(rows.filter((r) => r.includes("'{service_role}'") && r.includes("'true', 'true'")).length, 21);
    assert.equal(rows.filter((r) => r.includes("'{authenticated}'") &&
      r.includes("'(( SELECT auth.uid() AS uid) = user_id)', NULL")).length, 4);
    assert.match(replay, /P1 policy definition drift on % policies; abort/);
    assert.match(replay, /P1 postflight failed % policies/);
    for (const predicate of ["p.roles::text IS DISTINCT FROM e.roles",
      "p.cmd IS DISTINCT FROM e.cmd", "p.qual IS DISTINCT FROM e.qualifier",
      "p.with_check IS DISTINCT FROM e.check_expr"]) {
      assert.ok(replay.split(predicate).length >= 3, `both checks must enforce ${predicate}`);
    }
  });
  it("does not require preview-only subscriptions policies during native replay", () => {
    assert.match(migration, /create policy "subscriptions_select_member" on public\.subscriptions for select to authenticated using \(public\.is_org_member\(organization_id\) or public\.is_admin_or_founder\(\)\)/i);
    assert.match(replay, /policyname='subscriptions_select_member'/);
    assert.match(replay, /canonical subscriptions_select_member definition drifted; abort/);
    assert.match(replay, /native replay unexpectedly contains preview-only subscriptions policies; abort/);
    assert.match(replay, /policyname IN \('Users can view own subscriptions',/);
    assert.equal(replay.split("= 'is_org_memberorganization_idoris_admin_or_founder'").length - 1, 2,
      "preflight and postflight must require the complete canonical member/admin predicate");
    assert.match(replay, /replace\(regexp_replace\(lower\(qual\)/);
    assert.doesNotMatch(sqlCode(replay), /qual LIKE /i);
  });
  it("performs no policy DDL or live cleanup in the rollback-only fixture", () => {
    assert.match(replay, /^BEGIN;/m);
    assert.match(replay, /^ROLLBACK;\s*$/m);
    assert.doesNotMatch(sqlCode(replay), /\b(?:CREATE|ALTER|DROP)\s+POLICY\b/i);
    assert.match(replay, /p1_rls_hygiene_staging_passed/);
  });
  it("keeps preview-only reconciliation read-only and evidence-based", () => {
    const statements = sqlCode(audit);
    assert.doesNotMatch(statements, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
    assert.match(statements, /FROM pg_policies/g);
    assert.match(statements, /distinct_effective_definitions/);
    assert.match(statements, /exact_approved_shape_count/);
    assert.match(audit, /not a migration/i);
  });
});
