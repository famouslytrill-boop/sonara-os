// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Server-side deterministic workbook math. No eval(), no arbitrary Excel
// formulas, no macros, no external links, no volatile functions and no network.
// Export computed VALUES, not executable formulas. Money uses integer cents and
// rates use basis points to avoid floating-point accounting drift.
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
const COLUMN=/^[a-z][a-z0-9_]{0,63}$/;
const OPS=Object.freeze(new Set([
  "sum_cents","subtract_cents","quantity_x_unit_cents",
  "basis_points_of_cents","days_between","copy"
]));
function safe(n){
  if(n>MAX||n<-MAX)throw new Error("spreadsheet_value_overflow");
  return Number(n);
}
function int(value,name,{positive=false,nonnegative=false}={}){
  if(!Number.isSafeInteger(value)||(positive&&value<=0)||(nonnegative&&value<0))
    throw new Error("invalid_"+name);
  return BigInt(value);
}
function isoDay(value,name){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error("invalid_"+name);
  const t=Date.parse(value+"T00:00:00Z");
  if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==value)throw new Error("invalid_"+name);
  return t;
}
function validateSchema(schema){
  if(!schema||typeof schema!=="object"||!Array.isArray(schema.columns)||
     schema.columns.length<1||schema.columns.length>100)throw new Error("invalid_spreadsheet_schema");
  const seen=new Set();
  const columns=new Map();
  for(const col of schema.columns){
    if(!col||!COLUMN.test(col.key||"")||seen.has(col.key))throw new Error("invalid_or_duplicate_column");
    if(!["text","integer","cents","basis_points","date","boolean","source_ref"].includes(col.type))
      throw new Error("unsupported_column_type");
    seen.add(col.key);columns.set(col.key,col);
  }
  const formulas=Array.isArray(schema.formulas)?schema.formulas:[];
  for(const formula of formulas){
    if(!formula||!COLUMN.test(formula.output||"")||seen.has(formula.output)||
       !OPS.has(formula.op)||!Array.isArray(formula.inputs)||formula.inputs.length<1||
       formula.inputs.some(x=>!seen.has(x)))throw new Error("invalid_formula_definition");
    if(formula.op==="basis_points_of_cents"&&!["floor","ceil","nearest"].includes(formula.rounding))
      throw new Error("explicit_rounding_required");
    seen.add(formula.output);
  }
  return Object.freeze({columns,formulas:Object.freeze(formulas.map(x=>Object.freeze({...x,inputs:Object.freeze([...x.inputs])})))});
}
function validateCell(value,type,key){
  if(value===null||value===undefined||value==="")return null;
  if(type==="text"){
    if(typeof value!=="string"||value.length>1000||/[\x00]/.test(value))throw new Error("invalid_"+key);
    return value;
  }
  if(type==="integer")return safe(int(value,key));
  if(type==="cents")return safe(int(value,key));
  if(type==="basis_points"){
    const n=int(value,key,{nonnegative:true});
    if(n>100000n)throw new Error("invalid_"+key);
    return Number(n);
  }
  if(type==="date"){isoDay(value,key);return value;}
  if(type==="boolean"){
    if(typeof value!=="boolean")throw new Error("invalid_"+key);
    return value;
  }
  if(type==="source_ref"){
    if(typeof value!=="string"||!/^[A-Za-z0-9._:-]{3,160}$/.test(value))throw new Error("invalid_"+key);
    return value;
  }
  throw new Error("unsupported_"+key);
}
function divideRound(n,d,mode){
  if(d<=0n)throw new Error("invalid_divisor");
  if(mode==="floor")return n/d;
  if(mode==="ceil")return (n+d-1n)/d;
  return (n+d/2n)/d;
}
function calculateFormula(formula,row){
  const vals=formula.inputs.map(k=>row[k]);
  if(vals.some(v=>v===null||v===undefined))return null;
  if(formula.op==="copy")return vals[0];
  if(formula.op==="sum_cents")return safe(vals.reduce((a,v)=>a+int(v,"formula_input"),0n));
  if(formula.op==="subtract_cents"){
    if(vals.length!==2)throw new Error("subtract_requires_two_inputs");
    return safe(int(vals[0],"formula_input")-int(vals[1],"formula_input"));
  }
  if(formula.op==="quantity_x_unit_cents"){
    if(vals.length!==2)throw new Error("multiply_requires_two_inputs");
    return safe(int(vals[0],"quantity",{nonnegative:true})*int(vals[1],"unit_cents"));
  }
  if(formula.op==="basis_points_of_cents"){
    if(vals.length!==2)throw new Error("basis_points_requires_two_inputs");
    const amount=int(vals[0],"amount_cents");
    const bps=int(vals[1],"basis_points",{nonnegative:true});
    if(bps>100000n)throw new Error("basis_points_out_of_range");
    const negative=amount<0n;
    const magnitude=negative?-amount:amount;
    const rounded=divideRound(magnitude*bps,10000n,formula.rounding);
    return safe(negative?-rounded:rounded);
  }
  if(formula.op==="days_between"){
    if(vals.length!==2)throw new Error("days_between_requires_two_inputs");
    const start=isoDay(vals[0],"start_date"),end=isoDay(vals[1],"end_date");
    if(end<start)throw new Error("end_before_start");
    return Math.floor((end-start)/86400000);
  }
  throw new Error("unsupported_formula");
}
function calculateRow(schema,row){
  const compiled=validateSchema(schema);
  if(!row||typeof row!=="object"||Array.isArray(row))throw new Error("row_required");
  const out=Object.create(null);
  for(const [key,col] of compiled.columns)out[key]=validateCell(row[key],col.type,key);
  for(const formula of compiled.formulas)out[formula.output]=calculateFormula(formula,out);
  return Object.freeze({
    state:"deterministic_values_only",
    values:Object.freeze({...out}),
    executableSpreadsheetFormulaProduced:false,
    externalDataFetchPerformed:false,
    macrosAllowed:false
  });
}
function calculateRows(schema,rows,{limit=10000}={}){
  if(!Array.isArray(rows))throw new Error("rows_required");
  if(!Number.isSafeInteger(limit)||limit<1||limit>50000)throw new Error("invalid_row_limit");
  if(rows.length>limit)return Object.freeze({ok:false,code:"row_limit_exceeded",rowCount:rows.length,calculated:[]});
  return Object.freeze({ok:true,rowCount:rows.length,calculated:Object.freeze(rows.map(r=>calculateRow(schema,r)))});
}
module.exports={OPS,validateSchema,calculateRow,calculateRows};
