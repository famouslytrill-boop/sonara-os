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
