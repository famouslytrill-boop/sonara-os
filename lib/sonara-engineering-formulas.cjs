// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Research/estimating calculators, not structural design approval, payroll posting,
// circuit protection sizing, flight dynamics, optical certification, or QPU execution.
// SI units in identifiers are intentional. Rates are decimals (0.2 = 20%).
// Runtime dispatch is allowlisted; expressionText is explanatory data only.
const FORMULAS = Object.freeze([
  {
    "formulaKey": "fully_burdened_labor_cost",
    "groupKey": "labor_economics",
    "productArea": "Business Builder",
    "publicLabel": "Fully burdened labor cost",
    "expressionText": "paid_hours * (hourly_wage + benefits_per_hour + payroll_taxes_per_hour + overhead_per_hour)",
    "requiredInputs": [
      "paid_hours",
      "hourly_wage",
      "benefits_per_hour",
      "payroll_taxes_per_hour",
      "overhead_per_hour"
    ],
    "targetTables": [],
    "outputUnit": "money"
  },
  {
    "formulaKey": "trade_bid_price",
    "groupKey": "construction_trades",
    "productArea": "Business Builder",
    "publicLabel": "Trade job bid estimate",
    "expressionText": "((productive_hours / utilization_rate) * burdened_cost_per_paid_hour + materials_cost + other_direct_cost) * (1 + markup_rate)",
    "requiredInputs": [
      "productive_hours",
      "utilization_rate",
      "burdened_cost_per_paid_hour",
      "materials_cost",
      "other_direct_cost",
      "markup_rate"
    ],
    "targetTables": [],
    "outputUnit": "money"
  },
  {
    "formulaKey": "economic_profit",
    "groupKey": "labor_economics",
    "productArea": "Business Builder",
    "publicLabel": "Economic profit after opportunity cost",
    "expressionText": "chosen_net_benefit - best_foregone_net_benefit",
    "requiredInputs": [
      "chosen_net_benefit",
      "best_foregone_net_benefit"
    ],
    "targetTables": [],
    "outputUnit": "money"
  },
  {
    "formulaKey": "project_net_present_value",
    "groupKey": "building_economics",
    "productArea": "Business Builder",
    "publicLabel": "Project net present value",
    "expressionText": "annual_net_cash_flow * (1 - (1 + discount_rate)^(-years)) / discount_rate - upfront_cost",
    "requiredInputs": [
      "upfront_cost",
      "annual_net_cash_flow",
      "discount_rate",
      "years"
    ],
    "targetTables": [],
    "outputUnit": "money"
  },
  {
    "formulaKey": "material_quantity_with_waste",
    "groupKey": "construction_trades",
    "productArea": "Business Builder",
    "publicLabel": "Materials including waste",
    "expressionText": "net_quantity * (1 + waste_rate)",
    "requiredInputs": [
      "net_quantity",
      "waste_rate"
    ],
    "targetTables": [],
    "outputUnit": "quantity"
  },
  {
    "formulaKey": "concrete_volume_m3",
    "groupKey": "construction_trades",
    "productArea": "Business Builder",
    "publicLabel": "Concrete geometric volume",
    "expressionText": "length_meters * width_meters * depth_meters",
    "requiredInputs": [
      "length_meters",
      "width_meters",
      "depth_meters"
    ],
    "targetTables": [],
    "outputUnit": "cubic_meters"
  },
  {
    "formulaKey": "roofing_squares",
    "groupKey": "construction_trades",
    "productArea": "Business Builder",
    "publicLabel": "Roofing squares including waste",
    "expressionText": "roof_area_square_feet * (1 + waste_rate) / 100",
    "requiredInputs": [
      "roof_area_square_feet",
      "waste_rate"
    ],
    "targetTables": [],
    "outputUnit": "roofing_squares"
  },
  {
    "formulaKey": "paint_gallons",
    "groupKey": "construction_trades",
    "productArea": "Business Builder",
    "publicLabel": "Paint quantity in US gallons",
    "expressionText": "surface_square_feet * coats * (1 + waste_rate) / coverage_square_feet_per_gallon",
    "requiredInputs": [
      "surface_square_feet",
      "coats",
      "waste_rate",
      "coverage_square_feet_per_gallon"
    ],
    "targetTables": [],
    "outputUnit": "US_gallons"
  },
  {
    "formulaKey": "single_phase_ac_real_power_watts",
    "groupKey": "trade_electrical",
    "productArea": "Business Builder",
    "publicLabel": "Single-phase AC real power",
    "expressionText": "rms_volts * rms_amps * power_factor",
    "requiredInputs": [
      "rms_volts",
      "rms_amps",
      "power_factor"
    ],
    "targetTables": [],
    "outputUnit": "watts"
  },
  {
    "formulaKey": "pipe_flow_m3_s",
    "groupKey": "trade_plumbing",
    "productArea": "Business Builder",
    "publicLabel": "Estimated circular pipe flow",
    "expressionText": "pi * (inside_diameter_meters / 2)^2 * fluid_speed_meters_per_second",
    "requiredInputs": [
      "inside_diameter_meters",
      "fluid_speed_meters_per_second"
    ],
    "targetTables": [],
    "outputUnit": "cubic_meters_per_second"
  },
  {
    "formulaKey": "square_feet_to_square_meters",
    "groupKey": "measurement_science",
    "productArea": "Business Builder",
    "publicLabel": "Square feet to square meters",
    "expressionText": "area_square_feet * 0.09290304",
    "requiredInputs": [
      "area_square_feet"
    ],
    "targetTables": [],
    "outputUnit": "square_meters"
  },
  {
    "formulaKey": "byte_transfer_seconds",
    "groupKey": "computing_engineering",
    "productArea": "Creator Studio",
    "publicLabel": "Theoretical transfer duration",
    "expressionText": "payload_bytes * 8 / effective_bits_per_second",
    "requiredInputs": [
      "payload_bytes",
      "effective_bits_per_second"
    ],
    "targetTables": [],
    "outputUnit": "seconds"
  },
  {
    "formulaKey": "compute_job_cost",
    "groupKey": "computing_engineering",
    "productArea": "Creator Studio",
    "publicLabel": "Compute and storage job cost",
    "expressionText": "runtime_seconds * compute_rate_per_hour / 3600 + storage_gib * storage_rate_per_gib_month * months_stored",
    "requiredInputs": [
      "runtime_seconds",
      "compute_rate_per_hour",
      "storage_gib",
      "storage_rate_per_gib_month",
      "months_stored"
    ],
    "targetTables": [],
    "outputUnit": "money"
  },
  {
    "formulaKey": "satellite_orbital_period_seconds",
    "groupKey": "space_science",
    "productArea": "Business Builder",
    "publicLabel": "Keplerian satellite orbital period",
    "expressionText": "2 * pi * sqrt(semi_major_axis_meters^3 / gravitational_parameter_m3_s2)",
    "requiredInputs": [
      "semi_major_axis_meters",
      "gravitational_parameter_m3_s2"
    ],
    "targetTables": [],
    "outputUnit": "seconds"
  },
  {
    "formulaKey": "telescope_rayleigh_arcseconds",
    "groupKey": "space_science",
    "productArea": "Creator Studio",
    "publicLabel": "Diffraction-limited telescope resolution",
    "expressionText": "1.22 * wavelength_nanometers * 1e-9 / aperture_meters * 206264.806247",
    "requiredInputs": [
      "wavelength_nanometers",
      "aperture_meters"
    ],
    "targetTables": [],
    "outputUnit": "arcseconds"
  },
  {
    "formulaKey": "quantum_ideal_one_probability",
    "groupKey": "quantum_research",
    "productArea": "Creator Studio",
    "publicLabel": "Ideal qubit one-state probability",
    "expressionText": "sin(rotation_radians / 2)^2",
    "requiredInputs": [
      "rotation_radians"
    ],
    "targetTables": [],
    "outputUnit": "probability"
  },
  {
    "formulaKey": "quantum_sampling_standard_error",
    "groupKey": "quantum_research",
    "productArea": "Creator Studio",
    "publicLabel": "Quantum measurement standard error",
    "expressionText": "sqrt(probability_one * (1 - probability_one) / shots)",
    "requiredInputs": [
      "probability_one",
      "shots"
    ],
    "targetTables": [],
    "outputUnit": "probability"
  }
]);

