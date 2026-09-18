// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Executable deterministic business formulas for SONARA.
//
// The September expansion registry intentionally stores formulas as data. This
// module is the first governed execution layer on top of that registry. It does
// not eval registry expressions, execute external code, call providers, mutate
// customer records, or make regulated decisions. Every executable formula is an
// explicit allowlisted function with bounded numeric validation.

const { createHash } = require("node:crypto");
const {
  FORMULAS,
  scoreOpportunity
} = require("./sonara-industry-algorithm-expansion.cjs");

const ENGINE_VERSION = "2026-09-16.1";
const FORMULA_BY_KEY = new Map(FORMULAS.map((item) => [item.key, item]));

class FormulaInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FormulaInputError";
    this.code = code;
  }
}

const HANDLERS = Object.freeze({
  opportunity_score: (input) => scoreOpportunity(input),
  contribution_margin: (input) => n(input, "revenue") - n(input, "variable_cost"),
  ltv_simple: (input) => n(input, "arpa") * rate(input, "gross_margin_rate") / positive(input, "monthly_logo_churn_rate"),
  cac_payback: (input) => n(input, "cac") / (positive(input, "arpa") * positiveRate(input, "gross_margin_rate")),
  break_even_units: (input) => n(input, "fixed_cost") / positiveDifference(input, "unit_price", "unit_variable_cost"),
  target_margin_price: (input) => n(input, "variable_cost") / (1 - rateBelowOne(input, "target_margin_rate")),
  eoq: (input) => Math.sqrt((2 * positive(input, "annual_demand") * positive(input, "order_cost")) / positive(input, "annual_holding_cost_per_unit")),
  reorder_point: (input) => n(input, "mean_demand_during_lead_time") + n(input, "safety_stock"),
  gmroi: (input) => n(input, "gross_margin_dollars") / positive(input, "average_inventory_cost"),
  sell_through: (input) => {
    const sold = nonNegative(input, "units_sold");
    const ending = nonNegative(input, "ending_units_on_hand");
    return sold / positiveValue(sold + ending, "units_sold + ending_units_on_hand");
  },
  basket_lift: (input) => probability(input, "p_a_and_b") / positiveValue(probability(input, "p_a") * probability(input, "p_b"), "p_a * p_b"),
  oee: (input) => rate(input, "availability") * rate(input, "performance") * rate(input, "quality"),
  takt_time: (input) => n(input, "available_production_time") / positive(input, "required_customer_units"),
  first_pass_yield: (input) => nonNegative(input, "good_units_without_rework") / positive(input, "total_units_started"),
  cp: (input) => (n(input, "usl") - n(input, "lsl")) / (6 * positive(input, "sigma")),
  cpk: (input) => Math.min(
    (n(input, "usl") - n(input, "mean")) / (3 * positive(input, "sigma")),
    (n(input, "mean") - n(input, "lsl")) / (3 * positive(input, "sigma"))
  ),
  food_cost_pct: (input) => nonNegative(input, "recipe_ingredient_cost") / positive(input, "menu_price"),
  recipe_cost: recipeCost,
  labor_utilization: (input) => nonNegative(input, "productive_or_billable_time") / positive(input, "available_time"),
  travel_ratio: (input) => nonNegative(input, "travel_time") / positive(input, "paid_or_scheduled_time"),
  occupancy: (input) => nonNegative(input, "occupied_unit_days") / positive(input, "rentable_unit_days"),
  noi: (input) => n(input, "operating_income") - n(input, "operating_expenses"),
  collection_rate: (input) => nonNegative(input, "payments_collected") / positive(input, "payments_due"),
  route_cost: (input) => [
    "distance_cost",
    "travel_time_cost",
    "lateness_penalty",
    "overtime_penalty",
    "unserved_penalty"
  ].reduce((total, key) => total + nonNegative(input, key), 0),
  haversine: haversine,
  earned_value_cpi: (input) => n(input, "earned_value") / positive(input, "actual_cost"),
  earned_value_spi: (input) => n(input, "earned_value") / positive(input, "planned_value"),
  pert_expected: (input) => (n(input, "optimistic") + 4 * n(input, "most_likely") + n(input, "pessimistic")) / 6,
  little_law: (input) => n(input, "throughput_rate") * n(input, "cycle_time"),
  lead_score: weightedSignals,
  campaign_roi: (input) => (n(input, "incremental_contribution") - n(input, "campaign_cost")) / positive(input, "campaign_cost"),
  donor_retention: (input) => nonNegative(input, "retained_prior_period_donors") / positive(input, "prior_period_donors"),
  customer_health: weightedSignals,
  error_budget: (input) => 1 - rate(input, "target_availability"),
  security_risk: (input) => n(input, "likelihood") * n(input, "impact") * n(input, "exposure") * n(input, "control_gap"),
  audio_beat_alignment: (input) => nonNegative(input, "aligned_edit_points") / positive(input, "eligible_edit_points"),
  video_pacing: (input) => nonNegative(input, "program_duration") / positive(input, "detected_shot_count"),
  music_pitch_class_distance: pitchClassDistance
});

