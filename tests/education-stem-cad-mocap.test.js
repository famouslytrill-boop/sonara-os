"use strict";

const assert = require("node:assert/strict");
const { evaluateFormula, listFormulaDefinitions } = require("../lib/sonara-formula-library.cjs");
const { EDUCATION_FORMULAS } = require("../lib/sonara-education-stem-cad-mocap.cjs");

function equals(key, input, expected, tolerance = 0.00011) {
  const actual = evaluateFormula(key, input);
  assert.equal(actual.ok, true, `${key}: ${JSON.stringify(actual)}`);
  assert.ok(Math.abs(actual.resultValue - expected) <= tolerance, `${key}: ${actual.resultValue} expected ${expected}`);
}
function invalid(key, input) {
  const actual = evaluateFormula(key, input);
  assert.equal(actual.code, "invalid_input", `${key}: ${JSON.stringify(actual)}`);
}
describe("education, physical science, social studies, CAD, arts and mocap", () => {
  it("registers all 36 handlers with metadata and declared inputs", () => {
    const defs = new Map(listFormulaDefinitions().map((definition) => [definition.formulaKey, definition]));
    assert.equal(Object.keys(EDUCATION_FORMULAS).length, 36);
    for (const key of Object.keys(EDUCATION_FORMULAS)) {
      assert.ok(defs.has(key), `missing metadata ${key}`);
      assert.ok(defs.get(key).requiredInputs.length, `no inputs for ${key}`);
    }
  });
  it("solves mathematics without mixing probabilities, lengths or monetary rates", () => {
    equals("math_triangle_area_m2", { base_m: 6, height_m: 4 }, 12);
    equals("math_circle_area_m2", { radius_m: 2 }, 12.5664);
    equals("math_hypotenuse_m", { leg_a_m: 3, leg_b_m: 4 }, 5);
    equals("math_compound_future_value", { principal: 100, annual_rate_percent: 5, years: 2 }, 110.25);
    equals("math_weighted_grade_percent", { earned_points: 80, possible_points: 100 }, 80);
    equals("math_probability_union_percent", { event_a_percent: 60, event_b_percent: 30, intersection_percent: 10 }, 80);
  });
  it("calculates physical quantities, not electrical installation approvals", () => {
    equals("stem_ohms_voltage_v", { current_amperes: 2, resistance_ohms: 5 }, 10);
    equals("stem_electrical_power_w", { voltage_volts: 120, current_amperes: 2 }, 240);
    equals("stem_wave_speed_mps", { frequency_hz: 3, wavelength_m: 2 }, 6);
    equals("stem_material_density_kg_m3", { mass_kg: 10, volume_m3: 2 }, 5);
  });
  it("uses explicitly supplied aggregate historical, census and geography denominators", () => {
    equals("social_population_density_km2", { population_people: 1000000, area_km2: 1000 }, 1000);
    equals("social_population_change_percent", { current_population: 110, previous_population: 100 }, 10);
    equals("social_school_participation_percent", { enrolled_school_age: 80, population_school_age: 100 }, 80);
    equals("social_voter_turnout_percent", { ballots_cast: 60, eligible_voters: 100 }, 60);
    equals("social_map_scale_distance_m", { map_distance_cm: 2, scale_denominator: 50000 }, 1000);
  });
  it("reports language statistics without declaring comprehension or accuracy", () => {
    equals("language_reading_wpm", { word_count: 200, elapsed_minutes: 2 }, 100);
    equals("language_lexical_diversity_percent", { unique_word_types: 50, total_word_tokens: 200 }, 25);
    equals("language_flesch_reading_ease", { word_count: 100, sentence_count: 5, syllable_count: 140 }, 68.095);
    equals("language_source_coverage_percent", { cited_claims: 8, total_factual_claims: 10 }, 80);
  });
  it("budgets beats, animation frames, print resolution and image ratios", () => {
    equals("arts_beat_duration_seconds", { beat_count: 8, tempo_bpm: 120 }, 4);
    equals("arts_frame_count", { duration_seconds: 1.5, frames_per_second: 24 }, 36);
    equals("arts_print_dpi", { image_width_pixels: 3600, print_width_inches: 12 }, 300);
    equals("arts_frame_aspect_ratio", { frame_width_pixels: 1920, frame_height_pixels: 1080 }, 1.7778);
  });
  it("keeps fitness calculations as estimates, not diagnoses or weight-loss prescriptions", () => {
    equals("pe_met_minutes", { activity_minutes: 30, met_value: 4 }, 120);
    equals("pe_pace_minutes_per_km", { elapsed_minutes: 30, distance_km: 5 }, 6);
    equals("pe_estimated_kcal", { met_value: 4, body_mass_kg: 70, activity_minutes: 30 }, 147);
  });
  it("provides unit-aware geometry and physical model lengths, not CAD file parsing", () => {
    equals("cad_paper_to_model_mm", { drawing_length_mm: 20, scale_denominator: 50 }, 1000);
    equals("cad_distance_3d_mm", { delta_x: 3, delta_y: 4, delta_z: 12 }, 13);
    equals("cad_cylinder_volume_mm3", { radius_mm: 10, height_mm: 100 }, 31415.9265);
    equals("cad_inches_to_millimeters", { length_inches: 2 }, 50.8);
    equals("cad_feet_to_millimeters", { length_feet: 1 }, 304.8);
  });
  it("computes tracking telemetry and vector angles without capturing camera frames", () => {
    equals("mocap_marker_speed_mps", { displacement_x: 3, displacement_y: 4, displacement_z: 0, elapsed_seconds: 2 }, 2.5);
    equals("mocap_sample_interval_ms", { sample_rate_hz: 120 }, 8.3333);
    equals("mocap_joint_angle_degrees", { vector_a_x: 1, vector_a_y: 0, vector_a_z: 0, vector_b_x: 0, vector_b_y: 1, vector_b_z: 0 }, 90);
    equals("mocap_frame_coverage_percent", { valid_tracked_frames: 90, total_capture_frames: 100 }, 90);
    equals("mocap_nyquist_hz", { sample_rate_hz: 120 }, 60);
  });
  it("rejects invalid fractions, negative measurements, zero vectors and unsafe missing values", () => {
    invalid("math_weighted_grade_percent", { earned_points: 101, possible_points: 100 });
    invalid("math_probability_union_percent", { event_a_percent: 60, event_b_percent: 60, intersection_percent: 0 });
    invalid("math_probability_union_percent", { event_a_percent: 20, event_b_percent: 30, intersection_percent: 25 });
    invalid("social_voter_turnout_percent", { ballots_cast: 110, eligible_voters: 100 });
    invalid("social_voter_turnout_percent", { ballots_cast: 10, eligible_voters: 10.5 });
    invalid("social_population_change_percent", { current_population: 110, previous_population: 100.5 });
    invalid("language_flesch_reading_ease", { word_count: 100, sentence_count: 5.5, syllable_count: 140 });
    invalid("social_school_participation_percent", { enrolled_school_age: 101, population_school_age: 100 });
    invalid("language_lexical_diversity_percent", { unique_word_types: 21, total_word_tokens: 20 });
    invalid("language_flesch_reading_ease", { word_count: 100, sentence_count: 101, syllable_count: 140 });
    invalid("language_flesch_reading_ease", { word_count: 100, sentence_count: 5, syllable_count: 90 });
    invalid("stem_material_density_kg_m3", { mass_kg: 1, volume_m3: 0 });
    invalid("cad_inches_to_millimeters", { length_inches: -1 });
    invalid("mocap_sample_interval_ms", { sample_rate_hz: 0 });
    invalid("mocap_joint_angle_degrees", { vector_a_x: 0, vector_a_y: 0, vector_a_z: 0, vector_b_x: 1, vector_b_y: 1, vector_b_z: 1 });
    invalid("mocap_frame_coverage_percent", { valid_tracked_frames: 11, total_capture_frames: 10 });
    assert.equal(evaluateFormula("cad_cylinder_volume_mm3", { radius_mm: 2 }).code, "missing_inputs");
  });
});
