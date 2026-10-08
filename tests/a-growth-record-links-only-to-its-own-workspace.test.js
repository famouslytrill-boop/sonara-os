"use strict";

// The Growth create endpoints took the ids a record links to -- the campaign a
// lead came from, the lead a conversion belongs to, the platform, segment,
// connection or content item -- from the request body, and checked only that
// each looked like a UUID. Every one of those tables is organization-scoped,
// and the foreign key behind each accepts a row from any organization. So a
// record could point across the tenant boundary, and that other workspace's
// deletes would reach into this one through ON DELETE SET NULL.
//
// These tests post to the real routes, against a fake database holding two
// workspaces, and hold three answers apart: not an id (400), not yours (403),
// could not check (502). The case table is checked against the handlers'
// own ownedReferences calls in both directions, so a check removed, or a link
// added without one, fails here rather than passing unexamined.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";

const mine = (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const theirs = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LINKED = {
  campaign_id: { table: "growth_campaigns", n: 1, row: { name: "Spring", status: "active" } },
  lead_id: { table: "growth_leads", n: 2, row: { name: "Ann", status: "new" } },
  touchpoint_id: { table: "growth_touchpoints", n: 3, row: { event_name: "visit" } },
  content_id: { table: "growth_content_queue", n: 4, row: { channel: "blog", content_type: "blog" } },
  provider_connection_id: { table: "growth_provider_connections", n: 5, row: { provider_key: "hubspot" } },
  audience_segment_id: { table: "growth_audience_segments", n: 6, row: { name: "Regulars" } },
  platform_id: { table: "sonara_platforms", n: 7, row: { name: "Main site" } }
};

// What each handler needs to get as far as its write, and where it writes.
const CASES = [
  { path: "/api/growth/campaigns", body: { name: "Spring" }, table: "growth_campaigns", columns: ["platform_id"] },
  { path: "/api/growth/leads", body: { name: "Ann" }, table: "growth_leads", columns: ["platform_id", "campaign_id"] },
  { path: "/api/growth/consents", body: { channel: "email", consent_status: "granted", purpose: "Newsletter", source: "Signed up at the counter" }, table: "growth_contact_consents", columns: ["lead_id"] },
  { path: "/api/growth/touchpoints", body: { tracking_basis_attested: "true", event_name: "visit" }, table: "growth_touchpoints", columns: ["campaign_id", "lead_id"] },
  { path: "/api/growth/conversions", body: { conversion_type: "sale" }, table: "growth_conversions", columns: ["campaign_id", "lead_id", "touchpoint_id"] },
  { path: "/api/growth/content", body: { channel: "blog", content_type: "blog" }, table: "growth_content_queue", columns: ["campaign_id", "provider_connection_id", "audience_segment_id"] },
  { path: "/api/growth/experiments", body: { name: "Headline", hypothesis: "Shorter wins", variant_a: "Long", variant_b: "Short" }, table: "growth_experiments", columns: ["platform_id", "campaign_id"] },
  { path: "/api/growth/automations", body: { trigger_key: "lead_created", action_key: "notify_owner" }, table: "automation_rules", columns: ["platform_id"] },
  // Saving with its own campaign goes on to the provider, which needs
  // credentials this file does not have; tests/growth-studio-platform.test.js
  // covers that path. The refusals happen before any of it.
  { path: "/api/growth/provider-jobs", body: { provider_key: "hubspot", capability: "campaign_create", operation: "campaign_create", idempotency_key: "job-1" }, table: "growth_provider_jobs", columns: ["campaign_id", "content_id"], refusalsOnly: true }
];

function seed() {
  const tables = {
    organizations: [{ id: ORG, name: "Bright Plumbing" }, { id: OTHER, name: "Somebody Else Ltd" }],
    growth_contact_consents: [], growth_conversions: [], growth_experiments: [], growth_experiment_variants: [],
    automation_rules: [], growth_provider_jobs: [], growth_control_events: []
  };
  for (const linked of Object.values(LINKED)) {
    tables[linked.table] = [
      { id: mine(linked.n), organization_id: ORG, ...linked.row },
      { id: theirs(linked.n), organization_id: OTHER, ...linked.row }
    ];
  }
  return tables;
}

describe("a Growth record links only to its own workspace's records", () => {
  let fake;
  let savedFetch;
  function start(tables = seed()) {
    fake = createFakeSupabase({ users: {}, tables, ids: "uuid" });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    const app = express();
    app.use(express.json());
    const signedIn = () => (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; next(); };
    registerRoutes(app, {
      layout: ({ heading }) => `<html><h1>${heading}</h1></html>`,
      brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value),
      requireWorkspaceAccess: signedIn,
      requirePaidOrOwnerAccess: signedIn,
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG, role: "owner" }),
      getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "service-role" })
    });
    return app;
  }
  afterEach(() => {
    if (savedFetch) global.fetch = savedFetch;
    savedFetch = null;
  });
  const count = (table) => fake.rows(table).length;

  it("tests every link the handlers check, and checks every link it tests", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "growth-studio-control-routes.cjs"), "utf8");
    const checked = new Set();
    for (const handler of source.matchAll(/app\.post\("(\/api\/growth\/[a-z-]+)"[\s\S]*?(?=\n {2}app\.|\n};)/g)) {
      for (const call of handler[0].matchAll(/ownedReferences\(config, context, req\.body, \[([^\]]*)\]\)/g)) {
        for (const [, column] of call[1].matchAll(/"([a-z_]+)"/g)) checked.add(`${handler[1]} ${column}`);
      }
    }
    const tested = new Set(CASES.flatMap((entry) => entry.columns.map((column) => `${entry.path} ${column}`)));
    assert.ok(checked.size >= 17, `only ${checked.size} checked links found in the handlers; this test has gone blind`);
    assert.deepEqual([...checked].filter((pair) => !tested.has(pair)), [], "a handler checks a link this file never tries to break");
    assert.deepEqual([...tested].filter((pair) => !checked.has(pair)), [], "this file expects a check the handler no longer makes");
    assert.deepEqual(Object.keys(registerRoutes.REFERENCES).sort(), Object.keys(LINKED).sort(), "a reference kind has no fixture here");
  });

  for (const entry of CASES) {
    for (const column of entry.columns) {
      it(`refuses ${entry.path} a ${column} from another workspace, and writes nothing`, async () => {
        const app = start();
        const before = count(entry.table);
        const response = await request(app).post(entry.path).send({ ...entry.body, [column]: theirs(LINKED[column].n) });
        assert.equal(response.status, 403, JSON.stringify(response.body));
        assert.equal(response.body.code, `${column}_not_yours`);
        assert.equal(count(entry.table), before, "a record pointing at another workspace was written");
      });
    }

    if (!entry.refusalsOnly) {
      it(`saves ${entry.path} with this workspace's own links`, async () => {
        const app = start();
        const own = Object.fromEntries(entry.columns.map((column) => [column, mine(LINKED[column].n)]));
        const response = await request(app).post(entry.path).send({ ...entry.body, ...own });
        assert.ok(response.status >= 200 && response.status < 300, `${entry.path} answered ${response.status} ${JSON.stringify(response.body)}`);
        const written = fake.rows(entry.table).find((row) => entry.columns.every((column) => row[column] === own[column]));
        assert.ok(written, `${entry.path} did not save the links it was given`);
      });
    }
  }

  it("refuses something that is not an id at all, rather than saving without the link", async () => {
    const app = start();
    const response = await request(app).post("/api/growth/conversions").send({ conversion_type: "sale", campaign_id: "spring-flyers" });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "campaign_id_invalid");
    assert.equal(count("growth_conversions"), 0, "a conversion was saved without the campaign it was given");
  });

  it("treats an empty field as no link, because every form sends one", async () => {
    const app = start();
    const response = await request(app).post("/api/growth/conversions").send({ conversion_type: "sale", campaign_id: "", lead_id: "  " });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const [row] = fake.rows("growth_conversions");
    assert.equal(row.campaign_id, null);
    assert.equal(row.lead_id, null);
  });

  it("says it could not check, and writes nothing, when the check cannot be read", async () => {
    const app = start();
    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      if (String(typeof input === "string" ? input : input?.url).includes("/rest/v1/growth_leads?select=id&id=eq.")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return installed(input, init);
    };
    const response = await request(app).post("/api/growth/conversions").send({ conversion_type: "sale", lead_id: mine(LINKED.lead_id.n) });
    assert.equal(response.status, 502);
    assert.equal(response.body.code, "lead_id_unreadable");
    assert.equal(count("growth_conversions"), 0, "a conversion was saved on the strength of a check that did not happen");
  });
});
