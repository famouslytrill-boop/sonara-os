"use strict";

// The plans this product sells, and what each one advertises.
//
// Moved out of server.js on 13 August 2026 when the breadth ladder was added.
// It is a data table with no behaviour, and server.js is under a line ratchet
// in tests/server-split.test.js that the split exists to bring down -- so the
// three new plans are absorbed by moving the table rather than by raising the
// ceiling to make room for them.
//
// Every consumer reads the STRIPE_PLANS export from server.js rather than this
// file, and that export is unchanged, so the move is invisible to
// scripts/verify-stripe-env.mjs, tests/pricing.test.js and the rest.
// scripts/verify-production-product-catalog.mjs greps server.js plus lib/ and
// routes/, so a move inside lib/ keeps the deployed-runtime markers in scope.

// These prices already sit below every comparable tool we could find charging
// for the same job -- see docs/pricing/2026-07-28-COMPETITOR-PRICING.md for the
// survey that confirmed it, and for why they were left where they are.
//
// amountCents is the price this page promises. The amount actually charged
// lives in the Stripe Price object named by `env`, and the two have to agree --
// tests/pricing.test.js checks the page never shows a number the config does
// not hold, and the pricing doc records what each Stripe Price must be created
// at. Changing a price here means creating a new Stripe Price: Stripe prices
// are immutable once created.
const STRIPE_PLANS = {
  free: {
    name: "Free",
    price: "$0",
    amountCents: 0,
    description: "A real account, the free tools in all three studios, and your saved work. No card needed.",
    env: undefined,
    mode: undefined
  },
  // The breadth ladder, added 13 August 2026 on the owner's instruction.
  //
  // **Repriced 6 September 2026**, on the owner's instruction to be competitive
  // but still cheaper: $19/$39/$79 became $29/$59/$109. The case and the sourced
  // competitor figures are in docs/pricing/2026-09-06-PRICE-INCREASE.md.
  //
  // Two facts made this safe to do in place rather than as a fourth ladder, and
  // both were checked rather than assumed:
  //
  //   1. These plans' price variables are unset in production, so
  //      /api/readiness lists only free, starter, core, pro and the quoted
  //      package under checkoutPlans. Checkout for them has never been possible.
  //   2. No paid signup has completed in production at all -- SHIP_READINESS.md
  //      item 1, still open.
  //
  // So nobody is subscribed to any of these and no existing charge changes. The
  // depth ladder above is deliberately untouched for the opposite reason: those
  // three have live Stripe prices and are what the page actually shows today.
  //
  // A Stripe price is immutable, so raising an amount means creating a NEW
  // Price object. The ones recorded in docs/MANUAL_DASHBOARD_SETUP_FINAL.md were
  // created at the old amounts and must not be used -- pointing a variable at
  // one would advertise $29 and charge $19. That document now says so.
  //
  // docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md argued the case from the
  // market; docs/2026-08-12-WHAT-ELSE-CAN-WE-SELL.md argued it again from a bug,
  // because the depth ladder above and the entitlement map disagreed about what
  // seven products cost. A breadth ladder cannot disagree with itself that way:
  // the plan floor becomes which workspaces you get, which is the thing the
  // entitlement map is already keyed on.
  //
  // These carry no Stripe price until the owner creates one. A plan with no
  // configured price renders "Checkout is not configured for this plan yet" and
  // cannot be bought, so adding them cannot break anybody's checkout. The three
  // above stay exactly as they are for the same reason: Stripe prices are
  // immutable, and an existing subscriber must keep paying what they agreed to.
  workspace_monthly: {
    name: "One workspace",
    price: "$29/mo",
    amountCents: 2900,
    description: "Any one of Business Builder, Creator Studio or Growth Studio, in full. You choose which when you subscribe.",
    env: "STRIPE_PRICE_WORKSPACE_MONTHLY",
    mode: "subscription",
    // Which workspace is a per-customer answer, recorded on the subscription.
    // See choosesOneWorkspace in lib/sonara-paid-access.cjs.
    choosesWorkspace: true,
    pick: "you only need one of the three"
  },
  all_three_monthly: {
    name: "All three",
    price: "$59/mo",
    amountCents: 5900,
    description: "Business Builder, Creator Studio and Growth Studio together, one login and one bill.",
    env: "STRIPE_PRICE_ALL_THREE_MONTHLY",
    mode: "subscription",
    pick: "you need all three",
    coversAllThree: true
  },
  team_monthly: {
    name: "Team",
    price: "$109/mo",
    amountCents: 10900,
    description: "All three workspaces, plus the staff portal: per-person schedules, hours, tasks and pay rates.",
    env: "STRIPE_PRICE_TEAM_MONTHLY",
    mode: "subscription",
    pick: "you have staff to schedule and pay",
    coversAllThree: true
  },
  // Annual billing, added 5 September 2026.
  //
  // Two months free: each yearly amount is ten times its monthly twin's, so a
  // customer paying yearly skips two of the twelve. The figures are not
  // repeated here -- they were, and they went stale the moment the monthly
  // ladder moved from $19/$39/$79 to $29/$59/$109 on 6 September 2026, leaving
  // a comment recommending $190/$390/$790 directly above a table holding
  // $290/$590/$1090. Somebody creating the Stripe prices reads the comment.
  // The ratio is checked instead, by
  // tests/an-annual-plan-opens-what-its-monthly-twin-opens.test.js, which fails
  // if any annual amount stops being ten months of the plan it is billed
  // annually against.
  //
  // The discount is a convention rather than a calculation: every competitor in
  // docs/pricing/ discounts annually, and matching the deepest of them
  // (Jobber's monthly-to-annual drop is 41%) would give away more margin than
  // the cash timing is worth. Two months free is the number a customer
  // recognises without being told the percentage.
  //
  // `billedAnnually` names the monthly plan this is the same product as. It is
  // load-bearing, not documentation: lib/sonara-paid-access.cjs and
  // lib/sonara-plan-limits.cjs derive every annual entitlement and allowance
  // from the named twin rather than repeating them. Four separate lists had to
  // agree for a plan to work, and the last time they did not, seven products
  // advertised plans that answer a paying customer with a 402.
  //
  // `hiddenUntilBuyable` keeps them off the ladder until their Stripe price
  // exists. Team is listed-but-unbuyable on purpose, because nothing supersedes
  // into it and a customer who cannot find it cannot ask for it. An annual
  // plan is different: the monthly twin is right there and sells the same
  // product, so an unconfigured annual card costs a customer nothing and adds
  // three "not open yet" cards to a page with four real ones. This does not
  // make a misconfiguration invisible -- scripts/verify-stripe-env.mjs checks
  // every plan naming an env var, whether or not the page shows it.
  workspace_annual: {
    name: "One workspace, yearly",
    price: "$290/yr",
    amountCents: 29000,
    description: "Any one of Business Builder, Creator Studio or Growth Studio, paid yearly. Two months free against monthly.",
    env: "STRIPE_PRICE_WORKSPACE_ANNUAL",
    mode: "subscription",
    billedAnnually: "workspace_monthly",
    hiddenUntilBuyable: true,
    pick: "you only need one of the three, and you would rather pay once a year"
  },
  all_three_annual: {
    name: "All three, yearly",
    price: "$590/yr",
    amountCents: 59000,
    description: "Business Builder, Creator Studio and Growth Studio together, paid yearly. Two months free against monthly.",
    env: "STRIPE_PRICE_ALL_THREE_ANNUAL",
    mode: "subscription",
    billedAnnually: "all_three_monthly",
    hiddenUntilBuyable: true,
    coversAllThree: true,
    pick: "you need all three, and you would rather pay once a year"
  },
  team_annual: {
    name: "Team, yearly",
    price: "$1090/yr",
    amountCents: 109000,
    description: "All three workspaces plus the staff portal, paid yearly. Two months free against monthly.",
    env: "STRIPE_PRICE_TEAM_ANNUAL",
    mode: "subscription",
    billedAnnually: "team_monthly",
    hiddenUntilBuyable: true,
    coversAllThree: true,
    pick: "you have staff to schedule and pay, and you would rather pay once a year"
  },
  // Quoted, not sold through checkout.
  //
  // This used to carry a Stripe price and a Start checkout button while
  // advertising no amount at all -- the live price was $197 and the first
  // number a customer saw was on Stripe's page, after committing. It is
  // done-for-you work whose scope varies, so a fixed self-serve price was the
  // wrong shape for it anyway.
  //
  // The plan stays in this table rather than being deleted: it is an
  // entitlement key, so anyone who has already been granted the package keeps
  // their access. `quoted` is what removes it from checkout everywhere.
  business_builder_one_time: {
    name: "Business Builder setup",
    price: "We quote you",
    amountCents: null,
    description: "A one-off package where our team sets your business up for you. Tell us what you need and we will quote it.",
    quoted: true,
    env: undefined,
    mode: undefined
  }
};

