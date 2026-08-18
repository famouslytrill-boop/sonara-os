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

const PLANNER_TOOLS = Object.freeze([
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
  rotaCost,
  paymentSchedule,
  rateCard,
  splitSheet,
  repurposePlan,
  budgetSplit,
  referralReward,
  followUpSchedule
};
