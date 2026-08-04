"use strict";

// What a page says about itself to everything that is not a browser.
//
// Every page shipped with a title and an image and no description at all: no
// <meta name="description">, no og:description, no twitter card, no canonical.
// A search result showed whatever a crawler chose to lift out of the body, and
// a link pasted into Slack, WhatsApp or X rendered as a headline and a picture
// with nothing underneath saying what the page was.
//
// The summary already existed. `body` is the one-sentence description every
// page passes to layout() and renders in its hero, so it is reused rather than
// a second description being written and left to drift out of step.
//
// Canonical matters because the duplication is deliberate: the same legal text
// is served at /terms and /legal/terms, /privacy and /legal/privacy, and six
// more pairs. Sixteen URLs, eight documents. Without a canonical those are
// eight pairs of pages competing with each other.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

const PUBLIC_PAGES = ["/", "/about", "/pricing", "/security", "/contact", "/products", "/free-tools", "/how-it-works", "/start", "/service-catalog", "/business-builder", "/creator-studio", "/growth-studio", "/tutorials/creator-studio"];

// href alias -> the /legal/ page it duplicates.
const ALIASES = {
  "/terms": "/legal/terms",
  "/privacy": "/legal/privacy",
  "/refund-policy": "/legal/refund-policy",
  "/cookies": "/legal/cookie-policy",
  "/acceptable-use": "/legal/acceptable-use",
  "/accessibility": "/legal/accessibility",
  "/earnings-disclaimer": "/legal/earnings-disclaimer",
  "/subprocessor-notice": "/legal/subprocessor-notice"
};

async function head(route) {
  const response = await request(app).get(route).set("accept", "text/html");
  return { status: response.status, head: String(response.text).split("</head>")[0] };
}

const attribute = (source, pattern) => (source.match(pattern) || [])[1] || "";

describe("pages describe themselves", () => {
  it("gives every public page a description", async function descriptions() {
    this.timeout(60000);
    const missing = [];
    for (const route of PUBLIC_PAGES) {
      const { status, head: source } = await head(route);
      if (status !== 200) {
        missing.push(`${route}: HTTP ${status}`);
        continue;
      }
      const description = attribute(source, /name="description" content="([^"]*)"/);
      if (!description) missing.push(`${route}: no meta description`);
      else if (description.length < 40) missing.push(`${route}: description is too short to be useful ("${description}")`);
      if (!source.includes('property="og:description"')) missing.push(`${route}: no og:description, so a shared link shows nothing`);
      if (!source.includes('name="twitter:card"')) missing.push(`${route}: no twitter card`);
    }
    assert.deepEqual(missing, [], `These pages tell a crawler or a link preview nothing about themselves:\n  ${missing.join("\n  ")}`);
  });

  it("describes each page differently", async function distinct() {
    this.timeout(60000);
    // One description repeated across every page is the same failure as none:
    // every search result and every shared link reads identically.
    const seen = new Map();
    for (const route of PUBLIC_PAGES) {
      const { head: source } = await head(route);
      const description = attribute(source, /name="description" content="([^"]*)"/);
      if (!description) continue;
      if (seen.has(description)) {
        assert.fail(`${route} and ${seen.get(description)} share a description:\n  "${description}"`);
      }
      seen.set(description, route);
    }
    assert.ok(seen.size >= PUBLIC_PAGES.length - 1, `only ${seen.size} distinct descriptions across ${PUBLIC_PAGES.length} pages`);
  });

  it("points every duplicated legal URL at one canonical", async function canonicals() {
    this.timeout(60000);
    const wrong = [];
    for (const [alias, source] of Object.entries(ALIASES)) {
      const aliasHead = await head(alias);
      const sourceHead = await head(source);
      const aliasCanonical = attribute(aliasHead.head, /rel="canonical" href="([^"]*)"/);
      const sourceCanonical = attribute(sourceHead.head, /rel="canonical" href="([^"]*)"/);
      if (!aliasCanonical.endsWith(source)) wrong.push(`${alias} points at "${aliasCanonical || "nothing"}" instead of ${source}`);
      if (!sourceCanonical.endsWith(source)) wrong.push(`${source} does not declare itself canonical (got "${sourceCanonical || "nothing"}")`);
    }
    assert.deepEqual(
      wrong,
      [],
      `The legal aliases serve duplicate text without agreeing which URL is the real one:\n  ${wrong.join("\n  ")}`
    );
  });

  it("builds canonicals on the production origin, not a relative path", async function origin() {
    this.timeout(20000);
    const { head: source } = await head("/legal/privacy");
    const canonical = attribute(source, /rel="canonical" href="([^"]*)"/);
    assert.match(canonical, /^https:\/\/sonaraindustries\.com\//, `a relative canonical is ignored by crawlers: "${canonical}"`);
    assert.match(source, /property="og:url" content="https:\/\//);
  });

  it("escapes the description rather than breaking the tag", async function escaping() {
    this.timeout(20000);
    // Page bodies contain apostrophes and em dashes, and one contains a quote
    // character away from being an attribute injection.
    for (const route of ["/pricing", "/how-it-works"]) {
      const { head: source } = await head(route);
      const raw = (source.match(/name="description" content="([^"]*)"/) || [])[1] || "";
      assert.ok(!raw.includes("<"), `${route} has an unescaped angle bracket in its description`);
      assert.ok(raw.length > 0);
    }
  });
});
