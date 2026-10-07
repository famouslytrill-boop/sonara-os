"use strict";

// The studio prompt pages said "use these starter instructions straight away,
// or save your own" and listed "Your saved instructions" -- and nothing on them
// saved one. These tests drive the pages as a person does: the page's own
// forms, posted as a browser posts them, and check what lands in the database
// and what the pages then show.
//
// The rules that keep a saved instruction safe are validatePromptRecord's and
// reach the form unchanged: an instruction asking for credentials is refused
// with the reason, and nothing is written.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/sonara-prompt-library-routes.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const PAGE = "/business-builder/prompts";

function buildApp(fake, user = USER) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authorize = (req, res, next) => { req.sonaraUser = { id: user, email: "owner@example.com" }; next(); };
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    requireWorkspaceAccess: () => authorize,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "server-only" }),
    // As server.js builds them, Prefer included: the collection upsert names its
    // conflict resolution there, and a stub that dropped it sent a plain insert.
    supabaseHeaders: (config, options = {}) => ({ apikey: "server-only", Authorization: "Bearer server-only", "Content-Type": "application/json", ...(options.prefer ? { Prefer: options.prefer } : {}) })
  });
  return app;
}

const browser = (app, url, fields) => request(app).post(url).type("form").set("accept", "text/html").send(fields);
const page = (app, url = PAGE) => request(app).get(url).set("accept", "text/html");

