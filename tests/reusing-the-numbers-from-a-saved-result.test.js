"use strict";

// Reopening a free tool with the numbers from a saved result.
//
// The tenant risk here is the same one every read in this application has: the
// service-role key bypasses row level security, so the filter in the query is
// the whole boundary. A saved result is addressed by a uuid in a query string,
// and the two filters on that read are what stop it being somebody else's.
//
// **organization_id** is the tenant boundary. Without it, an id from another
// business fetches that business's figures into this customer's form.
//
// **module_key** stops a saved break-even filling in the reorder-point form,
// which would look like the tool working while producing an answer from numbers
// that mean something else entirely.
//
// Everything else here is about the page refusing to look filled in when it is
// not: a failed read must not render an empty form as though no preset was
// asked for, or somebody types it all again believing it was never saved.

const assert = require("node:assert/strict");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const { toolPathsFrom } = require("../lib/sonara-module-crud.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const OTHER_ORG = "b2b2b2b2-0000-4000-8000-00000000002b";
const USER = "c3c3c3c3-0000-4000-8000-00000000003c";
const MINE = "d4d4d4d4-0000-4000-8000-00000000004d";
const THEIRS = "e5e5e5e5-0000-4000-8000-00000000005e";
const OTHER_TOOL = "f6f6f6f6-0000-4000-8000-00000000006f";

// Distinctive enough that finding one in a page is unambiguous.
const MY_COSTS = "4271";
const THEIR_COSTS = "9183";

const TOOL = "/business-builder/tools/break-even";

function seed() {
  return {
    organizations: [{ id: ORG, name: "Bright Ltd" }, { id: OTHER_ORG, name: "Somebody Else" }],
    organization_memberships: [{ id: "mem-1", organization_id: ORG, user_id: USER, status: "active", role: "owner", created_at: "2026-01-01" }],
    business_memberships: [{ id: "bmem-1", organization_id: ORG, workspace_id: null, user_id: USER, status: "active", role: "owner", created_at: "2026-01-01" }],
    module_outputs: [
      {
        id: MINE, organization_id: ORG, product_key: "business_builder", module_key: "break_even_planner",
        input_payload: { fixedCostsMonthly: MY_COSTS, pricePerSale: "60", variableCostPerSale: "25", cashOnHand: "12000" },
        output_payload: { breakEven: "You cover your costs at 98 sales a month." },
        created_at: "2026-08-01T09:00:00.000Z"
      },
      {
        id: THEIRS, organization_id: OTHER_ORG, product_key: "business_builder", module_key: "break_even_planner",
        input_payload: { fixedCostsMonthly: THEIR_COSTS, pricePerSale: "80", variableCostPerSale: "30", cashOnHand: "5000" },
        output_payload: { breakEven: "Somebody else's answer." },
        created_at: "2026-08-01T09:00:00.000Z"
      },
      {
        id: OTHER_TOOL, organization_id: ORG, product_key: "business_builder", module_key: "reorder_point_planner",
        input_payload: { averageDailyUsage: "7", leadTimeDays: "4", safetyStock: "20" },
        output_payload: { reorderPoint: "Reorder at 48." },
        created_at: "2026-08-01T09:00:00.000Z"
      }
    ]
  };
}

describe("reusing the numbers from a saved result", () => {
  describe("linking a result back to its tool", () => {
    it("builds the map from the table that registered the routes", () => {
      const paths = toolPathsFrom([
        { module: "break_even", path: TOOL, title: "Break-even" },
        { module: "reorder_point", path: "/business-builder/tools/reorder-point", title: "Reorder point" }
      ]);
      assert.equal(paths.get("break_even"), TOOL);
      assert.equal(paths.size, 2);
    });

    it("leaves out a tool missing either half rather than linking to nothing", () => {
      // A half-registered tool loses its link instead of gaining a broken one.
      const paths = toolPathsFrom([
        { module: "break_even", path: TOOL },
        { module: "no_path" },
        { path: "/no/module" },
        null
      ]);
      assert.equal(paths.size, 1);
      assert.equal(paths.has("no_path"), false);
    });

    it("survives being handed nothing", () => {
      for (const value of [null, undefined, "", 12, {}]) {
        assert.equal(toolPathsFrom(value).size, 0, `threw or filled on ${JSON.stringify(value)}`);
      }
    });
  });

  describe("the tool page", () => {
    let app;
    let fake;
    let savedFetch;
    let savedEnv;

    before(() => {
      savedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
      fake = createFakeSupabase({ users: { "token-a": { id: USER, email: "owner@example.com" } }, tables: seed() });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      app = require("../server");
    });

    after(() => {
      if (savedFetch) global.fetch = savedFetch;
      for (const [key, value] of Object.entries(savedEnv || {})) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    const open = (query = "") => request(app).get(`${TOOL}${query}`).set("accept", "text/html").set("authorization", "Bearer token-a").redirects(0);

    it("still opens for a stranger with no preset asked for", async () => {
      const response = await request(app).get(TOOL).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200, "a free tool that needs an account is not a free tool");
      assert.ok(response.text.includes("No account needed"));
    });

    it("fills the form in from a result this customer saved", async () => {
      const response = await open(`?reuse=${MINE}`);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes(`value="${MY_COSTS}"`), "the saved numbers did not reach the form");
      assert.ok(response.text.includes("Your numbers from last time"));
    });

    it("will not fill in another business's saved result", async () => {
      const response = await open(`?reuse=${THEIRS}`);
      assert.equal(response.status, 200);
      assert.ok(!response.text.includes(THEIR_COSTS), "another business's figures reached this customer's form");
      assert.ok(!response.text.includes("Your numbers from last time"));
      // Said the same way as an id that does not exist. Telling them apart
      // tells somebody guessing ids when they have guessed a real one.
      assert.ok(response.text.includes("not one of yours"));
    });

    it("will not fill one tool in from another tool's saved result", async () => {
      // A saved break-even filling the reorder-point form would look like the
      // tool working while answering from figures that mean something else.
      const response = await open(`?reuse=${OTHER_TOOL}`);
      assert.ok(!response.text.includes("Your numbers from last time"));
      assert.ok(response.text.includes("not one of yours"));
    });

    it("says nothing was filled in rather than showing an empty form", async () => {
      const response = await open("?reuse=99999999-0000-4000-8000-000000000000");
      assert.ok(response.text.includes("Not filled in"), "an unfindable result rendered as a blank form somebody would retype");
    });

    it("refuses a reuse value that is not an id, without asking the database", async () => {
      // The distinction matters. encodeURIComponent already stops a crafted
      // value changing the query -- an appended "&limit=99" becomes part of one
      // filter value and matches nothing -- so "it did not fill the form in"
      // would pass with no shape check at all. What the shape check uniquely
      // buys is not making the round trip, which is what this asserts.
      for (const bad of ["../../etc", `${MINE}&limit=99`, "not-a-uuid"]) {
        fake.reset();
        const response = await open(`?reuse=${encodeURIComponent(bad)}`);
        assert.equal(response.status, 200);
        assert.ok(!response.text.includes(`value="${MY_COSTS}"`), `accepted ${bad}`);
        assert.equal(fake.queries.filter((entry) => entry.table === "module_outputs").length, 0,
          `a value that cannot be an id was still sent to the database: ${bad}`);
      }
    });

    it("scopes the read by both the business and the tool", async () => {
      fake.reset();
      await open(`?reuse=${MINE}`);
      const reads = fake.queries.filter((entry) => entry.table === "module_outputs" && entry.method === "GET");
      assert.ok(reads.length > 0, "no saved-result read was recorded, so this check is looking at nothing");
      for (const read of reads) {
        assert.ok(read.search.includes(`organization_id=eq.${ORG}`), `a preset read carried no tenant filter: ${read.search}`);
        assert.ok(read.search.includes("module_key=eq.break_even_planner"), `a preset read was not scoped to this tool: ${read.search}`);
      }
    });

    it("asks for the inputs and not the whole row", async () => {
      fake.reset();
      await open(`?reuse=${MINE}`);
      const read = fake.queries.find((entry) => entry.table === "module_outputs" && entry.method === "GET");
      assert.ok(/select=input_payload/.test(read.search), `the preset read selects more than it needs: ${read.search}`);
    });

    it("does not read anything when no preset was asked for", async () => {
      fake.reset();
      await open();
      assert.equal(fake.queries.filter((entry) => entry.table === "module_outputs").length, 0,
        "every visitor to a free tool costs a query for a preset nobody asked for");
    });

    it("says nothing about presets to somebody who did not ask for one", async () => {
      // The `reuse &&` guard earns its place here rather than at the query --
      // the shape check already stops the round trip. Without the guard a
      // signed-in customer opening a tool normally is told their numbers were
      // not filled in, which is a confusing answer to a question they never
      // asked.
      const response = await open();
      assert.equal(response.status, 200);
      assert.ok(!response.text.includes("Not filled in"), "a plain visit was answered as a failed preset");
      assert.ok(!response.text.includes("Your numbers from last time"));
    });
  });
});
