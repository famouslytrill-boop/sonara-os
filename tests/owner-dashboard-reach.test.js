"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-last9-routes.cjs"), "utf8");
const { findRoute } = require("../lib/sonara-route-registry.cjs");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");

function ownerDashboardBlock() {
  const start = SOURCE.indexOf("OWNER_PAGES.forEach");
  const end = SOURCE.indexOf("ALL_OWNER_PAGES.forEach");
  assert.ok(start > 0 && end > start, "the owner dashboard handler was not found; this test would check nothing");
  return SOURCE.slice(start, end);
}

// The owner dashboard listed what a business owes and nothing about what it is
// owed, and none of the money pages were reachable from it. Both are the same
// failure the search list had: a hand-kept list falling behind the pages that
// exist, invisibly, because nothing compared them.
describe("the owner dashboard reaches the money", () => {
  it("links every owner record page, from the list that defines them", () => {
    // This checked five hand-written links. They are generated from
    // ALL_OWNER_PAGES now, because the hand-written list had fallen eleven
    // pages behind -- purchase orders, stock counts, transfers, supplier
    // payments, accounting exports, costs, maintenance, menu, recipes,
    // vehicles and vendors were all reachable only by typing the URL.
    const block = ownerDashboardBlock();
    assert.match(
      block,
      /ALL_OWNER_PAGES\.map\(/,
      "the owner dashboard must generate its links from ALL_OWNER_PAGES, not restate them"
    );
    for (const page of ALL_OWNER_PAGES) {
      assert.ok(findRoute(page.path), `${page.path} has an owner page and is not a registered route`);
    }
  });

  it("links the money pages that are not owner record pages", () => {
    // money-due and chase-drafts are surfaces over those records rather than
    // record pages, so the generated list does not include them.
    const block = ownerDashboardBlock();
    for (const route of ["/business-builder/owner/money-due", "/business-builder/owner/chase-drafts"]) {
      assert.ok(block.includes(`"${route}"`), `the owner dashboard does not link to ${route}`);
      assert.ok(findRoute(route), `${route} is linked but is not a registered route`);
    }
  });

  it("counts what the business is owed, not only what it owes", () => {
    // "Invoices" used to mean vendor_invoices, which is money going out. An
    // owner reading that saw one side of their own books.
    const summary = SOURCE.slice(SOURCE.indexOf("async function operationsSummary"), SOURCE.indexOf("async function resolveOrganization"));
    assert.ok(summary.includes('"vendor_invoices"'), "money owed out must still be counted");
    assert.ok(summary.includes('"customer_invoices"'), "money owed in must be counted too");
    assert.doesNotMatch(
      summary,
      /\["Invoices", "vendor_invoices"\]/,
      'the bare label "Invoices" on vendor_invoices is ambiguous once both sides are counted'
    );
  });

  it("labels each side so neither can be read as the other", () => {
    const summary = SOURCE.slice(SOURCE.indexOf("async function operationsSummary"), SOURCE.indexOf("async function resolveOrganization"));
    const labels = [...summary.matchAll(/\["([^"]+)", "(?:vendor_invoices|customer_invoices)"\]/g)].map((match) => match[1]);
    assert.equal(labels.length, 2, "both invoice tables must appear exactly once");
    assert.equal(new Set(labels).size, 2, "the two invoice counts must not share a label");
    for (const label of labels) {
      assert.ok(/owe|sent|owed/i.test(label), `"${label}" does not say which direction the money goes`);
    }
  });
});
