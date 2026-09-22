// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic financial-intelligence primitives.
//
// These functions intentionally compute transparent arithmetic only. They do
// not move money, trade, file taxes, post accounting entries, approve credit,
// or replace professional accounting/financial advice. Callers must preserve
// source lineage, currency/period consistency and reconciliation status.

const FINANCIAL_INTELLIGENCE_FORMULA_CATALOG = Object.freeze([
  Object.freeze({ key: "net_cash_flow", label: "Net cash flow", expression: "cash_inflows - cash_outflows", unit: "currency" }),
  Object.freeze({ key: "monthly_net_burn", label: "Monthly net burn", expression: "max(cash_outflows - cash_inflows, 0)", unit: "currency_per_month" }),
  Object.freeze({ key: "runway_months", label: "Cash runway", expression: "cash_balance / monthly_burn", unit: "months", nullState: "not_currently_burning_cash" }),
  Object.freeze({ key: "gross_margin_percent", label: "Gross margin", expression: "100 * (revenue - cost_of_goods_sold) / revenue", unit: "percent" }),
  Object.freeze({ key: "period_growth_percent", label: "Period growth", expression: "100 * (current - previous) / abs(previous)", unit: "percent" }),
  Object.freeze({ key: "customer_acquisition_cost", label: "Customer acquisition cost", expression: "acquisition_spend / new_customers", unit: "currency_per_customer" }),
  Object.freeze({ key: "simple_ltv", label: "Simple LTV", expression: "average_revenue_per_customer * gross_margin_rate / churn_rate", unit: "currency" }),
  Object.freeze({ key: "burn_multiple", label: "Burn multiple", expression: "net_burn / net_new_annual_recurring_revenue", unit: "ratio" }),
  Object.freeze({ key: "revenue_concentration_percent", label: "Top-customer revenue concentration", expression: "100 * top_customer_revenue / total_revenue", unit: "percent" }),
  Object.freeze({ key: "scenario_runway", label: "Deterministic runway scenario", expression: "runway(cash_balance, adjusted_inflows, adjusted_outflows)", unit: "months" }),
  Object.freeze({ key: "data_quality_flags", label: "Financial data-quality gate", expression: "reconciled && period_aligned && currency_aligned && source_rows > 0", unit: "state" })
]);

function getFinancialIntelligenceFormulaCatalog() {
  return {
    ok: true,
    mode: "deterministic_supplemental_decision_support",
    count: FINANCIAL_INTELLIGENCE_FORMULA_CATALOG.length,
    canMoveMoney: false,
    canPostAccountingEntries: false,
    canTrade: false,
    canApproveCredit: false,
    formulas: FINANCIAL_INTELLIGENCE_FORMULA_CATALOG.map((item) => ({ ...item }))
  };
}

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
  return number;
}

function nonNegative(value, name) {
  const number = finite(value, name);
  if (number < 0) throw new RangeError(`${name} must be >= 0`);
  return number;
}

