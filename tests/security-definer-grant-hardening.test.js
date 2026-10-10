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

describe("policy authorization helpers move privileged logic behind a private schema", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20261008130000_move_rls_definer_logic_to_private_schema.sql"),
    "utf8"
  );
  const report = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "report-security-definer-exposure.mjs"),
    "utf8"
  );

  const helpers = [
    "can_manage_entity",
    "has_entity_role",
    "has_org_role",
    "is_entity_member",
    "is_org_member",
    "is_org_owner_or_admin",
    "sonara_is_org_member"
  ];

  it("puts privileged helper bodies in private and leaves public compatibility wrappers as invokers", () => {
    assert.match(migration, /create schema if not exists private/i);
    for (const helper of helpers) {
      assert.match(migration, new RegExp(`create or replace function private\\.${helper}\\b[\\s\\S]*?security definer`, "i"));
      assert.match(migration, new RegExp(`create or replace function public\\.${helper}\\b[\\s\\S]*?security invoker`, "i"));
      assert.match(migration, new RegExp(`private\\.${helper}\\(`, "i"));
    }
  });

  it("keeps anonymous callers out while authenticated policy evaluation and server paths can execute", () => {
    assert.match(migration, /revoke all on schema private from public, anon, authenticated, service_role/i);
    assert.match(migration, /grant usage on schema private to authenticated, service_role/i);
    assert.match(migration, /from public, anon/i);
    assert.match(migration, /to authenticated, service_role/i);
    assert.match(migration, /has_schema_privilege\('anon', 'private', 'usage'\)/i);
    assert.match(migration, /has_function_privilege\('anon', private_oid, 'execute'\)/i);
  });

  it("pins search_path and verifies public/private privilege class instead of trusting migration text", () => {
    assert.match(migration, /set search_path = ''/i);
    assert.match(migration, /public_is_definer/i);
    assert.match(migration, /private_is_definer/i);
    assert.match(migration, /public authorization helper remains SECURITY DEFINER/i);
    assert.match(migration, /private authorization helper is not SECURITY DEFINER/i);
  });

  it("updates the exposure report so a complete private-helper transition is not misreported as parser blindness", () => {
    assert.match(report, /privateDefinerNames/);
    assert.match(report, /POLICY_HELPERS/);
    assert.match(report, /private authorization-helper transition is partial/);
    assert.match(report, /policy helper\(s\) remain exposed SECURITY DEFINER after private transition/);
  });
});

