"use strict";

// The pages a customer reads must not print the data model at them.
//
// Before this test, /service-catalog said "entitlement" fifty times, the home
// page explained that "product availability varies by lifecycle stage", and
// /account offered a "Readiness JSON" link. None of that means anything to
// somebody deciding whether to pay for this.
//
// This renders every GET page the app serves and fails when a banned term
// reaches the screen. Operator and legal surfaces are exempt -- see
// lib/sonara-plain-language.cjs for which, and why.

const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../server");
const plainLanguage = require("../lib/sonara-plain-language.cjs");

function customerFacingRoutes() {
  const routes = [];
  for (const layer of app._router.stack) {
    const route = layer.route;
    if (!route || !route.methods.get) continue;
    // Parameterised routes need an id we do not have; /api is not read by a
    // human. Everything else is fair game.
    if (route.path.includes(":") || route.path.startsWith("/api")) continue;
    if (plainLanguage.isTechnicalRoute(route.path)) continue;
    routes.push(route.path);
  }
  return routes;
}

// Text as a reader sees it. Script and style bodies are not read, and tag
// names, class names and hrefs are not either -- /business-builder/tools/readiness
// is a URL, and renaming URLs would break links people have saved.
function visibleText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

// Most of the app is behind a login, and the first version of this test only
// scanned what an anonymous visitor could reach -- 56 pages. The rest
// redirected to the login screen and were never looked at, which meant
// /dashboard, every workspace screen, and the market-intelligence pages went
// unchecked. Those are where a paying customer actually spends their day, and
// they were still saying "Readiness JSON" and "Deliverable lifecycle".
//
// Standing in a signed-in session brings 138 pages into view. server.js
// resolves a bearer token by asking Supabase who it belongs to, so stubbing
// that one call is enough to be somebody.
async function scan(headers) {
  const findings = [];
  let renderedCount = 0;

  for (const route of customerFacingRoutes()) {
    const response = await request(app).get(route).set("accept", "text/html").set(headers);
    if (response.status !== 200) continue;
    // sitemap.xml lists route paths, which are URLs rather than copy.
    if (!/html/.test(response.headers["content-type"] || "")) continue;
    renderedCount += 1;
    const text = visibleText(response.text);
    for (const term of plainLanguage.BANNED_ON_CUSTOMER_PAGES) {
      const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}`, "gi");
      const hits = text.match(pattern);
      if (hits) findings.push({ route, term, count: hits.length });
    }
  }
  return { findings, renderedCount };
}

function report(findings) {
  return findings.map((finding) => `  ${finding.route}: "${finding.term}" x${finding.count}`).join("\n");
}

const FIX_HINT =
  "\n\nRewrite the copy, or take the word out of BANNED_ON_CUSTOMER_PAGES if it has become customer language.";

describe("public pages speak plainly", () => {
  let result;

  before(async function beforeAll() {
    this.timeout(60000);
    result = await scan({});
  });

  it("renders enough pages for the check to mean something", () => {
    // If a refactor stops these routes rendering, the check would pass by
    // examining nothing. It found 56 public pages when written.
    assert.ok(result.renderedCount >= 50, `only ${result.renderedCount} public pages rendered; the scan is not covering the app`);
  });

  it("prints no engineering vocabulary", () => {
    assert.deepEqual(result.findings, [], `these public pages show internal vocabulary:\n${report(result.findings)}${FIX_HINT}`);
  });
});

describe("signed-in workspaces speak plainly", () => {
  let result;
  let originalFetch;
  let savedEnv;

  function restoreEnv() {
    if (!savedEnv) return;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    savedEnv = undefined;
  }

  before(async function beforeAll() {
    this.timeout(60000);
    // tests/setup-env.cjs strips every SUPABASE_ variable so the suite cannot
    // reach a real project. Signing in needs the app to believe it has one.
    savedEnv = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";

    originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "customer@example.com" }) };
      }
      // Everything else fails, so each page renders its own unconfigured
      // state -- which is exactly the copy that used to leak table names and
      // setup jargon at whoever was unlucky enough to see it.
      return { ok: false, status: 404, json: async () => [] };
    };
    result = await scan({ Authorization: "Bearer customer-session" });
    global.fetch = originalFetch;
    restoreEnv();
  });

  after(() => {
    if (originalFetch) global.fetch = originalFetch;
    restoreEnv();
  });

  it("reaches the pages a login was hiding", () => {
    // 138 rendered when written, against 56 anonymously. If this drops back
    // toward the public count, the session stopped being recognised and the
    // workspaces have quietly gone unchecked again.
    assert.ok(
      result.renderedCount >= 120,
      `only ${result.renderedCount} pages rendered signed in; the session is not being recognised and the workspaces are not being checked`
    );
  });

  it("prints no engineering vocabulary", () => {
    assert.deepEqual(result.findings, [], `these workspace pages show internal vocabulary:\n${report(result.findings)}${FIX_HINT}`);
  });
});

// A catalog card is assembled from several independent pieces -- the summary,
// the availability label, the plan floor, why it is not open, the price note.
// Each was written on its own and read fine on its own. Rendered together they
// produced this, live on the money page:
//
//   "... Included from Starter. Not open yet -- paid access for this is still
//    being tested. Comes with Starter. We are still testing paid access for
//    this one, so it is not open yet."
//
// The same fact three times. Nothing was wrong or misleading; it just read like
// a stutter to somebody deciding whether to pay. No test could have caught it,
// because every individual string was correct.
describe("catalog cards do not say the same thing twice", () => {
  let cards;

  before(async function renderCatalog() {
    this.timeout(30000);
    const response = await request(app).get("/service-catalog").set("accept", "text/html");
    assert.equal(response.status, 200);
    cards = [...response.text.matchAll(/<h3>([^<]*)<\/h3><p>([^<]*)<\/p>/g)].map((match) => ({
      name: visibleText(match[1]).trim(),
      body: visibleText(match[2])
    }));
    assert.ok(cards.length >= 30, `only ${cards.length} catalog cards rendered; the check would be vacuous`);
  });

  it("states the plan once per card", () => {
    const stuttering = cards.filter((card) => /Included from|Included in/.test(card.body) && /Comes with/.test(card.body));
    assert.deepEqual(
      stuttering.map((card) => card.name),
      [],
      "these cards name the plan twice, once from includedFrom() and once from the price note"
    );
  });

  it("explains being closed once per card", () => {
    const repeated = cards.filter((card) => (card.body.match(/not open yet/gi) || []).length > 1);
    assert.deepEqual(repeated.map((card) => card.name), [], "these cards say 'not open yet' more than once");
  });

  it("mentions testing paid access once per card", () => {
    const repeated = cards.filter((card) => (card.body.match(/testing paid access|paid access .{0,20}being tested/gi) || []).length > 1);
    assert.deepEqual(repeated.map((card) => card.name), [], "these cards explain the paid-access test twice");
  });

  it("still tells a done-for-you service what it costs", () => {
    // The fix was to drop the price note only where the card already says it.
    // Services with no plan floor have nowhere else to state pricing, so
    // theirs must survive.
    const quoted = cards.filter((card) => /We quote you after we have read your brief|Free to use\./.test(card.body));
    assert.ok(quoted.length > 0, "the done-for-you services must still state their pricing");
  });
});

describe("the vocabulary module", () => {
  it("has customer wording for every availability the catalog can hold", () => {
    const { ALLOWED_LIFECYCLE_STATUSES } = require("../lib/sonara-recommended-product-catalog.cjs");
    for (const status of ALLOWED_LIFECYCLE_STATUSES) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(plainLanguage.AVAILABILITY, status),
        `the catalog can store "${status}" but there is no customer wording for it`
      );
    }
  });

  it("has a plan name for every plan the catalog can require", () => {
    const { ALLOWED_PLAN_FLOORS } = require("../lib/sonara-recommended-product-catalog.cjs");
    for (const plan of ALLOWED_PLAN_FLOORS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(plainLanguage.PLAN_LABELS, plan),
        `the catalog can require "${plan}" but there is no customer name for it`
      );
    }
  });

  it("rewrites the longer phrase before the shorter one it contains", () => {
    // "lifecycle stage" must not be half-rewritten into "lifecycle" first.
    assert.equal(plainLanguage.toPlainLanguage("lifecycle stage"), "availability");
    assert.equal(plainLanguage.toPlainLanguage("launch readiness"), "launch checklist");
  });

  it("says nothing when given nothing", () => {
    assert.equal(plainLanguage.toPlainLanguage(null), "");
    assert.equal(plainLanguage.toPlainLanguage(undefined), "");
  });

  it("still lets operators see the real names", () => {
    assert.equal(plainLanguage.isTechnicalRoute("/infrastructure"), true);
    assert.equal(plainLanguage.isTechnicalRoute("/admin/database"), true);
    assert.equal(plainLanguage.isTechnicalRoute("/legal/data-processing"), true);
    assert.equal(plainLanguage.isTechnicalRoute("/pricing"), false);
    // A route that merely starts with the same letters is not a prefix match.
    assert.equal(plainLanguage.isTechnicalRoute("/administration-fees"), false);
  });
});
