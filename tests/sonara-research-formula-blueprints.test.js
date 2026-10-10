"use strict";
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
const stub = {
  "./sonara-formula-engine.cjs": {
    listExecutableFormulas: () => [
      { key: "eoq", expression: "sqrt(2DS/H)", assumptions: ["stable demand"], engineVersion: "v1" },
      { key: "little_law", expression: "L=λW", assumptions: ["steady state"], engineVersion: "v1" },
      { key: "break_even_units", expression: "F/(P-V)", assumptions: [], engineVersion: "v1" }
    ]
  },
  "./sonara-research-atlas.cjs": { ATLAS: [
    { id: "us_restaurants", product: "business_builder" },
    { id: "us_musicians", product: "creator_studio" },
    { id: "global_scientists", product: "sonara_one" },
    { id: "us_hedge_funds", product: "business_builder" }
  ] }
};
let catalogue;
try {
  Module._load = function(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stub, request)) return stub[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  catalogue = require("../lib/sonara-research-formula-blueprints.cjs");
} finally {
  Module._load = originalLoad;
}
const { BLUEPRINTS, listFormulaBlueprints, planFormulaForAtlas, getFormulaResearchCoverage } = catalogue;

describe("SONARA applied-science research formula catalog", () => {

it("precisely 50 distinct non-executable concept definitions", () => {
  assert.equal(BLUEPRINTS.length, 50);
  assert.equal(new Set(BLUEPRINTS.map(x => x.key)).size, 50);
  assert.ok(BLUEPRINTS.every(x => !x.productionAuthorized && !x.scientificallyValidated));
});
it("filters by declared scientific discipline only", () => {
  const physics = listFormulaBlueprints({ discipline: "physics" });
  assert.ok(physics.length >= 3);
  assert.ok(physics.every(x => x.discipline === "physics"));
  assert.throws(() => listFormulaBlueprints({ discipline: "supernatural" }), /Unknown scientific discipline/);
});
it("existing runtime metadata is linked without invoking the evaluator", () => {
  const plan = planFormulaForAtlas({ conceptId: "eoq", categoryId: "us_restaurants" });
  assert.equal(plan.canonicalHandler.key, "eoq");
  assert.equal(plan.canonicalHandler.expression, "sqrt(2DS/H)");
  assert.equal(plan.readiness, "existing_handler_requires_domain_validation");
  assert.equal(plan.evaluatorExecuted, false);
  assert.equal(plan.productionAuthorized, false);
});
it("unimplemented physics remains research-only and is not falsely called executable", () => {
  const plan = planFormulaForAtlas({ conceptId: "mass_energy", categoryId: "global_scientists" });
  assert.equal(plan.canonicalHandler, null);
  assert.equal(plan.readiness, "research_only_no_executable_handler");
});
it("product fit is advisory and never a verified recommendation", () => {
  const p = planFormulaForAtlas({ conceptId: "newton_second_law", categoryId: "us_musicians" });
  assert.equal(p.applicationCandidate, false);
  assert.equal(p.customerDecisionAuthorized, false);
});
it("regulated investment plans always require explicit review", () => {
  const p = planFormulaForAtlas({ conceptId: "npv", categoryId: "us_hedge_funds" });
  assert.equal(p.regulatoryReviewRequired, true);
  assert.equal(p.productionAuthorized, false);
});
it("unknown formula and atlas category fail closed", () => {
  assert.throws(() => planFormulaForAtlas({ conceptId: "__proto__", categoryId: "us_restaurants" }), /Unknown mathematical concept/);
  assert.throws(() => planFormulaForAtlas({ conceptId: "eoq", categoryId: "__proto__" }), /Unknown research category/);
});
it("coverage reports actual handler intersection, not 50 production formulas", () => {
  const coverage = getFormulaResearchCoverage();
  assert.equal(coverage.concepts, 50);
  assert.equal(coverage.existingEngineAssociations, 3);
  assert.equal(coverage.researchOnlyConcepts, 47);
  assert.equal(coverage.validatedForCustomerDecisions, 0);
});
it("outputs exclude customer records, side effects and provider authority", () => {
  const p = planFormulaForAtlas({ conceptId: "wave_speed", categoryId: "us_musicians" });
  assert.equal(p.applicationCandidate, true);
  assert.equal(p.evidenceIndependentlyVerified, false);
  assert.equal(p.unitsVerified, false);
  assert.equal(p.evaluatorExecuted, false);
  assert.ok(!Object.keys(p).includes("inputs"));
});

});
