"use strict";

// Offline contract checks. PostgreSQL replay and role-matrix tests remain
// mandatory release gates; these checks do not pretend to run SQL.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const filename = "20261008090000_consolidate_postgres_index_rls_hygiene.sql";
const file = path.join(root, "supabase", "migrations", filename);
const source = fs.readFileSync(file, "utf8");
const normalized = source.replace(/\r\n/g, "\n");
const pinned = JSON.parse(fs.readFileSync(path.join(root, "supabase", "applied-migration-checksums.json"), "utf8"));

describe("PostgreSQL optimization never broadens RLS or migration history", () => {
  it("pins the new migration exactly, rather than editing a shipped one", () => {
    assert.equal(pinned[filename], createHash("sha256").update(normalized).digest("hex"));
    assert.ok(filename.startsWith("20261008"), "new repair must be a later migration");
  });

  it("is all-or-nothing with time-limited schema locks and drift guards", () => {
    assert.match(source, /\bBEGIN;/);
    assert.match(source, /SET LOCAL lock_timeout = '2s';/);
    assert.match(source, /SET LOCAL statement_timeout = '30s';/);
    assert.match(source, /RAISE EXCEPTION 'RLS policy definition changed; abort'/);
    assert.match(source, /RAISE EXCEPTION 'employee_schedules indexes differ or missing; abort'/);
    assert.match(source, /RAISE EXCEPTION 'entities slug indexes differ or missing; abort'/);
    assert.match(source, /\bCOMMIT;\s*$/);
  });

  it("removes only two redundant indexes, keeping the key and ordered access paths", () => {
    const dropped = [...source.matchAll(/^DROP INDEX public\.([a-z0-9_]+);$/gmi)].map(x => x[1]).sort();
    assert.deepEqual(dropped, ["employee_schedules_org_starts_at_idx", "entities_slug_idx"]);
    assert.match(source, /to_regclass\('public\.employee_schedules_organization_starts_at_idx'\) IS NULL/);
    assert.match(source, /to_regclass\('public\.entities_slug_key'\) IS NULL/);
    assert.doesNotMatch(source, /\bDROP\s+(?:TABLE|POLICY|CONSTRAINT)\b/i);
    assert.doesNotMatch(source, /\bCREATE\s+INDEX\b/i);
  });

  it("changes precisely three scalar non-correlated RLS predicates, retaining ownership", () => {
    const alterations = [...source.matchAll(/^ALTER POLICY\s+(.+)$/gmi)];
    assert.equal(alterations.length, 3);
    assert.match(source, /WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\)/);
    assert.match(source, /USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
    assert.match(source, /USING \(\(SELECT auth\.uid\(\)\) = follower_user_id\)/);
    assert.doesNotMatch(source, /\bGRANT\b|\bREVOKE\b|\bDISABLE ROW LEVEL SECURITY\b/i);
    assert.doesNotMatch(source, /\bCREATE POLICY\b|\bDROP POLICY\b/i);
  });
});


