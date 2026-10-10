// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only MediaPipe pose WORLD landmark intake. Hip-relative coordinates
// cannot establish absolute motion/velocity of the body through a room.
const { createHash } = require("node:crypto");
const { evaluateFormula } = require("./sonara-formula-library.cjs");
const { frameIndexAtTimestamp } = require("./sonara-measurement-pipeline.cjs");

const MAX_FRAMES=128;
const LANDMARK_COUNT=33;
class PoseIntakeError extends Error {
  constructor(code,message){super(message);this.name="PoseIntakeError";this.code=code;}
}
function fail(code,msg){throw new PoseIntakeError(code,msg);}
function finite(raw,key,{min=-10,max=10,integer=false}={}){
  if(typeof raw!=="number" || !Number.isFinite(raw) || raw<min || raw>max ||
    (integer&&!Number.isSafeInteger(raw)))fail("invalid_input",`Invalid ${key}`);
  return raw;
}
function obj(v,key){if(!v||typeof v!=="object"||Array.isArray(v))fail("invalid_input",`Invalid ${key}`);return v;}
function token(v,key){if(typeof v!=="string"||v.length>90||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(v))fail("invalid_input",`Invalid ${key}`);return v;}
function jointIndices(joint) {
  if(!Array.isArray(joint)||joint.length!==3)fail("invalid_joint","Joint requires three distinct integer landmark indices");
  const indices=joint.map((i)=>finite(i,"joint_index",{min:0,max:32,integer:true}));
  if(new Set(indices).size!==3)fail("invalid_joint","Joint landmark indices must be distinct");
  return indices;
}
function parsePoseWorldLandmarks(request) {
  const req=obj(request,"request");
  if(req.schemaVersion!==1)fail("unsupported_version","World-landmark intake requires schemaVersion 1");
  if(req.coordinateSpace!=="mediapipe_pose_world_meters_hip_centered") {
    fail("unsupported_coordinate_space","Only hip-centered world landmarks in meters are accepted; normalized image landmarks are not 3D metric points");
  }
  const source=obj(req.source,"source");
  if(source.origin!=="manual_export"&&source.origin!=="reviewed_provider_export")fail("invalid_source","Unexpected pose-source origin");
  const reference=token(source.reference,"source.reference");
  const indices=jointIndices(req.jointIndices);
  const floor=finite(req.minVisibility,"minVisibility",{min:0,max:1});
  if(!Array.isArray(req.frames)||req.frames.length===0||req.frames.length>MAX_FRAMES)fail("invalid_frame_count","Expected 1-128 world-landmark frames");
  let timeline=null;
  if(req.timeline!==undefined){
    const t=obj(req.timeline,"timeline");
    timeline={
      startTimestampUs:finite(t.startTimestampUs,"timeline.startTimestampUs",{min:0,max:1e15,integer:true}),
      rateNumerator:finite(t.rateNumerator,"timeline.rateNumerator",{min:1,max:1e6,integer:true}),
      rateDenominator:finite(t.rateDenominator,"timeline.rateDenominator",{min:1,max:1e6,integer:true})
    };
  }
  const outputs=[],normalized=[];
  let previousTs=-1;
  for(let i=0;i<req.frames.length;i++){
    const frame=obj(req.frames[i],`frames[${i}]`);
    const ts=finite(frame.timestampUs,`frames[${i}].timestampUs`,{min:0,max:1e15,integer:true});
    if(ts<=previousTs)fail("non_monotonic_timestamps","Frame timestamps must strictly increase");
    previousTs=ts;
    if(!Array.isArray(frame.landmarks)||frame.landmarks.length!==LANDMARK_COUNT) {
      fail("invalid_landmark_count","MediaPipe world pose must contain exactly 33 landmarks per frame");
    }
    // Validate all landmarks; calculate only the three explicitly requested.
    const points=frame.landmarks.map((point,k)=>{
      const p=obj(point,`landmarks[${k}]`);
      return {
        x:finite(p.x,`landmarks[${k}].x`),
        y:finite(p.y,`landmarks[${k}].y`),
        z:finite(p.z,`landmarks[${k}].z`),
        visibility:finite(p.visibility,`landmarks[${k}].visibility`,{min:0,max:1})
      };
    });
    const [a,b,c]=indices.map(index=>points[index]);
    const visibility=Math.min(a.visibility,b.visibility,c.visibility);
    const frameIndex=timeline ? frameIndexAtTimestamp(ts,timeline.startTimestampUs,timeline.rateNumerator,timeline.rateDenominator) : null;
    let status="ok",angleDegrees=null;
    if(visibility<floor){status="low_visibility";}
    else {
      const evaluated=evaluateFormula("mocap_joint_angle_degrees",{
        vector_a_x:a.x-b.x,vector_a_y:a.y-b.y,vector_a_z:a.z-b.z,
        vector_b_x:c.x-b.x,vector_b_y:c.y-b.y,vector_b_z:c.z-b.z
      });
      if(!evaluated.ok){
        if(evaluated.code==="invalid_input")status="degenerate_vectors";
        else fail("formula_execution_failed","Joint-angle formula failed unexpectedly");
      } else angleDegrees=evaluated.resultValue;
    }
    outputs.push({timestampUs:ts,frameIndex,angleDegrees,status,minSelectedVisibility:visibility});
    normalized.push({timestampUs:ts,selected:indices.map(index=>points[index])});
  }
  const valid=outputs.filter(x=>x.status==="ok").length;
  return {
    ok:true,version:"2026-10-09.1",format:"mediapipe_pose_world_landmarks",
    unit:"degrees",coordinateSpace:req.coordinateSpace,
    jointIndices:indices,frameCount:outputs.length,validFrameCount:valid,
    invalidFrameCount:outputs.length-valid,validCoveragePercent:100*valid/outputs.length,
    measurements:outputs,
    evidence:{
      origin:source.origin,reference,
      digestAlgorithm:"sha256",
      inputDigest:createHash("sha256").update(JSON.stringify({
        schemaVersion:1,origin:source.origin,reference,indices,floor,timeline,frames:normalized
      })).digest("hex"),
      limitations:["hip_relative_not_global_motion","no_person_identification","no_sensor_calibration_proof","no_camera_access_or_persistence"]
    }
  };
}
function tryParsePoseWorldLandmarks(req) {
  try{return parsePoseWorldLandmarks(req);}
  catch(error){
    if(!(error instanceof PoseIntakeError))throw error;
    return {ok:false,code:error.code,message:error.message};
  }
}
module.exports={parsePoseWorldLandmarks,tryParsePoseWorldLandmarks,PoseIntakeError,LANDMARK_COUNT};
