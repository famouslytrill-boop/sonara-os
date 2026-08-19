"use strict";

// Nine planning tools -- three for each product line.
//
// ## Why these are calculators rather than generators
//
// The fifteen tools that came before are mostly outline and script builders:
// they take words and give back better-organised words. What a small business
// actually gets stuck on is arithmetic it does not trust itself to do -- what
// price covers the cost, how long the cash lasts, whether a referral reward is
// affordable, whether the splits add to a hundred. Those are questions with one
// right answer, and a wrong answer is expensive.
//
// So every tool here is deterministic. No model call, no provider, no network,
// no per-customer cost, and the same inputs always give the same output. That
// matters beyond the bill: `docs/SHIP_READINESS.md` records eleven catalog
// products removed for describing work that did not exist, and the cheapest way
// to avoid repeating that is to ship things that compute.
//
// ## Numbers that cannot be used are said, not shown
//
// `Number("about ten")` is `NaN`, and `NaN` formatted into a page reads as a
// broken product. Every input goes through `numberFrom`, which returns null
// rather than NaN, and every tool checks its required numbers before doing any
// arithmetic. A tool given unusable input says which box it could not read.
// This is the same rule the rest of this codebase follows for reads: do not
// state a figure you did not establish.

// ---------------------------------------------------------------------------
// Shared helpers. Deliberately local: these are pure, and importing the route
// file's copies would tie a data module to a route module.
// ---------------------------------------------------------------------------

