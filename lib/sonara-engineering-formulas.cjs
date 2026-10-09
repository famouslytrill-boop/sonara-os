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
  },
  {
    "formulaKey": "project_variable_cash_flow_npv",
    "groupKey": "building_economics",
    "productArea": "Business Builder",
    "publicLabel": "Variable cash-flow project NPV",
    "expressionText": "sum(cash_flows[t]/(1+discount_rate)^(t+1)) - upfront_cost",
    "requiredInputs": [
      "cash_flows",
      "discount_rate",
      "upfront_cost"
    ],
    "targetTables": [],
    "outputUnit": "money"
  },
  {
    "formulaKey": "roof_pitch_surface_sqft",
    "groupKey": "construction_trades",
    "productArea": "Business Builder",
    "publicLabel": "Sloped roofing surface estimate",
    "expressionText": "plan_area_square_feet * sqrt(1 + (rise_per_12/12)^2)",
    "requiredInputs": [
      "plan_area_square_feet",
      "rise_per_12"
    ],
    "targetTables": [],
    "outputUnit": "square_feet"
  },
  {
    "formulaKey": "trade_bid_gross_margin_percent",
    "groupKey": "construction_trades",
    "productArea": "Business Builder",
    "publicLabel": "Bid gross margin after direct job costs",
    "expressionText": "100 * (bid_price - direct_job_cost) / bid_price",
    "requiredInputs": [
      "bid_price",
      "direct_job_cost"
    ],
    "targetTables": [],
    "outputUnit": "percent"
  },
  {
    "formulaKey": "base64_encoded_bytes",
    "groupKey": "computing_engineering",
    "productArea": "Creator Studio",
    "publicLabel": "Base64 output byte length",
    "expressionText": "4 * ceil(source_bytes / 3)",
    "requiredInputs": [
      "source_bytes"
    ],
    "targetTables": [],
    "outputUnit": "bytes"
  },
  {
    "formulaKey": "circular_orbit_speed_m_s",
    "groupKey": "space_science",
    "productArea": "Business Builder",
    "publicLabel": "Ideal circular orbital speed",
    "expressionText": "sqrt(gravitational_parameter_m3_s2 / orbital_radius_meters)",
    "requiredInputs": [
      "gravitational_parameter_m3_s2",
      "orbital_radius_meters"
    ],
    "targetTables": [],
    "outputUnit": "meters_per_second"
  },
  {
    "formulaKey": "nadir_ground_sample_distance_m",
    "groupKey": "space_science",
    "productArea": "Creator Studio",
    "publicLabel": "Ideal optical nadir GSD",
    "expressionText": "sensor_pixel_pitch_micrometers * 1e-6 * altitude_meters / focal_length_meters",
    "requiredInputs": [
      "sensor_pixel_pitch_micrometers",
      "altitude_meters",
      "focal_length_meters"
    ],
    "targetTables": [],
    "outputUnit": "meters_per_pixel"
  },
  {
    "formulaKey": "combined_standard_uncertainty",
    "groupKey": "measurement_science",
    "productArea": "Business Builder",
    "publicLabel": "Independent standard uncertainties combined",
    "expressionText": "sqrt(uncertainty_a^2 + uncertainty_b^2)",
    "requiredInputs": [
      "uncertainty_a",
      "uncertainty_b"
    ],
    "targetTables": [],
    "outputUnit": "input_unit"
  },
  {
    "formulaKey": "correlated_standard_uncertainty",
    "groupKey": "measurement_science",
    "productArea": "Business Builder",
    "publicLabel": "Two correlated standard uncertainties",
    "expressionText": "sqrt(uncertainty_a^2 + uncertainty_b^2 + 2 * correlation_coefficient * uncertainty_a * uncertainty_b)",
    "requiredInputs": ["uncertainty_a","uncertainty_b","correlation_coefficient"],
    "targetTables": [],
    "outputUnit": "input_unit"
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
  if (typeof raw !== "number" && typeof raw !== "string") {
    invalid(key, key + " must be a number");
  }
  // Number("0x10"), Number("0b10") and Number("  ") are valid JavaScript,
  // but they are not unambiguous human-entered decimal measurements.
  // Bound text length before numeric conversion; scientific notation is valid.
  if (typeof raw === "string" &&
      (raw.length > 64 || !/^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?$/.test(raw.trim()))) {
    invalid(key, key + " must use decimal or scientific notation");
  }
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
    // expm1/log1p avoid catastrophic cancellation when the discount rate
    // approaches zero (for example 1e-15 over multiple years).
    const factor = r === 0 ? n : -Math.expm1(-n * Math.log1p(r)) / r;
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
  },
  project_variable_cash_flow_npv: (v) => {
    if (!Array.isArray(v.cash_flows) || v.cash_flows.length < 1 || v.cash_flows.length > 100) {
      invalid("cash_flows","Provide 1 to 100 annual net cash flows");
    }
    const ratePerYear = rate(v,"discount_rate");
    const net = v.cash_flows.reduce((sum,amount,i) =>
      sum + value({amount},"amount") * Math.exp(-(i + 1) * Math.log1p(ratePerYear)),0);
    return net - number(v,"upfront_cost");
  },
  roof_pitch_surface_sqft: (v) => number(v,"plan_area_square_feet") *
    Math.sqrt(1 + (number(v,"rise_per_12",0,48) / 12)**2),
  trade_bid_gross_margin_percent: (v) => 100 *
    (positive(v,"bid_price") - number(v,"direct_job_cost")) / positive(v,"bid_price"),
  base64_encoded_bytes: (v) => 4 *
    Math.ceil(number(v,"source_bytes",0,1e12,true) / 3),
  circular_orbit_speed_m_s: (v) =>
    Math.sqrt(positive(v,"gravitational_parameter_m3_s2",1e30) /
      positive(v,"orbital_radius_meters",1e12)),
  nadir_ground_sample_distance_m: (v) => positive(v,"sensor_pixel_pitch_micrometers",1e6) *
    1e-6 * positive(v,"altitude_meters",1e9) / positive(v,"focal_length_meters",1e6),
  combined_standard_uncertainty: (v) => Math.hypot(
    number(v,"uncertainty_a",0,1e12), number(v,"uncertainty_b",0,1e12)),
  correlated_standard_uncertainty: (v) => {
    const a = number(v,"uncertainty_a",0,1e12);
    const b = number(v,"uncertainty_b",0,1e12);
    const rho = number(v,"correlation_coefficient",-1,1);
    // When rho = -1, the result is |a-b|. This branch also avoids
    // cancellation that can turn a small true value into zero.
    if (rho === -1) return Math.abs(a - b);
    if (rho === 1) return a + b;
    const variance = (a - b) ** 2 + 2 * a * b * (1 + rho);
    return Math.sqrt(variance);
  }
});
const EVALUATORS = Object.freeze(Object.fromEntries(
  Object.entries(HANDLERS).map(([key, handler]) => [key, (input) => validResult(handler(input))])
));
if (FORMULAS.length !== Object.keys(EVALUATORS).length ||
    FORMULAS.some((formula) => !EVALUATORS[formula.formulaKey])) {
  throw new Error("Engineering formula definitions and evaluators do not match");
}
// Scientific/measurement outputs retain significant digits, unlike displayed money.
const PRECISE_FORMULA_KEYS = new Set([
  "pipe_flow_m3_s", "square_feet_to_square_meters",
  "satellite_orbital_period_seconds", "telescope_rayleigh_arcseconds",
  "quantum_ideal_one_probability", "quantum_sampling_standard_error",
  "circular_orbit_speed_m_s", "nadir_ground_sample_distance_m",
  "combined_standard_uncertainty", "correlated_standard_uncertainty"
]);
// These limitations accompany the generated customer-facing calculators,
// so a numeric answer cannot masquerade as a professional design approval.
const FORMULA_ADVISORIES = Object.freeze({
  fully_burdened_labor_cost: "Estimate only: add only non-overlapping benefit and employer-tax amounts; some employer benefit surveys already include legally required taxes. Verify local wage rules and actual allocated overhead.",
  trade_bid_price: "Planning quote only: input utilization as a fraction (0.8 means 80%). Markup is NOT gross margin. Review permits, tax, scope and contingency separately.",
  economic_profit: "Compare alternatives over an identical time period and currency; use net benefits, not gross revenue.",
  project_net_present_value: "Level annual end-of-year net cash flows. Discount rate is a fraction. Validate tax, inflation and project risk separately.",
  project_variable_cash_flow_npv: "Enter one annual end-of-year cash flow per year; negative years are allowed. Use a consistent currency and discount rate.",
  roof_pitch_surface_sqft: "Supply horizontal projected roof area, not sloped surface area. Uniform pitch only; excludes overhangs, valleys and construction safety review.",
  roofing_squares: "Enter roof surface area including slope; one roofing square is 100 square feet. Allowance is not a procurement order.",
  single_phase_ac_real_power_watts: "Single-phase RMS electrical power; not a wiring, breaker or code-compliance design.",
  pipe_flow_m3_s: "Ideal full circular pipe with area-average velocity; no friction, pump head or pipe-rating check.",
  combined_standard_uncertainty: "Two independent, uncorrelated standard uncertainties in the SAME unit; not a coverage interval.",
  correlated_standard_uncertainty: "Two standard uncertainties in the SAME unit; correlation coefficient must be between -1 and +1. Not a coverage interval or calibration certificate.",
  satellite_orbital_period_seconds: "Ideal two-body Keplerian model; semi-major axis is measured from the central body's center.",
  circular_orbit_speed_m_s: "Ideal two-body circular-orbit speed; orbital radius is measured from the central body's center.",
  nadir_ground_sample_distance_m: "Ideal nadir, small-angle ground sampling on flat terrain; not actual optical image resolution.",
  telescope_rayleigh_arcseconds: "Ideal circular-aperture diffraction limit, not real image resolution in the atmosphere.",
  quantum_ideal_one_probability: "Ideal single-qubit Ry rotation from |0>; not measured quantum hardware output.",
  quantum_sampling_standard_error: "Binomial sampling estimate only; excludes noise, bias, and QPU errors.",
  compute_job_cost: "User-supplied price model. Add network egress, API calls, licensing and taxes separately.",
  base64_encoded_bytes: "Padded Base64 output only; excludes line wrapping, headers and data-URI prefixes."
});
function engineeringFormulaAdvisory(key) { return FORMULA_ADVISORIES[key] || (FORMULAS.some(f => f.formulaKey === key) ? "Planning or educational estimate only. Verify input units, assumptions and applicable professional requirements." : ""); }
module.exports = { FORMULAS, EVALUATORS, PRECISE_FORMULA_KEYS, engineeringFormulaAdvisory };
