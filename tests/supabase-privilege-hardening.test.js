const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

describe("Supabase Data API privilege hardening", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260718064853_data_api_privilege_hardening.sql"
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("makes future public Data API objects opt-in", () => {
    assert.match(sql, /alter default privileges for role postgres in schema public/i);
    assert.match(sql, /revoke select, insert, update, delete on tables from anon, authenticated, service_role/i);
    assert.match(sql, /revoke usage, select on sequences from anon, authenticated, service_role/i);
    assert.match(sql, /revoke execute on functions from anon, authenticated, service_role/i);
    assert.match(sql, /revoke execute on functions from public/i);
  });

  it("keeps anonymous callers away from authorization RPC helpers", () => {
    assert.match(sql, /revoke execute on function public\.is_org_member\(uuid\) from public, anon/i);
    assert.match(sql, /grant execute on function public\.is_org_member\(uuid\) to authenticated, service_role/i);
    assert.doesNotMatch(sql, /grant\s+execute\s+on\s+function[\s\S]*?\s+to\s+anon\b/i);
  });

  it("locks authorization helper search paths", () => {
    const requiredHelpers = [
      "set_updated_at()",
      "is_org_member(uuid)",
      "has_org_role(uuid, text[])",
      "is_admin_or_founder()",
      "is_org_owner_or_admin(uuid)",
      "sonara_is_org_member(uuid)",
      "sonara_has_org_role(uuid, text[])",
      "is_entity_member(uuid)",
      "has_entity_role(uuid, public.entity_member_role[])",
      "can_manage_entity(uuid)"
    ];

    for (const helper of requiredHelpers) {
      assert.ok(
        sql.toLowerCase().includes(`alter function public.${helper} set search_path = ''`),
        `missing locked search_path for public.${helper}`
      );
    }
  });

  it("derives platform admin status from global user roles, not tenant membership", () => {
    const helper = sql.match(/create or replace function public\.is_admin_or_founder\(\)[\s\S]*?\$\$;/i)?.[0] || "";
    assert.match(helper, /security invoker/i);
    assert.match(helper, /from public\.user_roles roles/i);
    assert.match(helper, /roles\.user_id = \(select auth\.uid\(\)\)/i);
    assert.doesNotMatch(helper, /organization_memberships/i);
  });

  it("self-checks negative anonymous and positive authenticated execution", () => {
    assert.match(sql, /has_function_privilege\('anon', helper, 'execute'\)/i);
    assert.match(sql, /not has_function_privilege\('authenticated', helper, 'execute'\)/i);
    assert.match(sql, /not has_function_privilege\('service_role', helper, 'execute'\)/i);
  });
});
