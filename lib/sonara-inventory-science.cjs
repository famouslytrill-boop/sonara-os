"use strict";

// Answers to the questions lib/sonara-formula-library.cjs assumes.
//
// That library holds 47 formulas and every one is a single expression over
// inputs it is handed. Two of them hand off the only hard part:
//
//   reorder_point = (average_daily_usage * lead_time_days) + safety_stock
//
// **safety_stock is an input.** Working out a reorder point once you already
// know your safety stock is multiplication; working out the safety stock is the
// question, and it needs the variability of demand, a lead time, and a decision
// about how often you are willing to run out. Nothing here computed it, so the
// number came from somebody's judgement and the formula dressed it as arithmetic.
//
// This module computes it, from the customer's own sales history, with no model
// call, no provider, no network and no cost per use -- the same terms every
// other tool in this product ships on.
//
// Everything returns { ok: true, ... } or { ok: false, code, message }. Nothing
// here returns a number it cannot justify, because a reorder point is a number
// somebody spends money on.

// ---------------------------------------------------------------------------
// The quantile of the standard normal distribution.
// ---------------------------------------------------------------------------
//
// A service level -- "I want to cover 95% of demand during lead time" -- becomes
// a multiplier through the inverse normal CDF, and that function has no
// closed form. This is Peter Acklam's rational approximation, which is public
// mathematics rather than anybody's source: the coefficients are published and
// the algorithm is a ratio of two polynomials in each of three regions.
//
// **Checked before it was trusted.** Against ten tabulated quantiles the worst
// absolute error is 3.4e-9, and a round trip through an independently written
// erf-based CDF agrees to within that CDF's own error. Both are asserted in
// tests/inventory-science.test.js rather than stated only here.
//
// 1e-9 is far finer than the question deserves -- the difference between a 95%
// and a 95.0000001% service level is not a difference anybody stocks for -- and
// that is the point: the approximation is not where the error in a reorder point
// comes from. The sample size is.
const ACKLAM_A = Object.freeze([
  -3.969683028665376e+1, 2.209460984245205e+2, -2.759285104469687e+2,
  1.383577518672690e+2, -3.066479806614716e+1, 2.506628277459239e+0
]);
const ACKLAM_B = Object.freeze([
  -5.447609879822406e+1, 1.615858368580409e+2, -1.556989798598866e+2,
  6.680131188771972e+1, -1.328068155288572e+1
]);
const ACKLAM_C = Object.freeze([
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e+0,
  -2.549732539343734e+0, 4.374664141464968e+0, 2.938163982698783e+0
]);
const ACKLAM_D = Object.freeze([
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e+0,
  3.754408661907416e+0
]);
const P_LOW = 0.02425;
const P_HIGH = 1 - P_LOW;

function normalQuantile(probability) {
  const p = Number(probability);
  // 0 and 1 are infinities, not numbers. A 100% service level means never
  // running out under any demand at all, which needs infinite stock -- so it is
  // refused rather than returned as a very large number somebody might order to.
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    return {
      ok: false,
      code: "service_level_out_of_range",
      message: "A service level has to be above 0% and below 100%. 100% would need unlimited stock, because there is no demand a fixed amount always covers."
    };
  }
  let value;
  if (p < P_LOW) {
    const q = Math.sqrt(-2 * Math.log(p));
    value = polynomial(ACKLAM_C, q) / (polynomial(ACKLAM_D, q) * q + 1);
  } else if (p <= P_HIGH) {
    const q = p - 0.5;
    const r = q * q;
    value = (polynomial(ACKLAM_A, r) * q) / (polynomial(ACKLAM_B, r) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    value = -polynomial(ACKLAM_C, q) / (polynomial(ACKLAM_D, q) * q + 1);
  }
  return { ok: true, value };
}

// Horner's method. The C and D arrays are evaluated against q and the A and B
// arrays against r, which is why this takes the variable rather than assuming.
function polynomial(coefficients, x) {
  let total = coefficients[0];
  for (let index = 1; index < coefficients.length; index += 1) {
    total = total * x + coefficients[index];
  }
  return total;
}

// ---------------------------------------------------------------------------
// What the demand history actually says.
// ---------------------------------------------------------------------------

const MINIMUM_DAYS = 14;

