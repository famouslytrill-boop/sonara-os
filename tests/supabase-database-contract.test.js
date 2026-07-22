const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {
  DATABASE_FUNCTIONS,
  DATABASE_SCHEMAS,
  DATABASE_TABLE_GROUPS,
  DATABASE_TABLES,
  STORAGE_BUCKETS
} = require("../lib/sonara-database-contract.cjs");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(root, "supabase", "migrations", "20260722170000_complete_ecosystem_database_contract.sql");
const runtimeRepairMigrationPath = path.join(root, "supabase", "migrations", "20260721213000_complete_runtime_database_contract.sql");
const organizationDeleteAuditRepairPath = path.join(root, "supabase", "migrations", "20260722183000_fix_organization_delete_audit.sql");

describe("Supabase database contract", () => {
  it("declares one unique, organization-aware platform contract", () => {
    assert.equal(DATABASE_TABLES.length, 119);
    assert.equal(new Set(DATABASE_TABLES).size, DATABASE_TABLES.length);
    assert.deepEqual(DATABASE_SCHEMAS, ["public", "auth", "storage"]);
    assert.equal(STORAGE_BUCKETS.length, 7);
    for (const table of [
      "organization_memberships",
      "billing_subscriptions",
      "support_requests",
      "business_workspaces",
      "business_bookings",
      "business_appointments",
      "creator_assets",
      "music_projects",
      "audio_transcription_segments",
      "growth_campaigns",
      "integration_providers",
      "user_notifications",
      "sensory_feedback_profiles",
      "entity_agents",
      "entity_agent_runs",
      "entity_action_approvals",
      "agent_action_logs",
      "audit_logs"
    ]) {
      assert.ok(DATABASE_TABLES.includes(table), `${table} must be part of the contract`);
    }
    assert.equal(DATABASE_TABLE_GROUPS.agentsAndAutomation.length, 19);
  });

  it("keeps the readiness RPC service-only and verifies table RLS", () => {
    const sql = fs.readFileSync(migrationPath, "utf8").toLowerCase();
    assert.match(sql, /classes\.relrowsecurity/);
    assert.match(sql, /grant select, insert, update, delete on table public\.%i to service_role/);
    assert.match(sql, /security invoker/);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /revoke execute on function public\.sonara_database_contract_snapshot\(\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.sonara_database_contract_snapshot\(\) to service_role/);
    assert.match(sql, /notify pgrst, 'reload schema'/);
    assert.doesNotMatch(sql, /grant execute on function public\.sonara_database_contract_snapshot\(\) to anon|grant execute on function public\.sonara_database_contract_snapshot\(\) to authenticated/);
    for (const table of DATABASE_TABLES) assert.ok(sql.includes(`'${table}'`), `${table} must be checked by the migration`);
    for (const signature of DATABASE_FUNCTIONS) assert.ok(sql.includes(`'${signature.toLowerCase()}'`), `${signature} must be checked by the RPC`);
  });

  it("repairs the known production operations-table drift additively", () => {
    const sql = fs.readFileSync(runtimeRepairMigrationPath, "utf8").toLowerCase();
    for (const table of ["business_bookings", "employee_schedules", "maintenance_logs"]) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`));
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(
        sql,
        new RegExp(`create policy "service role manages ${table}"[\\s\\S]*?on public\\.${table} for all to service_role`)
      );
    }
  });

  it("creates the missing Creator Studio transcription table with tenant-safe access", () => {
    const sql = fs.readFileSync(migrationPath, "utf8").toLowerCase();
    assert.match(sql, /create table if not exists public\.audio_transcription_segments\b/);
    assert.match(sql, /organization_id uuid not null references public\.organizations\(id\) on delete cascade/);
    assert.match(sql, /alter table public\.audio_transcription_segments enable row level security/);
    assert.match(sql, /revoke all on table public\.audio_transcription_segments from public, anon, authenticated/);
    assert.match(sql, /create policy "service role manages audio_transcription_segments"[\s\S]*?to service_role/);
    assert.match(sql, /audio_transcription_segments_org_track_segment_idx/);
  });

  it("keeps organization deletion auditable without a dangling tenant foreign key", () => {
    const sql = fs.readFileSync(organizationDeleteAuditRepairPath, "utf8").toLowerCase();
    assert.match(sql, /create or replace function public\.audit_row_change\(\)/);
    assert.match(sql, /if tg_op = 'delete' then[\s\S]*?deleted_organization_id := target_id;[\s\S]*?target_org_id := null;/);
    assert.match(sql, /'deleted_organization_id', deleted_organization_id/);
    assert.match(sql, /revoke all on function public\.audit_row_change\(\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.audit_row_change\(\) to service_role/);
  });

  it("uses private local storage defaults and a scoped read-only MCP", () => {
    const config = fs.readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
    const mcp = JSON.parse(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"));
    assert.match(config, /auto_expose_new_tables = false/);
    assert.match(config, /minimum_password_length = 8/);
    for (const bucket of STORAGE_BUCKETS) {
      assert.match(config, new RegExp(`\\[storage\\.buckets\\.${bucket.replaceAll("-", "\\-")}\\]`));
      assert.match(config, new RegExp(`\\[storage\\.buckets\\.${bucket.replaceAll("-", "\\-")}\\][\\s\\S]*?public = false`));
    }
    const url = mcp.mcpServers.supabase.url;
    assert.match(url, /project_ref=yqncsonkxgwhcxedgevk/);
    assert.match(url, /read_only=true/);
    assert.doesNotMatch(JSON.stringify(mcp), /authorization|bearer|service_role|access_token/i);
  });
});
