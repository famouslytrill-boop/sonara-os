// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { lengthMeters, speedMetersPerSecond } = require("./sonara-measurement-pipeline.cjs");

// Auditable research/educational projections, not licensed engineering designs,
// diagnoses, disability assessments, student grading, election forecasts,
// Autodesk integrations, or physical-device tracking/control.
class EducationFormulaInputError extends Error {
  constructor(inputKey, message) {
    super(message || `${inputKey} must be a finite number in its supported range`);
    this.name = "EducationFormulaInputError";
    this.inputKey = inputKey;
  }
}
function n(v, key, min = 0, max = 1e9, integer = false) {
  const raw = v?.[key];
  const value = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    throw new EducationFormulaInputError(key);
  }
  return value;
}
function positive(v, key, max = 1e9) {
  const value = n(v, key, 0, max);
  if (!value) throw new EducationFormulaInputError(key, `${key} must be greater than zero`);
  return value;
}
function finite(value) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new EducationFormulaInputError("result", "Result exceeds supported precision");
  }
  return value;
}
function boundedPercent(value, key) {
  if (value < 0 || value > 100) throw new EducationFormulaInputError(key, `${key} produces an impossible percentage`);
  return finite(value);
}
function partPercent(v, partKey, wholeKey, integer = false) {
  const part = n(v, partKey, 0, 1e9, integer);
  const whole = positive(v, wholeKey);
  if (integer && !Number.isSafeInteger(whole)) throw new EducationFormulaInputError(wholeKey);
  if (part > whole) throw new EducationFormulaInputError(partKey, `${partKey} cannot exceed ${wholeKey}`);
  return finite(100 * part / whole);
}
function vector(v, prefix) {
  return ["x", "y", "z"].map((axis) => n(v, `${prefix}_${axis}`, -1e6, 1e6));
}
function norm3(a) { return Math.hypot(a[0], a[1], a[2]); }