// Which canonical plans a new customer is shown.
// Retired Starter/Core/Pro compatibility was removed after the live Stripe
// account proved those exact retired prices had zero subscriptions. The only
// visibility rule left is for annual plans that intentionally stay hidden until
// their canonical Stripe price is configured.
function offeredPlanKeys(checkoutOf) {
  const buyable = (plan) => checkoutOf(plan) === "enabled";
  return Object.keys(STRIPE_PLANS).filter((plan) => {
    if (STRIPE_PLANS[plan].hiddenUntilBuyable && !buyable(plan)) return false;
    return true;
  });


// The cheapest plan on offer that covers all three workspaces.
//
// The pricing page said "Pro covers all three for $39" in two places, written
// as literals. Once the breadth ladder is switched on, Pro is not on the page
// and the sentence describes a plan a visitor cannot see. This answers the
// question from whatever is actually being sold, so the copy cannot outlive the
// plan it names.
function planCoveringAllThree(offered) {
  const covering = offered
    .filter((plan) => STRIPE_PLANS[plan]?.coversAllThree && Number.isFinite(STRIPE_PLANS[plan].amountCents))
    .sort((a, b) => STRIPE_PLANS[a].amountCents - STRIPE_PLANS[b].amountCents);
  return covering[0] ? { key: covering[0], ...STRIPE_PLANS[covering[0]] } : null;
}

// The pricing page's ladder and the sentences that describe it.
//
// Here rather than in the route because all three answers come from the same
// question -- which plans Stripe can take money for -- and because the two
// sentences used to be written out by hand naming Starter, Core and Pro. Prose
// that names a plan outlives the plan; prose derived from the table cannot.
function pricingLadderCopy(checkoutOf) {
  const offered = offeredPlanKeys(checkoutOf);
  const allThree = planCoveringAllThree(offered);
  // No plan name in this one. It read "Pro covers all three for $39", and the
  // successor plan is called "All three", which would have made it "All three
  // covers all three for $39". The cards above say which plan the price is.
  const allThreeSentence = allThree ? `All three cost ${withoutPeriod(allThree.price)} together` : "";
  // Only plans somebody can buy right now, cheapest first. Listing everything
  // offered reads as six plans with two different ones "if you need all three",
  // because during the changeover both ladders are on the page and only one of
  // them is connected to Stripe.
  const buyable = offered
    .filter((plan) => STRIPE_PLANS[plan].pick && !STRIPE_PLANS[plan].quoted)
    .filter((plan) => checkoutOf(plan) === "enabled")
    .sort((a, b) => (STRIPE_PLANS[a].amountCents || 0) - (STRIPE_PLANS[b].amountCents || 0));
  const whichPlan = buyable.length
    ? `Start free. ${buyable
        .map((plan, index) => `${index === 0 ? "Move to " : ""}${STRIPE_PLANS[plan].name} at ${withoutPeriod(STRIPE_PLANS[plan].price)} if ${STRIPE_PLANS[plan].pick}`)
        .join(", or ")}.`
    : "Start free. Paid plans are not open for checkout yet \u2014 we are still connecting payments, and the plans above show what each one will be.";
  return { offered, allThree, allThreeSentence, whichPlan };
}

function withoutPeriod(price) {
  return String(price || "").replace("/mo", "");
}

// Every plan that is the annual form of another, as { annualKey: monthlyKey }.
//
// Exported so lib/sonara-paid-access.cjs and lib/sonara-plan-limits.cjs can
// expand their own tables from it. Derived from the table rather than listed,
// so adding a fourth annual plan needs no edit in either of those files -- the
// omission that shape of duplication produces is the one this repository keeps
// finding.
const ANNUAL_TWINS = Object.freeze(
  Object.fromEntries(
    Object.entries(STRIPE_PLANS)
      .filter(([, plan]) => plan.billedAnnually)
      .map(([key, plan]) => [key, plan.billedAnnually])
  )
);

/**
 * Expand a list of monthly plan keys to include each one's annual twin.
 *
 * Order is preserved and the annual key follows the monthly one it came from,
 * so a list read by a person still reads as pairs.
 */
function withAnnualTwins(monthlyKeys) {
  const byMonthly = new Map();
  for (const [annual, monthly] of Object.entries(ANNUAL_TWINS)) {
    if (!byMonthly.has(monthly)) byMonthly.set(monthly, []);
    byMonthly.get(monthly).push(annual);
  }
  return monthlyKeys.flatMap((key) => [key, ...(byMonthly.get(key) || [])]);
}

module.exports = {
  STRIPE_PLANS: Object.freeze(STRIPE_PLANS),
  ANNUAL_TWINS,
  withAnnualTwins,
  offeredPlanKeys,
  planCoveringAllThree,
  pricingLadderCopy
};
