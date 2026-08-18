"use strict";

// Nine planning tools, three for each product line. The arithmetic *is* the
// product: a break-even figure that is wrong is worse than no break-even
// figure, because somebody will act on it.
//
// So this file checks the numbers rather than the wording, and it checks the
// two things that are easy to get wrong and expensive to get wrong:
//
//   * an input that is not a number must produce a stated refusal, never NaN.
//     `Number("about ten")` is NaN, and "$NaN" on a result page is how a
//     customer learns not to trust the tool.
//   * a case with no answer must say so rather than return zero. A product that
//     loses money on every sale has no break-even, and "0 sales needed" is the
//     most dangerous possible rounding of that.

const assert = require("node:assert/strict");
const {
  PLANNER_TOOLS,
  numberFrom,
  breakEven,
  rotaCost,
  paymentSchedule,
  rateCard,
  splitSheet,
  repurposePlan,
  budgetSplit,
  referralReward,
  followUpSchedule
} = require("../lib/sonara-planner-tools.cjs");

const text = (output) => Object.values(output).join(" | ");

describe("nine planning tools do the arithmetic", () => {
  it("registers three tools for each product line", () => {
    const counts = PLANNER_TOOLS.reduce((tally, tool) => {
      tally[tool.productKey] = (tally[tool.productKey] || 0) + 1;
      return tally;
    }, {});
    assert.deepEqual(counts, { business_builder: 3, creator_studio: 3, growth_studio: 3 });
  });

  it("gives every tool a route, a module key and required fields", () => {
    const paths = new Set();
    const modules = new Set();
    for (const tool of PLANNER_TOOLS) {
      assert.match(tool.path, /^\/[a-z-]+\/tools\/[a-z-]+$/, `${tool.title} has an odd path`);
      assert.ok(tool.requiredFields.length > 0, `${tool.title} requires nothing, so it can be submitted empty`);
      assert.ok(!paths.has(tool.path), `${tool.path} is registered twice`);
      assert.ok(!modules.has(tool.module), `${tool.module} is used twice, so two tools would save as one`);
      paths.add(tool.path);
      modules.add(tool.module);
      // Every required field must be a field the form actually renders,
      // otherwise the tool refuses a submission over a box nobody can fill.
      const names = tool.fields.map((field) => field.name);
      for (const required of tool.requiredFields) {
        assert.ok(names.includes(required), `${tool.title} requires "${required}" but does not render it`);
      }
    }
  });

  // ---- refusing unusable input, rather than printing NaN --------------------

  it("reads a number out of what people actually type", () => {
    assert.equal(numberFrom("$1,500"), 1500);
    assert.equal(numberFrom(" 12.5% "), 12.5);
    assert.equal(numberFrom("about ten"), null, "prose must not become a number");
    assert.equal(numberFrom(""), null);
    assert.equal(numberFrom(undefined), null);
  });

  it("never prints NaN, whatever it is given", () => {
    const nonsense = { fixedCostsMonthly: "loads", pricePerSale: "a bit", variableCostPerSale: "?", cashOnHand: "", shiftsPerWeek: "x", hoursPerShift: "x", staffPerShift: "x", hourlyRate: "x", expectedWeeklySales: "x", totalPrice: "x", depositPercent: "x", instalments: "x", dayRate: "x", revisionsIncluded: "x", sourceLengthMinutes: "x", postsPerWeek: "x", monthlyBudget: "x", targetCostPerLead: "x", leadToCustomerPercent: "x", averageSaleValue: "x", grossMarginPercent: "x", rewardPerReferral: "x", referralsPerMonth: "x", touches: "x", daysBetween: "x", collaborators: "nonsense" };
    for (const tool of PLANNER_TOOLS) {
      const output = tool.build(nonsense);
      assert.doesNotMatch(text(output), /NaN|undefined|null/, `${tool.title} produced a placeholder`);
      assert.ok(Object.keys(output).length > 0, `${tool.title} returned nothing at all`);
    }
  });

  it("names the box it could not read", () => {
    const output = breakEven({ fixedCostsMonthly: "3000", pricePerSale: "lots", variableCostPerSale: "20", cashOnHand: "9000" });
    assert.match(output.couldNotCalculate, /price per sale/);
    assert.match(output.nothingWasGuessed, /No figure has been estimated/);
  });

  // ---- the arithmetic ------------------------------------------------------

  it("works out break-even and runway", () => {
    const output = breakEven({ fixedCostsMonthly: "3000", pricePerSale: "50", variableCostPerSale: "20", cashOnHand: "9000" });
    assert.match(output.contributionPerSale, /\$30\.00/);
    assert.match(output.breakEvenSales, /^100 sales/);
    assert.match(output.breakEvenRevenue, /\$5000\.00/);
    assert.match(output.runway, /3\.0 months/);
  });

  it("says there is no break-even when every sale loses money", () => {
    // The case that matters most. Contribution is negative, so no number of
    // sales reaches break-even and selling more makes it worse.
    const output = breakEven({ fixedCostsMonthly: "3000", pricePerSale: "20", variableCostPerSale: "50", cashOnHand: "9000" });
    assert.match(output.breakEven, /no break-even/i);
    assert.match(output.breakEven, /larger, not smaller/);
    assert.equal(output.breakEvenSales, undefined, "a sales target was given for a price that can never break even");
  });

  it("costs a rota and refuses to call an unknown share zero", () => {
    const output = rotaCost({ shiftsPerWeek: "10", hoursPerShift: "8", staffPerShift: "2", hourlyRate: "15", expectedWeeklySales: "8000" });
    assert.match(output.weeklyHours, /160\.0 paid hours/);
    assert.match(output.weeklyLabourCost, /\$2400\.00/);
    assert.match(output.costPerShift, /\$240\.00/);
    assert.match(output.labourShareOfSales, /30\.0%/);

    const noSales = rotaCost({ shiftsPerWeek: "10", hoursPerShift: "8", staffPerShift: "2", hourlyRate: "15", expectedWeeklySales: "0" });
    assert.match(noSales.labourShareOfSales, /It is not zero/);
  });

  it("builds a payment schedule that adds up", () => {
    const output = paymentSchedule({ totalPrice: "1200", depositPercent: "25", instalments: "3", startDate: "2026-09-01", daysBetween: "30" });
    assert.match(output.depositAmount, /\$300\.00/);
    assert.match(output.remainingBalance, /\$900\.00/);
    assert.match(output.eachPayment, /\$300\.00/);
    assert.match(output.schedule, /2026-09-01/);
    assert.match(output.schedule, /2026-10-01/);
    assert.match(output.cardSafety, /Never write a card number/);
  });

  it("prices a rate card, and says when the licence is missing", () => {
    const output = rateCard({ dayRate: "400", revisionsIncluded: "2", usageTerm: "UK social, 12 months" });
    assert.match(output.standardDay, /\$400\.00/);
    assert.match(output.halfDay, /\$240\.00/);
    assert.match(output.rushRate, /\$600\.00/);
    assert.match(output.revisions, /2 revisions included, then \$100\.00/);

    const noLicence = rateCard({ dayRate: "400", revisionsIncluded: "0" });
    assert.match(noLicence.usage, /sold it forever by default/);
    assert.match(noLicence.revisions, /0 revisions/);
  });

  it("catches splits that do not add to a hundred", () => {
    const good = splitSheet({ workTitle: "Night Drive", collaborators: "Ada:50, Bo:30, Cass:20" });
    assert.match(good.total, /100\.00%/);
    assert.match(good.balanced, /signable/);

    const over = splitSheet({ workTitle: "Night Drive", collaborators: "Ada:60, Bo:60" });
    assert.match(over.balanced, /promised more than exists/);

    const under = splitSheet({ workTitle: "Night Drive", collaborators: "Ada:50, Bo:30" });
    assert.match(under.balanced, /unaccounted for/);

    const malformed = splitSheet({ workTitle: "Night Drive", collaborators: "Ada, Bo:30" });
    assert.match(malformed.whatToDo, /Name:percent/);
  });

  it("plans repurposing from the length of the source", () => {
    const output = repurposePlan({ sourceTitle: "Studio session", sourceLengthMinutes: "60", postsPerWeek: "3", formats: "short clip, quote card" });
    assert.match(output.usableClips, /About 30 usable clips/);
    assert.match(output.totalPieces, /60 pieces/);
    assert.match(output.weeksOfContent, /20\.0 weeks/);
  });

  it("splits a budget and states the break-even cost per lead", () => {
    const output = budgetSplit({ monthlyBudget: "2000", targetCostPerLead: "20", leadToCustomerPercent: "10", averageSaleValue: "500", channels: "search, social" });
    assert.match(output.perChannel, /\$1000\.00/);
    assert.match(output.expectedLeads, /About 100 leads/);
    assert.match(output.expectedCustomers, /10\.0 customers/);
    assert.match(output.expectedRevenue, /\$5000\.00/);
    assert.match(output.breakEvenCostPerLead, /\$50\.00/);
    assert.match(output.verdict, /returns \$3000\.00/);

    const losing = budgetSplit({ monthlyBudget: "2000", targetCostPerLead: "20", leadToCustomerPercent: "1", averageSaleValue: "100", channels: "search" });
    assert.match(losing.verdict, /loses \$1900\.00/);
  });

  it("says when a referral reward costs more than the margin", () => {
    const affordable = referralReward({ averageSaleValue: "500", grossMarginPercent: "40", rewardPerReferral: "50", referralsPerMonth: "10" });
    assert.match(affordable.marginPerSale, /\$200\.00/);
    assert.match(affordable.netPerReferral, /\$150\.00 kept/);
    assert.match(affordable.monthlyEffect, /\$1500\.00/);

    const unaffordable = referralReward({ averageSaleValue: "500", grossMarginPercent: "10", rewardPerReferral: "80", referralsPerMonth: "10" });
    assert.match(unaffordable.netPerReferral, /costs you money/);
    assert.match(unaffordable.ownerApproval, /payout change/);
  });

  it("dates a follow-up sequence and gives it an end", () => {
    const output = followUpSchedule({ leadName: "Jordan", touches: "4", daysBetween: "3", firstContactDate: "2026-09-01", channel: "email" });
    assert.match(output.schedule, /2026-09-01 \(email\)/);
    assert.match(output.schedule, /2026-09-10/);
    assert.match(output.lastContact, /2026-09-10/);
    assert.match(output.stopRule, /Stop at the last step/);
    assert.match(output.sending, /Nothing here is sent for you/);
  });

  it("caps the counts that would otherwise run away", () => {
    // A customer typing 900 instalments or 400 follow-ups is a customer who
    // made a mistake, and a page with 900 rows on it helps nobody.
    const payments = paymentSchedule({ totalPrice: "1200", depositPercent: "10", instalments: "900" });
    assert.ok(payments.schedule.split(" | ").length <= 25, "an unbounded schedule was produced");
    const follow = followUpSchedule({ leadName: "Jordan", touches: "400", daysBetween: "1" });
    assert.ok(follow.schedule.split(" | ").length <= 12, "an unbounded sequence was produced");
  });
});
