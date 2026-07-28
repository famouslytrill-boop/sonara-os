"use strict";

// Which tables a user-scoped read could actually return rows from.
//
// CRIT-3 item (2) cannot be done table-by-table on faith. Forwarding a
// caller's JWT to a table with no member-readable policy returns zero rows,
// and a blank workspace screen looks a lot like "no data yet". This reports
// the real state so the switch-over is a decision rather than a gamble.
//
// It reads the migrations, so it answers for the schema in this repository. If
// the migrations have not been applied to the project you are pointing at, the
// answer here is what *will* be true, not what is.

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const { TENANT_SCOPED_TABLES } = require(path.join(root, "lib", "sonara-tenant-scoped-tables.cjs"));

function readMigrations() {
  const dir = path.join(root, "supabase", "migrations");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => fs.readFileSync(path.join(dir, name), "utf8"))
    .join("\n");
}

// Policies written the ordinary way, plus the ones this repo creates inside a
// DO block with EXECUTE (see generate-member-read-policies.cjs). Missing the
// second form would report every generated policy as absent.
function collectSelectPolicies(sql) {
  const policies = new Map();
  const add = (table, body) => {
    if (!policies.has(table)) policies.set(table, []);
    policies.get(table).push(body);
  };

  const direct = /create\s+policy\s+"?([^"\n]+?)"?\s+on\s+(?:public\.)?([a-z0-9_]+)\s+for\s+(select|all)\b([\s\S]*?);/gi;
  for (const match of sql.matchAll(direct)) add(match[2], match[4]);

  const executed = /execute\s+'create\s+policy\s+"[^"]+"\s+on\s+public\.([a-z0-9_]+)\s+for\s+(?:select|all)\b([^']*)'/gi;
  for (const match of sql.matchAll(executed)) add(match[1], match[2]);

  return policies;
}

function isMemberReadable(bodies) {
  return bodies.some((body) => {
    const text = " " + body.replace(/\s+/g, " ") + " ";
    if (/\bto\s+service_role\b/i.test(text)) return false;
    if (/auth\.role\(\)\s*=\s*'service_role'/i.test(text)) return false;
    return /is_org_member|organization_memberships|auth\.uid\(\)\s*=\s*user_id/i.test(text);
  });
}

const sql = readMigrations();
const policies = collectSelectPolicies(sql);

const ready = [];
const notReady = [];
for (const table of [...TENANT_SCOPED_TABLES].sort()) {
  const bodies = policies.get(table) || [];
  (bodies.length && isMemberReadable(bodies) ? ready : notReady).push(table);
}

const readySet = new Set(ready);

console.log(`Tenant-scoped tables: ${TENANT_SCOPED_TABLES.size}`);
console.log(`  a signed-in member can read : ${ready.length}`);
console.log(`  would return zero rows      : ${notReady.length}`);

if (process.argv.includes("--list")) {
  console.log(`\nready:\n  ${ready.join("\n  ")}`);
  console.log(`\nnot ready:\n  ${notReady.join("\n  ")}`);
}

// The tables the application reads on a GET route, measured by exercising every
// route against a recording stand-in. These are the ones that gate the
// switch-over; the rest can wait.
const READ_ON_GET_ROUTES = require(path.join(root, "scripts", "generate-member-read-policies.cjs"));
const targeted = [...READ_ON_GET_ROUTES.ORGANIZATION_READ_TABLES, ...READ_ON_GET_ROUTES.PERSONAL_READ_TABLES];
const targetedReady = targeted.filter((table) => readySet.has(table));
const targetedBlocked = targeted.filter((table) => !readySet.has(table));

console.log(`\nOf the ${targeted.length} tables this migration targets:`);
console.log(`  ready to read as the caller : ${targetedReady.length}`);
if (targetedBlocked.length) {
  console.log(`  still blocked               : ${targetedBlocked.length}`);
  console.log(`    ${targetedBlocked.join("\n    ")}`);
  console.error("\n[fail] the generated migration does not cover every table it lists.");
  process.exit(1);
}

console.log("\nEvery targeted table has a member-readable policy in the migrations.");
console.log("Note: this reads the repository, not the live project. Apply the migrations before");
console.log("switching any read path over, and confirm against the deployed schema.");
