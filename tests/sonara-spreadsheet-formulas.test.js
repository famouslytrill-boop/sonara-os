// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert=require("node:assert/strict");
const {validateSchema,calculateRow,calculateRows}=require("../lib/sonara-spreadsheet-formulas.cjs");
const schema={
  columns:[
    {key:"quantity",type:"integer"},{key:"unit_cents",type:"cents"},
    {key:"tax_bps",type:"basis_points"},{key:"start_date",type:"date"},
    {key:"end_date",type:"date"},{key:"note",type:"text"}
  ],
  formulas:[
    {output:"subtotal_cents",op:"quantity_x_unit_cents",inputs:["quantity","unit_cents"]},
    {output:"tax_cents",op:"basis_points_of_cents",inputs:["subtotal_cents","tax_bps"],rounding:"ceil"},
    {output:"days",op:"days_between",inputs:["start_date","end_date"]}
  ]
};
describe("deterministic spreadsheet formulas",()=>{
  it("validates an explicit typed schema and named formula operations",()=>{
    const out=validateSchema(schema);
    assert.equal(out.columns.size,6);
    assert.equal(out.formulas.length,3);
  });
  it("computes money in integer cents with explicit tax rounding",()=>{
    const out=calculateRow(schema,{quantity:3,unit_cents:999,tax_bps:725,
      start_date:"2026-10-01",end_date:"2026-10-06",note:"job"});
    assert.equal(out.values.subtotal_cents,2997);
    assert.equal(out.values.tax_cents,218);
    assert.equal(out.values.days,5);
    assert.equal(out.executableSpreadsheetFormulaProduced,false);
    assert.equal(out.macrosAllowed,false);
  });
  it("does not use JavaScript eval or spreadsheet formulas as input",()=>{
    assert.throws(()=>validateSchema({columns:[{key:"x",type:"cents"}],
      formulas:[{output:"y",op:"eval",inputs:["x"]}]}),/invalid_formula_definition/);
  });
  it("requires an explicit rounding rule for basis-point money math",()=>{
    assert.throws(()=>validateSchema({columns:[{key:"x",type:"cents"},{key:"r",type:"basis_points"}],
      formulas:[{output:"y",op:"basis_points_of_cents",inputs:["x","r"]}]}),
      /explicit_rounding_required/);
  });
  it("rejects duplicate and unknown columns",()=>{
    assert.throws(()=>validateSchema({columns:[{key:"x",type:"text"},{key:"x",type:"text"}]}),
      /invalid_or_duplicate_column/);
    assert.throws(()=>validateSchema({columns:[{key:"x",type:"javascript"}]}),
      /unsupported_column_type/);
  });
  it("keeps missing cells null instead of inventing zero",()=>{
    const out=calculateRow(schema,{quantity:3,unit_cents:null,tax_bps:725,
      start_date:"2026-10-01",end_date:"2026-10-06"});
    assert.equal(out.values.unit_cents,null);
    assert.equal(out.values.subtotal_cents,null);
    assert.equal(out.values.tax_cents,null);
  });
  it("rejects impossible date order",()=>{
    assert.throws(()=>calculateRow(schema,{quantity:1,unit_cents:1,tax_bps:0,
      start_date:"2026-10-06",end_date:"2026-10-01"}),/end_before_start/);
  });
  it("does not silently truncate a too-large sheet",()=>{
    const rows=Array.from({length:3},()=>({quantity:1,unit_cents:100,tax_bps:0,
      start_date:"2026-10-01",end_date:"2026-10-01"}));
    const out=calculateRows(schema,rows,{limit:2});
    assert.equal(out.ok,false);
    assert.equal(out.code,"row_limit_exceeded");
    assert.equal(out.rowCount,3);
    assert.equal(out.calculated.length,0);
  });
  it("refuses overflow rather than silently losing cent precision",()=>{
    const big={columns:[{key:"q",type:"integer"},{key:"u",type:"cents"}],
      formulas:[{output:"t",op:"quantity_x_unit_cents",inputs:["q","u"]}]};
    assert.throws(()=>calculateRow(big,{q:Number.MAX_SAFE_INTEGER,u:2}),/spreadsheet_value_overflow/);
  });
  it("supports negative calculated margins without allowing invalid typed rates",()=>{
    const margin={columns:[{key:"revenue",type:"cents"},{key:"cost",type:"cents"}],
      formulas:[{output:"margin",op:"subtract_cents",inputs:["revenue","cost"]}]};
    assert.equal(calculateRow(margin,{revenue:100,cost:250}).values.margin,-150);
    assert.throws(()=>calculateRow(schema,{quantity:1,unit_cents:100,tax_bps:-1,
      start_date:"2026-10-01",end_date:"2026-10-01"}),/invalid_tax_bps/);
  });
});
