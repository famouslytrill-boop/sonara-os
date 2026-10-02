"use strict";

// SONARA Industries had no public tool of its own.
//
// All forty tools sat under /business-builder/, /creator-studio/ or
// /growth-studio/, so a visitor who had not yet decided which studio they needed
// had nothing to open. The parent company now has three tools and a directory at
// /tools, served by routes/sonara-parent-tool-routes.cjs.
//
// This file was written on 2 October 2026 against a different three. Two branches
// built the parent company's front door the same day; #416 merged first, so its
// three shipped and the three this file was written for were dropped rather than
// added to — six at the parent company would contradict the owner's decision of
// three. What survived the rename is every assertion that was about the *shape* of
// a parent tool rather than about which three they are, because each of those still
// has a way of quietly stopping:
//
// **Every parent tool must be free.** None carries a productKey, because there is
// no "SONARA Industries" plan. If one left the free set, `productForTool` would
// return null and a visitor would be told "that is a fault on our side" on a page
// we shipped.
//
// **The count must not be written down anywhere.** Five surfaces each held their
// own "six" on 2 October 2026. All five were correct and all five were wrong the
// same afternoon — and then the set changed a second time that day, which is the
// reason this is a gate and not a note.
//
// **"Processing stays on your device" must be true.** Each of these three pages
// says so in those words. A claim about where somebody's data goes is not a
// marketing sentence; the assertion below is that there is no server route that
// could receive it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const access = require("../lib/sonara-tool-access.cjs");
const { PLANNER_TOOLS } = require("../lib/sonara-planner-tools.cjs");
const { MARKET_TOOLS } = require("../lib/sonara-market-tools.cjs");

const root = path.join(__dirname, "..");

