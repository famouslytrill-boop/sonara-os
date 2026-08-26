"use strict";

// The LeadForge landing page, and the one thing a sales page must not do.
//
// This application's home page carries the sentence "SONARA does not publish
// fake testimonials, invented customer counts, fictional awards, guaranteed
// revenue, false scarcity, or unsupported compliance and security claims", and
// tests/brand-routes.test.mjs asserts it is live. A landing page served from
// the same application with an invented figure on it would make that sentence
// false -- which is this codebase's signature defect wearing marketing copy
// instead of a passing test.
//
// So the rule is structural, not a matter of care. Every stat, logo and quote
// is either marked `sample: true` -- and then the page SAYS so, in front of the
// reader -- or carries a `source`. Neither is refused here.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const content = require("../lib/sonara-leadforge-content.cjs");

const PAGE = "/leadforge";
const open = () => request(app).get(PAGE).set("accept", "text/html").redirects(0);

describe("the LeadForge page cannot invent proof", () => {
  describe("the rule", () => {
    it("has proof to check, so this is not passing on an empty list", () => {
      assert.ok(content.proofItems().length >= 5, "there is almost no proof on the page, so every check below is nearly vacuous");
    });

    it("accepts nothing that is neither sampled nor sourced", () => {
      assert.deepEqual(content.validate(), []);
    });

    it("catches both bad shapes, run over a proposed list", () => {
      // validate() takes the list, so the rule can be run against a change
      // before it ships rather than only against what already did.
      const problems = content.validate([
        { value: "2,400 teams", sample: false, source: null, where: "stats" },
        { value: "12%", sample: true, source: "measured 2026-08-01", where: "stats" }
      ]);
      assert.equal(problems.length, 2, `expected both shapes to be caught, got ${JSON.stringify(problems)}`);
      assert.ok(problems.some((line) => /neither marked as a sample nor sourced/.test(line)),
        "an unsourced claim passed");
      assert.ok(problems.some((line) => /cannot be both/.test(line)),
        "a claim that is both sampled and sourced passed, and a reader has no way to know which it is");
    });

    it("accepts a properly sourced claim, or every refusal above is vacuous", () => {
      assert.deepEqual(content.validate([{ value: "12%", sample: false, source: "measured 2026-08-01", where: "stats" }]), []);
    });

    it("reports having no proof at all as a problem", () => {
      assert.ok(content.validate([]).some((line) => /looking at nothing/.test(line)),
        "an empty proof list passed, so this check could go blind by deletion");
    });
  });

  describe("what the page shows", () => {
    it("renders for anybody, with no account", async () => {
      const response = await open();
      assert.equal(response.status, 200);
      assert.match(response.text, /LeadForge/);
    });

    it("carries the notice while any proof is a sample", async () => {
      assert.equal(content.hasSamples(), true, "there are no samples, so this assertion proves nothing");
      const response = await open();
      assert.match(response.text, /Design preview/);
      assert.match(response.text, /placeholders for layout/);
    });

    it("labels the testimonial as a placeholder rather than a customer", async () => {
      const response = await open();
      assert.match(response.text, /Placeholder — not a real customer/);
    });

    it("says the logo strip is placeholder names", async () => {
      const response = await open();
      assert.match(response.text, /placeholder names/i);
    });

    it("tags every sampled statistic on the card itself", async () => {
      const response = await open();
      const sampled = content.STATS.filter((stat) => stat.sample).length;
      assert.ok(sampled > 0);
      const tags = response.text.match(/lf-sample-tag/g) || [];
      // One per sampled stat plus the testimonial's.
      assert.ok(tags.length >= sampled + 1,
        `${sampled} sampled stats and a sampled testimonial, but only ${tags.length} sample tags on the page`);
    });

    it("stays out of search while its proof is placeholder", async () => {
      const response = await open();
      assert.match(response.text, /<meta name="robots" content="noindex">/);
    });
  });

  describe("what the page is asked to sell", () => {
    it("names both calls to action", async () => {
      const response = await open();
      assert.match(response.text, /Book Your Live ICP Demo/);
      assert.match(response.text, /Add Chat to Your Site/);
    });

    it("walks define ICP through to closing from pipeline", async () => {
      const response = await open();
      assert.equal(content.WORKFLOW.length, 6);
      for (const step of content.WORKFLOW) {
        assert.ok(response.text.includes(step.title), `the workflow step "${step.title}" is missing from the page`);
      }
      assert.match(response.text, /Define your ICP/);
      assert.match(response.text, /close from pipeline/i);
    });

    it("covers find, enrich, score, route and activate", async () => {
      const response = await open().then((r) => r.text.toLowerCase());
      for (const verb of ["find", "enrich", "score", "rout", "activat"]) {
        assert.ok(response.includes(verb), `the page never mentions ${verb}`);
      }
    });

    it("shows the chat widget turning a conversation into a routed opportunity", async () => {
      const response = await open();
      assert.match(response.text, /routed to A\. Rivera/);
      for (const step of content.CHAT_STEPS) {
        assert.ok(response.text.includes(step.title), `chat step "${step.title}" is missing`);
      }
    });

    it("carries the onboarding and compliance points", async () => {
      const response = await open();
      for (const block of content.TRUST) {
        assert.ok(response.text.includes(block.title), `trust block "${block.title}" is missing`);
      }
    });

    it("does not claim a certification it has not listed", async () => {
      // The compliance half of the proof policy. Naming a standard on a sales
      // page is a claim, and this page has no dated certifications behind it.
      const response = await open().then((r) => r.text);
      for (const standard of ["SOC 2", "SOC2", "ISO 27001", "HIPAA", "PCI DSS", "FedRAMP"]) {
        assert.ok(!response.includes(standard), `the page claims ${standard} with nothing behind it`);
      }
    });

    it("makes no guarantee about revenue", async () => {
      const response = await open().then((r) => r.text.toLowerCase());
      for (const phrase of ["guaranteed revenue", "guarantee more", "double your pipeline", "guaranteed results"]) {
        assert.ok(!response.includes(phrase), `the page promises "${phrase}"`);
      }
    });
  });

  describe("the page's own document", () => {
    const source = require("node:fs").readFileSync(require.resolve("../routes/sonara-leadforge-routes.cjs"), "utf8");

    it("renders its own html rather than the SONARA shell", async () => {
      // Asserted on the rendered page, not on the source: the source mentions
      // layout() in a comment explaining why it is not used, and a grep for the
      // word fails on the explanation rather than on the behaviour.
      const response = await open();
      assert.match(response.text, /<!doctype html>/i);
      assert.ok(!response.text.includes("sonara-site-header"), "SONARA's header rendered on a LeadForge page");
      assert.ok(!response.text.includes("SONARA Industries home"), "SONARA's brand link rendered on a LeadForge page");
      assert.ok(!response.text.includes("sonara-loader"), "the SONARA startup loader rendered on a LeadForge page");
    });

    it("loads its own stylesheet and not the SONARA application UI", () => {
      assert.match(source, /\/leadforge\.css/);
      assert.doesNotMatch(source, /sonara-application-ui\.css/);
    });

    it("decides the notice from the content, not from a flag it holds itself", () => {
      // If the route could choose, the notice and the samples could drift apart
      // and the page would look sourced while carrying placeholders.
      assert.match(source, /content\.hasSamples\(\)/);
    });

    it("escapes the content it renders", () => {
      assert.match(source, /const e = escapeHtml/);
    });
  });
});
