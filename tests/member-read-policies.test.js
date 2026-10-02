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

/**
 * Which tables end the migration sequence with a SELECT policy for
 * `authenticated`, and the names of those policies.
 *
 * Read by applying what the migrations DO, in order -- every create and drop,
 * literal or inside a loop -- rather than by searching for a sentence. The first
 * version of this check searched for the literal text
 * `create policy ... on public.<table> for select to authenticated`, which has two
 * failures and both were live on 3 October 2026:
 *
 *   - **A policy made in a loop is invisible to it.** 20260723080000 gives
 *     creator_generation_assets, creator_generation_events and
 *     creator_reference_analyses a member read policy inside
 *     `foreach relation_name in array array[...] loop execute format(...)`. The
 *     text never names those tables next to `create policy`, so a search reports
 *     them unreadable. Recording them as "service-role only" to quiet it would put
 *     a false reason in the register below -- worse than no entry.
 *   - **A dropped policy still matches.** A later `drop policy if exists` removes
 *     a policy the text still contains, and a search would call the table
 *     readable when it is not.
 *
 * Placeholders in a loop's format string -- %1$s, %1$I, %s, %I -- are all the
 * relation name in every loop this repository has; LOOP_FIXTURE below holds one
 * so a loop written differently fails here rather than being misread.
 */