describe("post-hardening P1 replay proof remains fail-closed", () => {
  const fixture = fs.readFileSync(path.join(root, "tests", "sql", "p1-rls-initplan-policy-dedup-rollback.sql"), "utf8");
  const replay = fs.readFileSync(path.join(root, "scripts", "verify-migration-replay.mjs"), "utf8");
  const withoutComments = fixture.replace(/^--[^\n]*$/gm, "");

  it("requires exactly 21 service-only and four user-ownership policy definitions", () => {
    const match = fixture.match(/INSERT INTO expected_rls_p1 VALUES([\s\S]*?);/);
    assert.ok(match, "P1 exact baseline or drift guard is missing");
    const rows = match[1].split("\n").filter((row) => row.trim().startsWith("('"));
    assert.equal(rows.length, 25, "P1 policy catalog must not silently shrink");
    const unique = rows.map((row) => row.split("', '").slice(0, 2).join("."));
    assert.equal(new Set(unique).size, 25, "P1 duplicate names hide missing protected policies");
    const service = rows.filter((row) => row.includes("'{service_role}'"));
    const ownership = rows.filter((row) => row.includes("'{authenticated}'"));
    assert.equal(service.length, 21, "all pure service policies must stay role-scoped");
    assert.equal(ownership.length, 4, "all owner policies must stay authenticated and user-scoped");
    assert.ok(service.every((row) => /'ALL', 'true', 'true'/.test(row)), "service policy must retain its exact roles and checks");
    assert.ok(ownership.every((row) => /'SELECT', '\(\( SELECT auth\.uid\(\) AS uid\) = user_id\)', NULL/.test(row)),
      "ownership must use cached authenticated UID tied to the row");
  });

  it("enforces role/command/USING/WITH CHECK equality both before and after the probe", () => {
    assert.match(fixture, /p\.roles::text IS DISTINCT FROM e\.roles/g);
    for (const region of [fixture.split("DO $drift$")[1].split("$drift$;")[0], fixture.split("DO $postflight$")[1]]) {
      assert.ok(region.includes("p.roles::text IS DISTINCT FROM e.roles"));
    }
    for (const criterion of ["p.cmd IS DISTINCT FROM e.cmd", "p.qual IS DISTINCT FROM e.qualifier",
      "p.with_check IS DISTINCT FROM e.check_expr", "p.permissive IS DISTINCT FROM e.permissive"]) {
      for (const region of [fixture.split("DO $drift$")[1].split("$drift$;")[0], fixture.split("DO $postflight$")[1]]) {
        assert.ok(region.includes(criterion), criterion + " must be checked preflight and postflight");
      }
    }
    assert.match(fixture, /RAISE EXCEPTION 'P1 policy definition drift on % policies; abort'/);
    assert.match(fixture, /RAISE EXCEPTION 'P1 postflight failed % policies'/);
  });

  it("treats migration-only subscription policy as authoritative instead of copying preview drift", () => {
    assert.match(fixture, /policyname='subscriptions_select_member'/);
    assert.match(fixture, /is_org_memberorganization_idoris_admin_or_founder/);
    assert.match(fixture, /policyname IN \('Users can view own subscriptions',/);
    assert.match(fixture, /'Users can view their own subscription'\)\) <> 0/);
    assert.doesNotMatch(withoutComments, /^\s*(?:CREATE|ALTER|DROP)\s+POLICY\b/gmi,
      "a staging-only replay must not mutate any applied RLS policy");
  });

  it("keeps the two-tenant write/deny test ahead of P1 and rolls its probe back", () => {
    const matrix = replay.indexOf("P0 synthetic two-tenant and role-based RLS write/deny matrix");
    const p1 = replay.indexOf('behaves(psql, "P1 post-hardening RLS and canonical subscription proof"');
    assert.ok(matrix >= 0 && p1 > matrix, "the P0 role matrix must run before P1");
    assert.match(fixture, /BEGIN;\s*SET LOCAL lock_timeout='2s';\s*SET LOCAL statement_timeout='30s';/);
    assert.match(fixture, /SELECT 'p1_rls_hygiene_staging_passed';\s*ROLLBACK;\s*$/);
  });
});


describe("subscription policy drift report is read-only", () => {
  it("compares migration-defined access with both untracked preview policies without writing DDL", () => {
    const audit = fs.readFileSync(path.join(root, "scripts", "sql", "postgres-p1-p2-candidate-review.sql"), "utf8");
    const marker = "-- Subscription migration-vs-catalog RLS drift";
    const at = audit.indexOf(marker);
    assert.ok(at >= 0, "the cross-environment subscription policy report is missing");
    const section = audit.slice(at);
    for (const policy of ["subscriptions_select_member", "Users can view own subscriptions",
      "Users can view their own subscription"]) {
      assert.ok(section.includes(policy), "missing comparison for " + policy);
    }
    for (const result of ["missing_migration_policy", "migration_policy_definition_drift",
      "extra_policy_not_in_migration_history", "migration_policy_matches"]) {
      assert.ok(section.includes(result), "missing explicit review status " + result);
    }
    const unquotedSql = section.replace(/^--[^\n]*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
    assert.doesNotMatch(unquotedSql, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i,
      "this audit must only read catalog metadata");
    assert.match(section, /FROM pg_policies/);
    assert.match(section, /ORDER BY n.name;\s*$/);
  });
});
