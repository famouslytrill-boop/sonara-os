// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "20260922100000_harden_unreferenced_authorization_rpc_grants.sql"),
  "utf8"
);

describe("authorization RPC grant hardening", () => {
  it("covers only the helpers proven not to be RLS policy dependencies", () => {
    for (const signature of [
      "public.has_company_access(uuid,text)",
      "public.has_scope(uuid,text)",
      "public.is_admin()",
      "public.is_current_user_admin()",
      "public.sonara_has_org_role(uuid,text[])"
    ]) {
      assert.ok(migration.includes(signature), `missing hardened signature: ${signature}`);
    }

    for (const policyHelper of [
      "can_manage_entity",
      "has_entity_role",
      "has_org_role",
      "is_entity_member",
      "is_org_member",
      "is_org_owner_or_admin",
      "sonara_is_org_member"
    ]) {
      assert.doesNotMatch(migration, new RegExp(`public\\.${policyHelper}\\(`));
    }
  });

  it("preserves the server-only execution path and pins search_path safely", () => {
    assert.match(migration, /alter function %s set search_path = %L/);
    assert.match(migration, /revoke execute on function %s from public, anon, authenticated/);
    assert.match(migration, /grant execute on function %s to service_role/);
    assert.match(migration, /if to_regprocedure\(signature\) is not null/);
  });
});