function evaluateFormula(key, inputs = {}) {
  const normalizedKey = String(key || "").trim();
  const definition = FORMULA_BY_KEY.get(normalizedKey);
  if (!definition) throw new FormulaInputError("unknown_formula", `Unknown formula: ${normalizedKey || "(empty)"}`);

  const handler = HANDLERS[normalizedKey];
  if (!handler) throw new FormulaInputError("formula_not_executable", `Formula is registered but not executable: ${normalizedKey}`);
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    throw new FormulaInputError("invalid_inputs", "Formula inputs must be an object");
  }

  const copiedInputs = JSON.parse(JSON.stringify(inputs));
  const value = handler(copiedInputs);
  if (!Number.isFinite(value)) throw new FormulaInputError("non_finite_result", `Formula ${normalizedKey} produced a non-finite result`);

  return {
    ok: true,
    key: definition.key,
    name: definition.name,
    domain: definition.domain,
    expression: definition.expression,
    engineVersion: ENGINE_VERSION,
    value,
    assumptions: [...definition.assumptions],
    evidence: {
      inputHash: digest(copiedInputs),
      inputs: copiedInputs
    }
  };
}

function tryEvaluateFormula(key, inputs = {}) {
  try {
    return evaluateFormula(key, inputs);
  } catch (error) {
    if (!(error instanceof FormulaInputError)) throw error;
    return {
      ok: false,
      key: String(key || "").trim(),
      engineVersion: ENGINE_VERSION,
      error: { code: error.code, message: error.message }
    };
  }
}

function listExecutableFormulas() {
  return FORMULAS
    .filter((item) => typeof HANDLERS[item.key] === "function")
    .map((item) => ({ ...item, engineVersion: ENGINE_VERSION }));
}

function recipeCost(input) {
  if (!Array.isArray(input.ingredients) || !input.ingredients.length) {
    throw new FormulaInputError("invalid_ingredients", "ingredients must be a non-empty array");
  }
  return input.ingredients.reduce((total, ingredient, index) => {
    if (!ingredient || typeof ingredient !== "object") {
      throw new FormulaInputError("invalid_ingredient", `ingredients[${index}] must be an object`);
    }
    const quantity = nonNegative(ingredient, "quantity", `ingredients[${index}].quantity`);
    const unitCost = nonNegative(ingredient, "normalized_unit_cost", `ingredients[${index}].normalized_unit_cost`);
    const usableYield = positiveRate(ingredient, "usable_yield", `ingredients[${index}].usable_yield`);
    return total + (quantity * unitCost) / usableYield;
  }, 0);
}

