"use strict";

// `routes/sonara-subsystem-routes.cjs` was 30 of 177 lines. One test named it,
// and only as one of many routes in the outage crawl -- which renders the
// unconfigured state and drives no handler. Its one write endpoint was
// unexercised.
//
// That endpoint takes a **table name from the URL** and inserts into it. The
// module says what that means in its own comment:
//
//   "One endpoint, and the table has to be one of the 38 the registry says may
//    be written. A path parameter reaching PostgREST unchecked would be a way
//    to write to any table in the database."
//
// It is admin-gated, so this is not an anonymous hole. It is still the widest
// single parameter in the application: `customers`, `customer_invoices`,
// `agent_pending_actions` and every other table are one path segment away, and
// the request goes out with the service role key, which bypasses row level
// security. The allowlist is the only thing between the two.
//
// The registry has grown since that comment was written -- 68 tables, 50
// writable -- so the numbers here are read from it rather than quoted.
//
// The other property tested below is what the server owns. Eight writable
// tables declare `organization_id` NOT NULL and five declare `user_id`, and
// neither is offered by any form: they come from the signed-in admin. A body
// carrying either would otherwise file a row against another business.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerSubsystemRoutes = require("../routes/sonara-subsystem-routes.cjs");
const registry = require("../lib/sonara-subsystem-registry.cjs");
const { describedColumns } = require("../lib/sonara-migration-columns.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const ADMIN = { id: "55555555-5555-4555-8555-555555555555" };

const ALL_TABLES = registry.SUBSYSTEMS.flatMap((subsystem) => subsystem.tables);
const WRITABLE = ALL_TABLES.filter(registry.isWritable);
const READ_ONLY = ALL_TABLES.filter((table) => !registry.isWritable(table));

// A table with no organization_id and a choice field, for the plain cases.
const PLAIN = "sonara_ecosystem_registry";
// A table the server has to stamp with an organization.
const SCOPED = "license_reviews";
// One where organization_id is NOT NULL, so a missing organization is a refusal
// rather than an omission.
const NEEDS_ORG = WRITABLE.find((table) =>
  describedColumns(table).some((column) => column.name === "organization_id" && column.required)
);

function harness({ configured = true, admin = ADMIN, organization = { ok: true, organizationId: ORG }, insert = { ok: true, status: 201, rows: [{ id: "new" }] } } = {}) {
  const sent = [];
  const app = express();
  app.use(express.json());

  const previousFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    sent.push({ url: String(url), method: (init.method || "GET").toUpperCase(), body: init.body ? JSON.parse(init.body) : null });
    if (!insert) throw new Error("unreachable");
    return { ok: insert.ok, status: insert.status, json: async () => insert.rows };
  };

  registerSubsystemRoutes(app, {
    // Renders sections and actions, not just the heading. A stub that drops
    // them makes every assertion about page content pass by measuring an empty
    // page -- which is how the first version of the index test below "passed".
    layout: ({ heading, body, sections = [], actions = [] }) =>
      `<main><h1>${heading || ""}</h1><p>${body || ""}</p>${sections.join("")}${actions.join("")}</main>`,
    brandCard: (title, body) => `<article>${title}${body}</article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireAdmin: (req, _res, next) => {
      if (admin) req.sonaraAdmin = { user: admin };
      next();
    },
    getSupabaseServerConfig: () => (configured ? { ok: true, url: "https://db.example" } : { ok: false }),
    supabaseHeaders: () => ({ apikey: "service-role" }),
    getCustomerPrimaryOrganization: async () => organization
  });

  return { app, sent, restore: () => { global.fetch = previousFetch; } };
}

describe("a path parameter is not a table name", () => {
  let live = null;
  afterEach(() => {
    if (live) live.restore();
    live = null;
  });

  it("has a registry to check against", () => {
    assert.ok(ALL_TABLES.length >= 50, `only ${ALL_TABLES.length} subsystem tables; this check has gone blind`);
    assert.ok(WRITABLE.length >= 30, `only ${WRITABLE.length} writable tables`);
    assert.ok(READ_ONLY.length >= 5, `only ${READ_ONLY.length} read-only tables, so the refusal below proves little`);
    assert.ok(NEEDS_ORG, "no writable table declares organization_id NOT NULL, so one refusal below is unreachable");
  });

  describe("the allowlist is the whole boundary", () => {
    for (const table of [
      "customers",
      "customer_invoices",
      "agent_pending_actions",
      "two_factor_enrolments",
      "pg_catalog.pg_user",
      "customers?select=*",
      "../customers"
    ]) {
      it(`refuses ${table}, without reaching the database`, async () => {
        live = harness();
        const res = await request(live.app)
          .post(`/api/research-lab/subsystems/${encodeURIComponent(table)}`)
          .send({ anything: "here" });
        assert.equal(res.status, 404, `${table} was not refused`);
        assert.equal(res.body.code, "unknown_table");
        assert.equal(live.sent.length, 0, `a request went out for ${table}`);
      });
    }

    it("refuses every table the registry marks read-only, with a reason rather than a code", async () => {
      // These record that something happened. A hand-written row would be a
      // fabricated fact sitting beside real ones.
      for (const table of READ_ONLY) {
        live = harness();
        const res = await request(live.app).post(`/api/research-lab/subsystems/${table}`).send({});
        assert.equal(res.status, 403, `${table} is read-only and was not refused`);
        assert.equal(res.body.code, "records_a_fact_not_an_intention");
        assert.equal(live.sent.length, 0, `${table} reached the database`);
        live.restore();
        live = null;
      }
    });

    it("accepts a table the registry marks writable", async () => {
      // The other side. A check that refused everything would pass every
      // assertion above and would have removed the feature.
      live = harness();
      const res = await request(live.app).post(`/api/research-lab/subsystems/${PLAIN}`).send({
        ecosystem_key: "one", name: "One", public_label: "One", description: "d", product_area: "business_builder"
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(live.sent.length, 1);
      assert.match(live.sent[0].url, new RegExp(`/rest/v1/${PLAIN}$`));
      assert.equal(live.sent[0].method, "POST");
    });
  });

  describe("the columns the server owns", () => {
    it("takes the organization from the signed-in admin, not from the body", async () => {
      // The service role key bypasses row level security, so a body-supplied
      // organization_id would file this row against another business.
      live = harness();
      const res = await request(live.app).post(`/api/research-lab/subsystems/${SCOPED}`).send({
        subject_name: "A tool",
        organization_id: OTHER_ORG,
        user_id: "somebody-else"
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const insert = live.sent[0].body;
      assert.equal(insert.organization_id, ORG, "the body's organization_id was used");
      assert.notEqual(insert.organization_id, OTHER_ORG);
    });

    it("writes only the fields the form declares", async () => {
      // The patch is built from the declaration rather than filtered from the
      // body, so a new attack name has nothing to land on.
      live = harness();
      await request(live.app).post(`/api/research-lab/subsystems/${SCOPED}`).send({
        subject_name: "A tool",
        id: "chosen-by-me",
        created_at: "1999-01-01",
        is_admin: true,
        organization_id: OTHER_ORG
      });
      const insert = live.sent[0].body;
      const offered = new Set(registry.formFields(SCOPED).map((field) => field.name));
      for (const key of Object.keys(insert)) {
        const serverOwned = key === "organization_id" || key === "user_id";
        assert.ok(offered.has(key) || serverOwned, `${key} reached the insert and no form offers it`);
      }
      assert.ok(!("id" in insert), "the row's id came from the request");
      assert.ok(!("created_at" in insert), "the row's timestamp came from the request");
    });

    it("refuses rather than filing a row with no organization, where the column demands one", async () => {
      live = harness({ organization: { ok: false } });
      const required = registry.formFields(NEEDS_ORG).filter((field) => field.required);
      const body = Object.fromEntries(required.map((field) => [
        field.name,
        field.type === "choice" ? field.values[0] : "something"
      ]));
      const res = await request(live.app).post(`/api/research-lab/subsystems/${NEEDS_ORG}`).send(body);
      assert.equal(res.status, 409, JSON.stringify(res.body));
      assert.equal(res.body.code, "no_organization_for_this_account");
      assert.equal(live.sent.length, 0, "a row was filed with no organization against a NOT NULL column");
    });
  });

  describe("what it refuses before writing", () => {
    it("names every required field that is missing, rather than failing at the database", async () => {
      live = harness();
      const res = await request(live.app).post(`/api/research-lab/subsystems/${PLAIN}`).send({ ecosystem_key: "one" });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "missing_required");
      assert.ok(res.body.missing.includes("name"), `missing did not name the fields: ${JSON.stringify(res.body.missing)}`);
      assert.equal(live.sent.length, 0);
    });

    it("treats whitespace as missing, not as an answer", async () => {
      live = harness();
      const res = await request(live.app).post(`/api/research-lab/subsystems/${PLAIN}`).send({
        ecosystem_key: "   ", name: "  ", public_label: "One", description: "d", product_area: "business_builder"
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.missing.includes("ecosystem_key"));
    });

    it("names the field when a choice is outside what the constraint allows", async () => {
      // Saying so here names the field, instead of returning a constraint
      // violation the person cannot act on.
      live = harness();
      const res = await request(live.app).post(`/api/research-lab/subsystems/${PLAIN}`).send({
        ecosystem_key: "one", name: "One", public_label: "One", description: "d", product_area: "not_a_product_area"
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "invalid_product_area");
      assert.equal(live.sent.length, 0);
    });

    it("names the field when a uuid is not one", async () => {
      live = harness();
      const res = await request(live.app).post(`/api/research-lab/subsystems/${SCOPED}`).send({
        subject_name: "A tool", reviewer_user_id: "not-a-uuid"
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "invalid_reviewer_user_id");
      assert.equal(live.sent.length, 0);
    });

    it("says setup is required rather than attempting an insert with no database", async () => {
      live = harness({ configured: false });
      const res = await request(live.app).post(`/api/research-lab/subsystems/${PLAIN}`).send({
        ecosystem_key: "one", name: "One", public_label: "One", description: "d", product_area: "business_builder"
      });
      assert.equal(res.status, 503);
      assert.equal(res.body.code, "setup_required");
      assert.equal(live.sent.length, 0);
    });

    it("reports a rejected insert as a failure, not as a saved row", async () => {
      live = harness({ insert: { ok: false, status: 409, rows: [] } });
      const res = await request(live.app).post(`/api/research-lab/subsystems/${PLAIN}`).send({
        ecosystem_key: "one", name: "One", public_label: "One", description: "d", product_area: "business_builder"
      });
      assert.equal(res.status, 502);
      assert.equal(res.body.code, "insert_failed_409", "the database's own status is worth carrying; it is what says why");
    });
  });

  describe("the pages", () => {
    it("lists every subsystem", async () => {
      live = harness();
      const res = await request(live.app).get("/research-lab/subsystems").set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.ok(res.text.length > 1500, `the index rendered ${res.text.length} bytes; it should be listing every subsystem`);
      for (const subsystem of registry.SUBSYSTEMS) {
        assert.ok(res.text.includes(subsystem.title), `${subsystem.title} is not on the index`);
      }
    });

    it("does not tell an operator the pages are read-only while offering forms", async () => {
      // The copy this replaced said "Nothing here can be changed from these
      // pages" and "Every page under this one reads", while the detail pages
      // render `<form method="post">` with a Save button for every writable
      // table. It also said "Five designed subsystems" against nine. A page
      // asserting a safety property that stopped being true is the failure this
      // repository keeps finding, and this one was in the safety sentence.
      live = harness();
      const res = await request(live.app).get("/research-lab/subsystems").set("Accept", "text/html");
      assert.doesNotMatch(res.text, /Nothing here can be changed/i);
      assert.doesNotMatch(res.text, /Every page under this one reads/i);
      assert.doesNotMatch(res.text, /Five designed subsystems/i);
      assert.doesNotMatch(res.text, /never been read or written/i);
    });

    it("counts the subsystems and tables from the registry rather than from memory", async () => {
      // The other side of it. Removing the false sentences would satisfy the
      // assertions above while saying nothing; these are the numbers that have
      // to be right, and they have to move when the registry does.
      live = harness();
      const res = await request(live.app).get("/research-lab/subsystems").set("Accept", "text/html");
      const writable = ALL_TABLES.filter(registry.isWritable).length;
      assert.ok(res.text.includes(String(ALL_TABLES.length)), `the index does not say how many tables there are (${ALL_TABLES.length})`);
      assert.ok(res.text.includes(String(registry.SUBSYSTEMS.length)), `the index does not say how many subsystems there are (${registry.SUBSYSTEMS.length})`);
      assert.ok(res.text.includes(String(writable)), `the index does not say how many tables can be written (${writable})`);
      assert.ok(
        res.text.includes(String(ALL_TABLES.length - writable)),
        `the index does not say how many cannot (${ALL_TABLES.length - writable})`
      );
    });

    it("gives every subsystem its own page", async () => {
      // Registered in a loop, so a page missing here means the loop stopped
      // matching rather than that one page was forgotten.
      for (const subsystem of registry.SUBSYSTEMS) {
        live = harness();
        const res = await request(live.app).get(`/research-lab/subsystems/${subsystem.slug}`).set("Accept", "text/html");
        assert.equal(res.status, 200, `/research-lab/subsystems/${subsystem.slug} answered ${res.status}`);
        live.restore();
        live = null;
      }
    });
  });
});
