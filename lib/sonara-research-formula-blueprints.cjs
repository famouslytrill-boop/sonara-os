// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Fifty documented mathematical and scientific CONCEPTS, not fifty newly
// implemented or validated calculators. Never eval() mathematical expressions.
const { listExecutableFormulas } = require("./sonara-formula-engine.cjs");
const { ATLAS } = require("./sonara-research-atlas.cjs");
const ROWS = `
percent_change|Percent change|(new-old)/old|statistics|-
weighted_mean|Weighted mean|sum(weight*value)/sum(weight)|statistics|-
expected_value|Expected value|sum(probability*outcome)|statistics|-
variance|Variance|E[(X-mean)^2]|statistics|-
standard_deviation|Standard deviation|sqrt(variance)|statistics|-
z_score|Z score|(value-mean)/standard_deviation|statistics|-
compound_growth|Compound growth|principal*(1+rate)^periods|business|-
conditional_probability|Conditional probability|P(A and B)/P(B)|statistics|-
linear_model|Linear regression prediction|intercept+slope*x|statistics|-
logistic_function|Logistic function|1/(1+exp(-z))|statistics|-
eoq|Economic order quantity|sqrt(2*demand*order_cost/holding_cost)|inventory|eoq
reorder_point|Reorder point|lead_time_demand+safety_stock|inventory|reorder_point
safety_stock|Safety stock approximation|z*sigma_lead_time|inventory|-
newsvendor_fractile|Newsvendor critical fractile|underage_cost/(underage_cost+overage_cost)|inventory|-
little_law|Little's law|work_in_progress=throughput*cycle_time|operations|little_law
utilization|Utilization|busy_time/available_time|operations|-
cycle_time|Average cycle time|elapsed_time/completed_units|operations|-
throughput|Throughput|completed_units/elapsed_time|operations|-
oee|Overall equipment effectiveness|availability*performance*quality|manufacturing|oee
cpk|Process capability Cpk|min((upper-mean)/(3*sigma),(mean-lower)/(3*sigma))|manufacturing|cpk
contribution_margin|Contribution margin|revenue-variable_cost|business|contribution_margin
gross_margin|Gross margin rate|(revenue-cogs)/revenue|business|-
break_even_units|Break-even units|fixed_cost/(price-variable_cost_per_unit)|business|break_even_units
cac_payback|Customer acquisition payback|cac/monthly_contribution|business|cac_payback
ltv_simple|Simple lifetime value|monthly_contribution/monthly_churn|business|ltv_simple
npv|Net present value|sum(cashflow_t/(1+rate)^t)|finance|-
irr|Internal rate of return|rate such that NPV(rate)=0|finance|-
roi|Return on investment|(gain-cost)/cost|business|-
cash_conversion_cycle|Cash conversion cycle|days_inventory+days_receivable-days_payable|business|-
cash_runway|Cash runway|available_cash/net_cash_burn|business|-
newton_second_law|Newton's second law|force=mass*acceleration|physics|-
mass_energy|Mass-energy equivalence|energy=mass*c^2|physics|-
newton_gravitation|Newtonian gravitation|force=G*m1*m2/r^2|physics|-
ohms_law|Ohm's law|voltage=current*resistance|engineering|-
electric_power|Electric power|power=voltage*current|engineering|-
constant_acceleration|Constant acceleration displacement|displacement=initial_speed*time+0.5*acceleration*time^2|physics|-
bernoulli|Bernoulli energy equation|pressure+0.5*density*velocity^2+density*g*height=constant|engineering|-
ideal_gas|Ideal gas law|pressure*volume=moles*gas_constant*temperature|physics|-
sensible_heat|Sensible heat|heat=mass*specific_heat*temperature_change|engineering|-
wave_speed|Wave propagation speed|speed=frequency*wavelength|media|-
shannon_entropy|Shannon entropy|-sum(probability*log2(probability))|information|-
binary_cross_entropy|Binary cross entropy|-[y*ln(p)+(1-y)*ln(1-p)]|information|-
sigmoid_derivative|Sigmoid derivative|sigmoid*(1-sigmoid)|information|-
softmax|Softmax|exp(logit_i)/sum(exp(logit_j))|information|-
precision|Classification precision|true_positive/(true_positive+false_positive)|information|-
recall|Classification recall|true_positive/(true_positive+false_negative)|information|-
f1_score|F1 score|2*precision*recall/(precision+recall)|information|-
p95_latency|95th percentile request latency|empirical_quantile(latency,0.95)|reliability|-
service_availability|Availability rate|good_service_time/total_service_time|reliability|-
mtbf|Mean time between failures|operating_time/failure_count|reliability|-
`.trim();
const ALLOWED_DISCIPLINES = new Set([
  "statistics", "business", "inventory", "operations", "manufacturing",
  "finance", "physics", "engineering", "media", "information", "reliability"
]);
const BLUEPRINTS = Object.freeze(ROWS.split("\n").map((line) => {
  const [key, title, expression, discipline, handler] = line.split("|");
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(key) || !ALLOWED_DISCIPLINES.has(discipline)
    || !title || !expression || !handler) throw new Error("Invalid research formula definition");
  return Object.freeze({ key, title, expression, discipline,
    engineHandlerKey: handler === "-" ? null : handler,
    scientificallyValidated: false, dimensionalAnalysisVerified: false,
    modelAssumptionsVerified: false, independentReproductionVerified: false,
    productionAuthorized: false });
}));
if (BLUEPRINTS.length !== 50 || new Set(BLUEPRINTS.map(x => x.key)).size !== 50) {
  throw new Error("Research formula concept registry must have 50 unique entries");
}
const BY_KEY = new Map(BLUEPRINTS.map(x => [x.key, x]));
const BY_CATEGORY = new Map(ATLAS.map(x => [x.id, x]));
const DISCIPLINES_BY_PRODUCT = Object.freeze({
  business_builder: ["business", "finance", "inventory", "operations", "manufacturing", "statistics", "engineering"],
  creator_studio: ["media", "information", "statistics", "business", "reliability"],
  growth_studio: ["statistics", "business", "information", "reliability"],
  sonara_one: ["statistics", "physics", "engineering", "information", "reliability"]
});
function listFormulaBlueprints({ discipline } = {}) {
  if (discipline != null && !ALLOWED_DISCIPLINES.has(discipline)) {
    throw new RangeError("Unknown scientific discipline");
  }
  return Object.freeze(BLUEPRINTS.filter(item => discipline == null || item.discipline === discipline));
}
function planFormulaForAtlas({ conceptId, categoryId } = {}) {
  if (typeof conceptId !== "string" || !BY_KEY.has(conceptId)) {
    throw new RangeError("Unknown mathematical concept");
  }
  if (typeof categoryId !== "string" || !BY_CATEGORY.has(categoryId)) {
    throw new RangeError("Unknown research category");
  }
  const concept = BY_KEY.get(conceptId);
  const category = BY_CATEGORY.get(categoryId);
  const canonical = concept.engineHandlerKey == null ? null
    : listExecutableFormulas().find(item => item.key === concept.engineHandlerKey) || null;
  const plausibleDomain = DISCIPLINES_BY_PRODUCT[category.product].includes(concept.discipline);
  return Object.freeze({
    conceptId, categoryId, product: category.product, discipline: concept.discipline,
    researchExpression: concept.expression, applicationCandidate: plausibleDomain,
    canonicalHandler: canonical ? Object.freeze({
      key: canonical.key, engineVersion: canonical.engineVersion,
      expression: canonical.expression,
      assumptions: Object.freeze([...canonical.assumptions])
    }) : null,
    readiness: canonical ? "existing_handler_requires_domain_validation"
      : "research_only_no_executable_handler",
    evaluatorExecuted: false, mathematicalAssumptionsVerified: false,
    unitsVerified: false, evidenceIndependentlyVerified: false,
    regulatoryReviewRequired: categoryId.includes("investment") || categoryId.includes("hedge")
      || categoryId.includes("law") || concept.discipline === "finance",
    productionAuthorized: false, customerDecisionAuthorized: false,
    nextGate: "Verify source, units, model assumptions, tests, permissions and human approval before any use in customer workflows."
  });
}
function getFormulaResearchCoverage() {
  const keys = new Set(listExecutableFormulas().map(item => item.key));
  const associated = BLUEPRINTS.filter(item => item.engineHandlerKey && keys.has(item.engineHandlerKey)).length;
  return Object.freeze({ concepts: BLUEPRINTS.length, existingEngineAssociations: associated,
    researchOnlyConcepts: BLUEPRINTS.length - associated,
    validatedForCustomerDecisions: 0, autonomousExecutionEnabled: false,
    productionAuthorized: false });
}
module.exports = Object.freeze({ BLUEPRINTS, listFormulaBlueprints,
  planFormulaForAtlas, getFormulaResearchCoverage });
