"use strict";

const assert = require("node:assert/strict");
const { evaluateFormula, listFormulaDefinitions } = require("../lib/sonara-formula-library.cjs");
const { APPLIED_FORMULAS } = require("../lib/sonara-applied-formulas.cjs");

function result(key, input, expected, tolerance = 0.0001) {
  const actual = evaluateFormula(key, input);
  assert.equal(actual.ok, true, JSON.stringify(actual));
  assert.ok(Math.abs(actual.resultValue - expected) <= tolerance, `${key}: ${actual.resultValue} vs ${expected}`);
}

describe("bounded applied formulas for business, construction and science", () => {
  it("has public formula metadata and allowlisted executors in one-to-one agreement", () => {
    const registered = new Set(listFormulaDefinitions().map((f) => f.formulaKey));
    for (const key of Object.keys(APPLIED_FORMULAS)) assert.ok(registered.has(key), key);
    assert.equal(Object.keys(APPLIED_FORMULAS).length, 15);
  });

  it("works out wages and actual employer-burden inputs without inventing benefits", () => {
    result("loaded_labor_cost", { paid_hours: 40, hourly_wage: 25, benefits_per_hour: 8, employer_payroll_cost_per_hour: 3 }, 1440);
    result("weekly_wage_projection", { regular_hours: 40, regular_rate: 25, overtime_hours: 5, overtime_multiplier: 1.5 }, 1187.5);
    result("billable_utilization_percent", { billable_hours: 30, paid_hours: 40 }, 75);
    assert.equal(evaluateFormula("billable_utilization_percent", { billable_hours: 41, paid_hours: 40 }).code, "invalid_input");
  });

  it("compares mutually exclusive choices without calling the difference opportunity cost", () => {
    result("opportunity_value_gap", { alternative_net_value: 1400, selected_net_value: 1000 }, 400);
    result("opportunity_value_gap", { alternative_net_value: 600, selected_net_value: 1000 }, -400);
    result("project_unit_margin_percent", { bid_revenue: 2000, direct_cost: 1000, allocated_overhead: 300 }, 35);
  });

  it("estimates trade quantity, crew capacity, cost and exact SI length", () => {
    result("material_quantity_with_waste", { net_quantity: 100, waste_percent: 10 }, 110);
    result("concrete_volume_cubic_yards", { length_feet: 10, width_feet: 10, depth_feet: 0.5, waste_percent: 8 }, 2, 0.0001);
    result("crew_duration_hours", { labor_hours: 48, crew_size: 4 }, 12);
    result("trade_job_cost", { labor_hours: 48, loaded_hourly_cost: 50, material_cost: 800, equipment_cost: 200, permit_cost: 100 }, 3500);
    result("length_meters_from_feet", { length_feet: 10 }, 3.048);
  });

  it("models encoding and ideal transmission with binary MiB units", () => {
    result("base64_encoded_bytes", { payload_bytes: 4 }, 8);
    result("base64_encoded_bytes", { payload_bytes: 0 }, 0);
    result("data_transfer_seconds", { payload_mebibytes: 1, throughput_bits_per_second: 8388608 }, 1);
  });

  it("labels quantum cost as an exposure proxy and satellite/telescope output as ideal", () => {
    result("quantum_qubit_layer_shots", { measured_qubits: 6, circuit_depth: 12, shot_count: 1000 }, 72000);
    result("earth_circular_orbit_period_minutes", { altitude_km: 400 }, 92.56, 0.1);
    result("telescope_diffraction_arcseconds", { wavelength_nanometers: 550, aperture_millimeters: 200 }, 0.6919, 0.002);
  });

  it("fails closed for missing, invalid, nonpositive and out-of-range inputs", () => {
    const cases = [
      ["loaded_labor_cost", { paid_hours: 1, hourly_wage: -1, benefits_per_hour: 0, employer_payroll_cost_per_hour: 0 }],
      ["crew_duration_hours", { labor_hours: 2, crew_size: 0 }],
      ["crew_duration_hours", { labor_hours: 2, crew_size: 1.5 }],
      ["concrete_volume_cubic_yards", { length_feet: 1, width_feet: 1, depth_feet: 1, waste_percent: 101 }],
      ["data_transfer_seconds", { payload_mebibytes: 1, throughput_bits_per_second: 0 }],
      ["base64_encoded_bytes", { payload_bytes: 2.3 }],
      ["telescope_diffraction_arcseconds", { wavelength_nanometers: 550, aperture_millimeters: 0 }],
      ["quantum_qubit_layer_shots", { measured_qubits: "nan", circuit_depth: 2, shot_count: 4 }]
    ];
    for (const [key, input] of cases) assert.equal(evaluateFormula(key, input).code, "invalid_input", key);
    assert.equal(evaluateFormula("loaded_labor_cost", { paid_hours: 40 }).code, "missing_inputs");
    assert.equal(evaluateFormula("not_a_formula", {}).code, "unknown_formula");
  });
});
