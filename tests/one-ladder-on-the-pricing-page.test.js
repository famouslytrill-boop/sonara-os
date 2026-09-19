"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");

const { STRIPE_PLANS, offeredPlanKeys } = require("../lib/sonara-stripe-plans.cjs");

const MONTHLY = ["workspace_monthly", "all_three_monthly", "team_monthly"];
const ANNUAL = ["workspace_annual", "all_three_annual", "team_annual"];
const app = require("../server");

const envNames = Object.values(STRIPE_PLANS).map((plan) => plan.env).filter(Boolean);
const touched = new Set([
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  ...envNames
]);
const original = Object.fromEntries([...touched].map((name) => [name, process.env[name]]));

function restore() {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function connect(plans) {
  restore();
  process.env.STRIPE_SECRET_KEY = "sk_test_canonical_ladder";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-canonical-ladder";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-canonical-ladder";
  for (const name of envNames) delete process.env[name];
  for (const plan of plans) {
    process.env[STRIPE_PLANS[plan].env] = `price_1Canonical${plan.replace(/[^A-Za-z0-9]/g, "")}`;
  }
}

const checkoutState = (enabled) => (plan) => enabled.includes(plan) ? "enabled" : "setup_required";

describe("the pricing page has one canonical ladder", () => {
  after(restore);

  it("defines exactly one monthly paid ladder", () => {
    const monthly = Object.entries(STRIPE_PLANS)
      .filter(([, plan]) => plan.mode === "subscription" && !plan.billedAnnually)
      .map(([key]) => key)
      .sort();

    assert.deepEqual(monthly, [...MONTHLY].sort());
    assert.equal(Object.values(STRIPE_PLANS).some((plan) => Object.hasOwn(plan, "supersededBy")), false);
    assert.equal(Object.values(STRIPE_PLANS).some((plan) => Array.isArray(plan.envAliases) && plan.envAliases.length), false);
  });

  it("always offers the canonical monthly plans", () => {
    const offered = offeredPlanKeys(checkoutState([]));
    for (const plan of MONTHLY) assert.ok(offered.includes(plan), `${plan} disappeared from the canonical ladder`);
  });

  it("keeps annual twins hidden until each one is buyable", () => {
    const none = offeredPlanKeys(checkoutState(MONTHLY));
    for (const plan of ANNUAL) assert.equal(none.includes(plan), false, `${plan} was shown before its price was configured`);

    const all = offeredPlanKeys(checkoutState([...MONTHLY, ...ANNUAL]));
    for (const plan of ANNUAL) assert.ok(all.includes(plan), `${plan} stayed hidden after becoming buyable`);
  });

  it("renders One workspace, All three and Team when their prices are configured", async () => {
    connect(MONTHLY);
    const response = await request(app).get("/pricing").set("Accept", "text/html");
    assert.equal(response.status, 200);
    for (const name of ["One workspace", "All three", "Team"]) {
      assert.match(response.text, new RegExp(name), `${name} is missing from the pricing page`);
    }
    assert.equal((response.text.match(/Start checkout/g) || []).length, 3);
  });

  it("does not need compatibility aliases to make the canonical plans buyable", async () => {
    connect(MONTHLY);
    const response = await request(app).get("/api/readiness").set("Accept", "application/json");
    assert.equal(response.status, 200);
    for (const plan of MONTHLY) assert.equal(response.body.checkoutPlans?.[plan]?.checkout, "enabled");
  });
});
