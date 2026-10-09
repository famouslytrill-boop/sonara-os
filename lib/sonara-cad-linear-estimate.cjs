// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// CAD-derived linear material takeoff for non-binding estimating only.
// Prices are user-entered; no autonomous purchases, invoices, permits or payroll.
const { parseAsciiDxf, DxfIntakeError } = require("./sonara-dxf-readonly-intake.cjs");

class LinearQuoteError extends Error {
  constructor(code,message){super(message);this.name="LinearQuoteError";this.code=code;}
}
function finite(x,key,max=1e9) {
  if(typeof x!=="number"||!Number.isFinite(x)||x<0||x>max) {
    throw new LinearQuoteError("invalid_estimate_input",`Invalid ${key}`);
  }
  return x;
}
function safe(n,key) {
  if(!Number.isFinite(n)||n>Number.MAX_SAFE_INTEGER) {
    throw new LinearQuoteError("result_overflow",`${key} exceeds supported precision`);
  }
  return n;
}
function linearMaterialEstimate(request) {
  if(!request||typeof request!=="object"||Array.isArray(request)) {
    throw new LinearQuoteError("invalid_estimate_input","Expected a request object");
  }
  // An ambiguous or curved DXF must fail before any quote mathematics.
  const measured=parseAsciiDxf(request.dxfText);
  const currency=request.currency;
  if(typeof currency!=="string"||!/^[A-Z]{3}$/.test(currency)) {
    throw new LinearQuoteError("invalid_currency","Currency must be an explicit uppercase three-letter code");
  }
  const price=finite(request.materialCostPerMeter,"materialCostPerMeter");
  const waste=finite(request.wastePercent,"wastePercent",100);
  const laborHours=finite(request.laborHours,"laborHours",1e6);
  const loadedRate=finite(request.loadedLaborCostPerHour,"loadedLaborCostPerHour");
  const otherCosts=finite(request.otherCosts,"otherCosts",1e12);
  const measuredLengthMeters=measured.totalLengthMeters;
  const orderLengthMeters=safe(measuredLengthMeters*(1+waste/100),"orderLengthMeters");
  const materialCost=safe(orderLengthMeters*price,"materialCost");
  const laborCost=safe(laborHours*loadedRate,"laborCost");
  const estimatedTotal=safe(materialCost+laborCost+otherCosts,"estimatedTotal");
  return {
    ok:true,estimateVersion:"2026-10-09.1",basis:"unverified_straight_DXF_geometry_and_user_entered_rates",
    currency,measuredLengthMeters,orderLengthMeters,
    materialCost,laborCost,otherCosts,estimatedTotal,
    source:{format:measured.format,sourceUnit:measured.sourceUnit,
      entityCount:measured.entityCount,segmentCount:measured.segmentCount,
      digestAlgorithm:measured.evidence.digestAlgorithm,
      digest:measured.evidence.sourceDigest},
    assumptions:["no_bends_curves_or_blocks","user_supplied_rates","not_a_bid_or_material_order",
      "no_taxes_delivery_permits_or_site_constraints","review_before_customer_use"]
  };
}
function tryLinearMaterialEstimate(req) {
  try { return linearMaterialEstimate(req); }
  catch(e){
    if(e instanceof LinearQuoteError || e instanceof DxfIntakeError) {
      return {ok:false,code:e.code,message:e.message};
    }
    throw e;
  }
}
module.exports={linearMaterialEstimate,tryLinearMaterialEstimate,LinearQuoteError};
