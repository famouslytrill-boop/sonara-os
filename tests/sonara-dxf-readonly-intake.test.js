"use strict";
const assert=require("node:assert/strict");
const {parseAsciiDxf,tryParseAsciiDxf,INSUNITS}=require("../lib/sonara-dxf-readonly-intake.cjs");

function dxf(units=4,entities=[],extraHeader=[]) {
  const pairs=[
    [0,"SECTION"],[2,"HEADER"],[9,"$INSUNITS"],[70,units],...extraHeader,
    [0,"ENDSEC"],[0,"SECTION"],[2,"ENTITIES"],...entities,
    [0,"ENDSEC"],[0,"EOF"]
  ];
  return pairs.flat().join("\n")+"\n";
}
const line=[
  [0,"LINE"],[8,"0"],[10,0],[20,0],[30,0],
  [11,3000],[21,4000],[31,0]
];
const poly=[
  [0,"LWPOLYLINE"],[90,3],[70,1],
  [10,0],[20,0],[10,1000],[20,0],[10,1000],[20,1000]
];
const flat=(...items)=>items.flat(1);
function refused(text,code){
  const result=tryParseAsciiDxf(text);
  assert.equal(result.ok,false,JSON.stringify(result));
  assert.equal(result.code,code,JSON.stringify(result));
}
function close(a,b){assert.ok(Math.abs(a-b)<1e-9,`expected ${b} got ${a}`);}

describe("strict read-only ASCII DXF subset",()=>{
  it("measures supported LINE and closed straight LWPOLYLINE with explicit millimeter conversion",()=>{
    const result=parseAsciiDxf(dxf(4,flat(...line,...poly)));
    assert.equal(result.entityCount,2);
    assert.equal(result.lineCount,1);
    assert.equal(result.polylineCount,1);
    assert.equal(result.segmentCount,4);
    assert.equal(result.sourceUnit,"mm");
    close(result.totalLengthMeters,5+1+1+Math.sqrt(2));
    assert.deepEqual(result.boundsMeters.min,[0,0,0]);
    assert.deepEqual(result.boundsMeters.max,[3,4,0]);
    assert.match(result.evidence.sourceDigest,/^[0-9a-f]{64}$/);
    assert.equal(result.evidence.scope,"only_explicit_supported_model_space_straight_line_geometry");
  });
  it("distinguishes international feet from historical US survey feet",()=>{
    assert.equal(INSUNITS[2],"ft");
    assert.equal(INSUNITS[21],"us_survey_ft");
    const geometry=flat(...line);
    const foot=parseAsciiDxf(dxf(2,geometry)).totalLengthMeters;
    const survey=parseAsciiDxf(dxf(21,geometry)).totalLengthMeters;
    close(foot,5000*0.3048);
    close(survey,5000*1200/3937);
    assert.notEqual(foot,survey);
  });
  it("fails on unknown, unitless or missing drawing units",()=>{
    refused(dxf(0,flat(...line)),"unsupported_unit");
    refused(dxf(23,flat(...line)),"unsupported_unit");
    refused(dxf(4,flat(...line),[[9,"$INSUNITS"],[70,6]]),"ambiguous_units");
    refused(dxf(4,flat(...line)).replace("9\n$INSUNITS\n70\n4\n",""),"missing_units");
  });
  it("fails closed on unrecognized drawing primitives including arcs, circles and inserted blocks",()=>{
    for(const kind of ["ARC","CIRCLE","INSERT","SPLINE","HATCH","TEXT","3DFACE"]) {
      refused(dxf(4,flat(...line,[0,kind])),"unsupported_entity");
    }
  });
  it("refuses curved or variable-width polylines instead of mismeasuring as straight segments",()=>{
    for(const [code,value] of [[42,0.5],[43,3],[40,1],[41,1]]) {
      refused(dxf(4,flat(...poly,[code,value])),"unsupported_geometry");
    }
    refused(dxf(4,flat(...poly,[38,1])),"unsupported_geometry");
    refused(dxf(4,flat(...poly,[70,4])),"ambiguous_geometry");
  });
  it("rejects ambiguous vertex counts, Y-before-X and repeated geometry codes",()=>{
    const badCount=poly.map(x=>x[0]===90?[90,4]:x);
    refused(dxf(4,flat(...badCount)),"invalid_vertices");
    refused(dxf(4,flat(
      [0,"LWPOLYLINE"],[90,2],[20,0],[10,0],[10,1],[20,1]
    )),"ambiguous_geometry");
    refused(dxf(4,flat(...line,[10,100])),"ambiguous_geometry");
  });
  it("refuses unknown sections, hidden geometry and out-of-order drawing contents",()=>{
    refused(dxf(4,flat(...line)).replace(
      "0\\nSECTION\\n2\\nENTITIES\\n",
      "0\\nSECTION\\n2\\nTABLES\\n0\\nENDSEC\\n0\\nSECTION\\n2\\nENTITIES\\n"
    ),"unsupported_section");
    refused(dxf(4,flat(...line,[60,1])),"unsupported_visibility");
    refused(dxf(4,flat(...line,[62,-1])),"unsupported_visibility");
    const correct=dxf(4,flat(...line));
    const header="0\\nSECTION\\n2\\nHEADER\\n9\\n$INSUNITS\\n70\\n4\\n0\\nENDSEC\\n";
    const entities="0\\nSECTION\\n2\\nENTITIES\\n"+flat(...line).join("\\n")+"\\n0\\nENDSEC\\n";
    refused(entities+header+"0\\nEOF\\n","malformed_structure");
  });

  it("rejects paper-space geometry, nonstandard extrusions and malformed file structure",()=>{
    refused(dxf(4,flat(...line,[67,1])),"unsupported_space");
    refused(dxf(4,flat(...line,[210,1])),"unsupported_transform");
    refused(dxf(4,flat(...line,[410,"Layout1"])),"unsupported_space");
    refused(dxf(4,flat(...line)).replace("0\nEOF\n",""),"malformed_structure");
    refused(dxf(4,flat(...line))+"0\nLINE\n","malformed_structure");
    refused("Binary\u0000DXF","invalid_payload");
  });
});
