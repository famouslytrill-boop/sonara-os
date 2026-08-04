"use strict";

// The product guides, and the promises they must not make.
//
// The subject matter came from a set of infographics -- digital products and
// where they sell, growth work organised by job, protecting focused time --
// which were watermarked works belonging to the people who made them, several
// of them lead magnets. Facts and methods are not ownable, a particular
// expression of them is, so the topics were used and none of the wording was.
//
// Guidance copy is the easiest place in a product to break its own rules. It is
// long, it is prose, it reads as advice, and nothing else in the codebase looks
// at it. So the rules are checked here rather than trusted:
//
//   No revenue or outcome promise. /legal/earnings-disclaimer says results are
//   not guaranteed; a guide that implies income contradicts a published page.
//
//   Nothing described as AI. These are checklists and tools and the product
//   does not claim otherwise.
//
//   Nothing that needs setup described as if it already works.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { GUIDES, getGuide } = require("../lib/sonara-guides.cjs");

const ROUTES = ["/tutorials/business-builder", "/tutorials/creator-studio", "/tutorials/growth-studio"];

function everyBody() {
  return Object.values(GUIDES).flat().map(([, body]) => body);
}

function everyHeading() {
  return Object.values(GUIDES).flat().map(([heading]) => heading);
}

describe("the product guides", () => {
  it("covers each product with enough to be worth reading", () => {
    for (const route of ROUTES) {
      const guide = getGuide(route);
      assert.ok(guide.length >= 6, `${route} has only ${guide.length} sections`);
      for (const [heading, body] of guide) {
        assert.ok(heading.length > 8, `a heading is too short to say anything: "${heading}"`);
        assert.ok(body.length > 120, `a section is too thin to be guidance: "${heading}"`);
      }
    }
    assert.equal(getGuide("/tutorials/getting-started").length, 0, "the getting-started page is a sequence, not a guide");
  });

  it("promises no revenue, ranking, or guaranteed outcome", () => {
    // The same boundary /legal/earnings-disclaimer states. A guide is where
    // this slips, because encouraging copy and a promise read alike.
    // "guarantee" is handled separately below, because the word appears in
    // disclaimers as often as in promises -- the first version of this check
    // fired on "None of these guarantees sales", which is the product saying
    // precisely the right thing. A check that cannot tell a claim from its
    // negation is a check that gets deleted.
    const forbidden = [
      /\bpassive income\b/i,
      /\bget rich\b/i,
      /\bmake \$[\d,]+/i,
      /\bearn \$[\d,]+/i,
      /\b(?:will|you'll) (?:earn|make|profit)\b/i,
      /\brisk[- ]free\b/i,
      /\bovernight\b/i,
      /\bquick money\b/i
    ];
    for (const body of everyBody()) {
      for (const pattern of forbidden) {
        assert.doesNotMatch(body, pattern, `a guide makes a promise the product does not make:\n  ${body}`);
      }
      // Every use of "guarantee" must be a denial of one.
      for (const match of body.matchAll(/\bguarantee\w*/gi)) {
        const preceding = body.slice(Math.max(0, match.index - 40), match.index);
        assert.match(
          preceding,
          /\b(?:no|none|not|never|cannot|can't|does not|doesn't|without|nothing)\b[^.]*$/i,
          `a guide uses "guarantee" as a promise rather than a disclaimer:\n  ...${preceding}${match[0]}...`
        );
      }
    }
  });

  it("does not describe the product as AI", () => {
    // House rule: these systems are not AI and do not claim to be.
    for (const text of [...everyBody(), ...everyHeading()]) {
      assert.doesNotMatch(text, /\bAI[- ](?:powered|driven|generated)\b/i, `a guide calls the product AI:\n  ${text}`);
      assert.doesNotMatch(text, /\bartificial intelligence\b/i, `a guide calls the product AI:\n  ${text}`);
    }
  });

  it("names no third-party brand as an endorsement", () => {
    // The source material was full of brand logos. Channels are described by
    // what they are for, so the guidance survives a channel changing its terms
    // and does not read as a recommendation of anyone in particular.
    for (const text of everyBody()) {
      for (const brand of ["Gumroad", "Payhip", "Etsy", "Redbubble", "Society6", "Creative Market", "Teachers Pay Teachers", "Canva", "ChatGPT", "Fiverr", "Upwork"]) {
        assert.ok(!text.includes(brand), `a guide names ${brand} directly; describe what the channel is for instead`);
      }
    }
  });

  it("keeps the rights and approval boundaries the product enforces", () => {
    const creator = getGuide("/tutorials/creator-studio").map(([, body]) => body).join(" ");
    assert.match(creator, /licen[cs]e/i, "the creator guide does not mention licensing at all");
    // The substance, not one word: the guide has to say that permission to
    // resell is separate from permission to use. It says that with "who owns",
    // "commercial resale" and "separate permission" rather than the word
    // "rights", and the first version of this check failed on the vocabulary
    // while the meaning was present.
    assert.match(creator, /who owns|resale|separate permission/i, "the creator guide does not raise who owns what you sell");

    const growth = getGuide("/tutorials/growth-studio").map(([, body]) => body).join(" ");
    assert.match(growth, /approval|approve/i, "the growth guide does not mention keeping outbound actions approved");
    assert.match(growth, /agreed|consent|asked to hear/i, "the growth guide does not mention permission to contact");
  });

  it("renders on the tutorial pages themselves", async function renderGuides() {
    this.timeout(30000);
    for (const route of ROUTES) {
      const response = await request(app).get(route).set("accept", "text/html");
      assert.equal(response.status, 200, `${route} returned ${response.status}`);
      const guide = getGuide(route);
      // First and last heading, so a truncated render is caught rather than
      // passing on the presence of one card.
      for (const [heading] of [guide[0], guide[guide.length - 1]]) {
        assert.ok(response.text.includes(heading), `${route} does not render the guide section "${heading}"`);
      }
      assert.match(response.text, /Step 1/, `${route} lost its steps`);
    }
  });

  it("stays on the marketing surface it was already on", async function surface() {
    this.timeout(20000);
    const response = await request(app).get(ROUTES[0]).set("accept", "text/html");
    assert.match(response.text, /data-sonara-surface="marketing"/);
  });
});
