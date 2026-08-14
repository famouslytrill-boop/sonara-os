"use strict";

// Fill in each Growth Studio form and press the button.
//
// Three of the eight could never save, and all three failed the same way: the
// handler required something no form had a field for, so every submission came
// back 400 naming a field the customer could not see.
//
//   segments     wanted segment_definition, an object; the form collects a name,
//                a description and a status.
//   experiments  wanted two variants with weights summing to one; the form
//                offered no variants at all.
//   consents     validated channel against a closed list; the form rendered it
//                as free text labelled "email, sms, post, phone", and "post" has
//                never been on that list.
//
// This is the same shape as the `item_name` defect already recorded in
// docs/SPRINT_LOG.md: a form that cannot save, with tests passing because they
// posted a body assembled by hand rather than the one the page produces.
//
// So this builds its bodies **out of the rendered HTML** — every input by name,
// every select's first real option, every textarea. A test that constructs its
// own body cannot see a missing field, because it supplies the field itself.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-growth-forms",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-growth-forms"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { CONSENT_CHANNELS } = require("../lib/sonara-growth-create-specs.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "growth@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });

// The body a browser would send for this form. Read off the page rather than
// written here, which is the whole point.
function bodyFromForm(html, action) {
  const at = html.indexOf(`action="${action}"`);
  if (at < 0) return null;
  const form = html.slice(at, html.indexOf("</form>", at));
  const body = {};
  for (const match of form.matchAll(/<select\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const options = [...match[2].matchAll(/<option value="([^"]*)"/g)].map((option) => option[1]).filter(Boolean);
    if (options.length) body[match[1]] = options[0];
  }
  for (const match of form.matchAll(/<textarea[^>]*name="([^"]+)"/g)) body[match[1]] = "X";
  for (const match of form.matchAll(/<input([^>]*)>/g)) {
    const attributes = match[1];
    const name = (attributes.match(/name="([^"]+)"/) || [])[1];
    if (!name || body[name] !== undefined) continue;
    const type = (attributes.match(/type="([^"]+)"/) || ["", "text"])[1];
    if (type === "hidden") { body[name] = (attributes.match(/value="([^"]*)"/) || ["", ""])[1]; continue; }
    if (type === "checkbox") { body[name] = "on"; continue; }
    if (type === "number") { body[name] = "1"; continue; }
    if (type === "date") { body[name] = "2026-08-01"; continue; }
    if (type === "email") { body[name] = "a@b.co"; continue; }
    body[name] = /_id$/.test(name) ? "55555555-5555-4555-8555-555555555555" : "X";
  }
  return body;
}

describe("every Growth Studio form can actually save", () => {
  let realFetch;
  const writes = [];
  const results = [];
  let formsFound = 0;

  before(async function submit() {
    this.timeout(120000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      const target = String(url);
      const method = (options.method || "GET").toUpperCase();
      if (target.includes("/auth/v1/user")) return json(USER);
      if (target.includes("/rest/v1/rpc/")) return json({});
      if (!target.includes("/rest/v1/")) return undefined;
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
      if (method !== "GET") { writes.push({ table, body: JSON.parse(options.body || "{}") }); return json([{ id: "new" }], 201); }
      if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
      if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
      if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Growth Ltd" }]);
      if (table === "billing_entitlements") {
        const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
        return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
      }
      return json([]);
    };

    const auth = (req) => req.set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`);
    for (const page of GROWTH_RECORD_PAGES) {
      if (!page.path) continue;
      const rendered = await auth(request(app).get(page.path)).set("Accept", "text/html").redirects(0);
      if (rendered.status !== 200) continue;
      const actions = new Set([...String(rendered.text).matchAll(/<form[^>]*action="(\/api\/growth[^"]*)"/g)].map((match) => match[1]));
      for (const action of actions) {
        formsFound += 1;
        const body = bodyFromForm(rendered.text, action);
        const before = writes.length;
        const response = await auth(request(app).post(action)).set("Accept", "application/json").type("form").send(body).redirects(0);
        results.push({
          action,
          status: response.status,
          code: response.body?.code || "",
          wrote: writes.slice(before),
          body
        });
      }
    }
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("found the forms, rather than passing over a page that rendered none", () => {
    assert.ok(formsFound >= 8, `only ${formsFound} Growth Studio create forms rendered; this check has gone blind`);
  });

  it("saves something for every form the pages render", () => {
    const refused = results
      .filter((result) => result.wrote.length === 0)
      .map((result) => `${result.action} answered ${result.status} ${result.code} for the body its own form produces: ${JSON.stringify(result.body)}`);
    assert.deepEqual(
      refused,
      [],
      `these forms cannot save what they collect:\n  ${refused.join("\n  ")}\n\n` +
        "The handler wants something the form has no field for. Add the field, or take the requirement out of the handler."
    );
  });

  it("writes the record the form is about, not only an audit event", () => {
    // growth_control_events is written beside several of these. A submission
    // that logged an event and saved no record would satisfy the check above
    // while creating nothing.
    const eventOnly = results
      .filter((result) => result.wrote.length > 0 && result.wrote.every((write) => write.table === "growth_control_events"))
      .map((result) => result.action);
    assert.deepEqual(eventOnly, [], `these forms recorded an event and saved no record: ${eventOnly.join(", ")}`);
  });

  it("gives an experiment the two variants its handler requires", () => {
    const experiment = results.find((result) => result.action.endsWith("/experiments"));
    assert.ok(experiment, "no experiments form was submitted");
    const variants = experiment.wrote.filter((write) => write.table === "growth_experiment_variants");
    assert.equal(variants.length, 2, `the form produced ${variants.length} variants`);
    const total = variants.reduce((sum, write) => sum + Number(write.body.allocation_weight || 0), 0);
    assert.ok(Math.abs(total - 1) < 0.0001, `variant weights sum to ${total}, and the handler requires one`);
  });

  it("stores what the customer wrote about a segment, marked as words rather than a rule", () => {
    const segment = results.find((result) => result.action.endsWith("/segments"));
    assert.ok(segment, "no segments form was submitted");
    const row = segment.wrote.find((write) => write.table === "growth_audience_segments");
    assert.ok(row, "no segment was written");
    // Nothing in this product evaluates segment_definition. Storing the
    // description under its own key keeps that honest: a future evaluator can
    // tell a written description from a rule it could execute.
    assert.ok(row.body.segment_definition?.described_as, "the segment definition does not carry what the customer wrote");
  });

  it("offers exactly the consent channels the handler accepts", async function channels() {
    this.timeout(20000);
    Object.assign(process.env, SUPABASE_ENV);
    const saved = global.fetch;
    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/auth/v1/user")) return json(USER);
      if (!target.includes("/rest/v1/")) return undefined;
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
      if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
      if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
      if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Growth Ltd" }]);
      if (table === "billing_entitlements") {
        const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
        return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
      }
      return json([]);
    };
    const page = GROWTH_RECORD_PAGES.find((record) => record.tableKey === "consents");
    const rendered = await request(app).get(page.path).set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
    global.fetch = saved;
    assert.equal(rendered.status, 200);
    const select = String(rendered.text).match(/<select\s+name="channel"[^>]*>([\s\S]*?)<\/select>/);
    assert.ok(select, "channel is not a picker, so a customer can type a value the handler refuses");
    const offered = [...select[1].matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]).filter(Boolean);
    // Not a subset check: a channel offered but refused is a dead end, and a
    // channel accepted but never offered is a capability nobody can reach.
    assert.deepEqual(offered.sort(), [...CONSENT_CHANNELS].sort());
  });
});
