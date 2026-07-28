"use strict";

// The pages a customer reads must not print the data model at them.
//
// Before this test, /service-catalog said "entitlement" fifty times, the home
// page explained that "product availability varies by lifecycle stage", and
// /account offered a "Readiness JSON" link. None of that means anything to
// somebody deciding whether to pay $15 a month.
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

describe("customer-facing pages speak plainly", () => {
  const findings = [];
  let renderedCount = 0;

  before(async function beforeAll() {
    this.timeout(60000);
    for (const route of customerFacingRoutes()) {
      const response = await request(app).get(route).set("accept", "text/html");
      if (response.status !== 200) continue;
      if (!/html/.test(response.headers["content-type"] || "")) continue;
      renderedCount += 1;
      const text = visibleText(response.text);
      for (const term of plainLanguage.BANNED_ON_CUSTOMER_PAGES) {
        const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}`, "gi");
        const hits = text.match(pattern);
        if (hits) findings.push({ route, term, count: hits.length });
      }
    }
  });

  it("renders enough pages for the check to mean something", () => {
    // If a refactor stops these routes rendering, the check would pass by
    // examining nothing. It found 60 customer-facing pages when written.
    assert.ok(renderedCount >= 40, `only ${renderedCount} customer-facing pages rendered; the scan is not covering the app`);
  });

  it("prints no engineering vocabulary", () => {
    const report = findings
      .map((finding) => `  ${finding.route}: "${finding.term}" x${finding.count}`)
      .join("\n");
    assert.deepEqual(
      findings,
      [],
      `these pages show internal vocabulary to customers:\n${report}\n\n` +
        "Rewrite the copy, or take the word out of BANNED_ON_CUSTOMER_PAGES if it has become customer language."
    );
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
