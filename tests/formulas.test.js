const request = require("supertest");
const assert = require("assert");
const app = require("../server");
const { evaluateFormula, listFormulaDefinitions } = require("../lib/sonara-formula-library.cjs");

describe("formula library", () => {
  it("registers formula definitions", function() {
    const definitions = listFormulaDefinitions();
    assert.ok(definitions.length >= 30);
    assert.ok(definitions.some((definition) => definition.formulaKey === "food_cost_percent"));
    assert.ok(definitions.some((definition) => definition.formulaKey === "song_readiness_score"));
    assert.ok(definitions.some((definition) => definition.formulaKey === "module_health_score"));
  });

  it("evaluates allowlisted formulas without eval", function() {
    const result = evaluateFormula("food_cost_percent", { ingredient_cost: 3, menu_price: 10 });
    assert.equal(result.ok, true);
    assert.equal(result.resultValue, 30);
    assert.equal(result.resultUnit, "percent");
  });

  it("rejects missing formula inputs", function() {
    const result = evaluateFormula("campaign_roi", { campaign_revenue: 100 });
    assert.equal(result.ok, false);
    assert.equal(result.code, "missing_inputs");
    assert.ok(result.missing.includes("campaign_cost"));
  });
});

describe("formula routes", () => {
  it("GET /formulas returns the formula visualizer page", async function() {
    const res = await request(app).get("/formulas").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Formula Library/);
    assert.match(res.text, /Business And Revenue|Business and revenue/i);
  });

  it("GET /api/formulas/definitions returns registered formulas", async function() {
    const res = await request(app).get("/api/formulas/definitions").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.count >= 30);
    assert.ok(res.body.formulas.some((formula) => formula.formulaKey === "regular_pay"));
  });

  it("GET /api/formulas/readiness returns table readiness", async function() {
    const res = await request(app).get("/api/formulas/readiness").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.tables));
    assert.ok(res.body.tables.some((item) => item.table === "sonara_formula_definitions"));
  });

  it("POST /api/formulas/evaluate evaluates formula input", async function() {
    const res = await request(app)
      .post("/api/formulas/evaluate")
      .send({ formulaKey: "regular_pay", inputValues: { regular_hours: 8, hourly_rate: 15 } })
      .set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.resultValue, 120);
    assert.equal(res.body.resultUnit, "money");
  });
});