// Mean and spread of daily demand.
//
// **A day with no row is a day with no sales, and that is a demand of zero.**
// This is the whole reason this function takes a day count as well as a list of
// quantities. A query that returns only the days an item sold, averaged over its
// own length, answers "how much do we sell on days we sell any" -- which is a
// different and much larger number than "how much do we sell per day". For a
// slow-moving item the two differ by an order of magnitude, and stocking to the
// first is how a business ends up with a year of stock of something it sells
// twice a month.
//
// Absent is not zero anywhere else in this codebase either. Here it is the
// difference between a reorder point and a wrong reorder point.
function demandStatistics(soldQuantities, daysObserved) {
  const sold = Array.isArray(soldQuantities) ? soldQuantities.map(Number).filter(Number.isFinite) : [];
  const days = Number(daysObserved);

  if (!Number.isFinite(days) || days <= 0) {
    return {
      ok: false,
      code: "day_span_required",
      message: "Working out demand per day needs to know how many days were looked at, including the days nothing sold."
    };
  }
  if (sold.length > days) {
    return {
      ok: false,
      code: "more_sales_days_than_days",
      message: `There are ${sold.length} days of sales in a span of ${days} days. One of the two is wrong, and guessing which would be worse than stopping.`
    };
  }
  if (sold.some((quantity) => quantity < 0)) {
    return {
      ok: false,
      code: "negative_quantity_sold",
      message: "A negative quantity sold is a return or a correction, not demand. Take those out before working out a reorder point."
    };
  }
  if (days < MINIMUM_DAYS) {
    // Refused rather than computed and labelled unreliable. A number on a page
    // is acted on whatever sits beside it, and a standard deviation over a week
    // of a seasonal business is not an estimate of anything.
    return {
      ok: false,
      code: "not_enough_history",
      message: `${days} days is not enough to say how much demand varies. This needs at least ${MINIMUM_DAYS}, and more is better -- a fortnight cannot see a monthly pattern.`,
      daysObserved: days,
      minimumDays: MINIMUM_DAYS
    };
  }

  // The zero days, made explicit.
  const observations = sold.concat(new Array(days - sold.length).fill(0));
  const total = observations.reduce((sum, value) => sum + value, 0);
  const mean = total / days;

  // Sample standard deviation, dividing by n-1 rather than n.
  //
  // These are a sample of the demand this item could have, not the whole of it,
  // and dividing by n understates the spread -- which understates safety stock,
  // which is the direction that runs a business out of stock rather than the
  // direction that costs it storage.
  const sumSquaredDeviations = observations.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const variance = sumSquaredDeviations / (days - 1);
  const standardDeviation = Math.sqrt(variance);

  return {
    ok: true,
    daysObserved: days,
    daysWithSales: sold.length,
    totalSold: total,
    meanDaily: mean,
    standardDeviationDaily: standardDeviation,
    // Said out loud because it changes how much the spread is worth trusting.
    // A steady item and a spiky one can share a mean.
    coefficientOfVariation: mean > 0 ? standardDeviation / mean : null
  };
}

// ---------------------------------------------------------------------------
// Safety stock, reorder point, order quantity.
// ---------------------------------------------------------------------------

