// Prove, against the real database, that a signed-in customer can actually read
// what the member policies say they can.
//
// This is the missing evidence for CRIT-3 item (2). Every Supabase call this
// application makes uses the service-role key, which bypasses RLS entirely. The
// item is to forward the caller's JWT on user-facing reads so RLS becomes a real
// second line of defence.
//
// The danger in that switch is specific and quiet: if a table's policy does not
// match, a user-scoped read returns **zero rows and HTTP 200**. Nothing errors.
// The workspace simply renders empty, and it looks like the customer has no
// data rather than like a bug. No unit test can catch it, because the policy
// only exists in the database.
//
// So this compares, per table, what service_role sees for one organization
// against what that organization's own member sees. Equal and non-zero is proof.
// Anything else is reported as not ready, with which of the two it was.
//
// Read-only. It issues GET requests and nothing else, and prints no key or token.
//
//   NEXT_PUBLIC_SUPABASE_URL=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   SONARA_VERIFY_USER_JWT=<access token of a real signed-in customer> \
//     node scripts/verify-member-read-access.mjs
//
// Get the JWT by signing in as a test customer and reading the
// sonara_customer_session cookie. It expires in an hour by design.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ORGANIZATION_READ_TABLES, PERSONAL_READ_TABLES } = require("./generate-member-read-policies.cjs");
// The decision lives in its own module so it can be tested. This script cannot
// run without a real database, so the one function in it that decides anything
// was never exercised -- and it reported a table "ready" when neither count
// could be read. See scripts/member-read-verdict.cjs.
const { verdict, STATES } = require("./member-read-verdict.cjs");

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
const userJwt = String(process.env.SONARA_VERIFY_USER_JWT || "").trim();

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
  ["SONARA_VERIFY_USER_JWT", userJwt]
].filter(([, value]) => !value).map(([name]) => name);

if (missing.length) {
  console.error(`Missing required environment: ${missing.join(", ")}`);
  console.error("This script has to talk to the real database -- RLS does not exist anywhere else.");
  process.exit(2);
}

// A service-role key is not a user token. Handing one to the "user" side would
// make every table look ready, because service_role bypasses RLS.
if (userJwt === serviceRoleKey) {
  console.error("SONARA_VERIFY_USER_JWT is the service-role key. That bypasses RLS and would report every table ready.");
  process.exit(2);
}

function serviceHeaders() {
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: "application/json" };
}

function userHeaders() {
  // apikey stays the anon key; the bearer token is what identifies the caller.
  return { apikey: anonKey, Authorization: `Bearer ${userJwt}`, Accept: "application/json", Prefer: "count=exact" };
}

async function countRows(table, headers, filter) {
  const query = `${url}/rest/v1/${table}?select=id&limit=1${filter ? `&${filter}` : ""}`;
  const response = await fetch(query, { headers: { ...headers, Prefer: "count=exact" } }).catch((error) => ({ ok: false, status: 0, error }));
  if (!response.ok) return { ok: false, status: response.status ?? 0 };
  // PostgREST returns the exact count in Content-Range as "0-0/N".
  const range = String(response.headers.get("content-range") || "");
  const total = Number(range.split("/")[1]);
  return { ok: true, status: response.status, count: Number.isFinite(total) ? total : null };
}

async function resolveUser() {
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${userJwt}` } });
  if (!response.ok) {
    console.error(`SONARA_VERIFY_USER_JWT was not accepted (HTTP ${response.status}). It may have expired -- they last one hour.`);
    process.exit(2);
  }
  return response.json();
}

async function resolveOrganization(userId) {
  const response = await fetch(
    `${url}/rest/v1/organization_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: serviceHeaders() }
  );
  const rows = response.ok ? await response.json().catch(() => []) : [];
  return rows[0]?.organization_id || "";
}

const user = await resolveUser();
const organizationId = await resolveOrganization(user.id);

if (!organizationId) {
  console.error(`The signed-in user has no organization membership, so every organization-scoped read would be empty for`);
  console.error("legitimate reasons and this check could not tell that apart from a broken policy. Use a customer with a workspace.");
  process.exit(2);
}

const results = [];

for (const table of ORGANIZATION_READ_TABLES) {
  const filter = `organization_id=eq.${encodeURIComponent(organizationId)}`;
  const asService = await countRows(table, serviceHeaders(), filter);
  const asUser = await countRows(table, userHeaders(), filter);
  results.push({ table, scope: "organization", asService, asUser });
}

for (const table of PERSONAL_READ_TABLES) {
  const filter = `user_id=eq.${encodeURIComponent(user.id)}`;
  const asService = await countRows(table, serviceHeaders(), filter);
  const asUser = await countRows(table, userHeaders(), filter);
  results.push({ table, scope: "person", asService, asUser });
}

const graded = results.map((row) => ({ ...row, ...verdict(row) }));
const by = (state) => graded.filter((row) => row.state === state);

console.log(`\nMember read access, organization ${organizationId.slice(0, 8)}…\n`);
for (const row of graded) {
  const marks = { ready: "  ok    ", partial: "  PARTIAL", blocked: "  BLOCKED", "no-evidence": "  --    ", unknown: "  ?     " };
  // A state with no mark would print `undefined` beside a table name, which
  // reads as a rendering glitch rather than as a state nobody handled.
  const mark = marks[row.state] || `  ${row.state.toUpperCase().padEnd(6)}`;
  console.log(`${mark} ${row.table.padEnd(34)} ${row.why}`);
}

const ready = by("ready");
console.log(`\n${ready.length} ready, ${by("partial").length} partial, ${by("blocked").length} blocked, ${by("no-evidence").length} without evidence, ${by("unknown").length} unknown.`);

// Every table has to land in one of the states the summary counts, or the
// numbers above add up to less than the list printed beneath them.
const unaccounted = graded.filter((row) => !STATES.includes(row.state));
if (unaccounted.length) {
  console.error(`\n${unaccounted.length} table(s) came back in a state this script does not count: ${[...new Set(unaccounted.map((row) => row.state))].join(", ")}`);
  process.exit(2);
}

if (ready.length) {
  console.log("\nSafe to add to the user-scoped read list, on this evidence:");
  console.log(`  ${ready.map((row) => row.table).join("\n  ")}`);
}

const failures = [...by("blocked"), ...by("partial")];
if (failures.length) {
  console.log("\nDo NOT switch these -- a user-scoped read returns fewer rows than the page expects:");
  console.log(`  ${failures.map((row) => `${row.table}: ${row.why}`).join("\n  ")}`);
}

console.log("\nTables reporting no evidence are not failures. They are tables this organization");
console.log("has no rows in; re-run against a workspace that does before switching those.\n");

// Exit non-zero only on a real contradiction. "No evidence" is a gap in the
// fixture, not a broken policy, and failing on it would train people to ignore
// this script.
process.exit(failures.length ? 1 : 0);