function numberFrom(value) {
  const cleaned = String(value == null ? "" : value).replace(/[$£€,\s%]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value) {
  return `$${value.toFixed(2)}`;
}

function whole(value) {
  return String(Math.round(value));
}

function listFrom(value) {
  return String(value == null ? "" : value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

// What a tool answers when it cannot use what it was given. Named fields, so
// the customer knows which box to look at rather than being told "invalid
// input" about a form with six of them.
function unusable(labels) {
  return {
    couldNotCalculate: `We could not read ${labels.join(" or ")} as a number, so nothing below would be trustworthy.`,
    whatToDo: "Enter digits only for those boxes -- 1500 rather than about 1.5k -- and run it again.",
    nothingWasGuessed: "No figure has been estimated or rounded in place of what was typed."
  };
}

// Returns { ok: true, values } or { ok: false, output }. Every tool starts here.
function readNumbers(body, spec) {
  const values = {};
  const bad = [];
  for (const [key, label] of Object.entries(spec)) {
    const parsed = numberFrom(body[key]);
    if (parsed === null || parsed < 0) bad.push(label);
    else values[key] = parsed;
  }
  return bad.length ? { ok: false, output: unusable(bad) } : { ok: true, values };
}

function addDays(dateText, days) {
  const start = new Date(String(dateText || "").trim());
  const base = Number.isNaN(start.getTime()) ? new Date() : start;
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Business Builder
// ---------------------------------------------------------------------------

function breakEven(body) {
  const read = readNumbers(body, {
    fixedCostsMonthly: "monthly fixed costs",
    pricePerSale: "price per sale",
    variableCostPerSale: "cost per sale",
    cashOnHand: "cash on hand"
  });
  if (!read.ok) return read.output;
  const { fixedCostsMonthly, pricePerSale, variableCostPerSale, cashOnHand } = read.values;

  const contribution = pricePerSale - variableCostPerSale;
  if (contribution <= 0) {
    // Not an error -- a real and important answer. Every sale loses money, so
    // there is no sales figure that reaches break-even, and saying "0 sales
    // needed" would be the most dangerous possible rounding.
    return {
      contributionPerSale: `${money(contribution)} -- each sale loses money before any fixed costs.`,
      breakEven: "There is no break-even at this price. Selling more makes the loss larger, not smaller.",
      whatToChange: `Raise the price above ${money(variableCostPerSale)}, or cut the cost per sale below ${money(pricePerSale)}.`,
      runway: `At ${money(fixedCostsMonthly)} a month, ${money(cashOnHand)} covers ${fixedCostsMonthly > 0 ? (cashOnHand / fixedCostsMonthly).toFixed(1) : "an unlimited number of"} months of fixed costs while this stays true.`,
      nextAction: "Fix the unit economics before spending anything on getting more customers."
    };
  }

  const salesNeeded = fixedCostsMonthly / contribution;
  const runwayMonths = fixedCostsMonthly > 0 ? cashOnHand / fixedCostsMonthly : null;
  return {
    contributionPerSale: `${money(contribution)} left from every sale after its own costs.`,
    breakEvenSales: `${whole(Math.ceil(salesNeeded))} sales a month covers your fixed costs.`,
    breakEvenRevenue: `${money(Math.ceil(salesNeeded) * pricePerSale)} of sales a month.`,
    runway: runwayMonths === null
      ? "With no fixed costs recorded, cash on hand is not being consumed by overheads."
      : `${runwayMonths.toFixed(1)} months of fixed costs are covered by the cash you have, before counting sales.`,
    oneMoreSale: `Each sale beyond break-even adds ${money(contribution)} to what you keep.`,
    nextAction: "Check the price against three comparable offers, then set the monthly sales target above break-even rather than at it."
  };
}

function rotaCost(body) {
  const read = readNumbers(body, {
    shiftsPerWeek: "shifts per week",
    hoursPerShift: "hours per shift",
    staffPerShift: "staff per shift",
    hourlyRate: "hourly rate",
    expectedWeeklySales: "expected weekly sales"
  });
  if (!read.ok) return read.output;
  const { shiftsPerWeek, hoursPerShift, staffPerShift, hourlyRate, expectedWeeklySales } = read.values;

  const weeklyHours = shiftsPerWeek * hoursPerShift * staffPerShift;
  const weeklyCost = weeklyHours * hourlyRate;
  const costPerShift = shiftsPerWeek > 0 ? weeklyCost / shiftsPerWeek : 0;
  const share = expectedWeeklySales > 0 ? (weeklyCost / expectedWeeklySales) * 100 : null;

  return {
    weeklyHours: `${weeklyHours.toFixed(1)} paid hours a week across all shifts.`,
    weeklyLabourCost: `${money(weeklyCost)} a week in wages, before tax, pension or holiday pay.`,
    costPerShift: `${money(costPerShift)} for one shift, fully staffed.`,
    // Null rather than 0%. A week with no expected sales has no meaningful
    // labour share, and printing "0%" would read as excellent.
    labourShareOfSales: share === null
      ? "No expected sales entered, so the share of sales cannot be worked out. It is not zero."
      : `${share.toFixed(1)}% of expected sales goes on wages for these shifts.`,
    whatItExcludes: "Employer tax, pension, holiday pay, training time and overtime are not in this figure.",
    nextAction: "Compare the share against what you know your trade runs at, then adjust staff per shift before adjusting the rate."
  };
}

function paymentSchedule(body) {
  const read = readNumbers(body, {
    totalPrice: "total price",
    depositPercent: "deposit percentage",
    instalments: "number of instalments"
  });
  if (!read.ok) return read.output;
  const { totalPrice, depositPercent } = read.values;
  const instalments = Math.max(1, Math.min(Math.round(read.values.instalments), 24));
  const capped = Math.min(depositPercent, 100);

  const deposit = totalPrice * (capped / 100);
  const remaining = totalPrice - deposit;
  const each = remaining / instalments;
  const daysBetween = Number(numberFrom(body.daysBetween) ?? 30);

  const rows = [];
  rows.push(`Deposit ${money(deposit)} due on ${addDays(body.startDate, 0)}`);
  for (let index = 1; index <= instalments; index += 1) {
    rows.push(`Payment ${index} of ${instalments}: ${money(each)} due on ${addDays(body.startDate, daysBetween * index)}`);
  }

  return {
    depositAmount: `${money(deposit)} (${capped}% of ${money(totalPrice)}).`,
    remainingBalance: `${money(remaining)} across ${instalments} payment${instalments === 1 ? "" : "s"}.`,
    eachPayment: `${money(each)} per payment.`,
    schedule: rows.join(" | "),
    // The rounding is stated rather than hidden. Thirds of a price do not divide
    // evenly and the customer will notice the last payment being a penny out.
    rounding: `Payments are shown to the cent; adjust the final one by up to ${money(0.01 * instalments)} so the total is exactly ${money(totalPrice)}.`,
    cardSafety: "Take payment through your payment provider. Never write a card number or security code on a quote, an invoice or into this workspace."
  };
}

// ---------------------------------------------------------------------------
// Creator Studio
// ---------------------------------------------------------------------------

function rateCard(body) {
  const read = readNumbers(body, { dayRate: "day rate", revisionsIncluded: "revisions included" });
  if (!read.ok) return read.output;
  const { dayRate } = read.values;
  const revisions = Math.max(0, Math.round(read.values.revisionsIncluded));
  const rush = numberFrom(body.rushMultiplier);
  const rushMultiplier = rush === null || rush < 1 ? 1.5 : rush;
  const extra = numberFrom(body.extraRevisionRate);
  const extraRate = extra === null ? dayRate * 0.25 : extra;

  return {
    standardDay: `${money(dayRate)} per day.`,
    halfDay: `${money(dayRate * 0.6)} per half day -- deliberately more than half, because a half day still costs you the rest of the day.`,
    rushRate: `${money(dayRate * rushMultiplier)} per day when the turnaround is shorter than agreed (${rushMultiplier}x).`,
    usage: String(body.usageTerm || "").trim()
      ? `Licence: ${String(body.usageTerm).trim()}. Anything outside that is a new agreement, not a favour.`
      : "Licence: not stated. Write down where the work may be used and for how long, or you have sold it forever by default.",
    revisions: `${revisions} revision${revisions === 1 ? "" : "s"} included, then ${money(extraRate)} each.`,
    ownership: "Say in writing who owns the finished work and when ownership transfers -- usually on final payment, not on delivery."
  };
}

function splitSheet(body) {
  const entries = listFrom(body.collaborators).map((entry) => {
    const [name, share] = entry.split(":");
    return { name: String(name || "").trim(), share: numberFrom(share) };
  });

  if (!entries.length) {
    return unusable(["the collaborator list"]);
  }
  const unreadable = entries.filter((entry) => entry.share === null || !entry.name);
  if (unreadable.length) {
    return {
      couldNotCalculate: `These entries are not in the expected form: ${unreadable.map((entry) => entry.name || "(no name)").join(", ")}.`,
      whatToDo: "Write each collaborator as Name:percent, separated by commas -- for example Ada:50, Bo:30, Cass:20.",
      nothingWasGuessed: "No share has been assumed for anybody."
    };
  }

  const total = entries.reduce((sum, entry) => sum + entry.share, 0);
  const balanced = Math.abs(total - 100) < 0.01;
  return {
    work: String(body.workTitle || "Untitled work").trim(),
    splits: entries.map((entry) => `${entry.name}: ${entry.share}%`).join(" | "),
    total: `${total.toFixed(2)}%`,
    // The whole point of a split sheet. 99% is a dispute waiting to happen and
    // 101% is a promise that cannot be kept.
    balanced: balanced
      ? "The shares add up to 100%. This is signable."
      : `The shares add up to ${total.toFixed(2)}%, not 100%. ${total > 100 ? "You have promised more than exists" : "Somebody is unaccounted for"} -- fix this before anybody signs.`,
    creditsBlock: entries.map((entry) => entry.name).join(", "),
    consent: "Everybody named must agree in writing before this is published, and a recorded voice or likeness needs its own permission."
  };
}

function repurposePlan(body) {
  const read = readNumbers(body, { sourceLengthMinutes: "source length in minutes", postsPerWeek: "posts per week" });
  if (!read.ok) return read.output;
  const minutes = read.values.sourceLengthMinutes;
  const postsPerWeek = Math.max(1, Math.round(read.values.postsPerWeek));
  const formats = listFrom(body.formats);
  const chosen = formats.length ? formats : ["short clip", "quote card", "written summary"];

  // One usable clip per two minutes of source is deliberately conservative:
  // planning around every minute producing something is how a content calendar
  // becomes a backlog of things nobody made.
  const clips = Math.max(1, Math.floor(minutes / 2));
  const pieces = clips * chosen.length;
  const weeks = pieces / postsPerWeek;

  return {
    source: `${String(body.sourceTitle || "Untitled").trim()} -- ${minutes} minutes.`,
    usableClips: `About ${clips} usable clip${clips === 1 ? "" : "s"}, at one per two minutes of source.`,
    formats: chosen.join(", "),
    totalPieces: `${pieces} piece${pieces === 1 ? "" : "s"} across those formats.`,
    weeksOfContent: `${weeks.toFixed(1)} weeks at ${postsPerWeek} post${postsPerWeek === 1 ? "" : "s"} a week.`,
    order: "Publish the strongest clip first, not chronologically. The first one decides whether anybody sees the second.",
    rights: "Check that music, footage and anybody appearing in the source are cleared for each format before it goes out."
  };
}

// ---------------------------------------------------------------------------
// Growth Studio
// ---------------------------------------------------------------------------

function budgetSplit(body) {
  const read = readNumbers(body, {
    monthlyBudget: "monthly budget",
    targetCostPerLead: "target cost per lead",
    leadToCustomerPercent: "lead to customer percentage",
    averageSaleValue: "average sale value"
  });
  if (!read.ok) return read.output;
  const { monthlyBudget, targetCostPerLead, leadToCustomerPercent, averageSaleValue } = read.values;
  const channels = listFrom(body.channels);
  const chosen = channels.length ? channels : ["one channel"];

  if (targetCostPerLead <= 0) {
    return {
      couldNotCalculate: "A target cost per lead of zero would mean leads arrive for nothing, and no number below would mean anything.",
      whatToDo: "Enter what you are willing to pay for one lead, even as a rough figure.",
      nothingWasGuessed: "No cost has been assumed on your behalf."
    };
  }

  const perChannel = monthlyBudget / chosen.length;
  const leads = monthlyBudget / targetCostPerLead;
  const customers = leads * (leadToCustomerPercent / 100);
  const revenue = customers * averageSaleValue;
  const breakEvenCostPerLead = leads > 0 && leadToCustomerPercent > 0
    ? averageSaleValue * (leadToCustomerPercent / 100)
    : null;

  return {
    perChannel: `${money(perChannel)} a month to each of: ${chosen.join(", ")}.`,
    expectedLeads: `About ${whole(leads)} leads a month at ${money(targetCostPerLead)} each.`,
    expectedCustomers: `About ${customers.toFixed(1)} customers, at a ${leadToCustomerPercent}% conversion.`,
    expectedRevenue: `${money(revenue)} a month.`,
    breakEvenCostPerLead: breakEvenCostPerLead === null
      ? "With no conversion rate entered, there is no cost per lead at which this breaks even."
      : `${money(breakEvenCostPerLead)} -- above this, every lead costs more than it brings in.`,
    verdict: revenue >= monthlyBudget
      ? `At these figures the spend returns ${money(revenue - monthlyBudget)} a month. Treat it as a forecast, not a promise.`
      : `At these figures the spend loses ${money(monthlyBudget - revenue)} a month. Change the conversion rate or the sale value before increasing the budget.`,
    honesty: "These are your own assumptions worked through. Nothing here is measured, and no channel is guaranteed to deliver at your target cost."
  };
}

function referralReward(body) {
  const read = readNumbers(body, {
    averageSaleValue: "average sale value",
    grossMarginPercent: "gross margin percentage",
    rewardPerReferral: "reward per referral",
    referralsPerMonth: "referrals per month"
  });
  if (!read.ok) return read.output;
  const { averageSaleValue, grossMarginPercent, rewardPerReferral, referralsPerMonth } = read.values;

  const marginPerSale = averageSaleValue * (Math.min(grossMarginPercent, 100) / 100);
  const netPerReferral = marginPerSale - rewardPerReferral;
  const monthlyNet = netPerReferral * referralsPerMonth;

  return {
    marginPerSale: `${money(marginPerSale)} kept from a ${money(averageSaleValue)} sale at ${grossMarginPercent}% margin.`,
    rewardCost: `${money(rewardPerReferral)} paid out per successful referral.`,
    netPerReferral: netPerReferral >= 0
      ? `${money(netPerReferral)} kept per referred customer, after the reward.`
      : `${money(netPerReferral)} -- every referred customer costs you money after the reward.`,
    monthlyEffect: `${money(monthlyNet)} a month at ${referralsPerMonth} referrals.`,
    maxAffordableReward: `${money(marginPerSale)} is the most you can pay before a referral stops being worth having. Staying well under it is what makes the programme survive a bad month.`,
    ownerApproval: "Paying money to customers is a payout change. Set it up, then have it approved before it goes live."
  };
}

function followUpSchedule(body) {
  const read = readNumbers(body, { touches: "number of follow-ups", daysBetween: "days between follow-ups" });
  if (!read.ok) return read.output;
  const touches = Math.max(1, Math.min(Math.round(read.values.touches), 12));
  const daysBetween = Math.max(1, Math.round(read.values.daysBetween));
  const channel = String(body.channel || "email").trim() || "email";
  const lead = String(body.leadName || "the lead").trim() || "the lead";

  const purposes = [
    "say thank you and confirm what they asked about",
    "answer the objection they are most likely to have",
    "send one piece of proof -- a result, a photo, a reference",
    "offer a specific time rather than asking when suits",
    "ask plainly whether now is the wrong time",
    "close the loop and say you will stop here"
  ];

  const rows = [];
  for (let index = 0; index < touches; index += 1) {
    const purpose = purposes[Math.min(index, purposes.length - 1)];
    rows.push(`${addDays(body.firstContactDate, daysBetween * index)} (${channel}): ${purpose}`);
  }

  return {
    lead,
    schedule: rows.join(" | "),
    lastContact: `Last planned contact: ${addDays(body.firstContactDate, daysBetween * (touches - 1))}.`,
    stopRule: "Stop at the last step whether or not they reply. A sequence with no end is the thing people remember you for.",
    consent: "Only run this against somebody who gave you their details for this purpose, and honour an unsubscribe or a request to stop immediately.",
    sending: "Nothing here is sent for you. This is a plan you or your team follow."
  };
}

// ---------------------------------------------------------------------------
// The registrations. `build` takes the submitted body and returns the output
// object the result page renders and the workspace saves.
// ---------------------------------------------------------------------------


// When to reorder, and how much.
//
// lib/sonara-formula-library.cjs already defines reorder_point as
// `(average_daily_usage * lead_time_days) + safety_stock` -- and takes
// safety_stock as an input, which is the only hard part of the question. This
// works it out, from the days the owner actually sold.
//
// The arithmetic is lib/sonara-inventory-science.cjs, which is tested against
// published normal quantiles and against two properties of the order quantity
// that hold whatever the implementation is.
function reorderPlan(body) {
  const science = require("./sonara-inventory-science.cjs");

  // The daily quantities, typed or pasted. Commas, spaces or new lines, because
  // this is going to be copied out of a spreadsheet column and a form that only
  // accepted one separator would be a form nobody could use.
  const raw = String(body?.dailyUnitsSold || "").trim();
  const parts = raw.split(/[\s,;]+/).filter(Boolean);
  const quantities = parts.map(Number);
  if (!parts.length || quantities.some((value) => !Number.isFinite(value))) {
    return {
      couldNotCalculate: "We could not read the daily quantities as numbers, so nothing below would be trustworthy.",
      whatToDo: "Paste the units sold on each selling day, separated by commas, spaces or new lines -- 4, 0, 7, 2 -- and run it again.",
      nothingWasGuessed: "No figure has been estimated in place of what was typed."
    };
  }

  const read = readNumbers(body, {
    daysInPeriod: "days in the period",
    leadTimeDays: "supplier lead time",
    serviceLevelPercent: "service level"
  });
  if (!read.ok) return read.output;
  const { daysInPeriod, leadTimeDays, serviceLevelPercent } = read.values;

  const stats = science.demandStatistics(quantities, daysInPeriod);
  if (!stats.ok) {
    return {
      couldNotCalculate: stats.message,
      whatToDo: stats.code === "not_enough_history"
        ? `Come back with at least ${science.MINIMUM_DAYS} days. A shorter run cannot tell a quiet week from a normal one.`
        : "Check the daily quantities and the number of days against each other, and run it again.",
      nothingWasGuessed: "No demand figure has been estimated in place of the history."
    };
  }

  const buffer = science.safetyStock({
    standardDeviationDaily: stats.standardDeviationDaily,
    meanDaily: stats.meanDaily,
    leadTimeDays,
    serviceLevel: serviceLevelPercent / 100,
    leadTimeStandardDeviationDays: numberFrom(body?.leadTimeVariationDays) || 0
  });
  if (!buffer.ok) {
    return {
      couldNotCalculate: buffer.message,
      whatToDo: "Check the lead time and the service level, and run it again.",
      nothingWasGuessed: "No buffer has been estimated."
    };
  }

  const point = science.reorderPoint({
    meanDaily: stats.meanDaily,
    leadTimeDays,
    safetyStockUnits: buffer.units
  });

  const output = {
    demandPerDay: `${stats.meanDaily.toFixed(2)} units a day on average, across all ${whole(stats.daysObserved)} days -- not just the ${whole(stats.daysWithSales)} you sold on.`,
    howMuchItVaries: stats.coefficientOfVariation === null
      ? "Nothing sold in this period, so there is no spread to measure."
      : `Daily demand swings by about ${stats.standardDeviationDaily.toFixed(2)} units either side of that${stats.coefficientOfVariation > 1 ? " -- which is more than the average itself, so this item is lumpy rather than steady" : ""}.`,
    safetyStock: `${Math.ceil(buffer.units)} units of buffer, to cover demand running high while you wait.`,
    reorderPoint: `Order more when stock drops to ${Math.ceil(point.units)} units.`,
    howThatSplits: `${Math.ceil(point.demandDuringLeadTime)} units is what you would normally sell in ${whole(leadTimeDays)} days; the other ${Math.ceil(buffer.units)} is the buffer.`,
    whyNotDouble: `A ${whole(leadTimeDays)}-day wait needs about ${Math.sqrt(leadTimeDays).toFixed(2)} times the buffer of a one-day wait, not ${whole(leadTimeDays)} times -- uncertainty grows with the square root of the wait, which is the part that is easy to get wrong by hand.`
  };

  // The order quantity is optional, because it needs two costs the reorder
  // point does not, and asking for them as required would stop somebody who
  // only wanted to know when to order.
  const orderCost = numberFrom(body?.costPerOrder);
  const holdingCost = numberFrom(body?.holdingCostPerUnitPerYear);
  if (orderCost > 0 && holdingCost > 0) {
    const annualDemand = stats.meanDaily * 365;
    const quantity = science.economicOrderQuantity({
      annualDemandUnits: annualDemand,
      orderCostCents: orderCost * 100,
      holdingCostCentsPerUnitPerYear: holdingCost * 100
    });
    if (quantity.ok) {
      output.howMuchToOrder = `${Math.ceil(quantity.units)} units at a time, which works out at about ${quantity.ordersPerYear.toFixed(1)} orders a year.`;
      output.whyThatMuch = `At that size what you spend ordering (${money(quantity.annualOrderingCostCents / 100)} a year) matches what you spend holding stock (${money(quantity.annualHoldingCostCents / 100)} a year). That balance is the whole point of the figure.`;
      output.doNotChaseIt = `The cost curve is flat near the bottom: ordering 20% more or less than this costs under 3% more in total. Round it to a case or a pallet without worrying.`;
    }
  }

  output.whatThisAssumes = "That the next few months look like the days you entered. A new product, a price change or a season this history does not cover makes it a starting point rather than an answer.";
  output.nextAction = orderCost > 0 && holdingCost > 0
    ? "Set the reorder level on the item, then check it again after a season."
    : "Set the reorder level on the item. To also get an order size, come back with what one order costs you to place and what it costs to hold a unit for a year.";
  return output;
}


// ---------------------------------------------------------------------------
// Three tools over lib/sonara-operations-science.cjs
// ---------------------------------------------------------------------------

// One stop per line: a name, then a latitude and a longitude.
//
// Parsed leniently on the separator and strictly on the numbers. A customer
// pasting a column out of a spreadsheet gets tabs; one typing it gets commas;
// one copying from a maps app gets "51.5074, -0.1278" with the name in front. A
// name containing a comma still works, because the last two fields are taken as
// the coordinates and everything before them is the name.
function parseStopLines(raw) {
  const rows = [];
  for (const line of String(raw == null ? "" : raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[\t,;]+|\s{2,}/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      rows.push({ name: trimmed, latitude: NaN, longitude: NaN });
      continue;
    }
    const longitude = numberFrom(parts[parts.length - 1]);
    const latitude = numberFrom(parts[parts.length - 2]);
    const name = parts.slice(0, -2).join(", ").trim();
    rows.push({ name: name || trimmed, latitude: latitude == null ? NaN : latitude, longitude: longitude == null ? NaN : longitude });
  }
  return rows;
}

function stopOrder(body) {
  const science = require("./sonara-operations-science.cjs");
  const stops = parseStopLines(body?.stops);
  if (!stops.length) {
    return {
      couldNotCalculate: "No stops were entered, so there is nothing to put in order.",
      whatToDo: "Put one stop on each line: a name, then the latitude and the longitude. Kensington, 51.4988, -0.1749",
      nothingWasGuessed: "No location has been looked up or invented."
    };
  }

  // A tick box that is absent is not a tick box that is off, except that in an
  // HTML form it is exactly that -- an unticked box is not submitted at all. So
  // the default is "yes, come back to base", and only the string "no" turns it
  // off, rather than treating every absent field as a refusal.
  const returnToStart = String(body?.returnToStart || "yes").trim().toLowerCase() !== "no";
  const result = science.sequenceStops(stops, { returnToStart });
  if (!result.ok) {
    return {
      couldNotCalculate: result.message,
      whatToDo: result.skipped?.length
        ? `These lines had no usable latitude and longitude: ${result.skipped.join("; ")}. Each stop needs both, as plain numbers.`
        : "Put one stop on each line, with its latitude and longitude as plain numbers.",
      nothingWasGuessed: "No location has been looked up or invented."
    };
  }

  const output = {
    driveThemInThisOrder: result.order.map((stop) => `${stop.position}. ${stop.name}`).join("  →  "),
    howFarThatIs: `${result.kilometres.toFixed(1)} km (${result.miles.toFixed(1)} miles) across ${whole(result.stopCount)} stops${result.returnToStart ? ", ending back where you started" : ", finishing at the last stop"}.`,
    againstTheOrderYouGave: result.savedMetres > 0
      ? `That is ${(result.savedMetres / 1000).toFixed(1)} km shorter than driving them in the order you typed -- about ${result.savedPercent.toFixed(0)}% less.`
      : "That is the same length as the order you typed, so the round you already drive is a good one. Keep driving it.",
    whatThisIsMeasuring: `Straight-line distance between the points, not driving distance. Real roads are usually a fifth to a third longer, and the ${result.returnToStart ? "order" : "sequence"} is what this gets right, not the mileage.`,
    howItWorkedItOut: `Nearest stop first, then repeatedly reversing stretches of the round wherever that made it shorter, until nothing did (${whole(result.twoOptPasses)} ${result.twoOptPasses === 1 ? "pass" : "passes"}). No mapping service was called and nothing was sent anywhere.`
  };
  if (result.skipped.length) {
    output.stopsLeftOut = `Left out because they had no usable latitude and longitude: ${result.skipped.join("; ")}.`;
  }
  output.nextAction = "Check the order against what you know -- one-way streets, a customer who is only in after two, a delivery window. This gets the geography right and knows none of that.";
  return output;
}

function demandForecast(body) {
  const science = require("./sonara-operations-science.cjs");
  const raw = String(body?.history || "").trim();
  const parts = raw.split(/[\s,;]+/).filter(Boolean);
  const series = parts.map(Number);
  if (!parts.length || series.some((value) => !Number.isFinite(value))) {
    return {
      couldNotCalculate: "We could not read the history as numbers, so nothing below would be trustworthy.",
      whatToDo: "Paste how many you sold in each period, oldest first, separated by commas, spaces or new lines -- 12, 14, 13, 16.",
      nothingWasGuessed: "No figure has been estimated in place of what was typed."
    };
  }

  const read = readNumbers(body, { periodsAhead: "how many periods ahead" });
  if (!read.ok) return read.output;

  const result = science.forecastDemand(series, { horizon: read.values.periodsAhead });
  if (!result.ok) {
    return {
      couldNotCalculate: result.message,
      whatToDo: `Come back with at least ${science.MIN_OBSERVATIONS} periods. A trend fitted to fewer is a line through noise.`,
      nothingWasGuessed: "No demand figure has been estimated in place of the history."
    };
  }

  const direction = result.trendPerPeriod > 0.01 ? "rising" : result.trendPerPeriod < -0.01 ? "falling" : "flat";
  const output = {
    whatItExpects: result.periods.map((entry) => `Period ${entry.period}: ${entry.forecast.toFixed(1)}`).join("  ·  "),
    overThatWholeStretch: `${result.total.toFixed(0)} in total across the next ${whole(result.horizon)} ${result.horizon === 1 ? "period" : "periods"}.`,
    whichWayItIsGoing: direction === "flat"
      ? `Flat. Demand is averaging ${result.observedMean.toFixed(1)} a period and is not trending either way.`
      : `${direction === "rising" ? "Rising" : "Falling"} by about ${Math.abs(result.trendPerPeriod).toFixed(2)} a period, from a current level of ${result.level.toFixed(1)}.`,
    // The honest part, and the part most forecasting tools omit. A method that
    // cannot beat "the same as last time" is not worth the page it is on, and a
    // customer is owed that in a sentence rather than a footnote.
    howWrongItUsuallyIs: result.beatsNaive === false
      ? `On your own history this is typically out by ${result.meanAbsoluteError.toFixed(1)} a period -- worse than simply assuming each period matches the one before it (${result.naiveMeanAbsoluteError.toFixed(1)}). Your demand is close to random, and the honest thing is to plan around the average of ${result.observedMean.toFixed(1)} rather than around this line.`
      : `On your own history this is typically out by ${result.meanAbsoluteError.toFixed(1)} a period, against ${result.naiveMeanAbsoluteError.toFixed(1)} for simply assuming each period matches the one before it. Plan for the forecast, but hold enough to absorb being out by that much.`,
    whatThisAssumes: result.basis,
    howItWorkedItOut: `Exponential smoothing with a trend, fitted to your ${whole(result.observations)} periods by trying every combination of two settings and keeping the one with the smallest error (level ${result.alpha}, trend ${result.beta}). Same numbers in, same answer out, every time.`
  };
  output.nextAction = "Feed the forecast into the stock reorder planner as your daily demand, or use the total to decide what to order for the period.";
  return output;
}

function duplicateCustomers(body) {
  const science = require("./sonara-operations-science.cjs");
  // One customer per line: name, then optionally an email and a phone. The
  // fields are recognised by shape rather than by position, because a list
  // pasted out of a spreadsheet has them in whatever order that sheet used.
  const rows = [];
  for (const line of String(body?.customers || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[\t,;]+/).map((part) => part.trim()).filter(Boolean);
    const email = parts.find((part) => /^[^@\s]+@[^@\s]+$/.test(part)) || "";
    const phone = parts.find((part) => part !== email && /\d/.test(part) && part.replace(/\D/g, "").length >= 7) || "";
    // Every remaining field, joined -- not the first one. A list exported with
    // the name as two columns gives "Taylor" and "Sam" as separate fields, and
    // taking only the first turns one person into a surname. Joined, the
    // similarity check's token sort then matches it against "Sam Taylor".
    const name = parts.filter((part) => part !== email && part !== phone).join(" ").trim();
    rows.push({ id: String(rows.length + 1), name, email, phone });
  }

  const result = science.findDuplicateCustomers(rows);
  if (!result.ok) {
    return {
      couldNotCalculate: result.message,
      whatToDo: "Put one customer on each line: their name, and their email or phone if you have it. Sam Taylor, sam@example.com, 555 010 9999",
      nothingWasGuessed: "No record has been changed, merged or removed."
    };
  }

  if (!result.pairs.length) {
    return {
      nothingLooksDuplicated: `All ${whole(result.compared)} records were compared against each other -- ${whole(result.comparisons)} comparisons -- and none of them look like the same person twice.`,
      whatWasChecked: "Matching email addresses, matching phone numbers, and names that are alike allowing for spelling, accents, punctuation and the first and last name being the wrong way round.",
      nothingWasChanged: result.basis,
      nextAction: "Nothing to do. Run it again after your next import."
    };
  }

  const lines = result.pairs.slice(0, 40).map((pair) => `${pair.left}  ↔  ${pair.right} — ${pair.reason}`);
  const output = {
    theseMayBeTheSamePerson: lines.join("\n"),
    // The buckets are described by what they mean, not by their internal names.
    // "medium" covers an exact name match and a first-and-last swap, and a
    // sentence that claimed one of those for both would be wrong half the time.
    howManyAndHowSure: `${whole(result.pairs.length)} ${result.pairs.length === 1 ? "pair" : "pairs"} out of ${whole(result.comparisons)} comparisons: ${whole(result.high)} worth acting on now (a contact detail matches exactly), ${whole(result.medium)} worth opening (the same name, or the same name reversed), ${whole(result.low)} worth a glance (the name is only similar).`,
    whatWasChecked: "Matching email addresses, matching phone numbers, and names that are alike allowing for spelling, accents, punctuation and the first and last name being the wrong way round.",
    nothingWasChanged: result.basis
  };
  if (result.pairs.length > lines.length) {
    output.moreThanShown = `${whole(result.pairs.length - lines.length)} further pairs were found and are not listed here. Work through these first, run it again, and the rest will be fewer.`;
  }
  output.nextAction = "Open the pairs where a contact detail matches first -- those are the ones worth acting on. Decide which record to keep yourself; nothing here merges anything.";
  return output;
}


// One prediction per line: what you thought would happen, how sure you were,
// and whether it did. "Ad A beats B, 80%, yes"
function parsePredictionLines(raw) {
  const rows = [];
  for (const line of String(raw == null ? "" : raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Empty fields are kept, not filtered. "Still open, 50," is a call whose
    // outcome nobody has recorded yet, and dropping the empty last field turns
    // it into a call with no confidence -- which reads back to the customer as
    // "we could not understand this" instead of "this one has not settled".
    const parts = trimmed.split(/[\t,;]/).map((part) => part.trim());
    while (parts.length > 3 && parts[parts.length - 1] === "") parts.pop();
    if (parts.filter(Boolean).length < 2) {
      rows.push({ label: trimmed, predicted: null, outcome: null });
      continue;
    }
    // The confidence and the outcome are the last two fields; everything before
    // them is the label, so a label containing a comma still works.
    const outcome = parts[parts.length - 1];
    const predicted = parts[parts.length - 2];
    const label = parts.slice(0, -2).filter(Boolean).join(", ").trim();
    rows.push({ label: label || trimmed, predicted, outcome });
  }
  return rows;
}

function goalTracker(body) {
  const science = require("./sonara-goal-science.cjs");

  const read = readNumbers(body, {
    baseline: "where it started",
    current: "where it is now",
    target: "the target",
    daysElapsed: "days so far",
    daysTotal: "days in total"
  });
  if (!read.ok) return read.output;

  const progress = science.goalProgress({
    baseline: read.values.baseline,
    current: read.values.current,
    target: read.values.target,
    daysElapsed: read.values.daysElapsed,
    daysTotal: read.values.daysTotal
  });
  if (!progress.ok) {
    return {
      couldNotCalculate: progress.message,
      whatToDo: "Check the baseline, the current figure, the target and the two day counts against each other, and run it again.",
      nothingWasGuessed: "No figure has been estimated in place of what was typed."
    };
  }

  const percent = (value) => `${(value * 100).toFixed(0)}%`;
  const output = {
    howFarAlong: `${percent(progress.progress)} of the way from ${read.values.baseline} to ${read.values.target}, with ${percent(progress.timeUsed)} of the time used.`,
    onTrackOrNot: progress.reached
      ? "You have reached the target. Set the next one from where you are now, not from where you started."
      : progress.onTrack
        ? `Ahead of a straight line by ${percent(Math.abs(progress.aheadBy))}. Keep doing what you are doing.`
        : `Behind a straight line by ${percent(Math.abs(progress.aheadBy))}. That is a gap to close, not a goal lost.`,
    whatTheRestNeedsToLookLike: progress.requiredRatePerDay === null
      ? "The time is up, so there is no rate left to work out. Judge it on where it finished."
      : `${progress.requiredRatePerDay.toFixed(2)} a day for the days that are left, against the ${progress.achievedRatePerDay === null ? "-" : progress.achievedRatePerDay.toFixed(2)} a day you have managed so far.`,
    whatThisIsMeasuring: progress.basis
  };

  // The scoring half is optional, because a goal is worth tracking before
  // anybody has made five predictions about it.
  const predictions = parsePredictionLines(body?.predictions);
  if (predictions.length) {
    const scored = science.scorePredictions(predictions);
    if (!scored.ok) {
      output.howGoodYourCallsAre = scored.message;
      if (scored.unresolved.length) {
        output.stillWaitingOn = `Not counted, because nobody has recorded how they turned out: ${scored.unresolved.join("; ")}.`;
      }
    } else {
      output.howGoodYourCallsAre = `Across ${whole(scored.scored)} settled calls your score is ${scored.brier.toFixed(3)} -- lower is better, 0.25 is what you would get by saying "even chance" to everything.`;
      // The comparison is the point. A score with nothing beside it is a number
      // somebody either ignores or over-reads.
      output.againstKnowingNothing = scored.beatsBaseRate
        ? `Better than simply saying ${percent(scored.baseRate)} to everything, which would have scored ${scored.baseRateBrier.toFixed(3)}. Your calls carry real information.`
        : `No better than simply saying ${percent(scored.baseRate)} to everything, which would have scored ${scored.baseRateBrier.toFixed(3)}. Your confidence is not yet tracking which things actually happen.`;
      output.tooSureOrNotSureEnough = Math.abs(scored.overconfidence) < 0.05
        ? "Your confidence is about right on average -- when you say a number, that is roughly how often it happens."
        : scored.overconfidence > 0
          ? `You are running about ${percent(Math.abs(scored.overconfidence))} too confident on average. Try shading your numbers down.`
          : `You are running about ${percent(Math.abs(scored.overconfidence))} less confident than you need to be. Your calls are better than you think.`;
      const bands = scored.bands
        .filter((band) => band.count > 0)
        .map((band) => `${band.label}: said ${percent(band.saidOnAverage)}, happened ${percent(band.happened)} (${whole(band.count)})`);
      if (bands.length) output.whereYouAreOff = bands.join("  ·  ");
      if (scored.unresolved.length) {
        output.stillWaitingOn = `Not counted, because nobody has recorded how they turned out: ${scored.unresolved.join("; ")}.`;
      }
      if (scored.unusable.length) {
        output.couldNotReadTheseCalls = `No usable confidence on: ${scored.unusable.join("; ")}. Put a percentage on each one.`;
      }
    }
  }

  output.nextAction = "Write down your next call and how sure you are before you make the move, not after. A prediction recorded afterwards is a memory, and memories score themselves generously.";
  return output;
}


function mediaPlacements(body) {
  const science = require("./sonara-media-specs.cjs");
  const read = readNumbers(body, { width: "the width", height: "the height" });
  if (!read.ok) return read.output;

  const plan = science.mediaPlan({
    width: read.values.width,
    height: read.values.height,
    seconds: numberFrom(body?.seconds)
  });
  if (!plan.ok) {
    return {
      couldNotCalculate: plan.message,
      whatToDo: "Give the width and height of the file in pixels, and how long it runs if it is a video.",
      nothingWasGuessed: "Nothing about the file has been assumed."
    };
  }

  const exact = plan.placements.filter((entry) => entry.sameShape);
  const usable = plan.placements.filter((entry) => !entry.sameShape && entry.verdict.startsWith("usable"));
  const costly = plan.placements.filter((entry) => !entry.sameShape && !entry.verdict.startsWith("usable"));

  const output = {
    whatYouHave: `${whole(read.values.width)} by ${whole(read.values.height)} pixels, which is ${plan.source.ratio}${plan.source.seconds ? `, running ${whole(plan.source.seconds)} seconds` : ""}.`,
    whereItFitsAsIs: exact.length
      ? exact.map((entry) => `${entry.label} (${entry.where})`).join("  ·  ")
      : "Nowhere without a crop or bars. Every placement is a different shape from this file.",
    whereItWorksWithACrop: usable.length
      ? usable.map((entry) => `${entry.label}: loses ${(entry.croppedAway * 100).toFixed(0)}% off the ${entry.croppedFrom}`).join("  ·  ")
      : "None of the remaining placements can take this without losing a lot.",
    whereItCostsTooMuch: costly.length
      ? costly.map((entry) => `${entry.label}: ${entry.verdict}`).join("  ·  ")
      : "Nothing here would cost more than it is worth."
  };

  if (plan.tooLong.length) {
    output.tooLongFor = `${plan.tooLong.join(", ")}. Cut it or split it before uploading -- a platform that trims it for you will not choose where.`;
  }

  // The single most useful fact in the module, and the one most often got wrong.
  output.ifThereIsSoundOnIt = science.LOUDNESS_TARGETS
    .map((entry) => `${entry.platform} ${entry.lufs} LUFS`)
    .join("  ·  ") + ". Mastering louder than the target does not make it louder -- the platform turns it back down and you have spent the dynamic range for nothing.";

  output.whatThisIsMeasuring = plan.basis;
  output.whenThisWasChecked = `Platform sizes and loudness targets recorded ${plan.recordedOn}. They change without notice, so check anything that matters against the platform on the day.`;
  output.nextAction = exact.length
    ? "Export the exact fits first, then decide whether the cropped versions still show what matters."
    : "Shoot or export the shape you need most, rather than cropping everything out of one file.";
  return output;
}

const PLANNER_TOOLS = Object.freeze([
  {
    slug: "creator-studio",
    productKey: "creator_studio",
    path: "/creator-studio/tools/media-placements",
    title: "Where This File Fits",
    module: "media_placements",
    description: "What one image or video can be used for, what each crop costs, and what the loudness target is if there is sound on it.",
    submitLabel: "Work out where it fits",
    fields: [
      { name: "width", label: "Width in pixels", required: true },
      { name: "height", label: "Height in pixels", required: true },
      { name: "seconds", label: "How long it runs in seconds, if it is a video (optional)" }
    ],
    requiredFields: ["width", "height"],
    build: mediaPlacements
  },
  {
    slug: "growth-studio",
    productKey: "growth_studio",
    path: "/growth-studio/tools/goal-tracker",
    title: "Goal and Prediction Tracker",
    module: "goal_tracker",
    description: "Whether a goal is on track, and whether the calls you made about it were any good. Scores your past predictions against what actually happened.",
    submitLabel: "Check the goal",
    fields: [
      { name: "baseline", label: "Where it started", required: true },
      { name: "current", label: "Where it is now", required: true },
      { name: "target", label: "Where you want it", required: true },
      { name: "daysElapsed", label: "Days since you started", required: true },
      { name: "daysTotal", label: "Days the goal runs for", required: true },
      { name: "predictions", label: "One call per line, if you have any: what you expected, how sure you were, and whether it happened (optional)" }
    ],
    requiredFields: ["baseline", "current", "target", "daysElapsed", "daysTotal"],
    build: goalTracker
  },
  {
    slug: "business-builder",
    productKey: "business_builder",
    path: "/business-builder/tools/stop-order",
    title: "Round Order Planner",
    module: "stop_order_planner",
    description: "Put your stops in the order that drives shortest, from the coordinates you already have. No mapping service, no account with anyone.",
    submitLabel: "Work out the order",
    fields: [
      { name: "stops", label: "One stop per line: a name, then its latitude and longitude", required: true },
      { name: "returnToStart", label: "Do you come back to where you started? yes or no" }
    ],
    requiredFields: ["stops"],
    build: stopOrder
  },
  {
    slug: "business-builder",
    productKey: "business_builder",
    path: "/business-builder/tools/demand-forecast",
    title: "Demand Forecast",
    module: "demand_forecast",
    description: "What the next few periods look like, from what the last ones did -- and how wrong that usually is, which is the part worth knowing.",
    submitLabel: "Work out the forecast",
    fields: [
      { name: "history", label: "How many you sold in each period, oldest first (commas, spaces or new lines)", required: true },
      { name: "periodsAhead", label: "How many periods ahead to forecast", required: true }
    ],
    requiredFields: ["history", "periodsAhead"],
    build: demandForecast
  },
  {
    slug: "business-builder",
    productKey: "business_builder",
    path: "/business-builder/tools/duplicate-customers",
    title: "Duplicate Customer Check",
    module: "duplicate_customers",
    description: "Which of your customer records look like the same person twice, and why. It finds and reports; you decide what to do.",
    submitLabel: "Check for duplicates",
    fields: [
      { name: "customers", label: "One customer per line: their name, and their email or phone if you have it", required: true }
    ],
    requiredFields: ["customers"],
    build: duplicateCustomers
  },
  {
    slug: "business-builder",
    productKey: "business_builder",
    path: "/business-builder/tools/reorder-point",
    title: "Stock Reorder Planner",
    module: "reorder_point_planner",
    description: "Work out when to reorder and how much, from the days you actually sold rather than a number somebody guessed.",
    submitLabel: "Work out the reorder point",
    fields: [
      { name: "dailyUnitsSold", label: "Units sold on each selling day (commas, spaces or new lines)", required: true },
      { name: "daysInPeriod", label: "How many days that covers, counting days you sold none", required: true },
      { name: "leadTimeDays", label: "Days between ordering and it arriving", required: true },
      { name: "serviceLevelPercent", label: "How often you want to have it in stock, as a percentage (95 is usual)", required: true },
      { name: "leadTimeVariationDays", label: "How many days the delivery usually swings either way (optional)" },
      { name: "costPerOrder", label: "What placing one order costs you in admin and delivery (optional)" },
      { name: "holdingCostPerUnitPerYear", label: "What holding one unit for a year costs you (optional)" }
    ],
    requiredFields: ["dailyUnitsSold", "daysInPeriod", "leadTimeDays", "serviceLevelPercent"],
    build: reorderPlan
  },
  {
    slug: "business-builder",
    productKey: "business_builder",
    path: "/business-builder/tools/break-even",
    title: "Break-Even and Runway",
    module: "break_even_planner",
    description: "Work out how many sales cover your costs, and how long your cash lasts if they do not arrive.",
    submitLabel: "Work out break-even",
    fields: [
      { name: "fixedCostsMonthly", label: "Fixed costs per month (rent, wages, software)", required: true },
      { name: "pricePerSale", label: "Price of one sale", required: true },
      { name: "variableCostPerSale", label: "What one sale costs you to deliver", required: true },
      { name: "cashOnHand", label: "Cash in the business today", required: true }
    ],
    requiredFields: ["fixedCostsMonthly", "pricePerSale", "variableCostPerSale", "cashOnHand"],
    build: breakEven
  },
  {
    slug: "business-builder",
    productKey: "business_builder",
    path: "/business-builder/tools/rota",
    title: "Shift Rota Cost Planner",
    module: "rota_cost_planner",
    description: "Price a week of shifts before you publish the rota, and see what share of sales the wages take.",
    submitLabel: "Cost this rota",
    fields: [
      { name: "shiftsPerWeek", label: "Shifts per week", required: true },
      { name: "hoursPerShift", label: "Hours per shift", required: true },
      { name: "staffPerShift", label: "Staff on each shift", required: true },
      { name: "hourlyRate", label: "Average hourly rate", required: true },
      { name: "expectedWeeklySales", label: "Expected sales for the week", required: true }
    ],
    requiredFields: ["shiftsPerWeek", "hoursPerShift", "staffPerShift", "hourlyRate", "expectedWeeklySales"],
    build: rotaCost
  },
  {
    slug: "business-builder",
    productKey: "business_builder",
    path: "/business-builder/tools/payment-plan",
    title: "Deposit and Payment Schedule",
    module: "payment_schedule_planner",
    description: "Turn an agreed price into a deposit and dated instalments you can put on a quote.",
    submitLabel: "Build the schedule",
    fields: [
      { name: "totalPrice", label: "Total agreed price", required: true },
      { name: "depositPercent", label: "Deposit as a percentage", required: true },
      { name: "instalments", label: "Number of instalments after the deposit", required: true },
      { name: "startDate", label: "Date the deposit is due (YYYY-MM-DD)" },
      { name: "daysBetween", label: "Days between payments (default 30)" }
    ],
    requiredFields: ["totalPrice", "depositPercent", "instalments"],
    build: paymentSchedule
  },
  {
    slug: "creator-studio",
    productKey: "creator_studio",
    path: "/creator-studio/tools/rate-card",
    title: "Rate Card Builder",
    module: "rate_card_builder",
    description: "Turn a day rate into a rate card that says what the licence covers and what a rush costs.",
    submitLabel: "Build my rate card",
    fields: [
      { name: "dayRate", label: "Your day rate", required: true },
      { name: "revisionsIncluded", label: "Revisions included", required: true },
      { name: "usageTerm", label: "Where the work may be used, and for how long" },
      { name: "rushMultiplier", label: "Rush multiplier (default 1.5)" },
      { name: "extraRevisionRate", label: "Charge for an extra revision (default a quarter of the day rate)" }
    ],
    requiredFields: ["dayRate", "revisionsIncluded"],
    build: rateCard
  },
  {
    slug: "creator-studio",
    productKey: "creator_studio",
    path: "/creator-studio/tools/split-sheet",
    title: "Split Sheet and Credits",
    module: "split_sheet_builder",
    description: "Check that everybody's share of a collaborative work adds up to one hundred percent, before anybody signs.",
    submitLabel: "Check the splits",
    fields: [
      { name: "workTitle", label: "Title of the work", required: true },
      { name: "collaborators", label: "Collaborators as Name:percent, comma separated", type: "textarea", required: true }
    ],
    requiredFields: ["workTitle", "collaborators"],
    build: splitSheet
  },
  {
    slug: "creator-studio",
    productKey: "creator_studio",
    path: "/creator-studio/tools/repurpose",
    title: "Repurposing Planner",
    module: "repurpose_planner",
    description: "Work out how many pieces one recording is really worth, and how many weeks of posting that covers.",
    submitLabel: "Plan the repurposing",
    fields: [
      { name: "sourceTitle", label: "What you recorded", required: true },
      { name: "sourceLengthMinutes", label: "Length in minutes", required: true },
      { name: "postsPerWeek", label: "Posts you want to publish each week", required: true },
      { name: "formats", label: "Formats, comma separated (short clip, quote card, written summary)" }
    ],
    requiredFields: ["sourceTitle", "sourceLengthMinutes", "postsPerWeek"],
    build: repurposePlan
  },
  {
    slug: "growth-studio",
    productKey: "growth_studio",
    path: "/growth-studio/tools/budget-split",
    title: "Campaign Budget Split",
    module: "budget_split_planner",
    description: "Split a monthly budget across channels and see what it has to return before it is worth spending.",
    submitLabel: "Split the budget",
    fields: [
      { name: "monthlyBudget", label: "Monthly budget", required: true },
      { name: "targetCostPerLead", label: "What you are willing to pay per lead", required: true },
      { name: "leadToCustomerPercent", label: "Percentage of leads that become customers", required: true },
      { name: "averageSaleValue", label: "Average sale value", required: true },
      { name: "channels", label: "Channels, comma separated" }
    ],
    requiredFields: ["monthlyBudget", "targetCostPerLead", "leadToCustomerPercent", "averageSaleValue"],
    build: budgetSplit
  },
  {
    slug: "growth-studio",
    productKey: "growth_studio",
    path: "/growth-studio/tools/referral",
    title: "Referral Reward Planner",
    module: "referral_reward_planner",
    description: "Check whether a referral reward is affordable before you promise it to anybody.",
    submitLabel: "Check the reward",
    fields: [
      { name: "averageSaleValue", label: "Average sale value", required: true },
      { name: "grossMarginPercent", label: "Gross margin percentage", required: true },
      { name: "rewardPerReferral", label: "Reward per successful referral", required: true },
      { name: "referralsPerMonth", label: "Referrals you expect each month", required: true }
    ],
    requiredFields: ["averageSaleValue", "grossMarginPercent", "rewardPerReferral", "referralsPerMonth"],
    build: referralReward
  },
  {
    slug: "growth-studio",
    productKey: "growth_studio",
    path: "/growth-studio/tools/follow-up-schedule",
    title: "Follow-Up Schedule",
    module: "follow_up_schedule_planner",
    description: "Turn one enquiry into a dated sequence of follow-ups, with a point where you stop.",
    submitLabel: "Build the schedule",
    fields: [
      { name: "leadName", label: "Who you are following up", required: true },
      { name: "touches", label: "How many follow-ups", required: true },
      { name: "daysBetween", label: "Days between them", required: true },
      { name: "firstContactDate", label: "Date of the first contact (YYYY-MM-DD)" },
      { name: "channel", label: "Channel (email, call, message)" }
    ],
    requiredFields: ["leadName", "touches", "daysBetween"],
    build: followUpSchedule
  }
]);

module.exports = {
  PLANNER_TOOLS,
  numberFrom,
  breakEven,
  reorderPlan,
  stopOrder,
  goalTracker,
  mediaPlacements,
  parsePredictionLines,
  demandForecast,
  duplicateCustomers,
  parseStopLines,
  rotaCost,
  paymentSchedule,
  rateCard,
  splitSheet,
  repurposePlan,
  budgetSplit,
  referralReward,
  followUpSchedule
};
