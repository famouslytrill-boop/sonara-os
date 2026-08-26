"use strict";

// Nine products built against documented market complaints rather than from a
// blank page. Sources are in docs/market/2026-08-18-PRODUCT-GAP-RESEARCH.md and
// the three that drove the design are worth repeating, because each of these
// tools is only defensible while its number holds:
//
//   * 67% of creators had a contract or payment dispute in the past year, and
//     the average creator earns $44,293 -- a market that cannot hire a lawyer.
//   * 83% of small businesses call referrals their best acquisition source, up
//     from 65%, and attribution software cannot see a referral because there is
//     no click.
//   * 52% of buyers switch business software over inefficiency, not price.
//
// This file checks the arithmetic and the refusals. The claim each tool makes is
// only as good as its sums.

const assert = require("node:assert/strict");
const {
  MARKET_TOOLS, priceRise, softwareSpend, quietMonths,
  dealMemo, latePayment, rightsExpiry,
  referralSource, reviewRecency, responseTime
} = require("../lib/sonara-market-tools.cjs");

const text = (output) => Object.values(output).join(" | ");

describe("nine market tools answer the question that was asked", () => {
  it("registers three for each product line, with no path or module reused", () => {
    const counts = MARKET_TOOLS.reduce((tally, tool) => {
      tally[tool.productKey] = (tally[tool.productKey] || 0) + 1;
      return tally;
    }, {});
    assert.deepEqual(counts, { business_builder: 3, creator_studio: 3, growth_studio: 3 });
    assert.equal(new Set(MARKET_TOOLS.map((tool) => tool.path)).size, 9);
    assert.equal(new Set(MARKET_TOOLS.map((tool) => tool.module)).size, 9);
    for (const tool of MARKET_TOOLS) {
      const names = tool.fields.map((field) => field.name);
      for (const required of tool.requiredFields) {
        assert.ok(names.includes(required), `${tool.title} requires "${required}" but does not render it`);
      }
    }
  });

  it("never prints a placeholder, whatever it is given", () => {
    const nonsense = { currentPrice: "lots", variableCostPerSale: "?", customersPerMonth: "many", risePercent: "a bit", seats: "x", activeSeats: "x", pricePerSeatMonthly: "x", openingCash: "x", fixedCostsMonthly: "x", monthlyTakings: "some, more", fee: "x", amountOwed: "x", annualInterestPercent: "x", dueDate: "never", termMonths: "x", originalFee: "x", referrers: "nope", averageSaleValue: "x", totalReviews: "x", averageRating: "x", reviewsLast90Days: "x", enquiriesPerMonth: "x", averageResponseHours: "x", winRatePercent: "x" };
    for (const tool of MARKET_TOOLS) {
      const output = tool.build(nonsense);
      assert.doesNotMatch(text(output), /NaN|undefined|\[object Object\]/, `${tool.title} produced a placeholder`);
      assert.ok(Object.keys(output).length > 0, `${tool.title} returned nothing`);
    }
  });

  // ---- Business Builder ----------------------------------------------------

  it("says how many customers a price rise can afford to lose", () => {
    const output = priceRise({ currentPrice: "100", variableCostPerSale: "40", customersPerMonth: "50", risePercent: "10" });
    assert.match(output.profitNow, /\$3000\.00/);
    assert.match(output.marginAfter, /\$70\.00/);
    assert.match(output.customersNeeded, /^43 customers/);
    assert.match(output.youCanAffordToLose, /^7 customers/);
  });

  it("refuses to plan a rise for a price that is already below cost", () => {
    // Raising a price that loses money on every sale is not the first move, and
    // a "customers you can afford to lose" figure here would be nonsense
    // dressed as advice.
    const output = priceRise({ currentPrice: "30", variableCostPerSale: "40", customersPerMonth: "50", risePercent: "10" });
    assert.match(output.profitNow, /losing money on every sale/);
    assert.equal(output.youCanAffordToLose, undefined);
  });

  it("prices the seats nobody uses", () => {
    const output = softwareSpend({ seats: "10", activeSeats: "6", pricePerSeatMonthly: "15", tools: "CRM, scheduler" });
    assert.match(output.monthlyCost, /\$150\.00 a month, \$1800\.00 a year/);
    assert.match(output.unusedSeats, /4 seats nobody uses, costing \$60\.00 a month and \$720\.00 a year/);
    assert.match(output.costPerActiveUser, /\$25\.00 per person/);
  });

  it("names the month the cash runs out, not the quietest month", () => {
    // The quietest month and the month you run out are different months, and
    // planning for the wrong one is the whole failure this tool exists for.
    // Deliberately chosen so the two are different months: takings are lowest in
    // month 1, and the balance goes negative in month 3. The first draft of this
    // test used figures that never went negative and asserted "Month 3" against
    // a run that survived -- my arithmetic, not the tool's.
    const output = quietMonths({ openingCash: "5000", fixedCostsMonthly: "4000", monthlyTakings: "1000, 3500, 2000, 4500" });
    assert.match(output.runsOut, /Month 3/);
    assert.match(output.quietestMonth, /\$1000\.00/, "the quietest month should be month 1, which is not the month it runs out");
    const survives = quietMonths({ openingCash: "50000", fixedCostsMonthly: "1000", monthlyTakings: "3000, 3500" });
    assert.match(survives.runsOut, /stays above zero/);
  });

  // ---- Creator Studio ------------------------------------------------------

  it("names what a deal memo is still missing", () => {
    const thin = dealMemo({ client: "Northwind", fee: "1200" });
    assert.match(thin.whatIsMissing, /where the work may be used/);
    assert.match(thin.whatIsMissing, /payment is due/);
    assert.match(thin.whatIsMissing, /being delivered/);

    const complete = dealMemo({ client: "Northwind", fee: "1200", deliverables: "3 photos", usageTerm: "UK social 12 months", paymentDays: "30", deliveryDate: "2026-09-01" });
    assert.match(complete.whatIsMissing, /Nothing obvious is missing/);
    assert.match(complete.paymentDue, /2026-10-01/);
    assert.match(complete.whatThisIs, /not a contract/);
  });

  it("prices a late payment and dates the escalation", () => {
    const output = latePayment({ amountOwed: "1000", dueDate: "2026-07-01", annualInterestPercent: "8", today: "2026-08-01" });
    assert.match(output.status, /31 days overdue/);
    assert.match(output.interestSoFar, /\$6\.79/);
    assert.match(output.escalation, /2026-07-02/);
    assert.match(output.escalation, /2026-07-31/);
    assert.match(output.beforeYouCharge, /only chargeable/);
  });

  it("does not accrue interest before the money is due", () => {
    const output = latePayment({ amountOwed: "1000", dueDate: "2026-09-01", annualInterestPercent: "8", today: "2026-08-01" });
    assert.match(output.status, /Not overdue yet/);
    assert.equal(output.interestSoFar, undefined, "interest was charged on an invoice that is not late");
  });

  it("works out when a licence expires and what that is worth", () => {
    const output = rightsExpiry({ workTitle: "Campaign film", licensee: "Northwind", startDate: "2026-01-01", termMonths: "12", originalFee: "4000", today: "2026-08-18" });
    // Twelve months from 1 January 2026 lands on 1 January 2027: the tool counts
    // 30.44 days to the month rather than calendar months, which is stated here
    // because a licence date being a day out is worth arguing about.
    assert.equal(output.expires, "2027-01-01");
    assert.match(output.remaining, /days left/);
    assert.match(output.renewalPosition, /stronger position/);

    const lapsed = rightsExpiry({ workTitle: "Campaign film", licensee: "Northwind", startDate: "2024-01-01", termMonths: "12", originalFee: "4000", today: "2026-08-18" });
    assert.match(lapsed.remaining, /Expired/);
    assert.match(lapsed.remaining, /not an accusation/);
  });

  // ---- Growth Studio -------------------------------------------------------

  it("counts referrals and flags when they rest on one person", () => {
    const concentrated = referralSource({ referrers: "Ada:8, Bo:1, Cass:1", averageSaleValue: "500" });
    assert.match(concentrated.totalReferrals, /10 referrals from 3 people/);
    assert.match(concentrated.worth, /\$5000\.00/);
    assert.match(concentrated.topReferrer, /Ada sent 8/);
    assert.match(concentrated.concentration, /80%/);
    assert.match(concentrated.concentration, /single point of failure/);

    const spread = referralSource({ referrers: "Ada:4, Bo:3, Cass:3", averageSaleValue: "500" });
    assert.match(spread.concentration, /reasonably spread/);
  });

  it("scores review recency rather than the average alone", () => {
    const stale = reviewRecency({ totalReviews: "200", averageRating: "4.8", reviewsLast90Days: "2" });
    assert.match(stale.recentShare, /1%/);
    assert.match(stale.toStayCurrent, /18 more reviews/);
    assert.match(stale.whyRecencyMatters, /used to be good/);
    assert.match(stale.howNotToGetThem, /Do not offer anything in exchange/);

    const current = reviewRecency({ totalReviews: "40", averageRating: "4.5", reviewsLast90Days: "10" });
    assert.match(current.toStayCurrent, /Keep the rate/);
  });

  it("prices the wait, and says plainly that it is an assumption", () => {
    const slow = responseTime({ enquiriesPerMonth: "40", averageResponseHours: "48", winRatePercent: "30", averageSaleValue: "500" });
    assert.match(slow.responding, /2\.0 days/);
    // 2 days late costs a fifth of a 30% win rate, so 24% not 30%: 9.6 won
    // rather than 12, and the gap is 2.4 sales at $500.
    assert.match(slow.ifYouAnsweredSameDay, /\$1200\.00 a month more/);
    assert.match(slow.winningNow, /About 9\.6 of 40/);
    assert.match(slow.theRule, /stated rule/);
    assert.match(slow.whatItIsNot, /Not a measurement/);

    // The floor exists so the model never tells a business it wins nothing.
    const terrible = responseTime({ enquiriesPerMonth: "40", averageResponseHours: "2400", winRatePercent: "30", averageSaleValue: "500" });
    assert.match(terrible.winningNow, /About 2\.4 of 40/);
  });
});