const EDUCATION_FORMULAS = Object.freeze({
  math_triangle_area_m2: (v) => finite(n(v, "base_m") * n(v, "height_m") / 2),
  math_circle_area_m2: (v) => finite(Math.PI * n(v, "radius_m") ** 2),
  math_hypotenuse_m: (v) => finite(Math.hypot(n(v, "leg_a_m"), n(v, "leg_b_m"))),
  math_compound_future_value: (v) => finite(n(v, "principal") *
    (1 + n(v, "annual_rate_percent", -100, 1000) / 100) ** n(v, "years", 0, 100)),
  math_weighted_grade_percent: (v) => partPercent(v, "earned_points", "possible_points"),
  math_probability_union_percent: (v) => {
    const a = n(v, "event_a_percent", 0, 100);
    const b = n(v, "event_b_percent", 0, 100);
    const intersection = n(v, "intersection_percent", 0, 100);
    if (intersection > Math.min(a, b)) throw new EducationFormulaInputError("intersection_percent");
    return boundedPercent(a + b - intersection, "event_union_percent");
  },
  stem_ohms_voltage_v: (v) => finite(n(v, "current_amperes") * n(v, "resistance_ohms")),
  stem_electrical_power_w: (v) => finite(n(v, "voltage_volts") * n(v, "current_amperes")),
  stem_wave_speed_mps: (v) => finite(n(v, "frequency_hz") * n(v, "wavelength_m")),
  stem_material_density_kg_m3: (v) => finite(n(v, "mass_kg") / positive(v, "volume_m3")),
  social_population_density_km2: (v) => finite(n(v, "population_people", 0, 1e9, true) / positive(v, "area_km2")),
  social_population_change_percent: (v) => finite(
    100 * (n(v, "current_population", 0, 1e9, true) / n(v, "previous_population", 1, 1e9, true) - 1)
  ),
  social_school_participation_percent: (v) => partPercent(v, "enrolled_school_age", "population_school_age", true),
  social_voter_turnout_percent: (v) => partPercent(v, "ballots_cast", "eligible_voters", true),
  social_map_scale_distance_m: (v) => finite(n(v, "map_distance_cm") *
    positive(v, "scale_denominator") / 100),
  language_reading_wpm: (v) => finite(n(v, "word_count", 0, 1e9, true) / positive(v, "elapsed_minutes")),
  language_lexical_diversity_percent: (v) => partPercent(v, "unique_word_types", "total_word_tokens", true),
  language_flesch_reading_ease: (v) => {
    const words = n(v, "word_count", 1, 1e9, true);
    const sentences = n(v, "sentence_count", 1, 1e9, true);
    const syllables = n(v, "syllable_count", 1, 1e9, true);
    if (sentences > words) throw new EducationFormulaInputError("sentence_count");
    if (syllables < words) throw new EducationFormulaInputError("syllable_count");
    return finite(206.835 - 1.015 * words / sentences - 84.6 * syllables / words);
  },
  language_source_coverage_percent: (v) => partPercent(v, "cited_claims", "total_factual_claims", true),
  arts_beat_duration_seconds: (v) => finite(n(v, "beat_count") * 60 / positive(v, "tempo_bpm", 1000)),
  arts_frame_count: (v) => finite(Math.ceil(n(v, "duration_seconds", 0, 1e6) *
    positive(v, "frames_per_second", 1000))),
  arts_print_dpi: (v) => finite(positive(v, "image_width_pixels") / positive(v, "print_width_inches")),
  arts_frame_aspect_ratio: (v) => finite(positive(v, "frame_width_pixels") / positive(v, "frame_height_pixels")),
  pe_met_minutes: (v) => finite(n(v, "activity_minutes") * n(v, "met_value", 1, 30)),
  pe_pace_minutes_per_km: (v) => finite(n(v, "elapsed_minutes") / positive(v, "distance_km")),
  pe_estimated_kcal: (v) => finite(
    n(v, "met_value", 1, 30) * 3.5 * n(v, "body_mass_kg", 1, 500) *
    n(v, "activity_minutes") / 200
  ),
  cad_paper_to_model_mm: (v) => finite(n(v, "drawing_length_mm") * positive(v, "scale_denominator")),
  cad_distance_3d_mm: (v) => finite(lengthMeters({
    x: n(v, "delta_x", -1e6, 1e6), y: n(v, "delta_y", -1e6, 1e6), z: n(v, "delta_z", -1e6, 1e6)
  }, "mm") * 1000),
  cad_cylinder_volume_mm3: (v) => finite(Math.PI * n(v, "radius_mm") ** 2 * n(v, "height_mm")),
  cad_inches_to_millimeters: (v) => finite(n(v, "length_inches") * 25.4),
  cad_feet_to_millimeters: (v) => finite(n(v, "length_feet") * 304.8),
  mocap_marker_speed_mps: (v) => finite(speedMetersPerSecond({
    x: n(v, "displacement_x", -1e6, 1e6),
    y: n(v, "displacement_y", -1e6, 1e6),
    z: n(v, "displacement_z", -1e6, 1e6)
  }, "m", positive(v, "elapsed_seconds"))),
  mocap_sample_interval_ms: (v) => finite(1000 / positive(v, "sample_rate_hz", 1e6)),
  mocap_joint_angle_degrees: (v) => {
    const a = vector(v, "vector_a");
    const b = vector(v, "vector_b");
    const scale = norm3(a) * norm3(b);
    if (!scale) throw new EducationFormulaInputError("joint_vectors", "Joint vectors must have nonzero length");
    const cosine = Math.max(-1, Math.min(1, (a[0]*b[0] + a[1]*b[1] + a[2]*b[2]) / scale));
    return finite(Math.acos(cosine) * 180 / Math.PI);
  },
  mocap_frame_coverage_percent: (v) => partPercent(v, "valid_tracked_frames", "total_capture_frames", true),
  mocap_nyquist_hz: (v) => finite(positive(v, "sample_rate_hz", 1e6) / 2)
});

module.exports = { EDUCATION_FORMULAS, EducationFormulaInputError };
