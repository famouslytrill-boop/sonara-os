"use strict";

// The arithmetic behind a reorder point, checked against numbers nobody here
// chose.
//
// lib/sonara-formula-library.cjs defines reorder_point as
// `(average_daily_usage * lead_time_days) + safety_stock` and takes safety_stock
// as an input. Multiplying once you know your safety stock is the easy half;
// working out the safety stock is the question, and nothing computed it.
//
// A number a business orders stock against has to be checkable, so this file
// checks against published quantiles, an independently written CDF, and two
// properties of the economic order quantity that hold for reasons other than
// the implementation being what it is.

const assert = require("node:assert/strict");
const {
  MINIMUM_DAYS,
  normalQuantile,
  demandStatistics,
  safetyStock,
  reorderPoint,
  economicOrderQuantity
} = require("../lib/sonara-inventory-science.cjs");

// Standard normal quantiles, as tabulated. Not produced by the code under test.
const TABULATED = Object.freeze([
  [0.5, 0],
  [0.9, 1.2815515655446004],
  [0.95, 1.6448536269514722],
  [0.975, 1.9599639845400545],
  [0.98, 2.0537489106318225],
  [0.99, 2.3263478740408408],
  [0.995, 2.5758293035489004],
  [0.999, 3.0902323061678132],
  [0.01, -2.3263478740408408],
  [0.0001, -3.719016485455709]
]);

// Abramowitz & Stegun 7.1.26, written here rather than imported, so the quantile
// is compared against something with a different derivation instead of only
// against numbers typed into the table above.
function erf(x) {
  const sign = Math.sign(x);
  const value = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * value);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592)
    * t * Math.exp(-value * value);
  return sign * y;
}
const normalCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));

