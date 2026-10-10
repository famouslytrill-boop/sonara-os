"use strict";
const assert=require("node:assert/strict");
const {linearMaterialEstimate,tryLinearMaterialEstimate}=require("../lib/sonara-cad-linear-estimate.cjs");
const fixture=(kind="LINE")=>[
  0,"SECTION",2,"HEADER",9,"$INSUNITS",70,6,0,"ENDSEC",
  0,"SECTION",2,"ENTITIES",0,kind,10,0,20,0,11,3,21,4,
  0,"ENDSEC",0,"EOF"
].join("\n")+"\n";
function quote(overrides={}){return {
  dxfText:fixture(),materialCostPerMeter:20,wastePercent:10,
  laborHours:2,loadedLaborCostPerHour:50,otherCosts:25,currency:"USD",...overrides
};}
function refused(input,code){
  const r=tryLinearMaterialEstimate(input);
  assert.equal(r.ok,false,JSON.stringify(r));
  assert.equal(r.code,code,JSON.stringify(r));
}
describe("CAD straight-length estimate to cost bridge",()=>{
  it("turns explicit 3-4-5 meter DXF line into measured quantity and non-binding loaded-cost preview",()=>{
    const out=linearMaterialEstimate(quote());
    assert.equal(out.ok,true);
    assert.equal(out.measuredLengthMeters,5);
    assert.equal(out.orderLengthMeters,5.5);
    assert.equal(out.materialCost,110);
    assert.equal(out.laborCost,100);
    assert.equal(out.otherCosts,25);
    assert.equal(out.estimatedTotal,235);
    assert.equal(out.source.sourceUnit,"m");
    assert.match(out.source.digest,/^[0-9a-f]{64}$/);
    assert.equal(Object.hasOwn(out,"dxfText"),false);
  });
  it("refuses unsupported drawing geometry instead of preparing an incomplete quote",()=>{
    refused(quote({dxfText:fixture("ARC")}),"unsupported_entity");
    refused(quote({dxfText:fixture().replace("70\n6\n","70\n0\n")}),"unsupported_unit");
  });
  it("requires explicit currency and actual entered cost rates",()=>{
    refused(quote({currency:"usd"}),"invalid_currency");
    refused(quote({materialCostPerMeter:-1}),"invalid_estimate_input");
    refused(quote({loadedLaborCostPerHour:"50"}),"invalid_estimate_input");
    refused(quote({wastePercent:101}),"invalid_estimate_input");
    refused(quote({laborHours:Infinity}),"invalid_estimate_input");
    refused(quote({otherCosts:1e15}),"invalid_estimate_input");
  });
  it("accepts zero material and zero labor rates without inventing a quote minimum",()=>{
    const out=linearMaterialEstimate(quote({
      materialCostPerMeter:0,wastePercent:0,laborHours:0,
      loadedLaborCostPerHour:0,otherCosts:0
    }));
    assert.equal(out.estimatedTotal,0);
    assert.equal(out.measuredLengthMeters,5);
  });
});
