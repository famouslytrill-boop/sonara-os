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
  // Every read helper in the tree, not just the three this check first knew
  // about. It listed safeListTable, safeCountTable and safeCountFiltered, so
  // reads made through supabaseList in routes/sonara-last9-routes.cjs were
  // invisible to it -- that helper builds its URL from `${config.url}/rest/v1/
  // ${table}`, a variable, so the literal pattern below misses it too. Seven
  // tables were being read without this check ever seeing them.
  //
  // Adding a helper is easy and forgetting to add it here is easier, so the
  // final assertion in this file fails when a `(config, "table_name")` call
  // uses a name that is not listed.
  const helper = /(?:safeListTable|safeCountTable|safeCountFiltered|supabaseList|supabaseCount|supabaseInsert|supabasePatch|readMemberships|rest)\(\s*(?:config,\s*)?["']([a-z_]+)["']/g;
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
  ["user_roles", "keyed by user_id, not organization_id; who may read the privilege table is a decision"],
  // Surfaced when this check learned about supabaseList and rest(). All three
  // are organization-scoped and none is ordinary workspace data: who holds which
  // permission, who did what, and who is handing the business over. Opening them
  // to every member would let a colleague read the privilege table -- the same
  // reason user_roles is above. Owner review before any of them changes.
  ["business_permission_grants", "the privilege table for a business; a member reading who holds what is a decision, not a gap"],
  ["business_control_audit_events", "who did what inside the business; owner surface, not member-readable"],
  ["business_ownership_transfers", "a transfer in progress; owner-level and sensitive before it completes"],
  // Which payment processor account a business takes money into. Organization
  // -scoped, and not ordinary workspace data: a member who can read it learns
  // where the business's revenue settles, and a member who could write it could
  // redirect it. Connecting and disconnecting are owner actions, so the read is
  // owner-level too. Same reason as business_permission_grants above.
  ["business_payment_accounts", "names where the business's money settles; connect and disconnect are owner actions, so the read is owner-level"]
]);

// Not tenant data at all, so member scoping does not apply.
const NOT_TENANT_DATA = new Set(["service_catalog_items"]);

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
// The check above can only police reads it can see, and it sees them by
// recognising the name of the function that made them. That is a list, and a
// list nothing makes grow is how supabaseList went unnoticed.
describe("no read helper hides from the policy check", () => {
  const KNOWN_READ_HELPERS = [
    "safeListTable",
    "safeCountTable",
    "safeCountFiltered",
    "supabaseList",
    "supabaseCount",
    "supabaseInsert",
    "supabasePatch",
    // Reads organization_memberships and business_memberships in
    // lib/sonara-customer-organization.cjs -- the tenant boundary itself, so
    // the one read path this check least wants to be blind to.
    "readMemberships",
    "rest"
  ];

  it("recognises every function that is handed a table name", () => {
    const root = path.join(__dirname, "..");
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

    // Any call shaped `something(config, "a_table_name")` is a read helper.
    const shaped = /\b([a-zA-Z][a-zA-Z0-9_]*)\(\s*config,\s*["'][a-z_]+["']/g;
    const unknown = new Set();
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(shaped)) {
        if (!KNOWN_READ_HELPERS.includes(match[1])) unknown.add(match[1]);
      }
    }

    assert.deepEqual(
      [...unknown].sort(),
      [],
      `These take a table name and the policy check does not know them, so every table they touch is unchecked:\n  ${[...unknown].join("\n  ")}\n\n` +
        "Add each to KNOWN_READ_HELPERS here and to the helper pattern in tablesTheRuntimeReads()."
    );
  });
});

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
