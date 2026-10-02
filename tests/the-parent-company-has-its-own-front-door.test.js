"use strict";

// SONARA Industries had no public tool of its own.
//
// All forty tools sat under /business-builder/, /creator-studio/ or
// /growth-studio/, so a visitor who had not yet decided which studio they needed
// had nothing to open — and the one question they actually had ("which of these
// is for me?") was the one question no studio can answer without recommending
// itself. The parent company now has three tools and a directory at /tools.
//
// Three things about them have to stay true, and each has a way of quietly
// stopping:
//
// **Every parent tool must be free.** They carry no productKey, because there is
// no "SONARA Industries" plan. If one left the free set, toolAccess would reach
// `productForTool` → null → `unknown_product`, and a customer would be told "That
// is a fault on our side" on a page we shipped. The gate is right; the page would
// be ours to answer for.
//
// **The count must not be written down anywhere.** Five surfaces each held their
// own "six" on 2 October 2026. All five were correct and all five were wrong the
// same afternoon.
//
// **A refusal must stay a refusal.** Each of the three has a case with no answer —
// nothing ticked, nothing being re-typed, a count that contradicts itself — and
// each must say so rather than return a confident zero.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const access = require("../lib/sonara-tool-access.cjs");
const industries = require("../lib/sonara-industries-tools.cjs");
const { PLANNER_TOOLS } = require("../lib/sonara-planner-tools.cjs");
const { MARKET_TOOLS } = require("../lib/sonara-market-tools.cjs");

const root = path.join(__dirname, "..");

