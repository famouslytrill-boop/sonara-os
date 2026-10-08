"use strict";

// The nine "Add a ..." forms on the Growth record pages post straight to
// /api/growth/<key>, and those handlers answered only in JSON -- so a person
// who pressed Save was shown {"ok":true,...} and had to press Back to find out
// whether anything had happened. Nothing intercepted the forms: no client
// script, no server adapter.
//
// These tests post each form as a browser does, with the body read off the
// rendered page, and follow the answer back to the page it lands on.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/growth-studio-control-routes.cjs");
const { GROWTH_CREATE_SPECS } = require("../lib/sonara-growth-create-specs.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { GROWTH_TABLES } = require("../lib/sonara-growth-tables.cjs");
const outcomes = require("../lib/sonara-growth-form-outcomes.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const THEIR_CAMPAIGN = "b0000000-0000-4000-8000-000000000001";
const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

// The body a browser sends for this form, read off the page. Optional links
// are left empty, as a person who does not link anything leaves them.
function bodyFromForm(html, action) {
  const at = html.indexOf(`action="${action}"`);
  if (at < 0) return null;
  const form = html.slice(at, html.indexOf("</form>", at));
  const body = {};
  for (const match of form.matchAll(/<select\s+[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const options = [...match[2].matchAll(/<option value="([^"]*)"/g)].map((option) => option[1]).filter(Boolean);
    if (options.length) body[match[1]] = options[0];
  }
  for (const match of form.matchAll(/<textarea[^>]*name="([^"]+)"/g)) body[match[1]] = "X";
  for (const match of form.matchAll(/<input([^>]*)>/g)) {
    const attributes = match[1];
    const name = (attributes.match(/name="([^"]+)"/) || [])[1];
    if (!name || body[name] !== undefined) continue;
    const type = (attributes.match(/type="([^"]+)"/) || ["", "text"])[1];
    if (type === "hidden") body[name] = (attributes.match(/value="([^"]*)"/) || ["", ""])[1];
    else if (type === "checkbox") body[name] = "on";
    else if (type === "number") body[name] = "1";
    else if (type === "date") body[name] = "2026-08-01";
    else if (type === "email") body[name] = "a@b.co";
    else body[name] = /_id$/.test(name) ? "" : "X";
  }
  return body;
}

describe("a Growth form answers a person with a page", () => {
  let fake;
  let savedFetch;
  function start() {
    const tables = Object.fromEntries(Object.values(GROWTH_TABLES).map((table) => [table, []]));
    tables.growth_campaigns = [{ id: THEIR_CAMPAIGN, organization_id: OTHER, name: "Not yours", status: "active" }];
    tables.sonara_platforms = [];
    fake = createFakeSupabase({ users: {}, tables, ids: "uuid" });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    const signedIn = () => (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; next(); };
    registerRoutes(app, {
      layout: ({ heading, sections = [] }) => `<html><h1>${heading}</h1>${sections.join("")}</html>`,
      brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml,
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
  const pageFor = (spec) => GROWTH_RECORD_PAGES.find((record) => record.tableKey === spec.tableKey);

  it("answers every form a browser posts on its own page, saying it was saved", async () => {
    const app = start();
    let posted = 0;
    for (const spec of GROWTH_CREATE_SPECS) {
      const page = pageFor(spec);
      const action = `/api/growth/${spec.key}`;
      const rendered = await request(app).get(page.path).set("accept", BROWSER);
      assert.equal(rendered.status, 200, `${page.path} did not render`);
      const body = bodyFromForm(rendered.text, action);
      assert.ok(body, `${page.path} has no form posting to ${action}`);
      const table = GROWTH_TABLES[spec.tableKey];
      const before = fake.rows(table).length;
      const answer = await request(app).post(action).set("accept", BROWSER).type("form").send(body).redirects(0);
      assert.equal(answer.status, 303, `${action} answered ${answer.status}: ${String(answer.text).slice(0, 200)}`);
      assert.equal(answer.headers.location, `${page.path}?saved=1`);
      assert.equal(fake.rows(table).length, before + 1, `${action} said saved and wrote nothing`);
      const landed = await request(app).get(answer.headers.location).set("accept", BROWSER);
      assert.match(landed.text, new RegExp(`<h2>Saved</h2><p>The ${spec.noun} is saved\\.</p>`), `${page.path} does not say the ${spec.noun} was saved`);
      posted += 1;
    }
    assert.equal(posted, 9, `only ${posted} forms were posted; this test has gone blind`);
  });

  it("says in words why a form was not saved", async () => {
    const app = start();
    const empty = await request(app).post("/api/growth/leads").set("accept", BROWSER).type("form").send({ name: "", email: "", phone: "" }).redirects(0);
    assert.equal(empty.headers.location, "/growth-studio/enquiries?problem=lead_identity_required&form=create");
    const page = await request(app).get(empty.headers.location).set("accept", BROWSER);
    assert.match(page.text, /<h2>Not saved<\/h2><p>Give a name, an email or a phone number, so there is a way to reach them\.<\/p>/);
    assert.equal(fake.rows("growth_leads").length, 0);

    const linked = await request(app).post("/api/growth/conversions").set("accept", BROWSER).type("form").send({ conversion_type: "sale", campaign_id: THEIR_CAMPAIGN }).redirects(0);
    assert.equal(linked.headers.location, "/growth-studio/conversions?problem=campaign_id_not_yours&form=create");
    const refused = await request(app).get(linked.headers.location).set("accept", BROWSER);
    assert.match(refused.text, /The campaign you linked is not one of this workspace(&#39;|')s, so nothing was saved/);
    assert.equal(fake.rows("growth_conversions").length, 0);
  });

  it("tells a failed save from a failed send on the campaigns page, which reads ?problem= for both", async () => {
    const app = start();
    const saveFailed = await request(app).post("/api/growth/campaigns").set("accept", BROWSER).type("form").send({ name: "" }).redirects(0);
    assert.equal(saveFailed.headers.location, "/growth-studio/your-campaigns?problem=campaign_name_required&form=create");
    const afterSave = await request(app).get(saveFailed.headers.location).set("accept", BROWSER);
    assert.match(afterSave.text, /<h2>Not saved<\/h2><p>Give the campaign a name\.<\/p>/);
    assert.doesNotMatch(afterSave.text, /Nothing was sent/, "a failed save was announced as a campaign that was not sent");
    const afterSend = await request(app).get("/growth-studio/your-campaigns?problem=no_recipients").set("accept", BROWSER);
    assert.match(afterSend.text, /Nothing was sent/);
    assert.doesNotMatch(afterSend.text, /<h2>Not saved<\/h2>/, "a failed send was announced as a record that was not saved");
  });

  it("keeps answering a caller that asks for JSON in JSON", async () => {
    const app = start();
    const answer = await request(app).post("/api/growth/leads").set("accept", "application/json").type("form").send({ name: "Ann" });
    assert.equal(answer.status, 201);
    assert.equal(answer.body.ok, true);
  });

  it("never prints a code it does not know", async () => {
    const app = start();
    const page = await request(app).get("/growth-studio/enquiries?problem=%3Cscript%3Ealert(1)%3C%2Fscript%3E&form=create").set("accept", BROWSER);
    assert.match(page.text, new RegExp(outcomes.NOT_SAVED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(page.text, /alert\(1\)/, "a code from the address was printed on the page");
    assert.equal(outcomes.problemText("constructor"), outcomes.NOT_SAVED, "an object's own property name was read as a code");
  });

  it("has a sentence for every refusal a create handler can give, and none for refusals that no longer exist", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "growth-studio-control-routes.cjs"), "utf8");
    const codes = new Set();
    for (const spec of GROWTH_CREATE_SPECS) {
      const start = source.indexOf(`app.post("/api/growth/${spec.key}"`);
      assert.ok(start >= 0, `no handler for ${spec.key}`);
      const handler = source.slice(start, source.indexOf("\n  });\n", start));
      for (const [, code] of handler.matchAll(/code: "([a-z_]+)"/g)) codes.add(code);
    }
    const context = source.slice(source.indexOf("async function resolveContext"), source.indexOf("\n}\n", source.indexOf("async function resolveContext")));
    for (const [, code] of context.matchAll(/code: "([a-z_]+)"/g)) codes.add(code);
    assert.ok(codes.size >= 15, `only ${codes.size} refusal codes found in the handlers; this check has gone blind`);
    const unworded = [...codes].filter((code) => outcomes.problemText(code) === outcomes.NOT_SAVED);
    assert.deepEqual(unworded, [], "a create handler refuses with a code the page cannot put into words");
    const stale = Object.keys(outcomes.PROBLEMS).filter((code) => !codes.has(code));
    assert.deepEqual(stale, [], "a sentence is kept for a refusal no handler gives any more");
    for (const column of Object.keys(registerRoutes.REFERENCES)) {
      for (const suffix of ["invalid", "not_yours", "unreadable"]) {
        assert.notEqual(outcomes.problemText(`${column}_${suffix}`), outcomes.NOT_SAVED, `${column}_${suffix} has no sentence`);
      }
    }
  });
});
