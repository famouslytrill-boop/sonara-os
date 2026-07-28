"use strict";

// Two organizations, real routes, and the question that matters: can one see
// the other's records?
//
// CRIT-3 item (3) in docs/audits/2026-07-27-ENGINEERING_AUDIT.md. The tenant
// guard added in the previous change refuses a query with no organization in
// it. That is necessary and not sufficient -- a query can be perfectly scoped
// and still be scoped to the *wrong* organization, and the guard cannot tell.
// Only driving two tenants through the real routes can.
//
// tests/helpers/fake-supabase.cjs stands in for Auth and PostgREST, so this
// needs no network, no credentials, and no cleanup. It records every query,
// which lets these tests assert on what the application *asked for* and not
// only on what came back. That distinction carries the weight here: "B's data
// did not appear" can be true because of a render bug or a swallowed error.
// "The application never issued a query that could have returned B's data" is
// the property worth holding.

const assert = require("node:assert/strict");
const request = require("supertest");

const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const { TENANT_SCOPED_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");

const ORG_A = "aaaaaaaa-0000-0000-0000-00000000000a";
const ORG_B = "bbbbbbbb-0000-0000-0000-00000000000b";
const USER_A = "11111111-0000-0000-0000-000000000001";
const USER_B = "22222222-0000-0000-0000-000000000002";

// Distinctive enough that finding one in a page is unambiguous.
const MARKER = { [ORG_A]: "ALPHA", [ORG_B]: "BETA" };

function seedFor(organizationId, userId) {
  const tag = MARKER[organizationId];
  return {
    organizations: [{ id: organizationId, name: `${tag}-ORG`, slug: tag.toLowerCase() }],
    organization_memberships: [
      { id: `${tag}-mem`, organization_id: organizationId, user_id: userId, status: "active", role: "owner", created_at: "2026-01-01" }
    ],
    business_workspaces: [
      { id: `${tag}-ws`, organization_id: organizationId, name: `${tag}-WORKSPACE`, deleted_at: null, created_at: "2026-01-01" }
    ],
    customer_records: [
      { id: `${tag}-cust`, organization_id: organizationId, full_name: `${tag}-CUSTOMER`, email: `${tag}@example.com`, created_at: "2026-01-01" }
    ],
    intake_requests: [
      { id: `${tag}-int`, organization_id: organizationId, customer_name: `${tag}-INTAKE`, status: "new", created_at: "2026-01-01" }
    ],
    service_requests: [
      { id: `${tag}-req`, organization_id: organizationId, service_name: `${tag}-REQUEST`, product_key: "business_builder", status: "submitted", created_at: "2026-01-01" }
    ],
    service_deliverables: [
      { id: `${tag}-del`, organization_id: organizationId, title: `${tag}-DELIVERABLE`, product_key: "business_builder", status: "delivered", updated_at: "2026-01-01" }
    ],
    launch_checklist_items: [
      { id: `${tag}-chk`, organization_id: organizationId, title: `${tag}-CHECKLIST`, category: "legal", status: "open", created_at: "2026-01-01" }
    ],
    module_outputs: [
      { id: `${tag}-mod`, organization_id: organizationId, module_key: "offer", product_key: "business_builder", output_payload: { note: `${tag}-OUTPUT` }, created_at: "2026-01-01" }
    ]
  };
}

function mergedSeed() {
  const merged = {};
  for (const seed of [seedFor(ORG_A, USER_A), seedFor(ORG_B, USER_B)]) {
    for (const [table, rows] of Object.entries(seed)) (merged[table] ||= []).push(...rows);
  }
  return merged;
}

function customerRoutes(app) {
  const routes = [];
  for (const layer of app._router.stack) {
    const route = layer.route;
    if (!route || !route.methods.get) continue;
    if (route.path.includes(":") || route.path.startsWith("/api")) continue;
    routes.push(route.path);
  }
  return routes;
}

let app;
let fake;
let savedFetch;
let savedEnv;

// Everything lives inside one describe on purpose. A bare before()/after() at
// file scope is a *root* hook in mocha: it runs once for the entire suite, so
// the fake Supabase and the env vars below would stay installed for every
// other test file. That is exactly what happened first time -- three unrelated
// readiness tests started failing because this file had quietly become their
// environment too.
describe("cross-tenant isolation", () => {
before(function setUpTenants() {
  savedEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";

  fake = createFakeSupabase({
    users: { "token-a": { id: USER_A, email: "a@example.com" }, "token-b": { id: USER_B, email: "b@example.com" } },
    tables: mergedSeed()
  });

  savedFetch = global.fetch;
  // Wrapping rather than replacing: the tenant guard installed by server.js
  // stays in front of this, so a query it would refuse still gets refused.
  global.fetch = fake.install(savedFetch);

  app = require("../server");
});

after(() => {
  if (savedFetch) global.fetch = savedFetch;
  for (const [key, value] of Object.entries(savedEnv || {})) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// ---------------------------------------------------------------------------
// The harness can see a leak when there is one
// ---------------------------------------------------------------------------

describe("the cross-tenant harness is capable of failing", () => {
  it("holds both organizations' rows, so an unscoped read would return both", async () => {
    // Called on the fake directly, below the tenant guard. If this came back
    // with one organization's rows -- or none -- every isolation assertion
    // below would pass while proving nothing.
    const both = fake.rows("customer_records");
    assert.equal(both.length, 2, "the fake must hold a row for each organization");
    assert.deepEqual(
      both.map((row) => row.full_name).sort(),
      ["ALPHA-CUSTOMER", "BETA-CUSTOMER"],
      "both organizations' markers must be present and distinguishable"
    );
  });

  it("renders organization A's own records somewhere, or the leak check means nothing", async () => {
    // Seven routes showed A's markers when this was written. If a refactor
    // stops any record reaching a page, "B never appeared" becomes vacuously
    // true and this catches that instead.
    const showing = [];
    for (const route of customerRoutes(app)) {
      const response = await request(app).get(route).set("accept", "text/html").set("Authorization", "Bearer token-a");
      if (response.status === 200 && /ALPHA-/.test(response.text)) showing.push(route);
    }
    assert.ok(
      showing.length >= 3,
      `only ${showing.length} routes rendered organization A's own records; the isolation checks would be vacuous`
    );
  });
});

// ---------------------------------------------------------------------------
// Neither tenant can see the other
// ---------------------------------------------------------------------------

describe("one organization cannot read another's records", () => {
  for (const [signedInAs, token, ownMarker, otherMarker] of [
    ["organization A", "token-a", "ALPHA", "BETA"],
    ["organization B", "token-b", "BETA", "ALPHA"]
  ]) {
    it(`shows no ${otherMarker} record on any page when signed in as ${signedInAs}`, async function checkLeaks() {
      this.timeout(60000);
      const leaked = [];
      for (const route of customerRoutes(app)) {
        const response = await request(app).get(route).set("accept", "text/html").set("Authorization", `Bearer ${token}`);
        if (response.status !== 200) continue;
        if (new RegExp(`${otherMarker}-`).test(response.text)) leaked.push(route);
      }
      assert.deepEqual(leaked, [], `these pages showed ${otherMarker}'s records to ${signedInAs}: ${leaked.join(", ")}`);
    });

    it(`never asks for another organization's rows when signed in as ${signedInAs}`, async function checkQueries() {
      this.timeout(60000);
      const ownOrganization = ownMarker === "ALPHA" ? ORG_A : ORG_B;
      const otherOrganization = ownMarker === "ALPHA" ? ORG_B : ORG_A;

      const wrong = [];
      for (const route of customerRoutes(app)) {
        fake.reset();
        const response = await request(app).get(route).set("accept", "text/html").set("Authorization", `Bearer ${token}`);
        if (response.status !== 200) continue;

        for (const query of fake.queries) {
          if (query.table.startsWith("rpc:")) continue;
          if (!TENANT_SCOPED_TABLES.has(query.table)) continue;

          const organizationFilter = query.filters.find((filter) => filter.column === "organization_id");

          // Naming the other tenant is the unambiguous failure.
          if (organizationFilter && organizationFilter.value.includes(otherOrganization)) {
            wrong.push(`${route}: ${query.method} ${query.table} asked for the other organization`);
            continue;
          }
          // No organization at all, and not scoped to this user either. The
          // guard permits a few shapes -- existence probes, user-scoped reads
          // -- and those are fine; anything else reads across tenants.
          if (!organizationFilter) {
            const userFilter = query.filters.find((filter) => filter.column === "user_id");
            const isProbe = /select=id(&|$)/.test(query.search) && /limit=1(&|$)/.test(query.search);
            if (!userFilter && !isProbe) {
              wrong.push(`${route}: ${query.method} ${query.table} carried no organization (${query.search})`);
            }
            continue;
          }
          if (!organizationFilter.value.includes(ownOrganization)) {
            wrong.push(`${route}: ${query.method} ${query.table} scoped to ${organizationFilter.value}, not ${ownOrganization}`);
          }
        }
      }

      assert.deepEqual(
        [...new Set(wrong)],
        [],
        `Signed in as ${signedInAs}, the application issued queries it should not have:\n  ${[...new Set(wrong)].join("\n  ")}`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// The membership lookup decides everything downstream
// ---------------------------------------------------------------------------

describe("the organization a request runs as comes from the session", () => {
  it("resolves each user to their own organization", async () => {
    fake.reset();
    await request(app).get("/requests").set("accept", "text/html").set("Authorization", "Bearer token-a");
    const membershipQuery = fake.queries.find((query) => query.table === "organization_memberships");
    assert.ok(membershipQuery, "the membership lookup must run");
    const userFilter = membershipQuery.filters.find((filter) => filter.column === "user_id");
    assert.ok(userFilter, "the membership lookup must be filtered by user");
    assert.equal(userFilter.value, USER_A, "it must look up the signed-in user, not somebody else");
  });

  it("gives an anonymous visitor no organization at all", async () => {
    fake.reset();
    const response = await request(app).get("/requests").set("accept", "text/html");
    // Redirect or a setup page -- either way, not somebody's records.
    assert.doesNotMatch(response.text || "", /ALPHA-|BETA-/, "an anonymous visitor must see nobody's records");
  });

  it("ignores an organization id supplied in the query string", async () => {
    // A route that trusted a caller-supplied organization would be the leak
    // the tenant guard cannot see, since such a query is perfectly scoped --
    // just to the wrong tenant.
    fake.reset();
    const response = await request(app)
      .get(`/requests?organizationId=${ORG_B}&organization_id=${ORG_B}`)
      .set("accept", "text/html")
      .set("Authorization", "Bearer token-a");
    assert.doesNotMatch(response.text || "", /BETA-/, "a caller-supplied organization id must not change whose records are read");
  });
});
});
