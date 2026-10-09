// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deliberately narrow, read-only ASCII DXF geometry intake.
// Do not turn a partial drawing into a claimed complete quantity takeoff.
// Unknown ENTITIES, transformations, curves and unitless drawings fail closed.
const { createHash } = require("node:crypto");
const { LENGTH_TO_METERS } = require("./sonara-measurement-pipeline.cjs");

const MAX_CHARS = 524288;
const MAX_PAIRS = 30000;
const MAX_ENTITIES = 1024;
const MAX_VERTICES = 2048;
const INSUNITS = Object.freeze({
  1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m", 7: "km",
  10: "yd", 21: "us_survey_ft"
});
class DxfIntakeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DxfIntakeError";
    this.code = code;
  }
}
function fail(code, message) { throw new DxfIntakeError(code, message); }
function numeric(value) {
  if (typeof value !== "string" || !value.trim()) fail("invalid_coordinate", "Missing DXF numeric value");
  const valueNumber = Number(value);
  if (!Number.isFinite(valueNumber) || Math.abs(valueNumber) > 1e8) {
    fail("invalid_coordinate", "DXF coordinate must be finite and bounded");
  }
  return valueNumber;
}
function groupPairs(text) {
  if (typeof text !== "string" || !text.length || text.length > MAX_CHARS) fail("invalid_payload", "ASCII DXF exceeds text limits");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) fail("invalid_payload", "Binary DXF or control characters unsupported");
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = cleaned.split("\n");
  if (lines[lines.length-1] === "") lines.pop();
  if (lines.length % 2 || lines.length / 2 > MAX_PAIRS) fail("invalid_pairs", "DXF requires bounded group-code/value pairs");
  return Array.from({length: lines.length/2}, (_,i) => {
    const code = lines[2*i].trim();
    if (!/^-?\d{1,3}$/.test(code)) fail("invalid_group", "DXF contains a nonnumeric group code");
    return { code: Number(code), value: lines[2*i+1].trim() };
  });
}
function one(props, code, required=false) {
  const matches=props.filter(x=>x.code===code);
  if (matches.length>1) fail("ambiguous_geometry", `Repeated geometry code ${code}`);
  if (!matches.length) {
    if(required) fail("missing_geometry", `Missing geometry code ${code}`);
    return undefined;
  }
  return numeric(matches[0].value);
}
function extrusionSafe(props) {
  const x=one(props,210),y=one(props,220),z=one(props,230);
  if ((x!==undefined && x!==0) || (y!==undefined && y!==0) || (z!==undefined && z!==1)) {
    fail("unsupported_transform", "Extruded or non-default OCS geometry requires a full CAD adapter");
  }
  if ((one(props,67)||0)!==0) fail("unsupported_space", "Paper-space entities cannot be measured as model-space lengths");
  const layouts=props.filter(p=>p.code===410);
  if(layouts.some(p=>p.value!=="Model")) fail("unsupported_space", "Non-model layouts are not supported");
  if ((one(props,39)||0)!==0) fail("unsupported_geometry", "DXF entity thickness not supported");
}
function parseLine(props) {
  extrusionSafe(props);
  const p=[one(props,10,true),one(props,20,true),one(props,30)||0];
  const q=[one(props,11,true),one(props,21,true),one(props,31)||0];
  return [p,q];
}
function parsePolyline(props) {
  extrusionSafe(props);
  if ((one(props,38)||0)!==0) fail("unsupported_geometry", "Elevated OCS polylines are not supported");
  const flags=one(props,70)||0;
  if (!Number.isSafeInteger(flags) || flags<0 || (flags & ~129)!==0) fail("unsupported_geometry", "Unsupported LWPOLYLINE flags");
  for(const p of props) {
    if ([40,41,42,43].includes(p.code) && numeric(p.value)!==0) {
      fail("unsupported_geometry", "Curved or variable-width polylines require a complete CAD interpreter");
    }
  }
  const coords=[];
  let current=null;
  for(const p of props) {
    if(p.code===10) {
      if(current && current.y===undefined) fail("missing_geometry", "Polyline vertex lacks Y coordinate");
      current={x:numeric(p.value)};
      coords.push(current);
    } else if(p.code===20) {
      if(!current || current.y!==undefined) fail("ambiguous_geometry", "Misordered or repeated polyline Y coordinate");
      current.y=numeric(p.value);
    }
  }
  const count=one(props,90,true);
  if (!Number.isSafeInteger(count) || count<2 || count>MAX_VERTICES || coords.length!==count ||
      coords.some(c=>c.y===undefined)) {
    fail("invalid_vertices", "LWPOLYLINE declared vertex count differs from complete X/Y pairs");
  }
  const points=coords.map(c=>[c.x,c.y,0]);
  if(flags&1) points.push(points[0]);
  return points;
}
function parseAsciiDxf(text) {
  const pairs=groupPairs(text);
  let section=null,headerSeen=false,entitiesSeen=false,eof=false,insunits=null;
  let entities=0,segments=0,polylineCount=0,lineCount=0,total=0,vertices=0;
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  const addGeometry=(points) => {
    vertices+=points.length;
    if(vertices>MAX_VERTICES) fail("limit_exceeded", "DXF point limit exceeded");
    const scale=LENGTH_TO_METERS[insunits];
    for(const point of points) for(let j=0;j<3;j++){
      const converted=point[j]*scale;
      if(!Number.isFinite(converted)) fail("result_overflow", "Geometry exceeds numeric precision");
      bounds.min[j]=Math.min(bounds.min[j],converted);
      bounds.max[j]=Math.max(bounds.max[j],converted);
    }
    for(let j=1;j<points.length;j++) {
      const dist=Math.hypot(...points[j].map((v,k)=>(v-points[j-1][k])*scale));
      total+=dist;segments++;
      if(!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER) fail("result_overflow","Total length out of supported bounds");
    }
  };
  for(let i=0;i<pairs.length;) {
    const pair=pairs[i];
    if(eof) fail("malformed_structure", "DXF has content after EOF");
    if(pair.code===0 && pair.value==="SECTION") {
      if(section || i+1>=pairs.length || pairs[i+1].code!==2) fail("malformed_structure","Invalid section delimiter");
      section=pairs[i+1].value;
      if(section==="HEADER"){if(headerSeen)fail("malformed_structure","Repeated HEADER section");headerSeen=true;}
      if(section==="ENTITIES"){if(entitiesSeen)fail("malformed_structure","Repeated ENTITIES section");entitiesSeen=true;}
      i+=2;continue;
    }
    if(pair.code===0 && pair.value==="ENDSEC") {
      if(!section)fail("malformed_structure","ENDSEC without SECTION");
      section=null;i++;continue;
    }
    if(pair.code===0 && pair.value==="EOF") {
      if(section)fail("malformed_structure","EOF before ENDSEC");
      eof=true;i++;continue;
    }
    if(!section) fail("malformed_structure", "Group outside a SECTION");
    if(section==="HEADER" && pair.code===9 && pair.value==="$INSUNITS") {
      if(insunits!==null || !pairs[i+1] || pairs[i+1].code!==70) fail("ambiguous_units","Malformed or duplicated INSUNITS");
      const unit=Number(pairs[i+1].value);
      if(!Number.isSafeInteger(unit) || !Object.hasOwn(INSUNITS,unit)) fail("unsupported_unit","DXF drawing units unspecified or unsupported");
      insunits=INSUNITS[unit];i+=2;continue;
    }
    if(section==="ENTITIES" && pair.code===0) {
      if(insunits===null) fail("missing_units","DXF HEADER must specify supported INSUNITS before ENTITIES");
      const kind=pair.value;
      if(kind!=="LINE" && kind!=="LWPOLYLINE") fail("unsupported_entity",`DXF entity ${kind} requires specialized handling`);
      let end=i+1;
      while(end<pairs.length && pairs[end].code!==0)end++;
      const props=pairs.slice(i+1,end);
      entities++;
      if(entities>MAX_ENTITIES)fail("limit_exceeded","DXF entity limit exceeded");
      if(kind==="LINE"){addGeometry(parseLine(props));lineCount++;}
      else {addGeometry(parsePolyline(props));polylineCount++;}
      i=end;continue;
    }
    i++;
  }
  if(!eof || !headerSeen || !entitiesSeen || insunits===null) fail("malformed_structure","DXF requires HEADER, ENTITIES, INSUNITS and EOF");
  if(entities===0) fail("empty_geometry","No supported model-space geometry present");
  return {
    ok:true, format:"ASCII_DXF_LIMITED", parserVersion:"2026-10-09.1",
    sourceUnit:insunits, canonicalUnit:"m", entityCount:entities,
    lineCount, polylineCount, segmentCount:segments,
    totalLengthMeters:total, boundsMeters:bounds,
    evidence:{ digestAlgorithm:"sha256", sourceDigest:createHash("sha256").update(text.replace(/\r\n?/g,"\n")).digest("hex"),
      scope:"only_explicit_supported_model_space_straight_line_geometry",
      warnings:["not_a_complete_CAD_takeoff","no_import_export_or_autocad_execution"] }
  };
}
function tryParseAsciiDxf(text) {
  try { return parseAsciiDxf(text); }
  catch(error) {
    if(!(error instanceof DxfIntakeError))throw error;
    return {ok:false,code:error.code,message:error.message};
  }
}
module.exports={parseAsciiDxf,tryParseAsciiDxf,DxfIntakeError,INSUNITS};
