"use strict";

const assert = require("node:assert/strict");
const {
  PIPELINE_VERSION, LENGTH_TO_METERS, lengthMeters, speedMetersPerSecond,
  transformPointMeters, frameIndexAtTimestamp, estimateBoxJob,
  runMeasurementPipeline, tryRunMeasurementPipeline
} = require("../lib/sonara-measurement-pipeline.cjs");
const { evaluateFormula } = require("../lib/sonara-formula-library.cjs");

const FRAME = { unit: "ft", handedness: "right", upAxis: "Y", frameId: "model-reference-01" };
const samples = () => [
  { timestampUs: 1000000, position: { x: 0, y: 0, z: 0 }, confidence: 0.9 },
  { timestampUs: 2000000, position: { x: 3, y: 4, z: 0 }, confidence: 0.95 }
];
const job = () => ({
  length: 10, width: 10, height: 0.5, lengthUnit: "ft",
  wastePercent: 8, materialPricePerCubicMeter: 200,
  laborHours: 5, loadedLaborPricePerHour: 50, otherCost: 100, currency: "USD"
});
const motion = () => ({
  schemaVersion: 1, mode: "motion", source: { origin: "manual", reference: "qa-001" },
  frame: { ...FRAME }, confidenceFloor: 0.8, samples: samples()
});
const quote = () => ({
  schemaVersion: 1, mode: "trade", source: { origin: "manual", reference: "estimate-001" },
  job: job()
});
function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
}
function refused(input, code) {
  const r = tryRunMeasurementPipeline(input);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.code, code, JSON.stringify(r));
}

