"use strict";

// The day page, through the real handler.
//
// tests/what-a-day-made.test.js and tests/labour-cost.test.js call
// `derivedCard` and `labourCostForDay` directly with hand-built arguments. Both
// passed while nothing had ever run the wiring between them: `derivedReads` is
// awaited by the detail handler, its result is threaded into `derivedCard` as a
// fourth argument, and a mistake anywhere along that path -- a hook never
// called, a result never passed, a require that silently did not get added --
// leaves every unit test green and the page without a figure on it.
//
// That is the defect this repository keeps finding, so this renders the page.
//
// The second thing it asserts is the one that matters more than the arithmetic.
// The reads go out with the service key, which bypasses row level security, so
// the organization filter in the query is the only thing standing between one
// business and another's payroll. It is checked against the query strings that
// actually left, not against the code that builds them.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-day-page",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-day-page"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "cafe@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";
const DAY_ID = "55555555-5555-4555-8555-555555555555";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });

let queries = [];
let timeEntries = [];
let wageRates = [];

function stubFetch() {
  return async (url) => {
    const target = String(url);
    if (target.includes("/rest/v1/")) queries.push(target.split("/rest/v1/")[1]);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Cafe" }]);
    if (table === "pos_sales_summaries") return json([{ id: DAY_ID, organization_id: ORGANIZATION_ID, business_date: "2026-08-01", net_sales_cents: 120000 }]);
    if (table === "pos_menu_mix_items") return json([{ id: "mix", item_name: "Soup", quantity_sold: 40, net_sales_cents: 120000, theoretical_cost_cents: 36000 }]);
    if (table === "employee_time_entries") return json(timeEntries);
    if (table === "employee_wage_rates") return json(wageRates);
    return json([]);
  };
}

async function openTheDay() {
  const response = await request(app)
    .get(`/business-builder/owner/sales/${DAY_ID}`)
    .set("Accept", "text/html")
    .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
    .redirects(0);
  const visible = String(response.text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return { status: response.status, visible };
}

describe("the day page renders its own figures", () => {
  let realFetch;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    queries = [];
    timeEntries = [{ employee_id: "e1", clock_in_at: "2026-08-01T09:00:00Z", clock_out_at: "2026-08-01T17:00:00Z", break_minutes: 30 }];
    wageRates = [{ employee_id: "e1", amount_cents: 1500, rate_type: "hourly", effective_from: "2026-01-01", status: "active" }];
  });

  it("works out food and labour on the rendered page", async function open() {
    this.timeout(30000);
    const { status, visible } = await openTheDay();
    assert.equal(status, 200);
    assert.match(visible, /What this day made/, "the derived card did not render at all");
    assert.match(visible, /Net sales \$1200\.00/);
    assert.match(visible, /food cost \$360\.00/);
    assert.match(visible, /labour \$112\.50 over 7\.5 hours/, "7.5 hours at 1500 is 11250");
    assert.match(visible, /leaving \$727\.50/);
  });

  it("actually goes and reads the hours and the rates", async function open() {
    this.timeout(30000);
    await openTheDay();
    assert.ok(queries.some((query) => query.startsWith("employee_time_entries")), "derivedReads never asked for the hours");
    assert.ok(queries.some((query) => query.startsWith("employee_wage_rates")), "derivedReads never asked for the rates");
  });

  // The service key bypasses row level security, so this filter is the boundary.
  it("scopes both extra reads to this organization", async function open() {
    this.timeout(30000);
    await openTheDay();
    const extra = queries.filter((query) => query.startsWith("employee_time_entries") || query.startsWith("employee_wage_rates"));
    assert.ok(extra.length >= 2, `only ${extra.length} extra reads seen; this check has gone blind`);
    for (const query of extra) {
      assert.ok(
        query.includes(`organization_id=eq.${ORGANIZATION_ID}`),
        `an extra read went out unscoped, which with the service key reads every business: ${query}`
      );
    }
  });

  it("asks only for the day being looked at, not for every entry ever recorded", async function open() {
    this.timeout(30000);
    await openTheDay();
    const hours = queries.find((query) => query.startsWith("employee_time_entries"));
    assert.match(hours, /clock_in_at=gte\.2026-08-01/);
    assert.match(hours, /clock_in_at=lte\.2026-08-01/);
  });

  it("says what it could not cost, rather than costing it at nothing", async function open() {
    this.timeout(30000);
    timeEntries = [
      { employee_id: "e1", clock_in_at: "2026-08-01T09:00:00Z", clock_out_at: "2026-08-01T17:00:00Z" },
      { employee_id: "e2", clock_in_at: "2026-08-01T09:00:00Z", clock_out_at: "2026-08-01T13:00:00Z" }
    ];
    const { visible } = await openTheDay();
    assert.match(visible, /labour at least \$120\.00/, "the person who can be costed still is");
    assert.match(visible, /leaving at most/);
    assert.match(visible, /1 with no pay rate recorded for that date/);
  });

  it("does not report a labour cost when the hours could not be read", async function open() {
    this.timeout(30000);
    const failing = stubFetch();
    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/rest/v1/employee_time_entries")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => [] };
      return failing(url);
    };
    const { visible } = await openTheDay();
    global.fetch = stubFetch();
    assert.match(visible, /could not read the hours or the pay rates/);
    assert.doesNotMatch(visible, /labour \$0\.00|labour at least \$0\.00/, "an unreadable table must not read as nobody worked");
  });
});