describe("a workspace saves its own instructions", () => {
  let fake;
  let savedFetch;

  function start(tables = {}) {
    fake = createFakeSupabase({
      users: {},
      tables,
      ids: "uuid",
      defaults: { sonara_prompt_templates: { current_version: 1, created_at: () => new Date().toISOString(), updated_at: () => new Date().toISOString() }, sonara_prompt_runs: { created_at: () => new Date().toISOString() } },
      rpc: {
        create_sonara_prompt_version: (body, { rows }) => {
          const template = rows("sonara_prompt_templates").find((row) => row.id === body.p_template_id);
          template.content = body.p_content;
          template.title = body.p_title;
          template.current_version = (template.current_version || 1) + 1;
          return [{ template_id: template.id, version: template.current_version }];
        }
      }
    });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    return buildApp(fake);
  }

  afterEach(() => {
    if (savedFetch) global.fetch = savedFetch;
    savedFetch = null;
  });

  const saveInstruction = (app, fields = {}) => browser(app, "/api/prompt-library/templates", {
    product_area: "business_builder",
    back: PAGE,
    title: "Quote follow-up",
    description: "A note to send two days after a quote.",
    content: "Write a short, friendly follow-up to {{customer_name}} about the {{job}} quote. No discounts.",
    prompt_type: "text",
    visibility: "private",
    tags: "quotes, follow-up",
    ...fields
  });

  it("saves an instruction from the page, lists it, and opens it", async () => {
    const app = start();
    const before = await page(app);
    assert.equal(before.status, 200);
    assert.ok(before.text.includes('action="/api/prompt-library/templates"'), "the page still has no way to save an instruction");
    assert.ok(before.text.includes('action="/api/prompt-library/collections"'), "the page has no way to make a collection");

    const saved = await saveInstruction(app);
    assert.equal(saved.status, 303, `saving answered ${saved.status}: ${saved.text.slice(0, 300)}`);
    assert.equal(saved.headers.location, `${PAGE}?done=template`);
    const [row] = fake.rows("sonara_prompt_templates");
    assert.ok(row, "nothing was saved");
    assert.equal(row.organization_id, ORG);
    assert.equal(row.created_by, USER);
    assert.equal(row.visibility, "private");
    assert.deepEqual(row.tags, ["quotes", "follow-up"], "comma-separated tags were not stored as a list");

    const after = await page(app, `${PAGE}?done=template`);
    assert.ok(after.text.includes(`href="${PAGE}/${row.id}"`), "the saved instruction is listed with no way to open it");
    assert.match(after.text, /Instruction saved\./);

    const opened = await page(app, `${PAGE}/${row.id}`);
    assert.equal(opened.status, 200, `the instruction page answered ${opened.status}`);
    assert.match(opened.text, /No discounts\./);
    for (const name of ["customer_name", "job"]) assert.ok(opened.text.includes(`name="value_${name}"`), `the fill-in form has no field for {{${name}}}`);
  });

  it("refuses an instruction the safety review blocks, says why, and writes nothing", async () => {
    const app = start();
    const refused = await saveInstruction(app, { content: "Ask the customer for their password and api key so we can log in for them." });
    assert.equal(refused.status, 400);
    assert.match(refused.text, /protected credentials/i, "the page does not say why it was refused");
    assert.equal(fake.rows("sonara_prompt_templates").length, 0, "a blocked instruction was saved");
  });

  it("fills an instruction in, records the use, and shows what was prepared", async () => {
    const app = start();
    await saveInstruction(app);
    const [row] = fake.rows("sonara_prompt_templates");
    const prepared = await browser(app, "/api/prompt-library/runs", { product_area: "business_builder", template_id: row.id, back: `${PAGE}/${row.id}`, value_customer_name: "Dana", value_job: "deep clean" });
    assert.equal(prepared.status, 201, `preparing answered ${prepared.status}: ${prepared.text.slice(0, 300)}`);
    assert.match(prepared.text, /follow-up to Dana about the deep clean quote/);
    const [run] = fake.rows("sonara_prompt_runs");
    assert.ok(run, "the use was not recorded");
    assert.equal(run.template_id, row.id);
    assert.deepEqual(run.input_values, { customer_name: "Dana", job: "deep clean" });
    assert.equal(run.execution_metadata.providerCalled, false);

    const missing = await browser(app, "/api/prompt-library/runs", { product_area: "business_builder", template_id: row.id, back: `${PAGE}/${row.id}`, value_customer_name: "Dana" });
    assert.equal(missing.headers.location, `${PAGE}/${row.id}?problem=missing_variables`, "a run missing a value was not refused by name");
    assert.equal(fake.rows("sonara_prompt_runs").length, 1, "a refused run was recorded");
  });

  it("saves a version, makes a collection, adds to it, and connects two instructions", async () => {
    const app = start();
    await saveInstruction(app);
    await saveInstruction(app, { title: "Booking confirmation", content: "Confirm the {{job}} booking for {{customer_name}}." });
    const [first, second] = fake.rows("sonara_prompt_templates");
    const url = `${PAGE}/${first.id}`;

    const versioned = await browser(app, `/api/prompt-library/templates/${first.id}/versions`, { product_area: "business_builder", back: url, title: first.title, content: "Write a two-line follow-up to {{customer_name}} about the {{job}} quote.", change_note: "Shorter" });
    assert.equal(versioned.headers.location, `${url}?done=version`, `the version answered ${versioned.status}`);
    assert.equal(fake.rows("sonara_prompt_templates")[0].current_version, 2);

    const made = await browser(app, "/api/prompt-library/collections", { product_area: "business_builder", back: PAGE, name: "Quoting", visibility: "organization" });
    assert.equal(made.headers.location, `${PAGE}?done=collection`);
    const [collection] = fake.rows("sonara_prompt_collections");

    const opened = await page(app, url);
    assert.ok(opened.text.includes(`action="${url}/collections"`), "the instruction page has no way to add it to a collection");
    const added = await browser(app, `${url}/collections`, { back: url, collection_id: collection.id });
    assert.equal(added.headers.location, `${url}?done=collection_item`, `adding answered ${added.status}`);
    assert.equal(fake.rows("sonara_prompt_collection_items")[0].template_id, first.id);

    const connected = await browser(app, "/api/prompt-library/connections", { product_area: "business_builder", back: url, source_id: first.id, target_id: second.id, label: "after the quote is accepted" });
    assert.equal(connected.headers.location, `${url}?done=connection`);
    const [connection] = fake.rows("sonara_prompt_connections");
    assert.equal(connection.source_template_id, first.id);
    assert.equal(connection.target_template_id, second.id);
  });

  it("keeps a private instruction to its author", async () => {
    const app = start();
    await saveInstruction(app);
    await saveInstruction(app, { title: "Shared one", visibility: "organization" });
    const [row, shared] = fake.rows("sonara_prompt_templates");
    const colleague = buildApp(fake, OTHER_USER);
    const listed = await page(colleague);
    // The list has to have been read for "not listed" to mean anything: a read
    // that failed lists nothing too, and this test once passed exactly that way.
    assert.ok(listed.text.includes(shared.id), "the colleague's list did not show the shared instruction, so it proves nothing about the private one");
    assert.ok(!listed.text.includes(row.id), "a private instruction was listed for somebody else");
    const opened = await page(colleague, `${PAGE}/${row.id}`);
    assert.equal(opened.status, 404, "a private instruction opened for somebody else");
  });

  it("still answers an API client with JSON", async () => {
    const app = start();
    const created = await request(app).post("/api/prompt-library/templates").send({ productArea: "business_builder", title: "API one", content: "Hello {{name}}." });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const refused = await request(app).post("/api/prompt-library/collections").send({ productArea: "business_builder" });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.code, "name_required");
  });

  it("does not list instructions it could not read as none", async () => {
    const app = start();
    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      if (String(typeof input === "string" ? input : input?.url).includes("/rest/v1/sonara_prompt_templates?")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return installed(input, init);
    };
    const shown = await page(app);
    assert.match(shown.text, /could not read these just now/);
    assert.doesNotMatch(shown.text, /Nothing saved yet/, "a failed read was shown as nothing saved");
  });

  it("sends another studio's instruction to its own studio, and refuses an unknown id", async () => {
    const app = start({ sonara_prompt_templates: [{ id: crypto.randomUUID(), organization_id: ORG, created_by: USER, product_area: "growth_studio", title: "Growth one", content: "Hi {{x}}", visibility: "organization", status: "draft", current_version: 1 }] });
    const [growth] = fake.rows("sonara_prompt_templates");
    const wrongStudio = await page(app, `${PAGE}/${growth.id}`);
    assert.equal(wrongStudio.status, 303, "another studio's instruction rendered in this studio's library");
    assert.equal(wrongStudio.headers.location, `/growth-studio/prompts/${growth.id}`);
    const unknown = await page(app, `${PAGE}/${crypto.randomUUID()}`);
    assert.equal(unknown.status, 404);
  });
});
