"use strict";

// The pricing page shows one ladder, and it is the one connected to Stripe.
//
// The August 2026 restructure adds One workspace / All three / Team beside the
// existing Starter / Core / Pro. Both are real -- the old plans are entitlement
// keys somebody is paying on, and deleting one locks a paying customer out --
// so both live in the plan table and the page has to choose.
//
// Choosing badly is not a cosmetic problem. Listed together they are eight
// plans, two priced $19 and two priced $39, containing different things. And
// the obvious half-fix, hiding the old ladder as soon as the new one exists,
// empties the pricing page completely: the new plans carry no Stripe price
// until the owner creates one, so every card would read "not open for checkout
// yet" and a visitor could buy nothing at all.
//
// So this asserts the outcome in each state the environment can be in, on the
// rendered page rather than on the function that decides -- the page is what a
// customer sees, and the two have been different before in this codebase.

const assert = require("node:assert/strict");
const request = require("supertest");

const { STRIPE_PLANS, offeredPlanKeys } = require("../lib/sonara-stripe-plans.cjs");

const OLD = ["starter_monthly", "core_monthly", "pro_monthly"];
const NEW = ["workspace_monthly", "all_three_monthly", "team_monthly"];
// The two plans that replace one of the old ones. Team replaces nothing -- it
// is the staff tier and there has never been an equivalent -- so it is not
// hidden while the old ladder is up. It appears saying it is not open for
// checkout yet, which is what every plan without a configured price does and
// what the old ladder itself does on a machine with no Stripe keys. Hiding it
// too would be a tidier page bought by making a missing price invisible.
const REPLACEMENTS = ["workspace_monthly", "all_three_monthly"];

const PRICE_ENV = Object.fromEntries(Object.entries(STRIPE_PLANS).filter(([, config]) => config.env).map(([plan, config]) => [plan, config.env]));

const BASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-ladder",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-ladder",
  STRIPE_SECRET_KEY: "sk_test_ladder"
});

const app = require("../server");

const touched = new Set([...Object.keys(BASE_ENV), ...Object.values(PRICE_ENV), ...Object.values(STRIPE_PLANS).flatMap((c) => c.envAliases || [])]);
const original = Object.fromEntries([...touched].map((key) => [key, process.env[key]]));