describe("the parent company has its own front door", () => {
  const app = require("../server.js");
  const parentTools = app.locals.sonaraParentTools || [];
  const freeTools = app.locals.sonaraFreeTools || [];

  describe("the three tools exist and are reachable", () => {
    it("registers three parent-company tools", () => {
      assert.equal(parentTools.length, 3, "the owner's decision was three at the parent company");
      assert.equal(access.freeToolCountByCompany().sonara_industries, 3);
    });

    it("serves a directory at /tools that links every one of them", async () => {
      const response = await request(app).get("/tools").set("accept", "text/html");
      assert.equal(response.status, 200);
      for (const tool of parentTools) {
        assert.ok(response.text.includes(tool.path), `/tools does not link ${tool.path}`);
        assert.ok(response.text.includes(tool.title), `/tools does not name ${tool.title}`);
      }
    });

    it("answers each one with a working form to a visitor with no account", async () => {
      for (const tool of parentTools) {
        const response = await request(app).get(tool.path).set("accept", "text/html");
        assert.equal(response.status, 200, `${tool.path} did not render for a visitor`);
        assert.match(response.text, /<form/i, `${tool.path} rendered no form`);
        assert.doesNotMatch(response.text, /On a paid plan/, `${tool.path} refused a visitor`);
      }
    });

    // The pages say the work happens on the device. A <noscript> that tells the
    // visitor why nothing happened is the difference between a page that degrades
    // and a page that silently does nothing.
    it("says what a visitor without JavaScript gets, rather than a dead button", async () => {
      for (const tool of parentTools) {
        const response = await request(app).get(tool.path).set("accept", "text/html");
        assert.match(response.text, /<noscript>/i, `${tool.path} has no fallback notice`);
        assert.ok(
          response.text.includes("/sonara-parent-tools.js"),
          `${tool.path} claims on-device processing and loads no script to do it`
        );
      }
    });
  });

  describe("nothing typed into a parent tool is uploaded", () => {
    // The claim, in the page's own words. Asserted rather than trusted, because a
    // sentence about where somebody's data goes is the one kind of copy that must
    // not be able to drift away from the code.
    it("promises on the page that the input stays on the device", async () => {
      for (const tool of parentTools) {
        const response = await request(app).get(tool.path).set("accept", "text/html");
        assert.match(
          response.text,
          /processed locally and is not uploaded or saved/i,
          `${tool.path} does not state where the input goes`
        );
      }
    });

    it("has no route that could receive it", async () => {
      for (const tool of parentTools) {
        const response = await request(app).post(tool.path).type("form").send({ text: "{}" });
        assert.notEqual(
          response.status,
          200,
          `${tool.path} accepted a POST, and the page tells the visitor nothing is uploaded`
        );
      }
    });

    // The form has no action and no method, so a submit cannot navigate; the
    // script calls preventDefault. Both have to hold: an action-less form on a
    // page whose script failed to load would POST to the page itself, which is
    // what the assertion above covers, and a form with an action would send the
    // input somewhere whatever the script did.
    it("gives the form nowhere to send", async () => {
      for (const tool of parentTools) {
        const response = await request(app).get(tool.path).set("accept", "text/html");
        const form = (response.text.match(/<form[^>]*>/i) || [""])[0];
        assert.doesNotMatch(form, /\saction=/i, `${tool.path}'s form names a destination: ${form}`);
        assert.doesNotMatch(form, /\smethod=/i, `${tool.path}'s form names a method: ${form}`);
      }
    });
  });

  describe("every parent tool is free, because no plan could open one", () => {
    // The assertion the comment in lib/sonara-tool-access.cjs promises. Without
    // it that comment is a reason nobody checked.
    it("is in the free set, every one", () => {
      for (const tool of parentTools) {
        assert.ok(
          access.isFreeTool(tool.path),
          `${tool.path} is not free and no plan covers it; it would answer "a fault on our side"`
        );
        assert.ok(access.isParentTool(tool.path), `${tool.path} is not read as a parent tool`);
      }
      assert.equal(access.FREE_TOOL_PATHS.filter((toolPath) => access.isParentTool(toolPath)).length, 3);
    });

    // Not registered as a product prefix, deliberately. If somebody added it,
    // a parent tool could be locked behind an entitlement nobody sells.
    it("has no entitlement a gate could check", () => {
      for (const tool of parentTools) {
        assert.equal(access.productForTool(tool.path), null, `${tool.path} resolved to a product key`);
      }
    });
  });

  describe("none of them duplicates a studio tool", () => {
    const studioTools = [...PLANNER_TOOLS, ...MARKET_TOOLS];

    it("reads a population worth measuring", () => {
      assert.ok(studioTools.length >= 18, `only ${studioTools.length} studio tools read; this check has gone blind`);
    });

    it("shares no path with one", () => {
      const paths = new Set(studioTools.map((tool) => tool.path));
      for (const tool of parentTools) {
        assert.ok(!paths.has(tool.path), `${tool.path} is already a studio tool's path`);
      }
    });

    // A /tools/<key> that collided with a studio slug would be two pages at one
    // address, and Express would serve whichever registered first.
    it("claims no address a studio directory already owns", () => {
      const reserved = new Set(["/tools", "/business-builder/tools", "/creator-studio/tools", "/growth-studio/tools"]);
      for (const tool of parentTools) {
        assert.ok(!reserved.has(tool.path), `${tool.path} is a directory address, not a tool address`);
      }
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

    it("has every surface reading the figure rather than holding one", () => {
      const readers = [
        path.join(root, "server.js"),
        path.join(root, "lib", "sonara-stripe-plans.cjs"),
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
      const registered = [...freeTools, ...parentTools];
      assert.ok(registered.length >= 15, `only ${registered.length} tools registered; this check has gone blind`);
      for (const toolPath of access.FREE_TOOL_PATHS) {
        assert.ok(
          registered.some((entry) => entry.path === toolPath),
          `${toolPath} is listed as free and is not a registered tool`
        );
        const response = await request(app).get(toolPath).set("accept", "text/html");
        assert.equal(response.status, 200, `${toolPath} answered ${response.status}`);
        assert.doesNotMatch(response.text, /On a paid plan/, `${toolPath} is advertised as free and answered as locked`);
      }
    });
  });
});
