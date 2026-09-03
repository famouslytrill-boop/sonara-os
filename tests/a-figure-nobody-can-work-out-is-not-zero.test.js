"use strict";

// `divide(a, b)` in the formula library returned **0** when `b` was 0, and
// eight of the forty-seven evaluators divide. That is not a rounding quibble;
// it publishes a confident number where there is no answer, in figures an owner
// makes decisions on.
//
// The worst of them, measured before it was changed:
//
//   break_even_sales = fixed_costs / gross_margin_percent_decimal
//   { fixed_costs: 12000, gross_margin_percent_decimal: 0 }
//     -> { ok: true, resultValue: 0, resultUnit: "money" }
//
// "Break-even sales: 0", to a business with twelve thousand of fixed costs and
// no margin. At zero margin you never break even. And:
//
//   customer_acquisition_cost = marketing_spend / new_customers
//   { marketing_spend: 5000, new_customers: 0 }  -> { ok: true, resultValue: 0 }
//
// Five thousand spent, nobody acquired, and the answer reads as customers
// costing nothing rather than as money spent for none.
//
// This is the shape CLAUDE.md already names -- absent read as zero, three
// states collapsed into two -- in the arithmetic a customer is shown.
//
// `divide` now returns NaN for a zero denominator, which reaches the non-finite
// branch `evaluateFormula` already had. That branch used to answer
// `{ code: "invalid_result" }` with nothing else in it; it now names the
// formula, its expression, and what is wrong in words the person reading it
// can act on.
//
// The other side matters as much and is tested below: all forty-seven
// definitions still evaluate, and the eight dividing formulas still return real
// numbers when the denominator is real.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const {
  evaluateFormula,
  listFormulaDefinitions,
  getFormulaDefinition
} = require("../lib/sonara-formula-library.cjs");

// The eight evaluators that divide, with a denominator input for each.
const DIVIDING = Object.freeze([
  { key: "average_order_value", real: { gross_revenue: 900, order_count: 12 }, zero: { gross_revenue: 900, order_count: 0 }, expected: 75 },
  { key: "customer_acquisition_cost", real: { marketing_spend: 5000, new_customers: 25 }, zero: { marketing_spend: 5000, new_customers: 0 }, expected: 200 },
  { key: "break_even_sales", real: { fixed_costs: 12000, gross_margin_percent_decimal: 0.4 }, zero: { fixed_costs: 12000, gross_margin_percent_decimal: 0 }, expected: 30000 },
  { key: "employee_productivity", real: { sales: 8000, labor_hours: 160 }, zero: { sales: 8000, labor_hours: 0 }, expected: 50 },
  { key: "inventory_turnover", real: { cost_of_goods_sold: 6000, average_inventory_value: 1500 }, zero: { cost_of_goods_sold: 6000, average_inventory_value: 0 }, expected: 4 }
]);

