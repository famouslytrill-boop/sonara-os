// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// v1: deterministic, local-only measurement adapter between explicitly stated
// CAD dimensions, calibrated 3D tracks, rational media frames and job estimates.
// No CAD file IO, cameras, biometric recognition, persistence or physical control.
const { createHash } = require("node:crypto");

const PIPELINE_VERSION = "2026-10-09.1";
const LENGTH_TO_METERS = Object.freeze({
  m: 1, cm: 0.01, mm: 0.001, km: 1000,
  in: 0.0254, ft: 0.3048, yd: 0.9144,
  us_survey_ft: 1200 / 3937
});
const MODES = new Set(["cad", "motion", "media", "trade", "combined"]);
const ORIGINS = new Set(["manual", "reviewed_import", "calibrated_sensor"]);
const MAX_SAMPLES = 128;
const MAX_SAFE_MICROSECONDS = 1000000000000000;

class MeasurementInputError extends Error {
  constructor(key, code = "invalid_measurement", message = `Invalid ${key}`) {
    super(message);
    this.name = "MeasurementInputError";
    this.key = key;
    this.code = code;
  }
}

function number(value, key, { min = -1e9, max = 1e9, integer = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) ||
      value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    throw new MeasurementInputError(key);
  }
  return value;
}
function positive(value, key, max = 1e9) {
  const n = number(value, key, { min: 0, max });
  if (n === 0) throw new MeasurementInputError(key, "zero_denominator", `${key} must be greater than zero`);
  return n;
}
function object(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MeasurementInputError(key);
  return value;
}
function token(value, key, maxLength = 70) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value) || value.length > maxLength) {
    throw new MeasurementInputError(key);
  }
  return value;
}
function unitScale(unit) {
  if (!Object.hasOwn(LENGTH_TO_METERS, unit)) {
    throw new MeasurementInputError("unit", "unsupported_unit", "Unit must be an explicit supported length unit");
  }
  return LENGTH_TO_METERS[unit];
}
function finiteResult(value, key) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new MeasurementInputError(key, "result_overflow", `Unrepresentable ${key}`);
  }
  return value;
}
function vector(v, key = "point") {
  const p = object(v, key);
  return [
    number(p.x, `${key}.x`, { min: -1e7, max: 1e7 }),
    number(p.y, `${key}.y`, { min: -1e7, max: 1e7 }),
    number(p.z, `${key}.z`, { min: -1e7, max: 1e7 })
  ];
}
function lengthMeters(displacement, unit) {
  const [x, y, z] = vector(displacement, "displacement");
  return finiteResult(Math.hypot(x, y, z) * unitScale(unit), "length_m");
}
function speedMetersPerSecond(displacement, unit, elapsedSeconds) {
  return finiteResult(lengthMeters(displacement, unit) / positive(elapsedSeconds, "elapsedSeconds"), "speed_mps");
}

