"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrations = path.join(__dirname, "..", "supabase", "migrations");
const bridgeName = "20260919032950_prepare_org_membership_helpers_for_replay.sql";
const hardeningName = "20260919033000_organization_tenant_boundary_hardening.sql";
const bridge = fs.readFileSync(path.join(migrations, bridgeName), "utf8");
const hardening = fs.readFileSync(path.join(migrations, hardeningName), "utf8");

describe("organization helper replay bridge", () => {
  it("runs after the existing owner-helper bridge and before frozen tenant hardening", () => {
    assert.ok("20260919032900_prepare_org_owner_helper_for_replay.sql" < bridgeName);
    assert.ok(bridgeName < hardeningName);
  });

  it("normalizes the two live legacy parameter names without doing the later hardening early", () => {
    assert.match(bridge, /public\.is_org_member\(target_organization_id uuid\)/i);
    assert.match(bridge, /public\.has_org_role\(target_organization_id uuid, target_role text\)/i);
    assert.equal((bridge.match(/'target_org_id'::text/g) || []).length, 2);
    assert.match(bridge, /from public\.organization_members\b/i);
    assert.doesNotMatch(
      bridge,
      /from public\.organization_memberships memberships[\s\S]*memberships\.status = 'active'/i,
      "the bridge must not pretend the frozen hardening already ran"
    );

    assert.match(hardening, /from public\.organization_memberships memberships/i);
    assert.match(hardening, /memberships\.status = 'active'/i);
  });

  it("derives real policy dependencies from PostgreSQL and refuses every unsupported dependency", () => {
    assert.match(bridge, /from pg_depend d/i);
    assert.match(bridge, /d\.classid <> 'pg_policy'::regclass/i);
    assert.match(bridge, /unsupported dependencies/i);
    assert.match(bridge, /join pg_policy p/i);
    assert.match(bridge, /select distinct[\s\S]*p\.oid/i);
  });

  it("drops helpers without CASCADE and reconstructs every captured policy", () => {
    assert.match(bridge, /drop function public\.is_org_member\(uuid\);/i);
    assert.match(bridge, /drop function public\.has_org_role\(uuid, text\);/i);
    assert.doesNotMatch(bridge, /drop function[^;]*cascade/i);
    assert.match(bridge, /pg_get_expr\(p\.polqual, p\.polrelid\)/i);
    assert.match(bridge, /pg_get_expr\(p\.polwithcheck, p\.polrelid\)/i);
    assert.match(bridge, /create policy %I on %I\.%I as %s for %s to %s%s%s/i);
    assert.match(bridge, /captured % policies but restored %/i);
  });

  it("fails closed on unexpected live shapes instead of guessing", () => {
    assert.match(bridge, /does not exist/i);
    assert.match(bridge, /unexpected first input parameter name/i);
    assert.match(bridge, /no dependent policies captured/i);
    assert.match(bridge, /unknown command/i);
    assert.match(bridge, /first parameter is still/i);
  });
});