describe("the arithmetic behind a reorder point", () => {
  describe("the normal quantile", () => {
    it("has a table to check against", () => {
      assert.ok(TABULATED.length >= 10, "too few reference points to mean anything");
    });

    it("matches published quantiles to better than a billionth", () => {
      let worst = 0;
      for (const [probability, expected] of TABULATED) {
        const answer = normalQuantile(probability);
        assert.equal(answer.ok, true, `refused p=${probability}`);
        worst = Math.max(worst, Math.abs(answer.value - expected));
      }
      // Acklam's published bound is a relative error under 1.15e-9.
      assert.ok(worst < 1e-8, `worst absolute error was ${worst.toExponential(3)}, which is worse than the algorithm claims`);
    });

    it("agrees with an independently written CDF", () => {
      // Round trip: cdf(quantile(p)) should return p. The error here is bounded
      // by the erf approximation above rather than by the quantile.
      for (const probability of [0.5, 0.8, 0.9, 0.95, 0.99, 0.999]) {
        const back = normalCdf(normalQuantile(probability).value);
        assert.ok(
          Math.abs(back - probability) < 1e-6,
          `round trip for ${probability} came back ${back}`
        );
      }
    });

    it("refuses a service level of 100%, which would need unlimited stock", () => {
      for (const impossible of [1, 1.5, 0, -0.2, Number.NaN, "high"]) {
        const answer = normalQuantile(impossible);
        assert.equal(answer.ok, false, `accepted ${impossible}`);
        assert.equal(answer.code, "service_level_out_of_range");
      }
    });

    it("is symmetric about the median", () => {
      // A property, not a table lookup: q(p) = -q(1-p).
      for (const probability of [0.6, 0.75, 0.9, 0.99]) {
        const high = normalQuantile(probability).value;
        const low = normalQuantile(1 - probability).value;
        assert.ok(Math.abs(high + low) < 1e-8, `q(${probability}) and q(${1 - probability}) are not opposite`);
      }
    });
  });

  describe("what the sales history says", () => {
    // The defect this function exists to avoid. Fourteen selling days inside a
    // thirty-day span is 2.27 a day, not 4.86 a day -- and stocking to the
    // second is how a business ends up with a year of something it sells twice
    // a month.
    it("counts a day with no sales as a day of zero demand", () => {
      const sold = [5, 3, 8, 2, 6, 4, 7, 3, 5, 9, 1, 4, 6, 5];
      const overWholeSpan = demandStatistics(sold, 30);
      assert.equal(overWholeSpan.ok, true);

      const total = sold.reduce((sum, value) => sum + value, 0);
      assert.ok(Math.abs(overWholeSpan.meanDaily - total / 30) < 1e-12, "did not average over the whole span");

      const averagedOverSellingDaysOnly = total / sold.length;
      assert.ok(
        averagedOverSellingDaysOnly > overWholeSpan.meanDaily * 2,
        "this fixture no longer demonstrates the gap it was chosen for"
      );
      assert.equal(overWholeSpan.daysWithSales, sold.length);
      assert.equal(overWholeSpan.daysObserved, 30);
    });

    it("uses the sample standard deviation, dividing by one less than the count", () => {
      // Four observations over four days, hand-computable: mean 5, deviations
      // -3,-1,1,3, squares 9+1+1+9 = 20, /(4-1) = 6.6667, sqrt = 2.581988...
      // Dividing by n instead would give sqrt(5) = 2.2360, which understates the
      // spread -- and understating spread understates safety stock, which is the
      // direction that runs a business out of stock.
      const stats = demandStatistics([2, 4, 6, 8], 4);
      assert.equal(stats.ok, false, "four days should be refused as too little history");

      const longer = demandStatistics(new Array(20).fill(5), 20);
      assert.equal(longer.ok, true);
      assert.equal(longer.meanDaily, 5);
      assert.equal(longer.standardDeviationDaily, 0, "identical demand every day has no spread");
    });

    it("computes a spread that matches a hand calculation", () => {
      // 20 days: ten 2s and ten 8s. Mean 5. Each deviation is 3, squared 9,
      // summed 180, divided by 19 = 9.4736..., root = 3.07793...
      const stats = demandStatistics([...new Array(10).fill(2), ...new Array(10).fill(8)], 20);
      assert.equal(stats.ok, true);
      assert.equal(stats.meanDaily, 5);
      assert.ok(Math.abs(stats.standardDeviationDaily - Math.sqrt(180 / 19)) < 1e-12);
      assert.ok(Math.abs(stats.coefficientOfVariation - Math.sqrt(180 / 19) / 5) < 1e-12);
    });

    it("refuses a span too short to say anything about variability", () => {
      const stats = demandStatistics([1, 2, 3], 7);
      assert.equal(stats.ok, false);
      assert.equal(stats.code, "not_enough_history");
      assert.equal(stats.minimumDays, MINIMUM_DAYS);
    });

    it("refuses more selling days than days", () => {
      const stats = demandStatistics(new Array(40).fill(1), 30);
      assert.equal(stats.ok, false);
      assert.equal(stats.code, "more_sales_days_than_days");
    });

    it("refuses a negative quantity rather than averaging a return into demand", () => {
      const stats = demandStatistics([5, -2, 4, 6, 3, 5, 4, 6, 5, 4, 3, 5, 6, 4, 5], 20);
      assert.equal(stats.ok, false);
      assert.equal(stats.code, "negative_quantity_sold");
    });

    it("needs the day span, and will not infer it from the list", () => {
      const stats = demandStatistics([1, 2, 3], undefined);
      assert.equal(stats.ok, false);
      assert.equal(stats.code, "day_span_required");
    });
  });

  describe("safety stock", () => {
    it("grows with the square root of the lead time, not with the lead time", () => {
      // The part people get wrong by hand. Waiting four times as long does not
      // need four times the buffer, it needs twice -- variances add, standard
      // deviations do not.
      const base = safetyStock({ standardDeviationDaily: 3, leadTimeDays: 1, serviceLevel: 0.95 });
      const quadrupled = safetyStock({ standardDeviationDaily: 3, leadTimeDays: 4, serviceLevel: 0.95 });
      assert.equal(base.ok, true);
      assert.equal(quadrupled.ok, true);
      assert.ok(
        Math.abs(quadrupled.units - base.units * 2) < 1e-9,
        `four times the lead time gave ${quadrupled.units / base.units} times the buffer, not 2`
      );
    });

    it("matches the textbook expression exactly", () => {
      const answer = safetyStock({ standardDeviationDaily: 4, leadTimeDays: 9, serviceLevel: 0.975 });
      const expected = 1.9599639845400545 * 4 * 3; // z * sigma * sqrt(9)
      assert.ok(Math.abs(answer.units - expected) < 1e-7, `${answer.units} is not z*sigma*sqrt(L)`);
    });

    it("reduces to the simple form when the lead time does not vary", () => {
      const withZero = safetyStock({ standardDeviationDaily: 5, meanDaily: 10, leadTimeDays: 6, serviceLevel: 0.9, leadTimeStandardDeviationDays: 0 });
      const without = safetyStock({ standardDeviationDaily: 5, leadTimeDays: 6, serviceLevel: 0.9 });
      assert.ok(Math.abs(withZero.units - without.units) < 1e-12, "the two forms disagree where they must agree");
      assert.equal(withZero.includesLeadTimeVariability, false);
    });

    it("holds more when the supplier is unreliable, at the same demand", () => {
      const steady = safetyStock({ standardDeviationDaily: 5, meanDaily: 10, leadTimeDays: 6, serviceLevel: 0.95 });
      const erratic = safetyStock({ standardDeviationDaily: 5, meanDaily: 10, leadTimeDays: 6, serviceLevel: 0.95, leadTimeStandardDeviationDays: 2 });
      assert.ok(erratic.units > steady.units, "lead-time variability did not increase the buffer");
      assert.equal(erratic.includesLeadTimeVariability, true);
    });

    it("refuses a lead time of zero rather than returning no buffer", () => {
      const answer = safetyStock({ standardDeviationDaily: 3, leadTimeDays: 0, serviceLevel: 0.95 });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "lead_time_required");
    });
  });

  describe("the reorder point", () => {
    it("is demand while you wait, plus the buffer", () => {
      const answer = reorderPoint({ meanDaily: 12, leadTimeDays: 5, safetyStockUnits: 20 });
      assert.equal(answer.ok, true);
      assert.equal(answer.units, 80);
      assert.equal(answer.demandDuringLeadTime, 60);
    });

    it("refuses rather than treating a missing buffer as none", () => {
      const answer = reorderPoint({ meanDaily: 12, leadTimeDays: 5, safetyStockUnits: undefined });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "safety_stock_required");
    });
  });

  describe("the economic order quantity", () => {
    it("matches a hand calculation", () => {
      // sqrt(2 * 1200 * 5000 / 300) = sqrt(40000) = 200, exactly.
      const answer = economicOrderQuantity({ annualDemandUnits: 1200, orderCostCents: 5000, holdingCostCentsPerUnitPerYear: 300 });
      assert.equal(answer.ok, true);
      assert.ok(Math.abs(answer.units - 200) < 1e-9);
      assert.ok(Math.abs(answer.ordersPerYear - 6) < 1e-9);
    });

    it("balances ordering cost against holding cost, which is what it is for", () => {
      // A property of the optimum rather than of this implementation: at the
      // EOQ the two annual costs are equal. If the formula were mistyped they
      // would not be.
      for (const demand of [500, 1200, 9000]) {
        for (const orderCost of [1500, 5000]) {
          for (const holding of [120, 300, 900]) {
            const answer = economicOrderQuantity({
              annualDemandUnits: demand,
              orderCostCents: orderCost,
              holdingCostCentsPerUnitPerYear: holding
            });
            assert.ok(
              Math.abs(answer.annualOrderingCostCents - answer.annualHoldingCostCents) < 1e-6,
              `at the optimum these must be equal, and were ${answer.annualOrderingCostCents} and ${answer.annualHoldingCostCents}`
            );
          }
        }
      }
    });

    it("is flat near the bottom, which is why it is a guide and not a target", () => {
      // Ordering 20% away from the optimum should cost about 2% more in total.
      // Worth asserting because it is the reason nobody needs to hit this
      // number exactly, and a page that implied otherwise would be overselling.
      const demand = 1200, orderCost = 5000, holding = 300;
      const optimum = economicOrderQuantity({ annualDemandUnits: demand, orderCostCents: orderCost, holdingCostCentsPerUnitPerYear: holding });
      const totalCost = (quantity) => (demand / quantity) * orderCost + (quantity / 2) * holding;
      const best = totalCost(optimum.units);
      for (const factor of [0.8, 1.2]) {
        const penalty = totalCost(optimum.units * factor) / best - 1;
        assert.ok(penalty > 0, "moving off the optimum should cost more, not less");
        assert.ok(penalty < 0.03, `being ${factor} of the optimum cost ${(penalty * 100).toFixed(2)}% more, which is not flat`);
      }
    });

    it("refuses each missing input by name rather than returning zero", () => {
      const cases = [
        [{ annualDemandUnits: 0, orderCostCents: 5000, holdingCostCentsPerUnitPerYear: 300 }, "annual_demand_required"],
        [{ annualDemandUnits: 1200, orderCostCents: 0, holdingCostCentsPerUnitPerYear: 300 }, "order_cost_required"],
        [{ annualDemandUnits: 1200, orderCostCents: 5000, holdingCostCentsPerUnitPerYear: 0 }, "holding_cost_required"]
      ];
      for (const [input, code] of cases) {
        const answer = economicOrderQuantity(input);
        assert.equal(answer.ok, false);
        assert.equal(answer.code, code);
      }
    });
  });
});