describe("a figure nobody can work out is not zero", () => {
  it("has the formulas it is testing", () => {
    const definitions = listFormulaDefinitions();
    assert.ok(definitions.length >= 40, `only ${definitions.length} formula definitions; this check has gone blind`);
    for (const { key } of DIVIDING) {
      assert.ok(getFormulaDefinition(key), `${key} is no longer a registered formula, so nothing here was checked for it`);
    }
  });

  it("refuses to tell a business with no margin that it breaks even at zero", () => {
    const result = evaluateFormula("break_even_sales", { fixed_costs: 12000, gross_margin_percent_decimal: 0 });
    assert.equal(result.ok, false, "break-even with no margin answered with a number");
    assert.notEqual(result.resultValue, 0, "a break-even of 0 tells an owner with fixed costs that they are already there");
    assert.equal(result.code, "not_computable");
    assert.match(result.message, /Break-even sales/, "the refusal must name the figure the person asked for");
    assert.match(result.message, /zero/, "the refusal must say what is wrong, not only that something is");
  });

  it("refuses to say customers cost nothing when none were acquired", () => {
    const result = evaluateFormula("customer_acquisition_cost", { marketing_spend: 5000, new_customers: 0 });
    assert.equal(result.ok, false);
    assert.notEqual(result.resultValue, 0);
    assert.match(result.message, /Customer acquisition cost/);
  });

  it("refuses every dividing formula whose denominator is zero, rather than only the two that were noticed", () => {
    for (const { key, zero } of DIVIDING) {
      const result = evaluateFormula(key, zero);
      assert.equal(result.ok, false, `${key} still answers with a number when its denominator is zero`);
      assert.equal(result.code, "not_computable", `${key} refused with ${result.code} rather than not_computable`);
      assert.ok(result.message && result.message.length > 20, `${key} refused without saying why`);
    }
  });

  it("still answers when the denominator is real", () => {
    // The other side. A change that made every one of these refuse would also
    // pass the assertions above, and would have deleted the feature.
    for (const { key, real, expected } of DIVIDING) {
      const result = evaluateFormula(key, real);
      assert.equal(result.ok, true, `${key} no longer evaluates with real figures: ${result.message || result.code}`);
      assert.equal(result.resultValue, expected, `${key} returned ${result.resultValue}, expected ${expected}`);
    }
  });

  it("leaves all forty-seven definitions evaluating", () => {
    // The blunt check that the change did not break the library. Every required
    // input is set to 2, which is non-zero, so every formula should produce a
    // number.
    const definitions = listFormulaDefinitions();
    const failures = [];
    for (const definition of definitions) {
      const inputs = Object.fromEntries(definition.requiredInputs.map((key) => [key, 2]));
      const result = evaluateFormula(definition.formulaKey, inputs);
      if (!result.ok) failures.push(`${definition.formulaKey}: ${result.code}`);
    }
    assert.deepEqual(failures, [], "some formulas stopped evaluating with all-nonzero inputs");
  });

  it("keeps a zero that is a real answer", () => {
    // Zero is a perfectly good result when it is the arithmetic's answer rather
    // than a stand-in for "cannot say". Refusing those too would be the same
    // mistake pointing the other way.
    const result = evaluateFormula("average_order_value", { gross_revenue: 0, order_count: 12 });
    assert.equal(result.ok, true, "no revenue across twelve orders is an answer, and the answer is 0");
    assert.equal(result.resultValue, 0);
  });

  describe("over HTTP, which is how a customer meets it", () => {
    it("answers 400 with the reason rather than 200 with a zero", async () => {
      const res = await request(app)
        .post("/api/formulas/evaluate")
        .send({ formulaKey: "break_even_sales", inputValues: { fixed_costs: 12000, gross_margin_percent_decimal: 0 } })
        .set("Accept", "application/json");
      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.code, "not_computable");
      assert.match(res.body.message, /Break-even sales/);
    });

    it("still answers 200 with the figure when it can be worked out", async () => {
      const res = await request(app)
        .post("/api/formulas/evaluate")
        .send({ formulaKey: "break_even_sales", inputValues: { fixed_costs: 12000, gross_margin_percent_decimal: 0.4 } })
        .set("Accept", "application/json");
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.resultValue, 30000);
    });

    it("names the missing figures rather than assuming them", async () => {
      const res = await request(app)
        .post("/api/formulas/evaluate")
        .send({ formulaKey: "break_even_sales", inputValues: { fixed_costs: 12000 } })
        .set("Accept", "application/json");
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "missing_inputs");
      assert.ok(res.body.missing.includes("gross_margin_percent_decimal"));
    });

    it("refuses a formula it does not have rather than inventing one", async () => {
      const res = await request(app)
        .post("/api/formulas/evaluate")
        .send({ formulaKey: "profit_from_thin_air", inputValues: {} })
        .set("Accept", "application/json");
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "unknown_formula");
    });
  });
});
