// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { FORMULAS, EVALUATORS } = require("../lib/sonara-engineering-formulas.cjs");
const { evaluateFormula, listFormulaDefinitions } = require("../lib/sonara-formula-library.cjs");
describe("engineering formula library (deterministic and unit-labelled)", () => {
  const examples = [
    ["fully_burdened_labor_cost", {paid_hours:8,hourly_wage:20,benefits_per_hour:5,payroll_taxes_per_hour:2,overhead_per_hour:3},240],
    ["trade_bid_price",{productive_hours:8,utilization_rate:0.8,burdened_cost_per_paid_hour:30,materials_cost:100,other_direct_cost:0,markup_rate:0.2},480],
    ["economic_profit",{chosen_net_benefit:1500,best_foregone_net_benefit:1200},300],
    ["project_net_present_value",{upfront_cost:1000,annual_net_cash_flow:600,discount_rate:0,years:2},200],
    ["material_quantity_with_waste",{net_quantity:100,waste_percent:10},110],
    ["concrete_volume_m3",{length_meters:4,width_meters:3,depth_meters:0.2},2.4],
    ["roofing_squares",{roof_area_square_feet:1500,waste_rate:0.1},16.5],
    ["paint_gallons",{surface_square_feet:800,coats:2,waste_rate:0,coverage_square_feet_per_gallon:400},4],
    ["single_phase_ac_real_power_watts",{rms_volts:120,rms_amps:10,power_factor:0.8},960],
    ["pipe_flow_m3_s",{inside_diameter_meters:0.1,fluid_speed_meters_per_second:2},Math.PI*0.005],
    ["square_feet_to_square_meters",{area_square_feet:100},9.290304],
    ["byte_transfer_seconds",{payload_bytes:125000000,effective_bits_per_second:100000000},10],
    ["compute_job_cost",{runtime_seconds:3600,compute_rate_per_hour:2,storage_gib:10,storage_rate_per_gib_month:0.1,months_stored:1},3],
    ["satellite_orbital_period_seconds",{semi_major_axis_meters:7000000,gravitational_parameter_m3_s2:3.986004418e14},5828.516637686015],
    ["telescope_rayleigh_arcseconds",{wavelength_nanometers:550,aperture_meters:0.2},0.692],
    ["quantum_ideal_one_probability",{rotation_radians:Math.PI},1],
    ["quantum_sampling_standard_error",{probability_one:0.5,shots:100},0.05],
    ["project_variable_cash_flow_npv",{cash_flows:[500,700],discount_rate:0.1,upfront_cost:1000},500/1.1+700/1.21-1000],
    ["roof_pitch_surface_sqft",{plan_area_square_feet:1200,rise_per_12:6},1200*Math.sqrt(1.25)],
    ["trade_bid_gross_margin_percent",{bid_price:1250,direct_job_cost:1000},20],
    ["base64_encoded_bytes",{payload_bytes:3},4],
    ["circular_orbit_speed_m_s",{gravitational_parameter_m3_s2:3.986004418e14,orbital_radius_meters:7000000},Math.sqrt(3.986004418e14/7000000)],
    ["nadir_ground_sample_distance_m",{sensor_pixel_pitch_micrometers:5,altitude_meters:500000,focal_length_meters:1},2.5],
    ["combined_standard_uncertainty",{uncertainty_a:0.3,uncertainty_b:0.4},0.5],
    ["correlated_standard_uncertainty",{uncertainty_a:0.3,uncertainty_b:0.4,correlation_coefficient:0},0.5]
  ];
  it("registers every evaluator on the existing public calculator", () => {
    const keys = new Set(listFormulaDefinitions().map(d=>d.formulaKey));
    for(const formula of FORMULAS){ assert.ok(keys.has(formula.formulaKey),formula.formulaKey); assert.equal(typeof EVALUATORS[formula.formulaKey],"function");}
  });
  for (const [key, input, expected] of examples) {
    it(key + " returns a stable numerical answer", () => {
      const r = evaluateFormula(key, input);
      assert.equal(r.ok,true,JSON.stringify(r));
      assert.ok(Math.abs(r.resultValue - expected) < 0.01, key+" = "+r.resultValue);
      assert.deepEqual(Object.keys(r.inputValues).sort(),Object.keys(input).sort());
    });
  }
  it("refuses invalid, missing and unsafe denominators without inventing zero", () => {
    assert.equal(evaluateFormula("paint_gallons",{surface_square_feet:100,coats:1,waste_rate:0,coverage_square_feet_per_gallon:0}).code,"invalid_input");
    assert.equal(evaluateFormula("trade_bid_price",{productive_hours:1,utilization_rate:0,burdened_cost_per_paid_hour:1,materials_cost:1,other_direct_cost:1,markup_rate:1}).code,"invalid_input");
    assert.equal(evaluateFormula("quantum_sampling_standard_error",{probability_one:0.5,shots:0}).code,"invalid_input");
    assert.equal(evaluateFormula("project_net_present_value",{upfront_cost:100,annual_net_cash_flow:10,discount_rate:0.05,years:1.2}).code,"invalid_input");
    assert.equal(evaluateFormula("concrete_volume_m3",{length_meters:2,width_meters:1}).code,"missing_inputs");
    assert.equal(evaluateFormula("fully_burdened_labor_cost",{paid_hours:"oops",hourly_wage:1,benefits_per_hour:1,payroll_taxes_per_hour:1,overhead_per_hour:1}).code,"invalid_input");
    assert.equal(evaluateFormula("single_phase_ac_real_power_watts",{rms_volts:1,rms_amps:1,power_factor:1.2}).code,"invalid_input");
    assert.equal(evaluateFormula("satellite_orbital_period_seconds",{semi_major_axis_meters:1,gravitational_parameter_m3_s2:0}).code,"invalid_input");
    assert.equal(evaluateFormula("telescope_rayleigh_arcseconds",{wavelength_nanometers:1e9,aperture_meters:1}).code,"invalid_input");
  });
  it("keeps small non-zero scientific results instead of rounding them to zero",()=>{
    const p = evaluateFormula("quantum_ideal_one_probability",{rotation_radians:0.001});
    assert.equal(p.ok,true);
    assert.ok(p.resultValue > 0 && p.resultValue < 1e-6);
    const u = evaluateFormula("combined_standard_uncertainty",{uncertainty_a:1e-8,uncertainty_b:2e-8});
    assert.equal(u.ok,true);
    assert.ok(u.resultValue > 2e-8 && u.resultValue < 3e-8);
  });
  it("checks different annual cash-flows and correct return units",()=>{
    const zero = evaluateFormula("project_variable_cash_flow_npv",{cash_flows:[100,200],discount_rate:0,upfront_cost:50});
    assert.equal(zero.resultValue,250);
    assert.equal(zero.resultUnit,"money");
    assert.equal(evaluateFormula("project_variable_cash_flow_npv",{cash_flows:[],discount_rate:0.2,upfront_cost:0}).code,"missing_inputs");
    assert.equal(evaluateFormula("project_variable_cash_flow_npv",{cash_flows:[100,"NaN"],discount_rate:0.2,upfront_cost:0}).code,"invalid_input");
  });
  it("refuses invalid nonphysical and incompatible sampling domains",()=>{
    assert.equal(evaluateFormula("base64_encoded_bytes",{payload_bytes:1.5}).code,"invalid_input");
    assert.equal(evaluateFormula("nadir_ground_sample_distance_m",{sensor_pixel_pitch_micrometers:5,altitude_meters:500000,focal_length_meters:0}).code,"invalid_input");
    assert.equal(evaluateFormula("roof_pitch_surface_sqft",{plan_area_square_feet:100,rise_per_12:-1}).code,"invalid_input");
    assert.equal(evaluateFormula("trade_bid_gross_margin_percent",{bid_price:0,direct_job_cost:100}).code,"invalid_input");
  });
  it("uses one annual cash-flow list on the same existing formula form",()=>{
    const pages=require("../lib/sonara-formula-pages.cjs");
    const def=listFormulaDefinitions().find(d=>d.formulaKey==="project_variable_cash_flow_npv");
    assert.equal(pages.inputKind("cash_flows"),"list");
    const inputs=pages.valuesFromForm(def,{input_cash_flows:"500,700",input_discount_rate:"0.1",input_upfront_cost:"1000"});
    assert.deepEqual(inputs.cash_flows,["500","700"]);
    assert.equal(evaluateFormula(def.formulaKey,inputs).ok,true);
    assert.match(pages.formatResult(0.00000025,"probability"),/e-7/);
  });
  it("uses stable present-value math as annual discount rate tends to zero",()=>{
    const nearZero = evaluateFormula("project_net_present_value",{
      upfront_cost:100, annual_net_cash_flow:250,discount_rate:1e-16,years:3
    });
    assert.equal(nearZero.ok,true);
    assert.equal(nearZero.resultValue,650);
    const exactZero = evaluateFormula("project_net_present_value",{
      upfront_cost:100,annual_net_cash_flow:250,discount_rate:0,years:3
    });
    assert.equal(nearZero.resultValue,exactZero.resultValue);
    const variable = evaluateFormula("project_variable_cash_flow_npv",{
      cash_flows:[250,250,250],discount_rate:1e-16,upfront_cost:100
    });
    assert.equal(variable.ok,true);
    assert.equal(variable.resultValue,650);
  });
  it("accounts for correlation rather than assuming independent uncertainty",()=>{
    const measure=(rho)=>evaluateFormula("correlated_standard_uncertainty",{
      uncertainty_a:0.3,uncertainty_b:0.4,correlation_coefficient:rho
    });
    assert.equal(measure(-1).ok,true);
    assert.equal(measure(-1).resultValue,0.1);
    assert.equal(measure(0).resultValue,0.5);
    assert.equal(measure(1).resultValue,0.7);
    for(const rho of [-1.01,1.01,"NaN"]){
      assert.equal(measure(rho).code,"invalid_input");
    }
    const equality=evaluateFormula("correlated_standard_uncertainty",{
      uncertainty_a:5,uncertainty_b:5,correlation_coefficient:-1
    });
    assert.equal(equality.resultValue,0);
  });
  it("discloses research assumptions before and after evaluation",()=>{
    const pages=require("../lib/sonara-formula-pages.cjs");
    const def=listFormulaDefinitions().find(x=>x.formulaKey==="trade_bid_price");
    const escape=(v)=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const before=pages.calculatorCard(def,{},escape);
    assert.match(before,/Assumptions and limits/);
    assert.match(before,/Markup is NOT gross margin/);
    const answer=evaluateFormula("trade_bid_price",{
      productive_hours:8,utilization_rate:0.8,burdened_cost_per_paid_hour:30,
      materials_cost:100,other_direct_cost:0,markup_rate:0.2
    });
    const after=pages.resultCard(def,answer,escape);
    assert.match(after,/Assumptions and limits/);
    assert.match(after,/Save to my records/);
    assert.match(pages.formatResult(0.0000003,"percent"),/e-7%/);
  });
  it("treats non-object API input values as a bounded validation error", () => {
    for (const bad of [null, [], [1,2], "42", 42, false]) {
      const result = evaluateFormula("fully_burdened_labor_cost", bad);
      assert.equal(result.ok, false);
      assert.equal(result.code, "invalid_input");
    }
    for (const key of [null, {}, {toString: null}, ["trade_bid_price"]]) {
      assert.equal(evaluateFormula(key,{}).code, "unknown_formula");
    }
  });
  it("rejects ambiguous decimal formats without rejecting scientific notation", () => {
    const check = (paid_hours) => evaluateFormula("fully_burdened_labor_cost", {
      paid_hours,hourly_wage:20,benefits_per_hour:5,
      payroll_taxes_per_hour:2,overhead_per_hour:3
    });
    for (const invalid of ["0x10", "0b10", "0o10", "Infinity", "2_000", "1,000", {toString:null}]) {
      assert.equal(check(invalid).code, "invalid_input",String(invalid?.constructor?.name));
    }
    assert.equal(check(" ".repeat(80)).code, "missing_inputs");
    assert.equal(check("1e-3").ok,true);
    assert.equal(check(".25").resultValue,7.5);
  });
  it("does not convert structured form field values into server errors", () => {
    const pages = require("../lib/sonara-formula-pages.cjs");
    const definition = listFormulaDefinitions().find(x=>x.formulaKey==="fully_burdened_labor_cost");
    const result = pages.valuesFromForm(definition,{
      input_paid_hours:{toString:null},
      input_hourly_wage:"20",input_benefits_per_hour:"5",
      input_payroll_taxes_per_hour:"2",input_overhead_per_hour:"3"
    });
    assert.equal(result.paid_hours, "");
    assert.equal(evaluateFormula(definition.formulaKey,result).code, "missing_inputs");
    const valid = pages.valuesFromForm(definition,{input_paid_hours: "1e-3"});
    assert.equal(valid.paid_hours, "1e-3");
  });
  it("does not assume actual QPU noise or engineering certification",()=> {
    assert.equal(evaluateFormula("quantum_ideal_one_probability",{rotation_radians:0}).resultValue,0);
    assert.equal(evaluateFormula("quantum_sampling_standard_error",{probability_one:0.5,shots:10000}).resultValue,0.005);
  });
});
