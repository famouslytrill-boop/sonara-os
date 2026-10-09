// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure, allowlisted, bounded models. No network, payroll decisions, structural
// certification, satellite control, quantum execution, or persistence.
class AppliedFormulaInputError extends Error {
  constructor(inputKey, message) {
    super(message || `${inputKey} must be a finite number within its declared range`);
    this.name = "AppliedFormulaInputError";
    this.inputKey = inputKey;
  }
}

function number(v, key, { min = 0, max = 1e12, integer = false } = {}) {
  const raw = v?.[key];
  const value = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    throw new AppliedFormulaInputError(key);
  }
  return value;
}
function positive(v, key, max = 1e12) {
  const value = number(v, key, { max });
  if (value === 0) throw new AppliedFormulaInputError(key, `${key} must be greater than zero`);
  return value;
}
function percentage(v, key) { return number(v, key, { max: 100 }) / 100; }
function output(value) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new AppliedFormulaInputError("result", "Result exceeds supported precision");
  }
  return value;
}
const EARTH_EQUATORIAL_RADIUS_KM = 6378.137;
const EARTH_MU_KM3_S2 = 398600.4418;
const ARCSECONDS_PER_RADIAN = 206264.80624709636;

const APPLIED_FORMULAS = Object.freeze({
  // Planning only; benefit/tax amounts are employer inputs, not legal constants.
  loaded_labor_cost: (v) => output(
    number(v, "paid_hours") * (
      number(v, "hourly_wage") +
      number(v, "benefits_per_hour") +
      number(v, "employer_payroll_cost_per_hour")
    )
  ),
  // The user selects overtime hours and multiplier. Not a legal pay determination.
  weekly_wage_projection: (v) => output(
    number(v, "regular_hours") * number(v, "regular_rate") +
    number(v, "overtime_hours") * number(v, "regular_rate") *
      number(v, "overtime_multiplier", { min: 1, max: 10 })
  ),
  billable_utilization_percent: (v) => {
    const billable = number(v, "billable_hours");
    const paid = positive(v, "paid_hours");
    if (billable > paid) throw new AppliedFormulaInputError("billable_hours", "billable_hours cannot exceed paid_hours");
    return output(100 * billable / paid);
  },
  opportunity_value_gap: (v) => output(
    number(v, "alternative_net_value", { min: -1e12 }) -
    number(v, "selected_net_value", { min: -1e12 })
  ),
  project_unit_margin_percent: (v) => output(
    100 * (positive(v, "bid_revenue") -
      number(v, "direct_cost") -
      number(v, "allocated_overhead")) / positive(v, "bid_revenue")
  ),
  material_quantity_with_waste: (v) => output(
    number(v, "net_quantity") * (1 + percentage(v, "waste_percent"))
  ),
  concrete_volume_cubic_yards: (v) => output(
    number(v, "length_feet") * number(v, "width_feet") *
    number(v, "depth_feet") * (1 + percentage(v, "waste_percent")) / 27
  ),
  crew_duration_hours: (v) => output(
    number(v, "labor_hours") / number(v, "crew_size", { min: 1, max: 10000, integer: true })
  ),
  trade_job_cost: (v) => output(
    number(v, "labor_hours") * number(v, "loaded_hourly_cost") +
    number(v, "material_cost") + number(v, "equipment_cost") +
    number(v, "permit_cost")
  ),
  length_meters_from_feet: (v) => output(number(v, "length_feet") * 0.3048),
  data_transfer_seconds: (v) => output(
    number(v, "payload_mebibytes") * 1048576 * 8 / positive(v, "throughput_bits_per_second")
  ),
  base64_encoded_bytes: (v) => output(
    Math.ceil(number(v, "payload_bytes", { max: 1e12, integer: true }) / 3) * 4
  ),
  // A transparent budget proxy: not hardware gate count or execution time.
  quantum_qubit_layer_shots: (v) => output(
    number(v, "measured_qubits", { min: 1, max: 10000, integer: true }) *
    number(v, "circuit_depth", { min: 1, max: 1e6, integer: true }) *
    number(v, "shot_count", { min: 1, max: 1e6, integer: true })
  ),
  // Ideal two-body circular orbit; ignores oblateness, drag and perturbations.
  earth_circular_orbit_period_minutes: (v) => {
    const radius = EARTH_EQUATORIAL_RADIUS_KM + number(v, "altitude_km", { max: 1e8 });
    return output(2 * Math.PI * Math.sqrt(radius ** 3 / EARTH_MU_KM3_S2) / 60);
  },
  // Ideal Rayleigh criterion for a circular unobstructed aperture.
  telescope_diffraction_arcseconds: (v) => output(
    1.22 * (positive(v, "wavelength_nanometers") * 1e-9) /
    (positive(v, "aperture_millimeters") * 1e-3) * ARCSECONDS_PER_RADIAN
  )
});

module.exports = { APPLIED_FORMULAS, AppliedFormulaInputError };