function restore() {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

// Set exactly the given plans' price variables, clearing every other one --
// including the aliases, which are read as fallbacks and would otherwise leave
// a plan buyable in a state meant to have it switched off.
function connect(plans) {
  restore();
  Object.assign(process.env, BASE_ENV);
  for (const key of touched) {
    if (!Object.prototype.hasOwnProperty.call(BASE_ENV, key)) delete process.env[key];
  }
  for (const plan of plans) process.env[PRICE_ENV[plan]] = `price_${plan}`;
}

const at = (live) => (plan) => (live.includes(plan) ? "enabled" : "setup_required");

// The plan names the rendered page is actually selling, read out of the price
// card headings.
async function planNamesOnPage() {
  const response = await request(app).get("/pricing").set("Accept", "text/html");
  assert.equal(response.status, 200);
  const names = [...String(response.text).matchAll(/<h2>([^<]*?) - [^<]*?<\/h2>/g)].map((match) => match[1]);
  assert.ok(names.length >= 2, `only ${names.length} price cards parsed off the page; this check has gone blind`);
  return { names, html: String(response.text) };
}

describe("the pricing page shows one ladder", () => {
  after(restore);

  it("has two ladders to choose between in the first place", () => {
    // Every assertion below is about hiding something. If the table stopped
    // marking plans as superseded they would all pass by there being nothing
    // to hide.
    const superseded = Object.entries(STRIPE_PLANS).filter(([, config]) => config.supersededBy);
    assert.ok(superseded.length >= 3, `only ${superseded.length} superseded plans; there is no second ladder to choose against`);
    for (const [plan, config] of superseded) {
      assert.ok(STRIPE_PLANS[config.supersededBy], `${plan} is superseded by ${config.supersededBy}, which is not a plan`);
      assert.ok(STRIPE_PLANS[config.supersededBy].env, `${config.supersededBy} has no price variable, so it can never become buyable`);
    }
  });

  it("sells the old ladder while it is the only one connected", () => {
    const offered = offeredPlanKeys(at(OLD));
    for (const plan of OLD) assert.ok(offered.includes(plan), `${plan} is buyable and was hidden`);
    for (const plan of REPLACEMENTS) {
      assert.ok(!offered.includes(plan), `${plan} replaces a plan that still works, cannot be bought, and was advertised anyway`);
    }
  });

  it("switches to the new ladder by itself, once the new plans can be bought", () => {
    const offered = offeredPlanKeys(at([...OLD, ...NEW]));
    for (const plan of NEW) assert.ok(offered.includes(plan), `${plan} is buyable and was hidden`);
    for (const plan of OLD) assert.ok(!offered.includes(plan), `${plan} was superseded by a buyable plan and is still on the page`);
  });

  it("never leaves the page with nothing to buy", () => {
    for (const live of [[], OLD, NEW, [...OLD, ...NEW], [...OLD, "workspace_monthly"], ["starter_monthly"]]) {
      const offered = offeredPlanKeys(at(live));
      const sellable = offered.filter((plan) => STRIPE_PLANS[plan].env && !STRIPE_PLANS[plan].quoted);
      assert.ok(sellable.length > 0, `with ${live.join(",") || "nothing"} connected, the page offers no paid plan at all`);
      if (live.length) {
        assert.ok(
          sellable.some((plan) => live.includes(plan)),
          `with ${live.join(",")} connected, every plan on the page is one nobody can buy`
        );
      }
    }
  });

  it("puts no two plans at the same price on the page at once", () => {
    // Except with nothing connected at all, which is every development machine:
    // there the whole table shows and every card says it is not open, because
    // an empty pricing page is worse than a page of honest "not yet".
    // The failure this exists for: One workspace is $19 like Core, and All
    // three is $39 like Pro. Two cards at one price, containing different
    // things, is the page telling a visitor two different stories.
    for (const live of [OLD, NEW, [...OLD, ...NEW], [...OLD, "workspace_monthly"]]) {
      const prices = offeredPlanKeys(at(live))
        .filter((plan) => Number.isFinite(STRIPE_PLANS[plan].amountCents) && STRIPE_PLANS[plan].amountCents > 0)
        .map((plan) => STRIPE_PLANS[plan].amountCents);
      assert.equal(new Set(prices).size, prices.length, `with ${live.join(",")} connected, two plans share a price: ${prices.join(", ")}`);
    }
  });

  it("renders the old ladder, and no unbuyable new plan, in production as it stands today", async function render() {
    this.timeout(20000);
    connect(OLD);
    const { names, html } = await planNamesOnPage();
    assert.deepEqual(names, ["Free", "Starter", "Core", "Pro", "Team", "Business Builder setup"]);
    for (const plan of REPLACEMENTS) {
      assert.ok(!html.includes(`value="${plan}"`), `${plan} is on the page at a price a working plan already charges`);
    }
    // Team is on the page and must not look purchasable.
    assert.match(html, /Team - \$79\/mo/);
    assert.match(html, /Checkout is not configured for this plan yet|Not open yet/);
    // The prose has to move with the cards, or the page names plans it is not
    // showing. This is the sentence that used to be written out by hand.
    assert.match(html, /Move to Starter at \$7/);
    assert.doesNotMatch(html, /One workspace at \$19/);
  });

  it("renders the new ladder once its prices exist, and stops naming the old plans", async function render() {
    this.timeout(20000);
    connect([...OLD, ...NEW]);
    const { names, html } = await planNamesOnPage();
    assert.deepEqual(names, ["Free", "One workspace", "All three", "Team", "Business Builder setup"]);
    for (const plan of OLD) assert.ok(!html.includes(`value="${plan}"`), `${plan} is superseded and still has a checkout button`);
    assert.match(html, /Move to One workspace at \$19/);
    assert.match(html, /Team at \$79/);
    assert.doesNotMatch(html, /Starter at \$7/);
    // "Pro covers all three for $39" was written out, and Pro is not on this
    // page. The successor is called "All three", so naming the plan here would
    // have read "All three covers all three".
    assert.doesNotMatch(html, /Pro covers all three/);
    assert.match(html, /All three cost \$39 together/);
  });

  it("says paid plans are not open yet when none of them are", async function render() {
    this.timeout(20000);
    connect([]);
    const { html } = await planNamesOnPage();
    assert.match(html, /Paid plans are not open for checkout yet/);
    assert.doesNotMatch(html, /Move to /, "the page recommends a plan nobody can buy");
  });
});