describe("SONARA versioned engineering measurement pipeline", () => {
  it("has stable version, exact international unit factors, and separate historical survey foot", () => {
    assert.match(PIPELINE_VERSION, /^2026-/);
    assert.equal(LENGTH_TO_METERS.ft, 0.3048);
    assert.equal(LENGTH_TO_METERS.in, 0.0254);
    close(LENGTH_TO_METERS.us_survey_ft, 1200/3937);
    assert.notEqual(LENGTH_TO_METERS.us_survey_ft, LENGTH_TO_METERS.ft);
    close(lengthMeters({x: 3,y:4,z:0}, "ft"), 1.524);
    close(speedMetersPerSecond({x:3,y:4,z:0}, "ft", 2), 0.762);
  });

  it("applies glTF-style scale then quaternion rotation then translation to world meters", () => {
    const p = transformPointMeters({x:1,y:0,z:0}, {
      unit:"m", handedness:"right",upAxis:"Y",frameId:"rig-01",
      transform:{ uniformScale:2, rotationXYZW:[0,0,Math.SQRT1_2,Math.SQRT1_2],
        translationMeters:{x:1,y:2,z:3} }
    });
    close(p[0], 1); close(p[1], 4); close(p[2], 3);
    assert.deepEqual(transformPointMeters({x:5,y:0,z:0}, FRAME), [1.524,0,0]);
  });

  it("aligns timestamps at rational frame rates without 29.97 float drift", () => {
    assert.equal(frameIndexAtTimestamp(1000000,0,30000,1001),29);
    assert.equal(frameIndexAtTimestamp(1001000,0,30000,1001),30);
    assert.equal(frameIndexAtTimestamp(1001000,1001000,30000,1001),0);
    assert.equal(frameIndexAtTimestamp(0,0,24,1),0);
    assert.equal(frameIndexAtTimestamp(500000,0,24,1),12);
  });

  it("builds auditable motion segments with user-supplied confidence and no made-up frame metadata", () => {
    const one = runMeasurementPipeline(motion());
    assert.equal(one.ok,true);
    assert.equal(one.motion.sampleCount,2);
    assert.equal(one.motion.segmentCount,1);
    close(one.motion.totalDistanceMeters,1.524);
    close(one.motion.averageSpeedMetersPerSecond,1.524);
    assert.equal(one.motion.referenceFrameId,"model-reference-01");
    assert.equal(one.media,undefined);
    assert.match(one.evidence.inputDigest,/^[0-9a-f]{64}$/);
    assert.deepEqual(one.evidence.assumptions.includes("calibrated_measured_inputs_required"),true);
  });

  it("crosses motion, fractional frame rates and unit-aware job economics in one deterministic plan", () => {
    const input = {...motion(), mode:"combined", media:{
      rateNumerator:30000,rateDenominator:1001,startTimestampUs:1000000
    },job:job()};
    const one=runMeasurementPipeline(input),two=runMeasurementPipeline(input);
    assert.equal(one.evidence.inputDigest,two.evidence.inputDigest);
    assert.deepEqual(one.media.frameIndices,[0,29]);
    close(one.job.netVolumeM3,50*0.3048**3);
    close(one.job.orderedVolumeM3,50*0.3048**3*1.08);
    close(one.job.materialCost,50*0.3048**3*1.08*200);
    assert.equal(one.job.laborCost,250);
    close(one.job.estimatedTotal,50*0.3048**3*1.08*200+350);
    assert.equal(one.job.currency,"USD");
    assert.equal(one.job.basis,"ideal_rectangular_volume_and_entered_costs_not_a_quote");
  });

  it("supports cost-only CAD and trade plans without guessing geometry or pay rates", () => {
    const t=runMeasurementPipeline(quote());
    assert.equal(t.mode,"trade");
    assert.equal(t.motion,undefined);
    close(estimateBoxJob(job()).estimatedTotal,t.job.estimatedTotal);
    const c=runMeasurementPipeline({...quote(),mode:"cad"});
    close(c.job.netVolumeM3,t.job.netVolumeM3);
  });

  it("refuses inconsistent coordinate frames, invalid quaternions and implicit units", () => {
    refused({...motion(),frame:{...FRAME,unit:"unitless"}},"unsupported_unit");
    refused({...motion(),frame:{...FRAME,handedness:"left"}},"unsupported_frame");
    refused({...motion(),frame:{...FRAME,upAxis:"Z"}},"unsupported_frame");
    refused({...motion(),frame:{...FRAME,transform:{
      uniformScale:1,rotationXYZW:[0,0,0,0],translationMeters:{x:0,y:0,z:0}
    }}},"invalid_rotation");
    refused({...quote(),job:{...job(),lengthUnit:"drawing_units"}},"unsupported_unit");
  });

  it("refuses low-quality tracking, duplicate timestamps, invalid rates and excessive samples", () => {
    refused({...motion(),confidenceFloor:0.95},"insufficient_tracking_quality");
    refused({...motion(),samples:[samples()[0],{...samples()[1],timestampUs:1000000}]},"non_monotonic_time");
    refused({...motion(),samples:[]}, "invalid_sample_count");
    refused({...motion(),samples:Array.from({length:129},(_,i)=>({
      timestampUs:i,position:{x:0,y:0,z:0},confidence:1
    }))},"invalid_sample_count");
    refused({...motion(),mode:"media",media:{
      startTimestampUs:3000000,rateNumerator:30000,rateDenominator:1001
    }},"before_media_start");
    refused({...motion(),mode:"media",media:{
      startTimestampUs:0,rateNumerator:0,rateDenominator:1
    }},"invalid_measurement");
    refused({...motion(),samples:[samples()[0],{...samples()[1],confidence:NaN}]},"invalid_measurement");
  });

  it("refuses contradictions in request mode, missing source evidence and unsafe amounts", () => {
    refused({...motion(),mode:"cad"},"mode_inputs_mismatch");
    refused({...motion(),mode:"combined"},"mode_inputs_mismatch");
    refused({...quote(),mode:"media"},"mode_inputs_mismatch");
    refused({...quote(),source:{origin:"unverified_provider",reference:"m1"}},"invalid_measurement");
    refused({...quote(),source:{origin:"manual",reference:"../bad"}},"invalid_measurement");
    refused({...quote(),job:{...job(),currency:"usd"}},"invalid_currency");
    refused({...quote(),job:{...job(),wastePercent:-2}},"invalid_measurement");
    refused({...quote(),job:{...job(),loadedLaborPricePerHour:"30"}},"invalid_measurement");
    refused({...quote(),schemaVersion:2},"unsupported_version");
  });

  it("does not hash undeclared fields, retain raw pose images or expose secrets", () => {
    const baseline=runMeasurementPipeline(motion());
    const withUnexpected=runMeasurementPipeline({...motion(),source:{...motion().source,secret:"sk_live_dontstore"},
      samples:samples().map(x=>({...x,hiddenNote:"sk_live_dontstore"})),
      frame:{...FRAME,private_key:"sk_live_dontstore"}});
    assert.equal(baseline.evidence.inputDigest,withUnexpected.evidence.inputDigest);
    assert.equal(JSON.stringify(withUnexpected).includes("sk_live_dontstore"),false);
  });

  it("reuses the measurement primitives in the existing customer formula catalog", () => {
    const cad=evaluateFormula("cad_distance_3d_mm",{delta_x:3,delta_y:4,delta_z:12});
    assert.equal(cad.ok,true);
    close(cad.resultValue,13);
    const mocap=evaluateFormula("mocap_marker_speed_mps",{
      displacement_x:3,displacement_y:4,displacement_z:0,elapsed_seconds:2
    });
    assert.equal(mocap.ok,true);
    close(mocap.resultValue,2.5);
  });
});
