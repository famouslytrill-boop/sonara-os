"use strict";

// Which tables a signed-in customer may read, and which stay service-role only.
//
// Every Supabase call this application makes uses the service-role key, which
// bypasses RLS entirely. CRIT-3 item (2) is to forward the caller's JWT on
// user-facing reads so RLS becomes a real second line of defence. That cannot
// start until the tables those reads touch have a policy a member can read
// through -- without one, a user-scoped read returns zero rows and the
// workspace goes blank.
//
// The first attempt at that measurement ran anonymously, and anonymous is not a
// customer: every read behind getCustomerPrimaryOrganization needs a session, so
// no core table executed. It produced policies for thirty-three tables, of which
// the runtime names three.
//
// This test is the check that would have caught it -- it reads the runtime, not
// a recording, and it pins the deliberate exclusions so nobody closes the gap by
// opening an operator table.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function migrationsSql() {
  const dir = path.join(root, "supabase", "migrations");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => fs.readFileSync(path.join(dir, name), "utf8"))
    .join("\n");
}

// Tables the shipped runtime names, however it reaches them: a literal
// PostgREST path, or a name handed to one of the safe* read helpers.
function tablesTheRuntimeReads() {
  const files = [path.join(root, "server.js")];
  for (const dir of ["lib", "routes"]) {
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.cjs$/.test(entry.name)) files.push(full);
      }
    };
    walk(path.join(root, dir));
  }

  const tables = new Set();
  const helper = /(?:safeListTable|safeCountTable|safeCountFiltered)\(\s*(?:config,\s*)?["']([a-z_]+)["']/g;
  const literal = /\/rest\/v1\/([a-z_]+)[?"'`]/g;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(helper)) tables.add(match[1]);
    for (const match of source.matchAll(literal)) tables.add(match[1]);
  }
  return tables;
}

// Deliberately readable only by service_role, each with the reason. A table
// leaving this list is a decision somebody has to make on purpose.
const SERVICE_ROLE_ONLY = new Map([
  ["billing_webhook_events", "no organization_id; Stripe's own event record"],
  ["support_email_delivery_attempts", "no organization_id; delivery diagnostics"],
  ["business_employee_invites", "holds token_hash and pending invitee emails; owner review before members read invites"],
  ["user_roles", "keyed by user_id, not organization_id; who may read the privilege table is a decision"]
]);

// Not tenant data at all, so member scoping does not apply.
const NOT_TENANT_DATA = new Set(["product_modules", "service_catalog_items"]);

describe("member read policies cover what the application actually reads", () => {
  let sql;
  let runtimeTables;

  before(() => {
    sql = migrationsSql();
    runtimeTables = tablesTheRuntimeReads();
  });

  it("looks at enough of the runtime for the check to mean something", () => {
    assert.ok(
      runtimeTables.size >= 20,
      `only ${runtimeTables.size} tables found in the runtime; the scan is not covering the application`
    );
  });

  it("gives every organization-scoped table a read path a member can use", () => {
    const missing = [];
    for (const table of [...runtimeTables].sort()) {
      if (SERVICE_ROLE_ONLY.has(table) || NOT_TENANT_DATA.has(table)) continue;
      // Only tables that carry a tenant column can be member-scoped.
      const definition = new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`).exec(sql);
      if (!definition || !/organization_id/.test(definition[1])) continue;
      const readable = new RegExp(
        `create policy "[^"]*" on public\\.${table} for select to authenticated`
      ).test(sql);
      if (!readable) missing.push(table);
    }

    assert.deepEqual(
      missing,
      [],
      `These tables are read by the application and have no policy a signed-in member can read through:\n  ${missing.join("\n  ")}\n\n` +
        "Add them to ORGANIZATION_READ_TABLES in scripts/generate-member-read-policies.cjs and regenerate, " +
        "or record why they are service-role only in SERVICE_ROLE_ONLY in this file."
    );
  });

  it("keeps the operator tables closed to members", () => {
    // The failure this guards against is closing the gap above by opening one
    // of these, which would be a real regression rather than a fix.
    const opened = [];
    for (const [table, reason] of SERVICE_ROLE_ONLY) {
      const generator = fs.readFileSync(path.join(root, "scripts", "generate-member-read-policies.cjs"), "utf8");
      if (new RegExp(`^\\s*"${table}",`, "m").test(generator)) opened.push(`${table} (${reason})`);
    }
    assert.deepEqual(opened, [], `These are service-role only on purpose:\n  ${opened.join("\n  ")}`);
  });

});

// An applied migration is finished. supabase db push tracks migrations by
// filename, so rewriting one changes this repository and nothing else --
// every check here reads the file and would pass while production sat without
// the new policies.
//
// This nearly happened when creator_voice_consents and location_zones were
// added: the generator still pointed at 20260729040000, which was already on
// main.
//
// A check for this already existed and did not catch it. It compared the
// generator's target against one hard-coded filename, 20260728120000. When
// 20260729040000 was written and applied, nobody added it, so the check went on
// guarding against the previous mistake while the next one walked past. A list
// of one that nothing makes grow is not a check.
//
// So the list lives with the generator, both read it, and the generator refuses
// to write rather than only being tested about it.
describe("applied migrations are never rewritten", () => {
  const { APPLIED_MIGRATIONS, migrationName } = require("../scripts/generate-member-read-policies.cjs");

  it("writes to a migration that has not already been applied", () => {
    assert.equal(
      APPLIED_MIGRATIONS.includes(migrationName),
      false,
      `${migrationName} is already applied in production. Point migrationName at a new file; rewriting this one would change nothing in the database.`
    );
  });

  it("keeps every applied migration present on disk", () => {
    const missing = APPLIED_MIGRATIONS.filter(
      (name) => !fs.existsSync(path.join(__dirname, "..", "supabase", "migrations", name))
    );
    assert.deepEqual(missing, [], `these applied migrations have been deleted: ${missing.join(", ")}`);
  });
});
