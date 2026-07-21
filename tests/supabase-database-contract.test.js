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
const migrationPath = path.join(root, "supabase", "migrations", "20260721213000_complete_runtime_database_contract.sql");

describe("Supabase database contract", () => {
  it("declares one unique, organization-aware platform contract", () => {
    assert.equal(DATABASE_TABLES.length, 86);
    assert.equal(new Set(DATABASE_TABLES).size, DATABASE_TABLES.length);
    assert.deepEqual(DATABASE_SCHEMAS, ["public", "auth", "storage"]);
    assert.equal(STORAGE_BUCKETS.length, 7);
    for (const table of [
      "organization_memberships",
      "billing_subscriptions",
      "support_requests",
      "business_workspaces",
      "business_bookings",
      "creator_assets",
      "music_projects",
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