function invalid(key, reason) {
  const error = new Error(reason || (key + " is outside its permitted range"));
  error.code = "invalid_input";
  error.inputKey = key;
  throw error;
}
function number(input, key, min = 0, max = 1e15, integer = false) {
  const raw = input[key];
  if ((typeof raw !== "number" && typeof raw !== "string") ||
      (typeof raw === "string" && !raw.trim())) invalid(key, key + " must be a number");
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isSafeInteger(value))) invalid(key);
  return value;
}
function positive(input, key, max = 1e15) {
  return number(input, key, Number.MIN_VALUE, max);
}
function rate(input, key) { return number(input, key, 0, 1); }
function value(input, key, min = -1e12, max = 1e12) { return number(input, key, min, max); }
function validResult(result) {
  if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER) {
    invalid("result", "The calculated result is outside the supported numerical range");
  }
  return result;
}
const HANDLERS = Object.freeze({
  fully_burdened_labor_cost: (v) => number(v,"paid_hours") *
    (number(v,"hourly_wage") + number(v,"benefits_per_hour") +
      number(v,"payroll_taxes_per_hour") + number(v,"overhead_per_hour")),
  trade_bid_price: (v) => ((number(v,"productive_hours") / positive(v,"utilization_rate",1)) *
    number(v,"burdened_cost_per_paid_hour") + number(v,"materials_cost") +
    number(v,"other_direct_cost")) * (1 + number(v,"markup_rate",0,10)),
  economic_profit: (v) => value(v,"chosen_net_benefit") - value(v,"best_foregone_net_benefit"),
  project_net_present_value: (v) => {
    const n = number(v,"years",1,100,true);
    const r = rate(v,"discount_rate");
    const annual = value(v,"annual_net_cash_flow");
    const factor = r === 0 ? n : (1 - (1 + r)**(-n)) / r;
    return annual * factor - number(v,"upfront_cost");
  },
  material_quantity_with_waste: (v) => number(v,"net_quantity") * (1 + rate(v,"waste_rate")),
  concrete_volume_m3: (v) => positive(v,"length_meters") * positive(v,"width_meters") * positive(v,"depth_meters"),
  roofing_squares: (v) => number(v,"roof_area_square_feet") * (1 + rate(v,"waste_rate")) / 100,
  paint_gallons: (v) => number(v,"surface_square_feet") *
    number(v,"coats",1,20,true) * (1 + rate(v,"waste_rate")) /
    positive(v,"coverage_square_feet_per_gallon"),
  single_phase_ac_real_power_watts: (v) =>
    number(v,"rms_volts") * number(v,"rms_amps") * rate(v,"power_factor"),
  pipe_flow_m3_s: (v) => Math.PI * (positive(v,"inside_diameter_meters") / 2)**2 *
    number(v,"fluid_speed_meters_per_second"),
  square_feet_to_square_meters: (v) => number(v,"area_square_feet") * 0.09290304,
  byte_transfer_seconds: (v) => number(v,"payload_bytes",0,1e12) * 8 /
    positive(v,"effective_bits_per_second",1e15),
  compute_job_cost: (v) => number(v,"runtime_seconds",0,1e10) *
    number(v,"compute_rate_per_hour",0,1e6) / 3600 +
    number(v,"storage_gib",0,1e9) * number(v,"storage_rate_per_gib_month",0,1e6) *
    number(v,"months_stored",0,1200),
  satellite_orbital_period_seconds: (v) => 2 * Math.PI *
    Math.sqrt(positive(v,"semi_major_axis_meters",1e12)**3 /
      positive(v,"gravitational_parameter_m3_s2",1e30)),
  telescope_rayleigh_arcseconds: (v) => {
    const lambda = positive(v,"wavelength_nanometers",1e12) * 1e-9;
    const d = positive(v,"aperture_meters",1e6);
    if (lambda / d >= 0.01) invalid("wavelength_nanometers",
      "The small-angle Rayleigh approximation requires wavelength much smaller than aperture");
    return 1.22 * lambda / d * 206264.806247;
  },
  quantum_ideal_one_probability: (v) => Math.sin(
    number(v,"rotation_radians",0,2*Math.PI) / 2)**2,
  quantum_sampling_standard_error: (v) => {
    const p = rate(v,"probability_one");
    return Math.sqrt(p * (1 - p) / number(v,"shots",1,1e9,true));
  }
});
const EVALUATORS = Object.freeze(Object.fromEntries(
  Object.entries(HANDLERS).map(([key, handler]) => [key, (input) => validResult(handler(input))])
));
if (FORMULAS.length !== Object.keys(EVALUATORS).length ||
    FORMULAS.some((formula) => !EVALUATORS[formula.formulaKey])) {
  throw new Error("Engineering formula definitions and evaluators do not match");
}
module.exports = { FORMULAS, EVALUATORS };
