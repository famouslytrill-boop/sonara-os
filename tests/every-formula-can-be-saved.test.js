"use strict";

// The formula library listed fifty-nine formulas and nothing could be worked
// out from the page. Each now has a page with a field per input, an answer, and
// a save. Saving exposed what had been wrong all along: sixteen formulas had no
// row in sonara_formula_definitions, so the foreign key refused every saved
// result for them, and the route called that "setup_required".

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerFormulaRoutes = require("../routes/sonara-formula-routes.cjs");
const { listFormulaDefinitions, evaluateFormula } = require("../lib/sonara-formula-library.cjs");
const pages = require("../lib/sonara-formula-pages.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const HTML = "text/html,application/xhtml+xml";

function seededFormulaKeys() {
  const directory = path.join(__dirname, "..", "supabase", "migrations");
  const keys = new Set();
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".sql"))) {
    const sql = fs.readFileSync(path.join(directory, file), "utf8");
    // Up to ON CONFLICT or a semicolon ending a line: a note inside a row may
    // contain a semicolon of its own.
    for (const insert of sql.matchAll(/insert\s+into\s+public\.sonara_formula_definitions\b([\s\S]*?)(?:\bon\s+conflict\b|;\s*$)/gim)) {
      for (const row of insert[1].matchAll(/^\s*\(\s*'([a-z0-9_]+)'\s*,/gim)) keys.add(row[1]);
    }
  }
  return keys;
}

// A value the form would send for each kind of input, within every formula's
// bounds.
const SAMPLE = { number: "1", list: "1, 2", text: "C minor", datetime: "2026-10-07T09:00", yes_no: "false", ingredients: "1, 2" };

function buildApp(fake, organizationId = ORG) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerFormulaRoutes(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}${actions.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    requireWorkspaceAccess: () => (req, res, next) => { req.sonaraUser = { id: USER }; next(); },
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "server-only" }),
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId, userId: USER }),
    supabaseHeaders: (config, options = {}) => ({ apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json", ...(options.prefer ? { Prefer: options.prefer } : {}) })
  });
  return app;
}