function haversine(input) {
  const lat1 = degrees(input, "lat1");
  const lon1 = degrees(input, "lon1");
  const lat2 = degrees(input, "lat2");
  const lon2 = degrees(input, "lon2");
  const radius = input.earth_radius == null ? 6371.0088 : positive(input, "earth_radius");
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pitchClassDistance(input) {
  const a = integer(input, "a");
  const b = integer(input, "b");
  const normalizedA = ((a % 12) + 12) % 12;
  const normalizedB = ((b % 12) + 12) % 12;
  const forward = (normalizedA - normalizedB + 12) % 12;
  const backward = (normalizedB - normalizedA + 12) % 12;
  return Math.min(forward, backward);
}

function weightedSignals(input) {
  const signals = input.signals;
  const weights = input.weights;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) {
    throw new FormulaInputError("invalid_signals", "signals must be an object");
  }
  if (!weights || typeof weights !== "object" || Array.isArray(weights)) {
    throw new FormulaInputError("invalid_weights", "weights must be an object");
  }

  let total = 0;
  for (const [key, weightValue] of Object.entries(weights)) {
    const weight = finite(weightValue, `weights.${key}`);
    const signal = finite(signals[key] == null ? 0 : signals[key], `signals.${key}`);
    total += signal * weight;
  }
  return total - nonNegativeDefault(input.disqualifier_penalties, "disqualifier_penalties");
}

function n(input, key) {
  return finite(input[key], key);
}

function finite(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new FormulaInputError("invalid_number", `${label} must be a finite number`);
  return parsed;
}

function nonNegative(input, key, label = key) {
  const value = finite(input[key], label);
  if (value < 0) throw new FormulaInputError("negative_value", `${label} must be greater than or equal to zero`);
  return value;
}

function nonNegativeDefault(value, label) {
  if (value == null) return 0;
  const parsed = finite(value, label);
  if (parsed < 0) throw new FormulaInputError("negative_value", `${label} must be greater than or equal to zero`);
  return parsed;
}

function positive(input, key) {
  return positiveValue(finite(input[key], key), key);
}

function positiveValue(value, label) {
  if (!(value > 0)) throw new FormulaInputError("non_positive_denominator", `${label} must be greater than zero`);
  return value;
}

function positiveDifference(input, leftKey, rightKey) {
  return positiveValue(n(input, leftKey) - n(input, rightKey), `${leftKey} - ${rightKey}`);
}

function rate(input, key) {
  const value = finite(input[key], key);
  if (value < 0 || value > 1) throw new FormulaInputError("invalid_rate", `${key} must be between 0 and 1`);
  return value;
}

function positiveRate(input, key, label = key) {
  const value = finite(input[key], label);
  if (!(value > 0 && value <= 1)) throw new FormulaInputError("invalid_rate", `${label} must be greater than 0 and at most 1`);
  return value;
}

function rateBelowOne(input, key) {
  const value = finite(input[key], key);
  if (value < 0 || value >= 1) throw new FormulaInputError("invalid_rate", `${key} must be greater than or equal to 0 and less than 1`);
  return value;
}

function probability(input, key) {
  return rate(input, key);
}

function integer(input, key) {
  const value = finite(input[key], key);
  if (!Number.isInteger(value)) throw new FormulaInputError("invalid_integer", `${key} must be an integer`);
  return value;
}

function degrees(input, key) {
  const value = finite(input[key], key);
  if (key.startsWith("lat") && (value < -90 || value > 90)) {
    throw new FormulaInputError("invalid_latitude", `${key} must be between -90 and 90`);
  }
  if (key.startsWith("lon") && (value < -180 || value > 180)) {
    throw new FormulaInputError("invalid_longitude", `${key} must be between -180 and 180`);
  }
  return value;
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function digest(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

module.exports = {
  ENGINE_VERSION,
  FormulaInputError,
  evaluateFormula,
  tryEvaluateFormula,
  listExecutableFormulas
};
