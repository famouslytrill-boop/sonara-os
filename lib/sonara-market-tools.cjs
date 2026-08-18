"use strict";

// Nine products built against documented market complaints, three per line.
//
// The research and its sources are in
// docs/market/2026-08-18-PRODUCT-GAP-RESEARCH.md. The short version, because a
// product built on a number nobody can check is the thing this repository keeps
// deleting:
//
//   * 52% of buyers switch business software over *inefficiency*, not price, and
//     the feature they need is "buried, missing, or on the enterprise tier at
//     three times the budget". So competing on breadth competes where the
//     complaint is. Three of these are deliberately narrow.
//   * 67% of creators had a contract or payment dispute in the past year, and
//     the average creator earns $44,293 -- which is not a market that can hire a
//     lawyer. The crowded answer is contract generators; the gap is the moment
//     before a contract exists.
//   * 83% of small businesses call referrals their best acquisition source, up
//     from 65%, and almost no software measures referrals because they have no
//     click to attribute. Review tools compete on rating while the survey says
//     recency is what moved.
//
// Same two rules as lib/sonara-planner-tools.cjs, for the same reasons: a number
// that cannot be read is named rather than turned into NaN, and a case with no
// answer says so rather than returning zero.

const { numberFrom } = require("./sonara-planner-tools.cjs");

function money(value) {
  return `$${value.toFixed(2)}`;
}

function listFrom(value) {
  return String(value == null ? "" : value).split(",").map((part) => part.trim()).filter(Boolean);
}

function unusable(labels) {
  return {
    couldNotCalculate: `We could not read ${labels.join(" or ")} as a number, so nothing below would be trustworthy.`,
    whatToDo: "Enter digits only for those boxes and run it again.",
    nothingWasGuessed: "No figure has been estimated in place of what was typed."
  };
}

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