describe("every formula can be worked out and saved", () => {
  it("has a definition row in a migration for every formula the runtime evaluates", () => {
    const seeded = seededFormulaKeys();
    const definitions = listFormulaDefinitions();
    assert.ok(seeded.size >= 50, `only ${seeded.size} seeded formula keys were found, so this check has gone blind`);
    assert.ok(definitions.length >= 50, `only ${definitions.length} formulas were listed`);
    const missing = definitions.map((definition) => definition.formulaKey).filter((key) => !seeded.has(key));
    assert.deepEqual(missing, [], `these formulas can be evaluated but never saved, because sonara_formula_results.formula_key references a definition row they do not have: ${missing.join(", ")}`);
  });

  it("can work out every formula from the fields its own page draws", () => {
    const definitions = listFormulaDefinitions();
    for (const definition of definitions) {
      const body = Object.fromEntries(definition.requiredInputs.map((key) => [`input_${key}`, SAMPLE[pages.inputKind(key)]]));
      const result = evaluateFormula(definition.formulaKey, pages.valuesFromForm(definition, body));
      assert.equal(result.ok, true, `${definition.formulaKey} cannot be worked out from its page: ${JSON.stringify(result)}`);
    }
  });

  describe("the pages", () => {
    let fake;
    let savedFetch;
    beforeEach(() => {
      fake = createFakeSupabase({ users: {}, tables: { sonara_formula_results: [] }, ids: "uuid" });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
    });
    afterEach(() => { global.fetch = savedFetch; });

    it("links every formula from the library and draws a field for each of its inputs", async () => {
      const app = buildApp(fake);
      const index = await request(app).get("/formulas").set("Accept", HTML);
      for (const definition of listFormulaDefinitions()) {
        assert.ok(index.text.includes(`href="/formulas/${definition.formulaKey}"`), `/formulas does not link ${definition.formulaKey}`);
      }
      const page = await request(app).get("/formulas/food_cost_percent").set("Accept", HTML);
      assert.equal(page.status, 200);
      assert.match(page.text, /action="\/api\/formulas\/evaluate"/);
      assert.match(page.text, /name="input_ingredient_cost"/);
      assert.match(page.text, /name="input_menu_price"/);
      assert.equal((await request(app).get("/formulas/not_a_formula")).status, 404);
    });

    it("shows the answer and keeps what was typed when something is missing", async () => {
      const app = buildApp(fake);
      const done = await request(app).post("/api/formulas/evaluate").set("Accept", HTML).type("form")
        .send({ formulaKey: "food_cost_percent", input_ingredient_cost: "3", input_menu_price: "10" });
      assert.equal(done.status, 200);
      assert.match(done.text, /Food cost: 30%/);
      assert.match(done.text, /action="\/api\/formulas\/results"/);

      const missing = await request(app).post("/api/formulas/evaluate").set("Accept", HTML).type("form")
        .send({ formulaKey: "food_cost_percent", input_ingredient_cost: "3" });
      assert.equal(missing.status, 400);
      assert.match(missing.text, /Fill in Menu price/);
      assert.match(missing.text, /name="input_ingredient_cost" required inputmode="decimal" maxlength="40" value="3"/);
      assert.equal(fake.rows("sonara_formula_results").length, 0, "working a formula out saved something");
    });

    it("saves only the inputs the formula declares, worked out again by the server", async () => {
      const app = buildApp(fake);
      const saved = await request(app).post("/api/formulas/results").set("Accept", "application/json")
        .send({ formulaKey: "campaign_roi", inputValues: { campaign_revenue: 300, campaign_cost: 100, api_key: "sk_live_x", note: "from another form" } });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const [row] = fake.rows("sonara_formula_results");
      assert.deepEqual(Object.keys(row.input_values).sort(), ["campaign_cost", "campaign_revenue"], "fields the formula does not take were stored beside its figures");
      assert.equal(Number(row.result_value), 200);
      assert.equal(row.organization_id, ORG);
    });

    it("saves from the page and shows the saved result to that business only", async () => {
      fake.rows("sonara_formula_results").push({ id: "33333333-3333-4333-8333-333333333333", organization_id: OTHER_ORG, formula_key: "campaign_roi", input_values: { campaign_revenue: 999, campaign_cost: 1 }, result_value: 99800, result_unit: "percent", created_at: "2026-10-01T00:00:00Z" });
      const app = buildApp(fake);
      const saved = await request(app).post("/api/formulas/results").set("Accept", HTML).type("form")
        .send({ formulaKey: "campaign_roi", input_campaign_revenue: "300", input_campaign_cost: "100" });
      assert.equal(saved.status, 303);
      assert.equal(saved.headers.location, "/formulas/campaign_roi/results?saved=1");

      const list = await request(app).get(saved.headers.location).set("Accept", HTML);
      assert.equal(list.status, 200);
      assert.match(list.text, /<td>200%<\/td>/);
      assert.doesNotMatch(list.text, /99,800%/, "another business's saved result was shown");
    });

    it("says a saved-results read failed rather than that there are none", async () => {
      global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
      const list = await request(buildApp(fake)).get("/formulas/campaign_roi/results").set("Accept", HTML);
      assert.match(list.text, /could not be read just now/);
      assert.doesNotMatch(list.text, /Nothing has been saved/);
    });

    it("fails closed when workspace authorization middleware was not supplied", async () => {
      const app = express();
      app.use(express.json());
      registerFormulaRoutes(app);
      const page = await request(app).get("/formulas/campaign_roi/results");
      assert.equal(page.status,503);
      assert.equal(page.body.code,"workspace_guard_not_configured");
      const save = await request(app).post("/api/formulas/results").send({
        formulaKey:"campaign_roi",inputValues:{campaign_revenue:300,campaign_cost:100}
      });
      assert.equal(save.status,503);
      assert.equal(save.body.code,"workspace_guard_not_configured");
      const publicFormula = await request(app).post("/api/formulas/evaluate").send({
        formulaKey:"campaign_roi",inputValues:{campaign_revenue:300,campaign_cost:100}
      });
      assert.equal(publicFormula.status,200);
      assert.equal(publicFormula.body.resultValue,200);
      assert.equal(fake.rows("sonara_formula_results").length,0);
    });

    it("safely ignores invalid provenance metadata when saving a calculated answer", async () => {
      const app = buildApp(fake);
      const saved = await request(app).post("/api/formulas/results").send({
        formulaKey:"campaign_roi",
        inputValues:{campaign_revenue:300,campaign_cost:100},
        sourceTable:{toString:null},
        sourceRecordId:{toString:null}
      });
      assert.equal(saved.status,200,JSON.stringify(saved.body));
      const rows = fake.rows("sonara_formula_results");
      assert.equal(rows.length,1);
      assert.equal(rows[0].source_table,"manual_formula_input");
      assert.equal(rows[0].source_record_id,null);
    });

    it("reports a formula missing from the database as that, not as setup still to do", async () => {
      global.fetch = async () => ({ ok: false, status: 409, json: async () => ({ code: "23503", message: "violates foreign key constraint" }) });
      const json = await request(buildApp(fake)).post("/api/formulas/results").set("Accept", "application/json")
        .send({ formulaKey: "waste_cost", inputValues: { waste_quantity: 2, unit_cost: 3 } });
      assert.equal(json.status, 409);
      assert.equal(json.body.code, "formula_not_in_database");

      const html = await request(buildApp(fake)).post("/api/formulas/results").set("Accept", HTML).type("form")
        .send({ formulaKey: "waste_cost", input_waste_quantity: "2", input_unit_cost: "3" });
      assert.equal(html.status, 409);
      assert.match(html.text, /not yet recorded in the database/);
      assert.doesNotMatch(html.text, /not set up/);
    });
  });
});