// Apply glTF-style T*R*S to a point (source frame is declared right-handed,
// Y-up; the output frame is also right-handed, Y-up). A quaternion must be unit
// length; silently normalizing invalid calibration hides errors.
function transformPointMeters(point, frame) {
  const f = object(frame, "frame");
  const sourceScale = unitScale(f.unit);
  if (f.handedness !== "right" || f.upAxis !== "Y") {
    throw new MeasurementInputError("frame", "unsupported_frame", "Convert source coordinate conventions explicitly before ingestion");
  }
  token(f.frameId, "frame.frameId");
  const input = vector(point, "point").map((x) => x * sourceScale);
  if (f.transform === undefined) return input;
  const t = object(f.transform, "frame.transform");
  const translation = vector(t.translationMeters, "frame.transform.translationMeters");
  const rotation = t.rotationXYZW;
  if (!Array.isArray(rotation) || rotation.length !== 4) throw new MeasurementInputError("frame.transform.rotationXYZW");
  const [qx, qy, qz, qw] = rotation.map((x, i) => number(x, `frame.transform.rotationXYZW[${i}]`, { min: -1, max: 1 }));
  const squaredLength = qx*qx + qy*qy + qz*qz + qw*qw;
  if (Math.abs(squaredLength - 1) > 1e-6) throw new MeasurementInputError("frame.transform.rotationXYZW", "invalid_rotation", "Quaternion must have unit length");
  const factor = positive(t.uniformScale, "frame.transform.uniformScale", 1e6);
  const [x, y, z] = input.map((u) => u * factor);
  // Rotate vector by unit quaternion: v + qw*t + cross(q,t), t = 2 cross(q,v).
  const tx = 2 * (qy*z - qz*y), ty = 2 * (qz*x - qx*z), tz = 2 * (qx*y - qy*x);
  const rx = x + qw*tx + qy*tz - qz*ty;
  const ry = y + qw*ty + qz*tx - qx*tz;
  const rz = z + qw*tz + qx*ty - qy*tx;
  return [rx + translation[0], ry + translation[1], rz + translation[2]].map((n) => finiteResult(n, "transformed_point_m"));
}
function frameIndexAtTimestamp(timestampUs, startUs, fpsNumerator, fpsDenominator) {
  const t = number(timestampUs, "timestampUs", { min: 0, max: MAX_SAFE_MICROSECONDS, integer: true });
  const start = number(startUs, "startUs", { min: 0, max: MAX_SAFE_MICROSECONDS, integer: true });
  const num = number(fpsNumerator, "fpsNumerator", { min: 1, max: 1000000, integer: true });
  const den = number(fpsDenominator, "fpsDenominator", { min: 1, max: 1000000, integer: true });
  if (t < start) throw new MeasurementInputError("timestampUs", "before_media_start", "Sample timestamp precedes media start");
  // BigInt prevents float drift across long productions and 30000/1001 fps.
  const idx = BigInt(t - start) * BigInt(num) / (1000000n * BigInt(den));
  if (idx > BigInt(Number.MAX_SAFE_INTEGER)) throw new MeasurementInputError("frameIndex", "result_overflow");
  return Number(idx);
}
function estimateBoxJob(input) {
  const cfg = object(input, "job");
  const scale = unitScale(cfg.lengthUnit);
  const length = number(cfg.length, "job.length", { min: 0, max: 1e7 }) * scale;
  const width = number(cfg.width, "job.width", { min: 0, max: 1e7 }) * scale;
  const height = number(cfg.height, "job.height", { min: 0, max: 1e7 }) * scale;
  const wastePercent = number(cfg.wastePercent, "job.wastePercent", { min: 0, max: 100 });
  const rate = number(cfg.materialPricePerCubicMeter, "job.materialPricePerCubicMeter", { min: 0, max: 1e9 });
  const laborHours = number(cfg.laborHours, "job.laborHours", { min: 0, max: 1e6 });
  const loadedRate = number(cfg.loadedLaborPricePerHour, "job.loadedLaborPricePerHour", { min: 0, max: 1e9 });
  const other = number(cfg.otherCost, "job.otherCost", { min: 0, max: 1e12 });
  const currency = token(cfg.currency, "job.currency", 3);
  if (!/^[A-Z]{3}$/.test(currency)) throw new MeasurementInputError("job.currency", "invalid_currency");
  const netVolumeM3 = finiteResult(length * width * height, "netVolumeM3");
  const orderedVolumeM3 = finiteResult(netVolumeM3 * (1 + wastePercent / 100), "orderedVolumeM3");
  const materialCost = finiteResult(orderedVolumeM3 * rate, "materialCost");
  const laborCost = finiteResult(laborHours * loadedRate, "laborCost");
  return Object.freeze({
    netVolumeM3, orderedVolumeM3, materialCost, laborCost,
    otherCost: other, estimatedTotal: finiteResult(materialCost + laborCost + other, "estimatedTotal"),
    currency, basis: "ideal_rectangular_volume_and_entered_costs_not_a_quote"
  });
}
function runMeasurementPipeline(input) {
  const req = object(input, "request");
  if (req.schemaVersion !== 1) throw new MeasurementInputError("schemaVersion", "unsupported_version");
  if (!MODES.has(req.mode)) throw new MeasurementInputError("mode", "unsupported_mode");
  const hasSamples = req.samples !== undefined;
  const hasMedia = req.media !== undefined;
  const hasJob = req.job !== undefined;
  const validMode = (
    (req.mode === "motion" && hasSamples && !hasMedia && !hasJob) ||
    (req.mode === "media" && hasSamples && hasMedia && !hasJob) ||
    ((req.mode === "trade" || req.mode === "cad") && !hasSamples && !hasMedia && hasJob) ||
    (req.mode === "combined" && hasSamples && hasJob)
  );
  if (!validMode) throw new MeasurementInputError("mode", "mode_inputs_mismatch", "Mode must match the measured sections");
  const source = object(req.source, "source");
  if (!ORIGINS.has(source.origin)) throw new MeasurementInputError("source.origin");
  const sourceRef = token(source.reference, "source.reference", 100);
  const out = { ok: true, version: PIPELINE_VERSION, mode: req.mode };
  const inputsForHash = { schemaVersion: 1, mode: req.mode, source: { origin: source.origin, reference: sourceRef } };
  if (req.samples !== undefined) {
    const frame = object(req.frame, "frame");
    const sourceFrameId = token(frame.frameId, "frame.frameId");
    const destinationFrameId = frame.transform
      ? token(frame.targetFrameId, "frame.targetFrameId")
      : sourceFrameId;
    if (!Array.isArray(req.samples) || req.samples.length < 2 || req.samples.length > MAX_SAMPLES) {
      throw new MeasurementInputError("samples", "invalid_sample_count");
    }
    const confidenceFloor = number(req.confidenceFloor, "confidenceFloor", { min: 0, max: 1 });
    const points = [];
    let previousTs = -1;
    for (let i = 0; i < req.samples.length; i++) {
      const sample = object(req.samples[i], `samples[${i}]`);
      const timestampUs = number(sample.timestampUs, `samples[${i}].timestampUs`, { min: 0, max: MAX_SAFE_MICROSECONDS, integer: true });
      if (timestampUs <= previousTs) throw new MeasurementInputError("samples.timestampUs", "non_monotonic_time");
      previousTs = timestampUs;
      const confidence = number(sample.confidence, `samples[${i}].confidence`, { min: 0, max: 1 });
      if (confidence < confidenceFloor) throw new MeasurementInputError("samples.confidence", "insufficient_tracking_quality");
      points.push({ timestampUs, confidence, meters: transformPointMeters(sample.position, frame) });
    }
    const segments = [];
    let totalMeters = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const d = Math.hypot(...b.meters.map((v, j) => v - a.meters[j]));
      const speed = finiteResult(d * 1000000 / (b.timestampUs - a.timestampUs), "speedMps");
      totalMeters = finiteResult(totalMeters + d, "totalDistanceM");
      segments.push({ fromTimestampUs: a.timestampUs, toTimestampUs: b.timestampUs, distanceMeters: d, speedMetersPerSecond: speed });
    }
    const durationSeconds = (points[points.length-1].timestampUs - points[0].timestampUs) / 1000000;
    out.motion = { sampleCount: points.length, segmentCount: segments.length, totalDistanceMeters: totalMeters,
      elapsedSeconds: durationSeconds, averageSpeedMetersPerSecond: finiteResult(totalMeters / durationSeconds, "averageSpeedMps"), segments,
      unit: "m", sourceFrameId, referenceFrameId: destinationFrameId };
    inputsForHash.frame = {
      unit: frame.unit, handedness: frame.handedness, upAxis: frame.upAxis,
      frameId: sourceFrameId, targetFrameId: destinationFrameId,
      transform: frame.transform ? {
        translationMeters: vector(frame.transform.translationMeters, "frame.transform.translationMeters"),
        rotationXYZW: frame.transform.rotationXYZW.map((x) => x),
        uniformScale: frame.transform.uniformScale
      } : null
    };
    inputsForHash.samples = points.map((p) => ({ timestampUs: p.timestampUs, confidence: p.confidence, meters: p.meters }));
    inputsForHash.confidenceFloor = confidenceFloor;
    if (req.media) {
      const m = object(req.media, "media");
      const startUs = number(m.startTimestampUs, "media.startTimestampUs", { min: 0, max: MAX_SAFE_MICROSECONDS, integer: true });
      const numerator = number(m.rateNumerator, "media.rateNumerator", { min: 1, max: 1000000, integer: true });
      const denominator = number(m.rateDenominator, "media.rateDenominator", { min: 1, max: 1000000, integer: true });
      out.media = { rate: { numerator, denominator }, frameIndices: points.map((p) => frameIndexAtTimestamp(p.timestampUs, startUs, numerator, denominator)), frameIndexRule: "floor_exact_rational_non_drop_frame" };
      inputsForHash.media = { startTimestampUs: startUs, rateNumerator: numerator, rateDenominator: denominator };
    }
  } else if (req.media !== undefined) {
    throw new MeasurementInputError("samples", "samples_required_for_timeline");
  }
  if (req.job !== undefined) {
    out.job = estimateBoxJob(req.job);
    inputsForHash.job = {
      length: req.job.length, width: req.job.width, height: req.job.height,
      lengthUnit: req.job.lengthUnit, wastePercent: req.job.wastePercent,
      materialPricePerCubicMeter: req.job.materialPricePerCubicMeter,
      laborHours: req.job.laborHours, loadedLaborPricePerHour: req.job.loadedLaborPricePerHour,
      otherCost: req.job.otherCost, currency: out.job.currency
    };
  }
  if (!out.motion && !out.job) throw new MeasurementInputError("request", "nothing_to_calculate");
  out.evidence = { origin: source.origin, reference: sourceRef, digestAlgorithm: "sha256",
    inputDigest: createHash("sha256").update(JSON.stringify(inputsForHash)).digest("hex"),
    assumptions: ["explicit_length_units", "right_handed_y_up", "no_external_provider_access", "calibrated_measured_inputs_required"] };
  return out;
}
function tryRunMeasurementPipeline(input) {
  try { return runMeasurementPipeline(input); }
  catch (error) {
    if (!(error instanceof MeasurementInputError)) throw error;
    return { ok: false, code: error.code, key: error.key, message: error.message };
  }
}
module.exports = {
  PIPELINE_VERSION, LENGTH_TO_METERS, MeasurementInputError,
  lengthMeters, speedMetersPerSecond, transformPointMeters, frameIndexAtTimestamp,
  estimateBoxJob, runMeasurementPipeline, tryRunMeasurementPipeline
};
