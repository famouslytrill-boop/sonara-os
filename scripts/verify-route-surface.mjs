#!/usr/bin/env node
// Fails when this server answers a GET route that nothing declares.
//
// `scripts/verify-route-registry.cjs` checks that every route in the page
// manifest is registered with Express. This checks the other direction, which
// nothing checked: that every route Express registers is accounted for by
// something.
//
// The reason the direction matters is the number. On 16 September 2026 the page
// manifest held 308 routes and the server answered 558. The 250-route
// difference included `/staff/location`, `/admin/subscriptions`,
// `/account/security/two-factor`, `/growth/unsubscribe` and fourteen legal
// documents -- and the existing reverse check reported none of them, because
// its filter only looks under the three studio prefixes. It returned an empty
// list, the assertion passed over the empty list, and the gate printed
// "Route registry verification passed".
//
// This script therefore does four things, and the last two are the ones that
// keep it honest:
//
//   1. Reads the routes from `app._router.stack`, never from a list.
//   2. Fails on any served route that neither the page manifest nor
//      `lib/sonara-route-surface.cjs` accounts for.
//   3. Fails when a declared surface matches nothing, so a reason cannot
//      outlive the routes it describes -- the two-sidedness that caught 51
//      stale entries in report-orphan-tables.
//   4. Fails when two surfaces claim one route, because "the first pattern that
//      matched" is not an accounting.
//
// It also refuses to pass while measuring nothing: fewer than 400 served GET
// routes, or fewer than 8 surfaces, means something has stopped being read and
// the check has gone blind.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// A configured server, for the same reason tests/the-route-manifest test gives:
// without Supabase, whole areas of the application never register their routes
// and a check run on a bare machine measures the machine.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || "https://project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-for-route-surface";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-for-route-surface";

const app = require(path.join(root, "server.js"));
const { ROUTE_REGISTRY } = require(path.join(root, "lib", "sonara-route-registry.cjs"));
const { ROUTE_SURFACES, ACCESS, accountRoutes } = require(path.join(root, "lib", "sonara-route-surface.cjs"));

const MINIMUM_SERVED_ROUTES = 400;
const MINIMUM_SURFACES = 8;

const problems = [];
const account = accountRoutes(app, ROUTE_REGISTRY.map((record) => record.route));

// Shape 1, first: a check satisfied by an empty population says nothing.
if (account.served.length < MINIMUM_SERVED_ROUTES) {
  problems.push(
    `only ${account.served.length} served GET routes were read from the Express stack, below the floor of ${MINIMUM_SERVED_ROUTES}; this check has gone blind. `
    + "Either the server failed to register its routes under these environment variables, or app._router has changed shape."
  );
}
if (ROUTE_SURFACES.length < MINIMUM_SURFACES) {
  problems.push(`only ${ROUTE_SURFACES.length} route surfaces are declared, below the floor of ${MINIMUM_SURFACES}; lib/sonara-route-surface.cjs has lost entries.`);
}

// Every surface has to be usable as a record: a key, a pattern, a reason, and an
// access value this project recognises. A surface with an unrecognised access
// value would be skipped by the test that probes them, and skipping is how a
// check quietly stops covering something.
for (const surface of ROUTE_SURFACES) {
  if (!surface.key || !surface.label) problems.push(`a route surface is missing a key or a label: ${JSON.stringify(surface.key || surface.label || surface)}`);
  if (!(surface.pattern instanceof RegExp)) problems.push(`${surface.key} has no RegExp pattern`);
  if (!ACCESS.includes(surface.expectedAccess)) problems.push(`${surface.key} declares expectedAccess "${surface.expectedAccess}", which is not one of: ${ACCESS.join(", ")}`);
  // A reason is the field that matters. "reviewed" is not a reason; a sentence
  // saying what was measured and when is.
  if (!surface.reason || surface.reason.length < 80) problems.push(`${surface.key} needs a reason saying why these routes are not pages, in enough detail to be checkable`);
}

if (account.unaccounted.length) {
  problems.push(
    `this server answers these GET routes and nothing declares them:\n  ${account.unaccounted.join("\n  ")}\n`
    + "  Either add each to lib/sonara-route-registry.cjs as a page with a title, a navigation placement and an indexing policy,\n"
    + "  or add a surface to lib/sonara-route-surface.cjs saying what they are and why they are not pages.\n"
    + "  Leaving them undeclared is what is not allowed: a route nothing declares is a route no visibility rule applies to,\n"
    + "  and the manifest test only probes routes the manifest names."
  );
}

if (account.ambiguous.length) {
  problems.push(
    `these routes are claimed by more than one surface, so which reason applies depends on list order:\n  ${account.ambiguous.join("\n  ")}\n`
    + "  Narrow one of the patterns until exactly one surface matches."
  );
}

if (account.emptySurfaces.length) {
  problems.push(
    `these surfaces match no served route, so their stated reason no longer describes anything: ${account.emptySurfaces.join(", ")}\n`
    + "  Remove the surface, or fix its pattern. A wrong reason inside an exemption is worse than no exemption,\n"
    + "  because it is what the next person reads instead of checking."
  );
}

const check = process.argv.includes("--check");

console.log(`Route surface: ${account.served.length} served GET routes, ${account.declared.length} declared as pages, ${account.undeclared.length} accounted for by ${ROUTE_SURFACES.length} surfaces.`);
for (const surface of ROUTE_SURFACES) {
  const routes = account.bySurface.get(surface.key);
  const owner = surface.ownerDecision ? `  [owner decision: ${surface.ownerDecision}]` : "";
  console.log(`  ${String(routes.length).padStart(4)}  ${surface.key} (${surface.expectedAccess})${owner}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:\n`);
  for (const problem of problems) console.error(`- ${problem}\n`);
  process.exit(1);
}

if (check) console.log("Every served GET route is accounted for.");
process.exit(0);
