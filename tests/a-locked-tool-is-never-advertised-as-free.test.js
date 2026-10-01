"use strict";

// Thirty-four of the forty tools now need a plan. The pricing decision is the
// owner's. The failure mode is not, and it is a specific one with a history in
// this repository: until 19 August 2026 every tool was behind a login while
// /business-builder/tools listed ten of them by name, so the funnel advertised
// and then refused. The comment in routes/sonara-service-lifecycle-routes.cjs
// records that gating the computation drove a bounce rather than a signup.
//
// A paywall brings that failure back the moment one page says "free" about a
// tool another page refuses. These are the assertions that stop it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const access = require("../lib/sonara-tool-access.cjs");

const root = path.join(__dirname, "..");

describe("a locked tool is never advertised as free", () => {
  const app = require("../server.js");
  const tools = app.locals.sonaraFreeTools || [];

  describe("which tools are free", () => {
    it("reads a population worth measuring", () => {
      assert.ok(tools.length >= 30, `only ${tools.length} tools registered; this check has gone blind`);
    });

    // Both directions matter and an empty set would satisfy neither.
    it("frees some tools but not all of them", () => {
      const { free, locked } = access.partitionTools(tools);
      assert.ok(free.length > 0, "no tool is free; the home page promises six");
      assert.ok(locked.length > 0, "every tool is free; nothing is behind the paywall");
      assert.equal(free.length + locked.length, tools.length);
      assert.equal(free.length, access.FREE_TOOL_PATHS.length);
    });

    // The free set is a consequence of what the home page says, not a list
    // somebody picked. Derived from server.js here rather than copied, so
    // changing one without the other fails.
    it("matches exactly the tools the public home page links", () => {
      const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
      const home = server.slice(server.indexOf("sonara-conversion-home"));
      const advertised = tools
        .map((tool) => tool.path)
        .filter((toolPath) => home.includes(`href=\\"${toolPath}\\"`))
        .sort();
      assert.ok(advertised.length > 0, "no tool path was found on the home page; this check has gone blind");
      assert.deepEqual(
        advertised,
        [...access.FREE_TOOL_PATHS].sort(),
        "the home page and lib/sonara-tool-access.cjs disagree about which tools are free. "
          + "Change them together: a tool on the page but not in the list is promised and refused, "
          + "and a tool in the list but not on the page is free with nothing advertising it."
      );
    });

    it("every free path is a tool that exists", () => {
      const known = new Set(tools.map((tool) => tool.path));
      for (const toolPath of access.FREE_TOOL_PATHS) {
        assert.ok(known.has(toolPath), `${toolPath} is listed as free and is not a registered tool`);
      }
    });
  });

  describe("what a locked tool actually answers", () => {
    const locked = access.partitionTools(tools).locked;
    const free = access.partitionTools(tools).free;

    it("answers a free tool with its form, to anyone", async () => {
      for (const tool of free) {
        const response = await request(app).get(tool.path).set("accept", "text/html");
        assert.equal(response.status, 200, `${tool.path} did not render for a visitor`);
        assert.match(response.text, /<form/i, `${tool.path} rendered no form`);
        assert.doesNotMatch(response.text, /On a paid plan/, `${tool.path} is advertised as free and answered as locked`);
      }
    });

    // Never a 404 and never a bare redirect: somebody who clicked a named tool
    // is owed the sentence saying what it works out.
    it("answers a locked tool with a page that names it and says what opens it", async () => {
      for (const tool of locked) {
        const response = await request(app).get(tool.path).set("accept", "text/html");
        assert.equal(response.status, 200, `${tool.path} answered ${response.status} rather than explaining itself`);
        assert.match(response.text, /On a paid plan/, `${tool.path} did not say it is on a paid plan`);
        assert.match(response.text, /\/pricing/, `${tool.path} did not link the plans`);
        assert.doesNotMatch(response.text, /<form[^>]*method="post"[^>]*action="\/(business-builder|creator-studio|growth-studio)\/tools\//i,
          `${tool.path} served its working form to a visitor with no plan`);
      }
    });

    it("refuses to compute a locked tool, whatever is posted at it", async () => {
      for (const tool of locked.slice(0, 8)) {
        const response = await request(app).post(tool.path).set("accept", "application/json").send({});
        assert.ok([401, 403].includes(response.status), `${tool.path} answered POST with ${response.status}`);
        assert.equal(response.body.ok, false);
      }
    });

    // Validating first would report a locked tool as a badly filled form and
    // would tell a caller which inputs it wants.
    it("refuses a locked tool before it checks the fields", async () => {
      const tool = locked[0];
      const response = await request(app).post(tool.path).set("accept", "application/json").send({});
      assert.notEqual(response.body.code, "missing_fields", "the field check ran before the paywall");
      assert.ok(["sign_in_required", "plan_required", "entitlement_unreadable"].includes(response.body.code),
        `unexpected refusal code ${response.body.code}`);
    });

    // The point of the free six: a visitor with no account gets a real answer.
    // Fields come from the tool's own declaration rather than from memory --
    // guessing them made the first version of this fail on a 400 that had
    // nothing to do with the paywall.
    it("still computes a free tool for a visitor with no account", async () => {
      for (const tool of free) {
        const body = {};
        for (const field of tool.requiredFields) body[field] = "10";
        const response = await request(app).post(tool.path).set("accept", "text/html").type("form").send(body);
        assert.equal(response.status, 200, `${tool.path} answered ${response.status} to a visitor`);
        assert.doesNotMatch(response.text, /On a paid plan/, `${tool.path} refused a visitor as if it were locked`);
        // A computed answer, not a form echoed back. The first version asserted
        // the page said nothing about signing in, which matched the site
        // navigation on every page and had nothing to do with the paywall.
        assert.match(response.text, /Free tool result/, `${tool.path} answered a visitor without computing anything`);
      }
    });
  });

  describe("the directories label every entry", () => {
    for (const slug of ["business-builder", "creator-studio", "growth-studio"]) {
      it(`${slug} says which of its tools are free and which are not`, async () => {
        const response = await request(app).get(`/${slug}/tools`).set("accept", "text/html");
        assert.equal(response.status, 200);
        const mine = tools.filter((tool) => tool.path.startsWith(`/${slug}/`));
        assert.ok(mine.length > 0, `no tools found for ${slug}; this check has gone blind`);
        for (const tool of mine) {
          const label = access.isFreeTool(tool.path) ? `${tool.title} — free` : `${tool.title} — on a paid plan`;
          assert.ok(response.text.includes(label), `${slug} directory does not label ${tool.title}`);
        }
      });
    }

    // Hiding the locked ones would make the product look smaller than it is,
    // and would be a different way to stop telling the truth about it.
    it("hides none of them", async () => {
      for (const slug of ["business-builder", "creator-studio", "growth-studio"]) {
        const response = await request(app).get(`/${slug}/tools`).set("accept", "text/html");
        for (const tool of tools.filter((entry) => entry.path.startsWith(`/${slug}/`))) {
          assert.ok(response.text.includes(tool.path), `${tool.path} is missing from the ${slug} directory`);
        }
      }
    });
  });

  describe("no public page still calls a locked tool free", () => {
    it("the free-plan description does not promise all of them", () => {
      const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");
      const description = String(STRIPE_PLANS.free.description || "");
      assert.doesNotMatch(
        description,
        /the free tools in all three studios/,
        "the free plan still advertises the tools in all three studios"
      );
      assert.match(description, /six free tools/i, "the free plan no longer says how many tools are free");
    });

    // The marketing page named individual tools that are now behind the plan.
    it("the /free-tools page names only tools that are actually free", async () => {
      const response = await request(app).get("/free-tools").set("accept", "text/html");
      assert.equal(response.status, 200);
      const lockedTitles = access.partitionTools(tools).locked.map((tool) => tool.title);
      assert.ok(lockedTitles.length > 0, "nothing is locked; this check has gone blind");
      for (const title of lockedTitles) {
        assert.ok(!response.text.includes(title), `/free-tools still names "${title}", which needs a plan`);
      }
    });
  });
});
