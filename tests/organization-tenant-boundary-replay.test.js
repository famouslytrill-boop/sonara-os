"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const migrationName = "20260919032950_prepare_org_member_and_role_helpers_for_replay.sql";
const migrationPath = path.join(__dirname, "..", "supabase", "migrations", migrationName);
const hardeningPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260919033000_organization_tenant_boundary_hardening.sql"
);
const manifestPath = path.join(__dirname, "..", "supabase", "applied-migration-checksums.json");

const sql = fs.readFileSync(migrationPath, "utf8");
const hardeningSql = fs.readFileSync(hardeningPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

describe("organization authorization helper replay bridge", () => {
  it("sorts before the frozen tenant hardening migration without editing it", () => {
    assert.ok(migrationName < "20260919033000_organization_tenant_boundary_hardening.sql");
    assert.match(
      hardeningSql,
      /create or replace function public\.is_org_member\(target_organization_id uuid\)/i
    );
    assert.match(
      hardeningSql,
      /public\.has_org_role\(target_organization_id uuid, target_role text\)/i
    );
  });

  it("recognizes only the observed legacy and canonical parameter names", () => {
    assert.match(sql, /member_arg_1 = 'target_org_id'/i);
    assert.match(sql, /member_arg_1 = 'target_organization_id'/i);
    assert.match(sql, /scalar_role_arg_1 = 'target_org_id'/i);
    assert.match(sql, /scalar_role_arg_1 = 'target_organization_id'/i);
    assert.match(sql, /unexpected is_org_member input parameter name/i);
    assert.match(sql, /unexpected scalar has_org_role input parameter names/i);
  });

  it("preflights the helper signatures that were already canonical in production", () => {
    assert.match(sql, /array_role_arg_1 <> 'target_organization_id'/i);
    assert.match(sql, /array_role_arg_2 <> 'allowed_roles'/i);
    assert.match(sql, /owner_arg_1 <> 'target_organization_id'/i);
  });

  it("captures exact RLS policy dependencies from PostgreSQL catalogs", () => {
    assert.match(sql, /from pg_policy p/i);
    assert.match(sql, /from pg_depend d/i);
    assert.match(sql, /d\.classid = 'pg_policy'::regclass/i);
    assert.match(sql, /d\.refclassid = 'pg_proc'::regclass/i);
    assert.match(sql, /'permissive', p\.polpermissive/i);
    assert.match(sql, /'command', p\.polcmd/i);
    assert.match(sql, /'roles', to_jsonb\(p\.polroles\)/i);
    assert.match(sql, /pg_get_expr\(p\.polqual, p\.polrelid\)/i);
    assert.match(sql, /pg_get_expr\(p\.polwithcheck, p\.polrelid\)/i);
  });

  it("drops only the drifted helpers and never uses CASCADE", () => {
    assert.match(sql, /drop function public\.is_org_member\(uuid\)/i);
    assert.match(sql, /drop function public\.has_org_role\(uuid, text\)/i);
    assert.doesNotMatch(sql, /^\\s*drop\\s+function\\s+public\\.(?:is_org_member|has_org_role)\\([^)]*\\)\\s+cascade\\s*;/im);
  });

  it("recreates both helpers on the canonical active-membership source", () => {
    assert.match(sql, /create function public\.is_org_member\(target_organization_id uuid\)/i);
    assert.match(
      sql,
      /create function public\.has_org_role\(target_organization_id uuid, target_role text\)/i
    );
    const canonicalReferences = sql.match(/from public\.organization_memberships memberships/gi) || [];
    assert.equal(canonicalReferences.length, 2);
    const activeChecks = sql.match(/memberships\.status = ''active''/gi) || [];
    assert.equal(activeChecks.length, 2);
    assert.doesNotMatch(sql, /from public\.organization_members\b/i);
  });

  it("restores every captured policy and fails if counts diverge", () => {
    assert.match(sql, /create policy %I on %I\.%I as %s for %s to %s%s%s/i);
    assert.match(sql, /restored_count := restored_count \+ 1/i);
    assert.match(sql, /if restored_count <> captured_count then/i);
  });

  it("pins the new migration exactly under the immutable migration gate", () => {
    const digest = crypto
      .createHash("sha256")
      .update(sql.replace(/\r\n/g, "\n"), "utf8")
      .digest("hex");
    assert.equal(manifest[migrationName], digest);
  });
});