// The buffer that absorbs demand being higher than average while you wait.
//
// Two forms, and which one applies is a question about the supplier rather than
// about the maths:
//
//   demand varies, lead time fixed:   z * sigma_d * sqrt(L)
//   both vary:                        z * sqrt(L * sigma_d^2 + d^2 * sigma_L^2)
//
// The second reduces to the first when sigma_L is 0, so there is one expression
// below and not two paths to disagree.
//
// The sqrt(L) is the part people get wrong by hand: waiting twice as long does
// not double the uncertainty, it multiplies it by about 1.41, because variances
// add and standard deviations do not.
function safetyStock({ standardDeviationDaily, meanDaily = 0, leadTimeDays, serviceLevel, leadTimeStandardDeviationDays = 0 }) {
  const sigmaDaily = Number(standardDeviationDaily);
  const lead = Number(leadTimeDays);
  const sigmaLead = Number(leadTimeStandardDeviationDays);
  const mean = Number(meanDaily);

  if (!Number.isFinite(sigmaDaily) || sigmaDaily < 0) {
    return { ok: false, code: "spread_required", message: "Safety stock needs to know how much daily demand varies." };
  }
  if (!Number.isFinite(lead) || lead <= 0) {
    return { ok: false, code: "lead_time_required", message: "Safety stock needs the supplier's lead time in days." };
  }
  if (!Number.isFinite(sigmaLead) || sigmaLead < 0) {
    return { ok: false, code: "lead_time_spread_invalid", message: "Lead time variability cannot be negative." };
  }

  const quantile = normalQuantile(serviceLevel);
  if (!quantile.ok) return quantile;

  const varianceDuringLeadTime = lead * sigmaDaily ** 2 + (mean ** 2) * (sigmaLead ** 2);
  const value = quantile.value * Math.sqrt(varianceDuringLeadTime);

  return {
    ok: true,
    // Negative z below a 50% service level is real and is not an error: it means
    // holding less than average demand on purpose. Reported rather than clamped,
    // because clamping would hide that somebody chose it.
    units: value,
    serviceLevelZ: quantile.value,
    leadTimeDemandStandardDeviation: Math.sqrt(varianceDuringLeadTime),
    includesLeadTimeVariability: sigmaLead > 0
  };
}

// When to order: enough to cover average demand while you wait, plus the buffer.
function reorderPoint({ meanDaily, leadTimeDays, safetyStockUnits }) {
  const mean = Number(meanDaily);
  const lead = Number(leadTimeDays);
  const buffer = Number(safetyStockUnits);
  if (!Number.isFinite(mean) || mean < 0) {
    return { ok: false, code: "mean_required", message: "A reorder point needs average daily demand." };
  }
  if (!Number.isFinite(lead) || lead <= 0) {
    return { ok: false, code: "lead_time_required", message: "A reorder point needs the supplier's lead time in days." };
  }
  if (!Number.isFinite(buffer)) {
    return { ok: false, code: "safety_stock_required", message: "A reorder point needs a safety stock figure." };
  }
  const demandDuringLeadTime = mean * lead;
  return {
    ok: true,
    units: demandDuringLeadTime + buffer,
    demandDuringLeadTime,
    safetyStockUnits: buffer
  };
}

// How much to order at a time: the quantity where ordering cost and holding cost
// balance. Wilson's formula, 1913 -- sqrt(2DS/H).
//
// Its assumptions are strong and worth stating rather than burying: demand is
// steady, the lead time is known, the whole order arrives at once, and there is
// no discount for ordering more. A business with a real bulk discount should not
// use this number without adjusting for it.
//
// The curve is flat near the bottom, which is the useful part: ordering 20% away
// from the optimum costs about 2% more in total, so this is a guide to the
// right order of magnitude rather than a quantity to hit exactly.
function economicOrderQuantity({ annualDemandUnits, orderCostCents, holdingCostCentsPerUnitPerYear }) {
  const demand = Number(annualDemandUnits);
  const orderCost = Number(orderCostCents);
  const holding = Number(holdingCostCentsPerUnitPerYear);

  if (!Number.isFinite(demand) || demand <= 0) {
    return { ok: false, code: "annual_demand_required", message: "An order quantity needs how many you sell in a year." };
  }
  if (!Number.isFinite(orderCost) || orderCost <= 0) {
    return { ok: false, code: "order_cost_required", message: "An order quantity needs what it costs you to place one order -- the admin, the delivery, the time." };
  }
  if (!Number.isFinite(holding) || holding <= 0) {
    return { ok: false, code: "holding_cost_required", message: "An order quantity needs what it costs to hold one unit for a year." };
  }

  const units = Math.sqrt((2 * demand * orderCost) / holding);
  const ordersPerYear = demand / units;
  return {
    ok: true,
    units,
    ordersPerYear,
    daysBetweenOrders: 365 / ordersPerYear,
    // At the optimum these two are equal, which is the whole content of the
    // formula and a useful thing to show beside it.
    annualOrderingCostCents: ordersPerYear * orderCost,
    annualHoldingCostCents: (units / 2) * holding
  };
}

module.exports = {
  MINIMUM_DAYS,
  normalQuantile,
  demandStatistics,
  safetyStock,
  reorderPoint,
  economicOrderQuantity
};
