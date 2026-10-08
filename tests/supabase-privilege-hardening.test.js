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

describe("server-only browser grant hardening", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261008110000_revoke_browser_grants_server_only_tables.sql"
  );
  const migration = readFileSync(migrationPath, "utf8");

  const targets = [
    "audit_logs",
    "billing_events",
    "db_health_snapshots",
    "platform_jobs",
    "prompt_templates",
    "sonara_control_plane_checks",
    "sonara_launch_settings",
    "sonara_realtime_channel_registry",
    "sonara_storage_bucket_registry",
    "sonara_ui_capability_registry",
    "sonara_webhook_verification_registry",
    "sonara_worker_job_registry",
    "sonara_write_api_registry"
  ];

  it("pins the reviewed server-only target set instead of sweeping every no-policy table", () => {
    for (const table of targets) {
      assert.match(migration, new RegExp(`['"]${table}['"]`));
    }
    assert.match(migration, /expected 13 tables/i);
    assert.doesNotMatch(migration, /for\s+target\s+in[\s\S]*pg_policies[\s\S]*revoke all privileges/i);
  });

  it("accepts only fully granted or already-hardened browser DML states", () => {
    assert.match(migration, /relrowsecurity/i);
    assert.match(migration, /policy_count <> 0/i);
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      assert.match(
        migration,
        new RegExp(`has_table_privilege\\(role_name, relation_name, '${privilege}'\\)::int`, "i")
      );
    }
    assert.match(migration, /not in \(0, 4\)/i);
    assert.match(migration, /fresh replay can legitimately have none/i);
    assert.match(migration, /browser grant precondition drift/i);
  });

  it("revokes browser table privileges while preserving backend DML", () => {
    assert.match(
      migration,
      /revoke all privileges on table public\.%I from anon, authenticated/i
    );
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      assert.match(
        migration,
        new RegExp(`has_table_privilege\\('service_role', relation_name, '${privilege}'\\)`, "i")
      );
    }
    assert.match(migration, /service_role DML privilege was changed/i);
  });

  it("does not invent customer policies, remove tables or mutate customer rows", () => {
    assert.doesNotMatch(migration, /create\s+policy/i);
    assert.doesNotMatch(migration, /drop\s+table/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
    assert.doesNotMatch(migration, /update\s+public\./i);
    assert.doesNotMatch(migration, /insert\s+into\s+public\./i);
    assert.match(migration, /unexpectedly created a policy/i);
  });
});