describe("the parent company has its own front door", () => {
  const app = require("../server.js");
  const registered = app.locals.sonaraFreeTools || [];

  describe("the three tools exist and are reachable", () => {
    it("registers three parent-company tools", () => {
      assert.equal(industries.INDUSTRIES_TOOLS.length, 3, "the owner's decision was three at the parent company");
      assert.equal(access.freeToolCountByCompany().sonara_industries, 3);
    });

    it("serves a directory at /tools that labels every one of them", async () => {
      const response = await request(app).get("/tools").set("accept", "text/html");
      assert.equal(response.status, 200);
      for (const tool of industries.INDUSTRIES_TOOLS) {
        assert.ok(response.text.includes(`${tool.title} — free`), `/tools does not label ${tool.title} as free`);
        assert.ok(response.text.includes(tool.path), `/tools does not link ${tool.path}`);
      }
      // And it points at the studios rather than pretending to be the index of
      // everything, so each company's own directory stays the page that names
      // that company's tools.
      for (const directory of ["/business-builder/tools", "/creator-studio/tools", "/growth-studio/tools"]) {
        assert.ok(response.text.includes(directory), `/tools does not link ${directory}`);
      }
    });

    it("answers each one with a working form to a visitor with no account", async () => {
      for (const tool of industries.INDUSTRIES_TOOLS) {
        const response = await request(app).get(tool.path).set("accept", "text/html");
        assert.equal(response.status, 200, `${tool.path} did not render for a visitor`);
        assert.match(response.text, /<form/i, `${tool.path} rendered no form`);
        assert.doesNotMatch(response.text, /On a paid plan/, `${tool.path} refused a visitor`);
      }
    });

    it("computes each one for a visitor with no account", async () => {
      for (const tool of industries.INDUSTRIES_TOOLS) {
        const body = {};
        for (const field of tool.requiredFields) body[field] = "10";
        const response = await request(app).post(tool.path).set("accept", "text/html").type("form").send(body);
        assert.equal(response.status, 200, `${tool.path} answered ${response.status}`);
        assert.match(response.text, /Free tool result/, `${tool.path} computed nothing`);
      }
    });
  });

  describe("every parent tool is free, because no plan could open one", () => {
    it("carries no productKey and no slug", () => {
      for (const tool of industries.INDUSTRIES_TOOLS) {
        assert.equal(tool.productKey, null, `${tool.path} claims a product key, and there is no parent-company plan`);
        assert.equal(tool.slug, null, `${tool.path} claims a studio slug`);
        assert.equal(tool.directoryPath, "/tools", `${tool.path} has no directory to link back to`);
      }
    });

    // The assertion the comment in lib/sonara-tool-access.cjs promises. Without
    // it that comment is a reason nobody checked.
    it("is in the free set, every one", () => {
      for (const tool of industries.INDUSTRIES_TOOLS) {
        assert.ok(access.isFreeTool(tool.path), `${tool.path} is not free and no plan covers it; it would answer "a fault on our side"`);
      }
      assert.equal(access.FREE_TOOL_PATHS.filter((toolPath) => access.isParentTool(toolPath)).length, 3);
    });

    // Not registered as a product prefix, deliberately. If somebody added it,
    // a parent tool could be locked behind an entitlement nobody sells.
    it("has no entitlement a gate could check", () => {
      for (const tool of industries.INDUSTRIES_TOOLS) {
        assert.equal(access.productForTool(tool.path), null, `${tool.path} resolved to a product key`);
      }
    });
  });

  describe("none of them duplicates a studio tool", () => {
    const studioTools = [...PLANNER_TOOLS, ...MARKET_TOOLS];

    it("reads a population worth measuring", () => {
      assert.ok(studioTools.length >= 18, `only ${studioTools.length} studio tools read; this check has gone blind`);
    });

    it("shares no module key or path with one", () => {
      const modules = new Set(studioTools.map((tool) => tool.module));
      const paths = new Set(studioTools.map((tool) => tool.path));
      for (const tool of industries.INDUSTRIES_TOOLS) {
        assert.ok(!modules.has(tool.module), `${tool.module} is already a studio tool's module key`);
        assert.ok(!paths.has(tool.path), `${tool.path} is already a studio tool's path`);
      }
    });

    // The claim in lib/sonara-industries-tools.cjs is that subscription-count
    // asks a different question from software-spend: duplication of one record
    // across products, rather than seat utilisation on one product. Asserted by
    // the inputs, because two tools taking the same inputs are answering the same
    // question whatever their titles say.
    it("asks subscription-count a different question from software-spend", () => {
      const softwareSpend = studioTools.find((tool) => tool.path === "/business-builder/tools/software-spend");
      const subscriptionCount = industries.INDUSTRIES_TOOLS.find((tool) => tool.path === "/tools/subscription-count");
      assert.ok(softwareSpend, "software-spend is gone; this comparison is measuring nothing");
      assert.ok(subscriptionCount);
      const spendFields = new Set(softwareSpend.requiredFields);
      const countFields = new Set(subscriptionCount.requiredFields);
      const shared = [...countFields].filter((field) => spendFields.has(field));
      assert.deepEqual(shared, [], `the two take the same inputs (${shared.join(", ")}), so they are the same question`);
      assert.ok(countFields.has("productsHoldingCustomers"), "the duplication input is what makes this a different tool");
      assert.ok(spendFields.has("activeSeats"), "the utilisation input is what makes software-spend a different tool");
    });
  });

  describe("which studio, when it cannot say", () => {
    it("names no studio when nothing was ticked", () => {
      const result = industries.whichStudio({});
      assert.match(result.whichOne, /Nothing was ticked/);
      // The failure that matters: picking the first studio and calling it advice.
      for (const studio of industries.STUDIOS) {
        assert.ok(!String(result.whichOne).includes(studio.name), `it named ${studio.name} on no answers`);
      }
      assert.ok(result.whyNotAGuess, "it did not say why it is refusing");
    });

    it("names one studio when the answers point at one", () => {
      const result = industries.whichStudio({ makingWork: "yes", rightsMatter: "yes" });
      assert.match(result.whichOne, /Creator Studio/);
      assert.ok(!/Business Builder\.|Growth Studio\./.test(result.whichOne));
    });

    it("names both when they tie, rather than breaking the tie silently", () => {
      const result = industries.whichStudio({ makingWork: "yes", needCustomers: "yes" });
      assert.match(result.whichOne, /Creator Studio and Growth Studio/);
      assert.ok(result.whyTwo, "a tie was reported without saying it is a real answer");
    });

    it("reads only an affirmative as a yes", () => {
      assert.equal(industries.saidYes("yes"), true);
      assert.equal(industries.saidYes("on"), true);
      assert.equal(industries.saidYes("no"), false);
      assert.equal(industries.saidYes(""), false);
      assert.equal(industries.saidYes(undefined), false);
      // "no" must not count. A checkbox posted as "no" that scored would make
      // every answer a yes.
      const result = industries.whichStudio({ makingWork: "no", rightsMatter: "no" });
      assert.match(result.whichOne, /Nothing was ticked/);
    });

    it("takes its studio names from the positioning rather than from prose", () => {
      const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
      assert.ok(industries.STUDIOS.length === 3);
      for (const studio of industries.STUDIOS) {
        assert.ok(agents.includes(studio.name), `${studio.name} is not a name AGENTS.md uses`);
        assert.ok(agents.includes(studio.forWhat), `${studio.name}'s description is not the one AGENTS.md fixes`);
      }
    });
  });

  describe("re-typing cost, when there is nothing to count", () => {
    it("says nothing is being re-typed rather than reporting $0.00 a year", () => {
      const result = industries.retypingCost({ copiesPerWeek: "0", minutesPerCopy: "5", hourlyRate: "40", peopleDoingIt: "1" });
      assert.match(result.yearlyCost, /Nothing is being re-typed/);
      assert.ok(!/\$0\.00 a year/.test(result.yearlyCost));
    });

    it("names the box it could not read rather than returning NaN", () => {
      const result = industries.retypingCost({ copiesPerWeek: "lots", minutesPerCopy: "5", hourlyRate: "40", peopleDoingIt: "1" });
      assert.match(result.couldNotCalculate, /times a week/);
      assert.ok(!JSON.stringify(result).includes("NaN"));
      assert.ok(result.nothingWasGuessed);
    });

    it("multiplies by the number of people, not just one of them", () => {
      const one = industries.retypingCost({ copiesPerWeek: "20", minutesPerCopy: "3", hourlyRate: "40", peopleDoingIt: "1" });
      const two = industries.retypingCost({ copiesPerWeek: "20", minutesPerCopy: "3", hourlyRate: "40", peopleDoingIt: "2" });
      assert.notEqual(one.yearlyCost, two.yearlyCost, "the number of people changed nothing");
      assert.match(two.yearlyCost, /4160\.00/);
    });

    it("invents no error rate for the cost it cannot measure", () => {
      const result = industries.retypingCost({ copiesPerWeek: "20", minutesPerCopy: "3", hourlyRate: "40", peopleDoingIt: "2" });
      assert.match(result.theOtherCost, /not going to invent an error rate/);
    });

    it("quotes no price of ours, so nothing in it can go stale", () => {
      const source = fs.readFileSync(path.join(root, "lib", "sonara-industries-tools.cjs"), "utf8");
      // The three stale comparisons this repository has already shipped were all
      // a remembered price written into a file. There is no price in this one.
      assert.doesNotMatch(source, /\$\d+(\.\d+)?\s*(a|per)\s*month/i, "a monthly price is written into the parent tools");
      assert.ok(source.includes("/pricing"), "it does not point at the page that is generated from the plans");
    });
  });

  describe("subscription count, when the numbers contradict each other", () => {
    it("refuses when more products hold the list than exist", () => {
      const result = industries.subscriptionCount({ productCount: "3", monthlyTotal: "100", productsHoldingCustomers: "5" });
      assert.match(result.couldNotCalculate, /cannot both be true/);
      // The quiet version of this bug is taking the minimum and reporting a
      // confident answer to a question nobody asked.
      assert.ok(!result.yearlyTotal, "it computed a total from figures it had just called impossible");
      assert.match(result.nothingWasGuessed, /not quietly taken the smaller number/);
    });

    it("counts duplicates as copies beyond the first, not as the number holding it", () => {
      const result = industries.subscriptionCount({ productCount: "8", monthlyTotal: "400", productsHoldingCustomers: "6" });
      assert.match(result.duplicateCustomerLists, /^5 duplicate copies/);
      assert.match(result.yearlyTotal, /4800\.00/);
    });

    it("says one place holds it when only one does", () => {
      const result = industries.subscriptionCount({ productCount: "4", monthlyTotal: "100", productsHoldingCustomers: "1" });
      assert.match(result.duplicateCustomerLists, /One place holds your customer list/);
      assert.doesNotMatch(result.duplicateCustomerLists, /duplicate/);
    });

    it("says you are paying for nothing rather than dividing by zero", () => {
      const result = industries.subscriptionCount({ productCount: "0", monthlyTotal: "0", productsHoldingCustomers: "0" });
      assert.match(result.yearlyTotal, /paying for nothing/);
      assert.ok(!JSON.stringify(result).includes("NaN"));
      assert.ok(!JSON.stringify(result).includes("Infinity"));
    });
  });

  describe("the count is written down nowhere", () => {
    it("derives the sentence from the list", () => {
      const sentence = access.freeToolSentence();
      assert.ok(sentence.includes(String(access.FREE_TOOL_COUNT)), sentence);
      assert.match(sentence, /in each studio/);
      assert.match(sentence, /SONARA Industries/);
    });

    it("adapts the sentence when the studios stop being equal", () => {
      // The branch exists because four-each is today's split and not a law. A
      // sentence that said "4 in each studio" after one changed would be a page
      // stating something false, which is this whole file's subject.
      const counts = access.freeToolCountByCompany();
      assert.equal(counts.business_builder, counts.creator_studio);
      assert.equal(counts.creator_studio, counts.growth_studio);
      assert.equal(
        counts.business_builder + counts.creator_studio + counts.growth_studio + counts.sonara_industries,
        access.FREE_TOOL_COUNT
      );
    });

    it("has the five surfaces reading the figure rather than holding one", () => {
      const readers = [
        path.join(root, "lib", "sonara-stripe-plans.cjs"),
        path.join(root, "lib", "sonara-industries-tools.cjs"),
        path.join(root, "routes", "sonara-service-lifecycle-routes.cjs"),
        path.join(root, "routes", "sonara-route-registry-routes.cjs")
      ];
      for (const file of readers) {
        const source = fs.readFileSync(file, "utf8");
        assert.ok(
          source.includes("freeToolSentence") || source.includes("FREE_TOOL_COUNT") || source.includes("freeToolCountByCompany"),
          `${path.relative(root, file)} does not read the free-tool count`
        );
      }
    });

    it("has the free plan describing the real number", () => {
      const { STRIPE_PLANS } = require("../lib/sonara-stripe-plans.cjs");
      assert.ok(
        String(STRIPE_PLANS.free.description).includes(String(access.FREE_TOOL_COUNT)),
        STRIPE_PLANS.free.description
      );
    });
  });

  describe("every tool the owner's split names is actually free", () => {
    it("frees four in each studio", () => {
      const counts = access.freeToolCountByCompany();
      assert.equal(counts.business_builder, 4);
      assert.equal(counts.creator_studio, 4);
      assert.equal(counts.growth_studio, 4);
    });

    it("answers all fifteen to a visitor with no account", async () => {
      assert.equal(access.FREE_TOOL_PATHS.length, 15);
      for (const toolPath of access.FREE_TOOL_PATHS) {
        const tool = registered.find((entry) => entry.path === toolPath);
        assert.ok(tool, `${toolPath} is listed as free and is not a registered tool`);
        const response = await request(app).get(toolPath).set("accept", "text/html");
        assert.equal(response.status, 200, `${toolPath} answered ${response.status}`);
        assert.doesNotMatch(response.text, /On a paid plan/, `${toolPath} is advertised as free and answered as locked`);
      }
    });
  });
});
