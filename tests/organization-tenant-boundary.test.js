"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260919033000_organization_tenant_boundary_hardening.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("canonical organization tenant boundary", () => {
  it("resolves membership through organization_memberships and active status", () => {
    assert.match(sql, /create or replace function public\.is_org_member\(target_organization_id uuid\)/i);
    assert.match(sql, /from public\.organization_memberships memberships/i);
    assert.match(sql, /memberships\.status = 'active'/i);
    assert.match(sql, /memberships\.user_id = \(select auth\.uid\(\)\)/i);
  });

  it("repairs both has_org_role overloads onto the canonical membership source", () => {
    assert.match(sql, /public\.has_org_role\(target_organization_id uuid, target_role text\)/i);
    assert.match(sql, /public\.has_org_role\(target_organization_id uuid, allowed_roles text\[\]\)/i);
    const canonicalReferences = sql.match(/from public\.organization_memberships memberships/gi) || [];
    assert.ok(canonicalReferences.length >= 3, "membership helpers are not consistently canonical");
  });

  it("removes anonymous Data API access to organization authority tables", () => {
    for (const table of ["organizations", "organization_memberships", "business_memberships"]) {
      assert.match(
        sql,
        new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated`, "i")
      );
    }
  });

  it("keeps membership mutation server-authoritative", () => {
    assert.match(sql, /grant select on table public\.organization_memberships to authenticated/i);
    assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete)[^;]*organization_memberships\s+to\s+authenticated/i);
    assert.match(sql, /service_role_organization_memberships_all/i);
  });

  it("quarantines but does not destructively drop the legacy membership table", () => {
    assert.match(sql, /to_regclass\('public\.organization_members'\)/i);
    assert.match(sql, /revoke all privileges on table public\.organization_members from anon, authenticated/i);
    assert.doesNotMatch(sql, /drop table(?: if exists)? public\.organization_members/i);
  });

  it("contains migration-time assertions against identity-source regression", () => {
    assert.match(sql, /tenant hardening failed: is_org_member is not canonical/i);
    assert.match(sql, /tenant hardening failed: scalar has_org_role is not canonical/i);
    assert.match(sql, /tenant hardening failed: anon still has organization authority table access/i);
  });
});