function memberSelectPolicies(sqlText) {
  const state = new Map();
  const add = (table, name) => {
    if (!state.has(table)) state.set(table, new Set());
    state.get(table).add(name);
  };
  const drop = (table, name) => state.get(table)?.delete(name);
  const unquote = (name) => name.replace(/^"|"$/g, "");
  const fill = (template, table) => template.replace(/%1\$[sI]|%[sI]/g, table);

  // Statements in order. A loop is one unit: its body applies to each relation in
  // its array, in order.
  const unit = /foreach\s+\w+\s+in\s+array\s+array\s*\[([^\]]*)\]\s*loop([\s\S]*?)end\s+loop|create\s+policy\s+("[^"]+"|[a-z_][a-z0-9_]*)\s+on\s+public\.([a-z_][a-z0-9_]*)\s+for\s+(\w+)\s+to\s+(\w+)|drop\s+policy\s+if\s+exists\s+("[^"]+"|[a-z_][a-z0-9_]*)\s+on\s+public\.([a-z_][a-z0-9_]*)/gi;
  for (const match of sqlText.matchAll(unit)) {
    if (match[1] !== undefined) {
      const relations = [...match[1].matchAll(/'([a-z_][a-z0-9_]*)'/g)].map((m) => m[1]);
      const body = match[2];
      const steps = [...body.matchAll(/execute\s+format\(\s*'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
      for (const relation of relations) {
        for (const step of steps) {
          const created = /^create\s+policy\s+("[^"]+")\s+on\s+public\.\S+\s+for\s+(\w+)\s+to\s+(\w+)/i.exec(step);
          if (created) {
            if (created[2].toLowerCase() === "select" && created[3].toLowerCase() === "authenticated") add(relation, fill(unquote(created[1]), relation));
            continue;
          }
          const dropped = /^drop\s+policy\s+if\s+exists\s+("[^"]+")\s+on\s+public\./i.exec(step);
          if (dropped) drop(relation, fill(unquote(dropped[1]), relation));
        }
      }
      continue;
    }
    if (match[3] !== undefined) {
      if (match[5].toLowerCase() === "select" && match[6].toLowerCase() === "authenticated") add(match[4], unquote(match[3]));
      continue;
    }
    drop(match[8], unquote(match[7]));
  }
  return state;
}

// The loop shape the first version could not see, as a fixture.
const LOOP_FIXTURE = `
do $$ declare relation_name text; begin
  foreach relation_name in array array['fixture_a', 'fixture_b'] loop
    execute format('drop policy if exists "members read %1$s" on public.%1$I', relation_name);
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (true)', relation_name);
  end loop;
end $$;
drop policy if exists "members read fixture_b" on public.fixture_b;
create policy "literal read" on public.fixture_c for select to authenticated using (true);
`;

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
  // And a table named through a constant. Measured 3 October 2026: the two
  // patterns above saw 57 tables, and 30 more were read through declarations
  // like `const VERSION_TABLE = "creator_asset_versions"` and then
  // `/rest/v1/${VERSION_TABLE}` -- a variable, which neither pattern can follow.
  // This check reported every organization-scoped table covered while a third of
  // the tables the application reads had never been looked at. Counted only in a
  // file that actually issues REST calls, so a constant in a registry that names a
  // table without reading it does not add one.
  const constant = /const\s+[A-Z][A-Z0-9_]*TABLE[A-Z0-9_]*\s*=\s*["']([a-z_]+)["']/g;
  const readsRest = /\/rest\/v1\/|\brest\(|safeListTable\(|supabaseList\(/;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(helper)) tables.add(match[1]);
    for (const match of source.matchAll(literal)) tables.add(match[1]);
    if (readsRest.test(source)) {
      for (const match of source.matchAll(constant)) tables.add(match[1]);
    }
  }
  return tables;
}

// Deliberately readable only by service_role, each with the reason. A table
// leaving this list is a decision somebody has to make on purpose.
const SERVICE_ROLE_ONLY = new Map([
  ["billing_webhook_events", "no organization_id; Stripe's own event record"],
  ["support_email_delivery_attempts", "no organization_id; delivery diagnostics"],
  ["business_employee_invites", "holds token_hash and pending invitee emails; owner review before members read invites"],
  // user_roles was recorded here as "keyed by user_id, not organization_id; who may
  // read the privilege table is a decision", which filed it as service-role only.
  // It is not, and has not been since 20260714120000: "users can read own roles"
  // is `for select to authenticated using (user_id = auth.uid())` -- a person can
  // read their own roles, which is normal and safe, and nobody can read anybody
  // else's. The text search this file used could not see it because the statement
  // spans five lines. Removed on 3 October 2026 when the policy simulator read it.
  // It needs no entry: it has no organization_id, so the member check below skips
  // it by its own rule.
  // Surfaced when this check learned about supabaseList and rest(). All three
  // are organization-scoped and none is ordinary workspace data: who holds which
  // permission, who did what, and who is handing the business over. Opening them
  // to every member would let a colleague read the privilege table -- the same
  // reason user_roles is above. Owner review before any of them changes.
  ["business_permission_grants", "the privilege table for a business; a member reading who holds what is a decision, not a gap"],
  ["business_control_audit_events", "who did what inside the business; owner surface, not member-readable"],
  ["business_ownership_transfers", "a transfer in progress; owner-level and sensitive before it completes"],
  ["agent_action_logs", "agent audit records; owner/admin operational evidence is not member-readable"],
  ["agent_pending_actions", "agent approval queue; owner/admin decisions are not member-readable"],
  ["agent_schedules", "agent schedules; owner/admin control data is not member-readable"],
  // Which payment processor account a business takes money into. Organization
  // -scoped, and not ordinary workspace data: a member who can read it learns
  // where the business's revenue settles, and a member who could write it could
  // redirect it. Connecting and disconnecting are owner actions, so the read is
  // owner-level too. Same reason as business_permission_grants above.
  ["business_payment_accounts", "names where the business's money settles; connect and disconnect are owner actions, so the read is owner-level"],
  // Creator Studio's marketplace listings, added 3 October 2026. Closed by
  // decision: it is in verify-migration-replay's closed set, asserted against the
  // live catalogue. The reason is that a listing's clearance depends on its
  // version and that version's approvals, and those tables are closed too -- a
  // member able to read listings but not what clears them would see a sale they
  // cannot evaluate. Every read and write goes through the server, which applies
  // lib/sonara-creator-marketplace.cjs. The public side reads
  // creator_marketplace_entries, which has no organization and is not tenant data.
  ["creator_listings", "closed with the approval-graph tables its clearance depends on; every read goes through the marketplace gate on the server"],
  // Four whose only policy is the service role's, so they are not in the
  // replay's closed set (that set is "no policy at all") and still have no read
  // path a member's own token could use. Each reason names the migration it was
  // read from on 3 October 2026.
  ["creator_assets", "only policy is \"service role manages creator assets\" (for all, auth.role() = service_role); every read is server-side"],
  ["creator_artist_profiles", "only policy is the service-role one 016_creator_artist_system_schema.sql makes in its loop; read server-side by the creator profile routes"],
  ["merchant_products", "only policy is \"service role can manage merchant_products\"; the storefront reads it server-side and a public shop never reads it with a member's token"],
  ["merchant_product_variants", "only policy is \"service role can manage merchant_product_variants\"; read server-side with its product"]
]);

// Tables closed to everyone but the service role BY DECISION: RLS on and no
// policy at all. That decision is not recorded here -- it is recorded in
// scripts/verify-migration-replay.mjs, which applies every migration to a real
// PostgreSQL and asserts this exact set on every release, two-sided ("a table
// joining this list is a table that just became unreadable by every customer").
// So it is read from there rather than copied here, where a copy could drift from
// the database the replay actually checks.
//
// Nineteen of the thirty tables this file could not see until 3 October 2026 are
// in it. Copying nineteen reasons by hand into SERVICE_ROLE_ONLY would have been
// nineteen chances to write one down wrong.
function closedByDecision() {
  const replay = fs.readFileSync(path.join(root, "scripts", "verify-migration-replay.mjs"), "utf8");
  const match = /"closed_set_([^"]+)"/.exec(replay);
  return new Set(match ? match[1].split(",") : []);
}

// Not tenant data at all, so member scoping does not apply.
const NOT_TENANT_DATA = new Set(["service_catalog_items"]);

describe("member read policies cover what the application actually reads", () => {
  let sql;
  let runtimeTables;

  let policies;

  before(() => {
    sql = migrationsSql();
    runtimeTables = tablesTheRuntimeReads();
    policies = memberSelectPolicies(sql);
  });

  it("reads policies made in a loop, and forgets policies that were dropped", () => {
    const fixture = memberSelectPolicies(LOOP_FIXTURE);
    assert.deepEqual([...(fixture.get("fixture_a") || [])], ["members read fixture_a"], "a policy made in a loop was not seen");
    assert.equal(fixture.get("fixture_b")?.size || 0, 0, "a policy dropped after the loop is still counted");
    assert.deepEqual([...(fixture.get("fixture_c") || [])], ["literal read"], "a literal policy was not seen");
    // And on the real migrations: the three tables whose member read policy is
    // made in a loop, which the text search reported unreadable.
    for (const table of ["creator_generation_assets", "creator_generation_events", "creator_reference_analyses"]) {
      assert.ok(policies.get(table)?.size, `${table}'s loop-made read policy is not seen`);
    }
    // And one the migrations drop and replace. 20260723080000 makes
    // "creator members read creator_voice_consents" in its loop and then drops it
    // by name, creating a narrower literal policy in its place; later migrations
    // add creator_voice_consents_select_member (dropped and re-created by
    // 20260913193000). The loop-made one must be gone and the other two present --
    // the first draft of this assertion expected one policy and was wrong, which
    // the simulator showed by reading the migrations rather than this comment.
    const consents = [...(policies.get("creator_voice_consents") || [])].sort();
    assert.ok(!consents.includes("creator members read creator_voice_consents"), "a policy the migrations dropped is still counted");
    assert.deepEqual(consents, ["creator users read own voice consents", "creator_voice_consents_select_member"]);
  });

  it("looks at enough of the runtime for the check to mean something", () => {
    assert.ok(
      runtimeTables.size >= 20,
      `only ${runtimeTables.size} tables found in the runtime; the scan is not covering the application`
    );
    // The floor that matters now. Before the constant pattern this scan saw 57
    // tables; with it, 87. A scan back under 80 has lost a pattern, and the 30
    // tables that pattern finds would go unexamined again while this file kept
    // reporting full coverage.
    assert.ok(
      runtimeTables.size >= 80,
      `only ${runtimeTables.size} tables found; the constant-named reads have dropped out of view again`
    );
    // One table that is only ever named through a constant, as a fixture: if it
    // is missing, the constant pattern stopped matching.
    assert.ok(runtimeTables.has("creator_asset_versions"), "creator_asset_versions is read through VERSION_TABLE and the scan no longer sees it");
  });

  it("gives every organization-scoped table a read path a member can use", () => {
    const closed = closedByDecision();
    // Shape 1. An empty closed set would exempt nothing and look like a pass; a
    // replay file that stopped declaring one would exempt nothing silently too.
    assert.ok(closed.size >= 40, `only ${closed.size} tables read from the replay's closed set; this check has gone blind`);
    const missing = [];
    for (const table of [...runtimeTables].sort()) {
      if (SERVICE_ROLE_ONLY.has(table) || NOT_TENANT_DATA.has(table) || closed.has(table)) continue;
      // Only tables that carry a tenant column can be member-scoped.
      const definition = new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`).exec(sql);
      if (!definition || !/organization_id/.test(definition[1])) continue;
      const readable = (policies.get(table)?.size || 0) > 0;
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

  it("records no table as service-role only that a member can in fact read", () => {
    // The two-sided half. An entry saying "service-role only" for a table the
    // migrations have since given a member read policy is a reason that has
    // expired, and it is what the next person reads instead of checking. Read
    // against the simulated end state of every migration, so a policy made in a
    // loop counts.
    //
    // (A first draft of this test refused any entry also in the replay's closed
    // set, as "one reason in two places". That was wrong: the replay records
    // that a table is closed and an entry here records why, and
    // business_payment_accounts' why -- where the money settles -- is worth more
    // than the membership. Removed rather than given an exception list.)
    const stale = [...SERVICE_ROLE_ONLY.keys()].filter((table) => (policies.get(table)?.size || 0) > 0);
    assert.deepEqual(stale, [], `recorded as service-role only, and a member can read them:\n  ${stale.join("\n  ")}`);
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