function rounded(value, digits = 4) {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function safeRatio(numerator, denominator) {
  const n = finite(numerator, "numerator");
  const d = finite(denominator, "denominator");
  return d === 0 ? null : n / d;
}

function netCashFlow({ cashInflows, cashOutflows }) {
  return rounded(nonNegative(cashInflows, "cashInflows") - nonNegative(cashOutflows, "cashOutflows"));
}

function monthlyNetBurn({ cashInflows, cashOutflows }) {
  return rounded(Math.max(nonNegative(cashOutflows, "cashOutflows") - nonNegative(cashInflows, "cashInflows"), 0));
}

function runwayMonths({ cashBalance, monthlyBurn }) {
  const cash = nonNegative(cashBalance, "cashBalance");
  const burn = nonNegative(monthlyBurn, "monthlyBurn");
  if (burn === 0) return { value: null, state: "not_currently_burning_cash" };
  return { value: rounded(cash / burn, 2), state: "finite_runway" };
}

function grossMarginPercent({ revenue, costOfGoodsSold }) {
  const rev = nonNegative(revenue, "revenue");
  const cogs = nonNegative(costOfGoodsSold, "costOfGoodsSold");
  if (rev === 0) return null;
  return rounded(((rev - cogs) / rev) * 100, 2);
}

function periodGrowthPercent({ current, previous }) {
  const currentValue = finite(current, "current");
  const previousValue = finite(previous, "previous");
  if (previousValue === 0) return null;
  return rounded(((currentValue - previousValue) / Math.abs(previousValue)) * 100, 2);
}

function customerAcquisitionCost({ acquisitionSpend, newCustomers }) {
  const spend = nonNegative(acquisitionSpend, "acquisitionSpend");
  const customers = nonNegative(newCustomers, "newCustomers");
  if (customers === 0) return null;
  return rounded(spend / customers, 2);
}

function simpleLtv({ averageRevenuePerCustomer, grossMarginPercentValue, churnRatePercent }) {
  const arpc = nonNegative(averageRevenuePerCustomer, "averageRevenuePerCustomer");
  const margin = finite(grossMarginPercentValue, "grossMarginPercentValue");
  const churn = finite(churnRatePercent, "churnRatePercent");
  if (margin < 0 || margin > 100) throw new RangeError("grossMarginPercentValue must be between 0 and 100");
  if (churn <= 0 || churn > 100) return null;
  return rounded((arpc * (margin / 100)) / (churn / 100), 2);
}

function burnMultiple({ netBurn, netNewAnnualRecurringRevenue }) {
  const burn = nonNegative(netBurn, "netBurn");
  const newArr = finite(netNewAnnualRecurringRevenue, "netNewAnnualRecurringRevenue");
  if (newArr <= 0) return null;
  return rounded(burn / newArr, 2);
}

function revenueConcentrationPercent({ topCustomerRevenue, totalRevenue }) {
  const top = nonNegative(topCustomerRevenue, "topCustomerRevenue");
  const total = nonNegative(totalRevenue, "totalRevenue");
  if (total === 0) return null;
  if (top > total) throw new RangeError("topCustomerRevenue cannot exceed totalRevenue");
  return rounded((top / total) * 100, 2);
}

function scenarioRunway({
  cashBalance,
  baselineMonthlyInflows,
  baselineMonthlyOutflows,
  inflowChangePercent = 0,
  outflowChangePercent = 0
}) {
  const inflows = nonNegative(baselineMonthlyInflows, "baselineMonthlyInflows");
  const outflows = nonNegative(baselineMonthlyOutflows, "baselineMonthlyOutflows");
  const inflowChange = finite(inflowChangePercent, "inflowChangePercent");
  const outflowChange = finite(outflowChangePercent, "outflowChangePercent");

  const scenarioInflows = Math.max(inflows * (1 + inflowChange / 100), 0);
  const scenarioOutflows = Math.max(outflows * (1 + outflowChange / 100), 0);
  const burn = monthlyNetBurn({ cashInflows: scenarioInflows, cashOutflows: scenarioOutflows });

  return {
    assumptions: {
      inflowChangePercent: rounded(inflowChange, 2),
      outflowChangePercent: rounded(outflowChange, 2)
    },
    scenarioMonthlyInflows: rounded(scenarioInflows, 2),
    scenarioMonthlyOutflows: rounded(scenarioOutflows, 2),
    scenarioMonthlyBurn: burn,
    runway: runwayMonths({ cashBalance, monthlyBurn: burn })
  };
}

function dataQualityFlags({ reconciled = false, periodAligned = false, currencyAligned = false, sourceRows = 0 } = {}) {
  const flags = [];
  if (!reconciled) flags.push("not_reconciled");
  if (!periodAligned) flags.push("periods_not_confirmed_aligned");
  if (!currencyAligned) flags.push("currency_not_confirmed_aligned");
  if (!Number.isInteger(sourceRows) || sourceRows <= 0) flags.push("no_positive_source_row_count");
  return {
    readyForDecisionSupport: flags.length === 0,
    flags
  };
}

module.exports = {
  FINANCIAL_INTELLIGENCE_FORMULA_CATALOG,
  getFinancialIntelligenceFormulaCatalog,
  safeRatio,
  netCashFlow,
  monthlyNetBurn,
  runwayMonths,
  grossMarginPercent,
  periodGrowthPercent,
  customerAcquisitionCost,
  simpleLtv,
  burnMultiple,
  revenueConcentrationPercent,
  scenarioRunway,
  dataQualityFlags
};
