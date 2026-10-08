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

describe("current service-role RLS policy hardening", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261008100000_tighten_service_role_rls_policies.sql"
  );
  const migration = readFileSync(migrationPath, "utf8");

  it("narrows pure service-role policies instead of deleting them", () => {
    assert.match(migration, /alter policy %I on %I\.%I to service_role using \(true\) with check \(true\)/i);
    assert.match(migration, /alter policy %I on %I\.%I to service_role using \(true\)/i);
    assert.match(migration, /alter policy %I on %I\.%I to service_role with check \(true\)/i);
    assert.doesNotMatch(migration, /drop\s+policy/i);
  });

  it("does not rewrite mixed member or administrator authorization predicates", () => {
    assert.match(migration, /Mixed policies such as "member OR service role" are deliberately excluded/i);
    assert.match(migration, /complete predicate is the service-role/i);
  });

  it("converts the four remaining ownership checks to init-plan-safe auth.uid reads", () => {
    for (const policy of [
      "business_employee_profiles_select_own",
      "sonara_platforms_select_own",
      "user_notifications_select_own",
      "user_preferences_select_own"
    ]) {
      const start = migration.indexOf(`alter policy ${policy}`);
      assert.notEqual(start, -1, `missing ownership policy hardening for ${policy}`);
      const fragment = migration.slice(start, start + 220);
      assert.match(fragment, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
    }
  });

  it("fails instead of reporting a vacuous hardening pass", () => {
    assert.match(migration, /rewritten_count = 0/i);
    assert.match(migration, /refusing vacuous success/i);
    assert.match(migration, /remaining <> 0/i);
    assert.match(migration, /pure service-role RLS policies still evaluate auth\.role/i);
  });
});

describe("closed RLS tables grant no browser SQL privileges", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261008110000_revoke_browser_privileges_from_closed_rls_tables.sql"
  );
  const migration = readFileSync(migrationPath, "utf8");

  it("targets only public tables that have RLS enabled and zero policies", () => {
    assert.match(migration, /n\.nspname = 'public'/i);
    assert.match(migration, /c\.relrowsecurity/i);
    assert.match(migration, /not exists \([\s\S]*from pg_policy p[\s\S]*p\.polrelid = c\.oid/i);
  });

  it("revokes the complete table privilege layer from browser roles without touching service_role", () => {
    assert.match(
      migration,
      /revoke all privileges on table %I\.%I from anon, authenticated/i
    );
    assert.doesNotMatch(migration, /from anon, authenticated, service_role/i);
    assert.doesNotMatch(migration, /revoke[\s\S]*service_role/i);
  });

  it("covers privilege classes that RLS does not protect", () => {
    assert.match(migration, /has_table_privilege\('anon', c\.oid, 'TRUNCATE'\)/i);
    assert.match(migration, /has_table_privilege\('anon', c\.oid, 'REFERENCES'\)/i);
    assert.match(migration, /has_table_privilege\('anon', c\.oid, 'TRIGGER'\)/i);
    assert.match(migration, /has_table_privilege\('authenticated', c\.oid, 'TRUNCATE'\)/i);
    assert.match(migration, /has_table_privilege\('authenticated', c\.oid, 'REFERENCES'\)/i);
    assert.match(migration, /has_table_privilege\('authenticated', c\.oid, 'TRIGGER'\)/i);
  });

  it("fails closed on vacuous execution, surviving grants, or explicit column ACLs", () => {
    assert.match(migration, /hardened_tables = 0/i);
    assert.match(migration, /refusing vacuous success/i);
    assert.match(migration, /remaining_table_grants <> 0/i);
    assert.match(migration, /explicit_column_acls <> 0/i);
  });
});

describe("pgvector extension schema hardening", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261008120000_move_vector_extension_to_extensions_schema.sql"
  );
  const migration = readFileSync(migrationPath, "utf8");

  it("preserves the optional pgvector fallback instead of creating a new launch dependency", () => {
    assert.match(migration, /if not found then[\s\S]*pgvector is not installed/i);
    assert.match(migration, /return;/i);
    assert.doesNotMatch(migration, /create extension(?: if not exists)? vector/i);
  });

  it("moves only a relocatable public vector extension into extensions", () => {
    assert.match(migration, /if not relocatable then/i);
    assert.match(migration, /if current_schema = 'public' then[\s\S]*alter extension vector set schema extensions/i);
    assert.match(migration, /current_schema <> 'extensions'/i);
  });

  it("verifies both the extension namespace and an existing vector column namespace", () => {
    assert.match(migration, /pgvector remains in schema %, expected extensions/i);
    assert.match(migration, /c\.relname = 'sonara_memory_records'/i);
    assert.match(migration, /a\.attname = 'embedding'/i);
    assert.match(migration, /embedding_type_name = 'vector'/i);
    assert.match(migration, /embedding_type_schema <> 'extensions'/i);
  });
});