function daysBetween(fromText, toText) {
  const from = new Date(String(fromText || "").trim());
  const to = String(toText || "").trim() ? new Date(String(toText).trim()) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
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

// Pricing tools compute a price. None of them answer the question that actually
// stops an owner raising one: how many customers can I afford to lose.
function priceRise(body) {
  const read = readNumbers(body, {
    currentPrice: "current price",
    variableCostPerSale: "cost per sale",
    customersPerMonth: "customers per month",
    risePercent: "rise percentage"
  });
  if (!read.ok) return read.output;
  const { currentPrice, variableCostPerSale, customersPerMonth, risePercent } = read.values;

  const marginNow = currentPrice - variableCostPerSale;
  if (marginNow <= 0) {
    return {
      profitNow: `${money(marginNow)} per sale -- you are losing money on every sale before the rise.`,
      whatToChange: "A price rise is not the first move here. The price is below the cost of delivering, so fix that before working out who you can afford to lose.",
      nothingWasGuessed: "No break-even customer count is shown, because at this price there is not one."
    };
  }

  const newPrice = currentPrice * (1 + risePercent / 100);
  const marginAfter = newPrice - variableCostPerSale;
  const profitNow = marginNow * customersPerMonth;
  const customersNeeded = marginAfter > 0 ? profitNow / marginAfter : null;
  const canLose = customersNeeded === null ? null : customersPerMonth - customersNeeded;

  return {
    profitNow: `${money(profitNow)} a month from ${customersPerMonth} customers at ${money(currentPrice)}.`,
    newPrice: `${money(newPrice)} after a ${risePercent}% rise.`,
    marginAfter: `${money(marginAfter)} kept per sale, up from ${money(marginNow)}.`,
    customersNeeded: customersNeeded === null
      ? "The new price still does not cover the cost per sale."
      : `${Math.ceil(customersNeeded)} customers a month at the new price makes the same profit as ${customersPerMonth} at the old one.`,
    // The number the whole tool exists for.
    youCanAffordToLose: canLose === null
      ? "Not applicable at this price."
      : `${Math.floor(canLose)} customers a month -- lose fewer than that and you are better off.`,
    whatItAssumes: "That costs per sale and customer numbers are otherwise unchanged. It cannot tell you how customers will react, only what you can afford."
  };
}

// The category's own products add to the stack. This one measures it. Written
// against the documented complaint that more tools are making small businesses
// slower.
function softwareSpend(body) {
  const read = readNumbers(body, { seats: "seats paid for", activeSeats: "seats actually used", pricePerSeatMonthly: "price per seat" });
  if (!read.ok) return read.output;
  const { seats, activeSeats, pricePerSeatMonthly } = read.values;
  const tools = listFrom(body.tools);
  const used = Math.min(activeSeats, seats);

  const monthly = seats * pricePerSeatMonthly;
  const wasted = (seats - used) * pricePerSeatMonthly;
  return {
    monthlyCost: `${money(monthly)} a month, ${money(monthly * 12)} a year.`,
    seatsPaidFor: `${seats} paid, ${used} in use.`,
    unusedSeats: seats - used === 0
      ? "Every seat you pay for is in use."
      : `${seats - used} seats nobody uses, costing ${money(wasted)} a month and ${money(wasted * 12)} a year.`,
    costPerActiveUser: used > 0
      ? `${money(monthly / used)} per person actually using it.`
      : "Nobody is using it, so there is no cost per user -- there is just cost.",
    tools: tools.length ? `Counted across: ${tools.join(", ")}.` : "No tool names entered, so this is one line rather than a stack.",
    nextAction: "Cancel the unused seats before comparing alternatives. A cheaper tool with the same unused seats saves less than this does."
  };
}

// Forecasting tools project a trend. This names the month you run out.
function quietMonths(body) {
  const read = readNumbers(body, { openingCash: "opening cash", fixedCostsMonthly: "monthly fixed costs" });
  if (!read.ok) return read.output;
  const { openingCash, fixedCostsMonthly } = read.values;
  const takings = listFrom(body.monthlyTakings).map((value) => numberFrom(value));
  if (!takings.length || takings.some((value) => value === null)) {
    return unusable(["the month-by-month takings"]);
  }

  let balance = openingCash;
  const rows = [];
  let firstNegative = null;
  takings.forEach((value, index) => {
    balance += value - fixedCostsMonthly;
    rows.push(`Month ${index + 1}: ${money(balance)}`);
    if (balance < 0 && firstNegative === null) firstNegative = index + 1;
  });

  const lowest = Math.min(...takings);
  return {
    monthByMonth: rows.join(" | "),
    closingBalance: `${money(balance)} after ${takings.length} months.`,
    // The answer somebody opens this for.
    runsOut: firstNegative === null
      ? "Cash stays above zero in every month entered."
      : `Month ${firstNegative} is where the cash runs out. That is the month to plan for, not the one with the lowest takings.`,
    quietestMonth: `Lowest takings entered: ${money(lowest)}.`,
    whatItExcludes: "Tax bills, one-off purchases and anything you have not entered. It is only as good as the twelve numbers above it."
  };
}

// ---------------------------------------------------------------------------
// Creator Studio
// ---------------------------------------------------------------------------

// 67% of creators had a contract or payment dispute last year. Competitors
// generate contracts; the dispute happens earlier than that, in the gap between
// agreeing by message and anybody writing it down.
function dealMemo(body) {
  const read = readNumbers(body, { fee: "fee" });
  if (!read.ok) return read.output;
  const { fee } = read.values;
  const client = String(body.client || "").trim();
  const deliverables = listFrom(body.deliverables);
  const usage = String(body.usageTerm || "").trim();
  const dueDays = numberFrom(body.paymentDays);

  const missing = [];
  if (!usage) missing.push("where the work may be used, and for how long");
  if (dueDays === null) missing.push("how many days after delivery payment is due");
  if (!deliverables.length) missing.push("what exactly is being delivered");

  return {
    agreedWith: client || "Not named -- write down who agreed, not just the company.",
    fee: money(fee),
    deliverables: deliverables.length ? deliverables.join(", ") : "Not stated.",
    usage: usage || "Not stated.",
    paymentDue: dueDays === null ? "Not stated." : `${dueDays} days after delivery${body.deliveryDate ? `, so ${addDays(body.deliveryDate, dueDays)}` : ""}.`,
    // The point of the memo: naming what is missing while it can still be asked.
    whatIsMissing: missing.length
      ? `Ask about this before starting: ${missing.join("; ")}. Two thirds of creators had a dispute last year, and these are the three things they turn out to be about.`
      : "Nothing obvious is missing. Send this back to them and ask them to confirm it in writing.",
    whatThisIs: "A dated record of what you understood was agreed. It is not a contract and not legal advice, and it does not replace one for work at a scale where you would want a lawyer."
  };
}

// Invoicing tools resend the invoice. This prices the delay.
function latePayment(body) {
  const read = readNumbers(body, { amountOwed: "amount owed", annualInterestPercent: "annual interest percentage" });
  if (!read.ok) return read.output;
  const { amountOwed, annualInterestPercent } = read.values;
  const overdue = daysBetween(body.dueDate, body.today);
  if (overdue === null) return unusable(["the due date"]);

  if (overdue <= 0) {
    return {
      status: `Not overdue yet -- ${Math.abs(overdue)} days until it is due.`,
      amount: money(amountOwed),
      whatToDoNow: "Send a polite note a few days before the due date. It is the cheapest thing that moves a payment.",
      nothingIsOwedYet: "No interest is shown, because none has accrued."
    };
  }

  const interest = amountOwed * (annualInterestPercent / 100) * (overdue / 365);
  return {
    status: `${overdue} days overdue.`,
    amount: `${money(amountOwed)} outstanding.`,
    interestSoFar: `${money(interest)} at ${annualInterestPercent}% a year for ${overdue} days.`,
    totalNow: `${money(amountOwed + interest)} including the cost of the delay.`,
    escalation: [
      `${addDays(body.dueDate, 1)}: a short reminder, no accusation`,
      `${addDays(body.dueDate, 14)}: a formal notice naming the amount and the interest`,
      `${addDays(body.dueDate, 30)}: final notice before you stop work or escalate`
    ].join(" | "),
    beforeYouCharge: "Interest is only chargeable if your terms said so, or your jurisdiction allows it by statute. Check before you put it on an invoice."
  };
}

// No mainstream creator tool tracks a licence *end* date. The failure mode is
// silent: the brand keeps using the work and nobody is doing anything wrong on
// purpose.
function rightsExpiry(body) {
  const read = readNumbers(body, { termMonths: "licence length in months", originalFee: "original fee" });
  if (!read.ok) return read.output;
  const { termMonths, originalFee } = read.values;
  const start = String(body.startDate || "").trim();
  const expiry = addDays(start, Math.round(termMonths * 30.44));
  const remaining = daysBetween(body.today || new Date().toISOString().slice(0, 10), expiry);

  return {
    work: String(body.workTitle || "Untitled work").trim(),
    licensee: String(body.licensee || "Not named").trim(),
    term: `${termMonths} months from ${start || "an unstated start date"}.`,
    expires: expiry,
    remaining: remaining === null
      ? "Could not work out the days remaining from the dates given."
      : remaining > 0
        ? `${remaining} days left.`
        : `Expired ${Math.abs(remaining)} days ago. If the work is still in use, that is a renewal conversation, not an accusation.`,
    renewalPosition: `The original fee was ${money(originalFee)}. A renewal is a new licence for work that has already proved it performs, which is a stronger position than the first sale, not a weaker one.`,
    whatToDoNow: "Diarise a check four weeks before the expiry date. The usual way this is lost is nobody looking."
  };
}

// ---------------------------------------------------------------------------
// Growth Studio
// ---------------------------------------------------------------------------

// 83% of small businesses call referrals their best source, and attribution
// tools cannot see them because there is no click.
function referralSource(body) {
  const entries = listFrom(body.referrers).map((entry) => {
    const [name, count] = entry.split(":");
    return { name: String(name || "").trim(), count: numberFrom(count) };
  });
  if (!entries.length) return unusable(["the referrer list"]);
  const bad = entries.filter((entry) => !entry.name || entry.count === null);
  if (bad.length) {
    return {
      couldNotCalculate: `These entries are not in the expected form: ${bad.map((entry) => entry.name || "(no name)").join(", ")}.`,
      whatToDo: "Write each as Name:number of referrals, comma separated -- for example Ada:4, Bo:2.",
      nothingWasGuessed: "No count has been assumed for anybody."
    };
  }
  const value = numberFrom(body.averageSaleValue);
  if (value === null) return unusable(["average sale value"]);

  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const top = sorted[0];
  const topShare = total > 0 ? (top.count / total) * 100 : null;

  return {
    totalReferrals: `${total} referrals from ${entries.length} people.`,
    worth: `${money(total * value)} of business at ${money(value)} a sale.`,
    topReferrer: `${top.name} sent ${top.count}, worth ${money(top.count * value)}.`,
    concentration: topShare === null
      ? "No referrals recorded, so there is no concentration to report."
      : `${topShare.toFixed(0)}% of your referrals come from one person. ${topShare > 50 ? "That is a single point of failure as much as it is a success." : "That is a reasonably spread base."}`,
    everybody: sorted.map((entry) => `${entry.name}: ${entry.count}`).join(" | "),
    nextAction: "Thank the top three by name this week. Referrals are the one channel where the cost of keeping it working is a phone call."
  };
}

// Review tools optimise the average. The 2026 survey says recency is what moved.
function reviewRecency(body) {
  const read = readNumbers(body, { totalReviews: "total reviews", averageRating: "average rating", reviewsLast90Days: "reviews in the last 90 days" });
  if (!read.ok) return read.output;
  const { totalReviews, averageRating, reviewsLast90Days } = read.values;
  const target = numberFrom(body.targetRecentReviews);
  const wanted = target === null ? Math.max(3, Math.ceil(totalReviews * 0.1)) : Math.round(target);

  const recentShare = totalReviews > 0 ? (reviewsLast90Days / totalReviews) * 100 : null;
  const shortfall = Math.max(0, wanted - reviewsLast90Days);

  return {
    position: `${averageRating.toFixed(1)} stars from ${totalReviews} reviews.`,
    recent: `${reviewsLast90Days} in the last 90 days.`,
    recentShare: recentShare === null
      ? "No reviews recorded, so there is no recent share to report -- which is not the same as a good one."
      : `${recentShare.toFixed(0)}% of your reviews are recent.`,
    // The angle the whole tool is for.
    whyRecencyMatters: "Consumers now expect recent reviews as well as good ones. A high average from two years ago reads as a business that used to be good.",
    toStayCurrent: shortfall === 0
      ? `You are at or above ${wanted} recent reviews. Keep the rate rather than chasing the total.`
      : `${shortfall} more reviews in the next 90 days keeps you looking current, at about ${(shortfall / 13).toFixed(1)} a week.`,
    howNotToGetThem: "Do not offer anything in exchange for a review. Every major platform treats that as grounds for removing the reviews you already have, and it is the one growth tactic that can cost you the asset."
  };
}

// "If inquiries rise but sales do not, the issue may be pricing, response time,
// fit, or follow-up." This one prices the wait.
function responseTime(body) {
  const read = readNumbers(body, {
    enquiriesPerMonth: "enquiries per month",
    averageResponseHours: "average response time in hours",
    winRatePercent: "win rate percentage",
    averageSaleValue: "average sale value"
  });
  if (!read.ok) return read.output;
  const { enquiriesPerMonth, averageResponseHours, winRatePercent, averageSaleValue } = read.values;

  // A conservative, stated rule rather than an invented curve: each full day of
  // delay is treated as costing a tenth of the win rate, capped so the model
  // never claims a business wins nothing.
  const daysLate = Math.max(0, averageResponseHours / 24);
  const decayed = Math.max(winRatePercent * 0.2, winRatePercent * (1 - 0.1 * daysLate));
  const wonNow = enquiriesPerMonth * (decayed / 100);
  const wonIfFast = enquiriesPerMonth * (winRatePercent / 100);
  const gap = (wonIfFast - wonNow) * averageSaleValue;

  return {
    responding: `${averageResponseHours} hours on average, which is ${daysLate.toFixed(1)} days.`,
    winningNow: `About ${wonNow.toFixed(1)} of ${enquiriesPerMonth} enquiries a month.`,
    ifYouAnsweredSameDay: `About ${wonIfFast.toFixed(1)}, worth ${money(gap)} a month more.`,
    theRule: "This uses a stated rule -- each full day of delay costs a tenth of the win rate, floored at a fifth of it -- rather than a curve fitted to somebody else's industry. Change the response time and see the shape; do not quote the figure as measured.",
    cheapestFix: "An acknowledgement within the hour is not the same as an answer, and it holds most of the value. It is the cheapest thing on this page.",
    whatItIsNot: "Not a measurement of your business. It is your own numbers put through one explicit assumption."
  };
}


const MARKET_TOOLS = Object.freeze([
  {
    slug: "business-builder", productKey: "business_builder", path: "/business-builder/tools/price-rise",
    title: "Price Rise Planner", module: "price_rise_planner",
    description: "Work out how many customers you could lose after a price rise and still be better off.",
    submitLabel: "Work out the rise",
    fields: [
      { name: "currentPrice", label: "Your current price", required: true },
      { name: "variableCostPerSale", label: "What one sale costs you to deliver", required: true },
      { name: "customersPerMonth", label: "Customers a month", required: true },
      { name: "risePercent", label: "Rise you are considering, as a percentage", required: true }
    ],
    requiredFields: ["currentPrice", "variableCostPerSale", "customersPerMonth", "risePercent"],
    build: priceRise
  },
  {
    slug: "business-builder", productKey: "business_builder", path: "/business-builder/tools/software-spend",
    title: "Software Spend Auditor", module: "software_spend_auditor",
    description: "Count what your tools cost, what the unused seats cost, and what you pay per person actually using them.",
    submitLabel: "Audit the spend",
    fields: [
      { name: "seats", label: "Seats you pay for", required: true },
      { name: "activeSeats", label: "Seats actually used", required: true },
      { name: "pricePerSeatMonthly", label: "Price per seat per month", required: true },
      { name: "tools", label: "Tool names, comma separated" }
    ],
    requiredFields: ["seats", "activeSeats", "pricePerSeatMonthly"],
    build: softwareSpend
  },
  {
    slug: "business-builder", productKey: "business_builder", path: "/business-builder/tools/quiet-months",
    title: "Quiet Month Cash Plan", module: "quiet_month_planner",
    description: "Put your month-by-month takings against your fixed costs and find the month the cash runs out.",
    submitLabel: "Plan the quiet months",
    fields: [
      { name: "openingCash", label: "Cash you have today", required: true },
      { name: "fixedCostsMonthly", label: "Fixed costs per month", required: true },
      { name: "monthlyTakings", label: "Expected takings per month, comma separated", type: "textarea", required: true }
    ],
    requiredFields: ["openingCash", "fixedCostsMonthly", "monthlyTakings"],
    build: quietMonths
  },
  {
    slug: "creator-studio", productKey: "creator_studio", path: "/creator-studio/tools/deal-memo",
    title: "Deal Memo Recorder", module: "deal_memo_recorder",
    description: "Write down what was agreed the moment it is agreed, and see what is still missing before you start work.",
    submitLabel: "Record the deal",
    fields: [
      { name: "client", label: "Who agreed it", required: true },
      { name: "fee", label: "Agreed fee", required: true },
      { name: "deliverables", label: "What you are delivering, comma separated", type: "textarea" },
      { name: "usageTerm", label: "Where it may be used, and for how long" },
      { name: "paymentDays", label: "Days after delivery that payment is due" },
      { name: "deliveryDate", label: "Delivery date (YYYY-MM-DD)" }
    ],
    requiredFields: ["client", "fee"],
    build: dealMemo
  },
  {
    slug: "creator-studio", productKey: "creator_studio", path: "/creator-studio/tools/late-payment",
    title: "Late Payment Escalation", module: "late_payment_escalation",
    description: "See what a late invoice is really costing you, and get a dated ladder of what to send next.",
    submitLabel: "Work out what I am owed",
    fields: [
      { name: "amountOwed", label: "Amount outstanding", required: true },
      { name: "dueDate", label: "Date it was due (YYYY-MM-DD)", required: true },
      { name: "annualInterestPercent", label: "Annual interest rate your terms allow", required: true },
      { name: "today", label: "Today's date (YYYY-MM-DD), if not today" }
    ],
    requiredFields: ["amountOwed", "dueDate", "annualInterestPercent"],
    build: latePayment
  },
  {
    slug: "creator-studio", productKey: "creator_studio", path: "/creator-studio/tools/rights-expiry",
    title: "Usage Rights Expiry", module: "rights_expiry_watch",
    description: "Track when a licence you granted runs out, so work still in use becomes a renewal rather than a loss.",
    submitLabel: "Track the licence",
    fields: [
      { name: "workTitle", label: "The work", required: true },
      { name: "licensee", label: "Who you licensed it to", required: true },
      { name: "startDate", label: "Licence start date (YYYY-MM-DD)", required: true },
      { name: "termMonths", label: "Licence length in months", required: true },
      { name: "originalFee", label: "What they paid", required: true },
      { name: "today", label: "Today's date (YYYY-MM-DD), if not today" }
    ],
    requiredFields: ["workTitle", "licensee", "startDate", "termMonths", "originalFee"],
    build: rightsExpiry
  },
  {
    slug: "growth-studio", productKey: "growth_studio", path: "/growth-studio/tools/referral-source",
    title: "Referral Source Tracker", module: "referral_source_tracker",
    description: "Find out who actually sends you business, what they are worth, and whether it all rests on one person.",
    submitLabel: "Count the referrals",
    fields: [
      { name: "referrers", label: "Referrers as Name:number, comma separated", type: "textarea", required: true },
      { name: "averageSaleValue", label: "Average sale value", required: true }
    ],
    requiredFields: ["referrers", "averageSaleValue"],
    build: referralSource
  },
  {
    slug: "growth-studio", productKey: "growth_studio", path: "/growth-studio/tools/review-recency",
    title: "Review Recency Score", module: "review_recency_score",
    description: "A good rating from two years ago reads as a business that used to be good. See where you stand on recency.",
    submitLabel: "Check my recency",
    fields: [
      { name: "totalReviews", label: "Total reviews", required: true },
      { name: "averageRating", label: "Average rating", required: true },
      { name: "reviewsLast90Days", label: "Reviews in the last 90 days", required: true },
      { name: "targetRecentReviews", label: "Recent reviews you want (default a tenth of your total)" }
    ],
    requiredFields: ["totalReviews", "averageRating", "reviewsLast90Days"],
    build: reviewRecency
  },
  {
    slug: "growth-studio", productKey: "growth_studio", path: "/growth-studio/tools/response-time",
    title: "Enquiry Response Clock", module: "enquiry_response_clock",
    description: "Put a number on what answering enquiries slowly costs you each month.",
    submitLabel: "Price the wait",
    fields: [
      { name: "enquiriesPerMonth", label: "Enquiries a month", required: true },
      { name: "averageResponseHours", label: "Average hours before you reply", required: true },
      { name: "winRatePercent", label: "Percentage you win when you reply quickly", required: true },
      { name: "averageSaleValue", label: "Average sale value", required: true }
    ],
    requiredFields: ["enquiriesPerMonth", "averageResponseHours", "winRatePercent", "averageSaleValue"],
    build: responseTime
  }
]);

module.exports = {
  MARKET_TOOLS,
  priceRise,
  softwareSpend,
  quietMonths,
  dealMemo,
  latePayment,
  rightsExpiry,
  referralSource,
  reviewRecency,
  responseTime
};
