"use strict";
const assert=require("node:assert/strict");
const { parsePoseWorldLandmarks,tryParsePoseWorldLandmarks,LANDMARK_COUNT }=require("../lib/sonara-pose-world-readonly-intake.cjs");
const basePoint=()=>({x:0,y:0,z:0,visibility:1});
const frame=(time=0)=>{
  const landmarks=Array.from({length:LANDMARK_COUNT},basePoint);
  landmarks[11]={x:1,y:0,z:0,visibility:0.99};
  landmarks[13]={x:0,y:0,z:0,visibility:0.99};
  landmarks[15]={x:0,y:1,z:0,visibility:0.99};
  return {timestampUs:time,landmarks};
};
const sample=()=>({
  schemaVersion:1,coordinateSpace:"mediapipe_pose_world_meters_hip_centered",
  source:{origin:"manual_export",reference:"clip-a-01"},jointIndices:[11,13,15],
  minVisibility:0.8,frames:[frame(0),frame(1000000)],
  timeline:{startTimestampUs:0,rateNumerator:30000,rateDenominator:1001}
});
function refused(request,code){
  const r=tryParsePoseWorldLandmarks(request);
  assert.equal(r.ok,false,JSON.stringify(r));
  assert.equal(r.code,code,JSON.stringify(r));
}

describe("read-only calibrated hip-centered world pose landmark adapter",()=>{
  it("evaluates joint angle at the middle landmark using existing formula library",()=>{
    const output=parsePoseWorldLandmarks(sample());
    assert.equal(output.ok,true);
    assert.equal(output.unit,"degrees");
    assert.deepEqual(output.jointIndices,[11,13,15]);
    assert.equal(output.frameCount,2);
    assert.equal(output.validFrameCount,2);
    assert.equal(output.invalidFrameCount,0);
    assert.equal(output.validCoveragePercent,100);
    assert.deepEqual(output.measurements.map(x=>x.angleDegrees),[90,90]);
    assert.deepEqual(output.measurements.map(x=>x.frameIndex),[0,29]);
    assert.match(output.evidence.inputDigest,/^[0-9a-f]{64}$/);
    assert.ok(output.evidence.limitations.includes("hip_relative_not_global_motion"));
  });
  it("makes low visibility and degenerate vectors explicit rather than zero-angle guesses",()=>{
    const low=sample();low.frames[1].landmarks[11].visibility=0.3;
    const one=parsePoseWorldLandmarks(low);
    assert.equal(one.validFrameCount,1);
    assert.equal(one.invalidFrameCount,1);
    assert.equal(one.validCoveragePercent,50);
    assert.equal(one.measurements[1].angleDegrees,null);
    assert.equal(one.measurements[1].status,"low_visibility");
    const degenerate=sample();degenerate.frames[1].landmarks[11]={...degenerate.frames[1].landmarks[13]};
    const two=parsePoseWorldLandmarks(degenerate);
    assert.equal(two.measurements[1].status,"degenerate_vectors");
    assert.equal(two.measurements[1].angleDegrees,null);
  });
  it("refuses 2D normalized image landmarks as if they were metric 3D",()=>{
    refused({...sample(),coordinateSpace:"mediapipe_pose_image_normalized"},"unsupported_coordinate_space");
    refused({...sample(),coordinateSpace:undefined},"unsupported_coordinate_space");
  });
  it("refuses invalid timestamps, unbounded frames and malformed landmark arrays",()=>{
    const duplicate=sample();duplicate.frames[1].timestampUs=0;
    refused(duplicate,"non_monotonic_timestamps");
    const wrong=sample();wrong.frames[0].landmarks.pop();
    refused(wrong,"invalid_landmark_count");
    const many=sample();many.frames=Array.from({length:129},(_,i)=>frame(i));
    refused(many,"invalid_frame_count");
    const negative=sample();negative.frames[0].landmarks[3].visibility=-0.1;
    refused(negative,"invalid_input");
    const nan=sample();nan.frames[0].landmarks[3].x=NaN;
    refused(nan,"invalid_input");
  });
  it("rejects invalid joint configuration and implausible source tokens",()=>{
    refused({...sample(),jointIndices:[11,11,15]},"invalid_joint");
    refused({...sample(),jointIndices:[11,13,100]},"invalid_input");
    refused({...sample(),jointIndices:[11,13]},"invalid_joint");
    refused({...sample(),source:{origin:"unknown_camera",reference:"clip-a-01"}},"invalid_source");
    refused({...sample(),source:{origin:"manual_export",reference:"../../secret"}},"invalid_input");
    refused({...sample(),schemaVersion:2},"unsupported_version");
  });
  it("returns no original landmarks, images, or unvalidated secret properties",()=>{
    const original=sample();
    original.source.secret="sk_secret_reference";
    original.frames[0].landmarks[0].rawFrame="privateFrameData";
    const parsed=parsePoseWorldLandmarks(original);
    const encoded=JSON.stringify(parsed);
    assert.equal(encoded.includes("sk_secret_reference"),false);
    assert.equal(encoded.includes("privateFrameData"),false);
    assert.equal(encoded.includes("landmarks"),true); // format name only
    assert.equal(parsed.measurements[0].angleDegrees,90);
  });
  it("allows valid one-frame analysis without claiming motion speed",()=>{
    const one=sample();one.frames=[frame(5000)];delete one.timeline;
    const parsed=parsePoseWorldLandmarks(one);
    assert.equal(parsed.frameCount,1);
    assert.equal(parsed.measurements[0].frameIndex,null);
    assert.equal(parsed.measurements[0].angleDegrees,90);
    assert.equal(Object.hasOwn(parsed,"speedMetersPerSecond"),false);
  });
});
