"use strict";

// The twenty-seven owner record pages list a hundred rows at a time with
// "Previous" and "Next" and nothing else. A business with eight hundred
// customers looking for one of them pages through eight screens, reading a
// hundred names each time, and the product's answer to "where is Ada" was
// "keep clicking".
//
// `/search` exists and covers twenty of these tables, but it is a different
// page reached from a different link and it returns ten rows per table across
// every table at once. It answers "is this person anywhere in my records"; it
// does not answer "show me the customers whose name has Ada in it", which is
// what somebody standing on the customers page is asking.
//
// Two things had to stay true once a filter existed, and both fail silently:
// the count has to count the filtered rows, and the pager has to carry the
// filter. Both have their own test below.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const recordFilter = require("../lib/sonara-record-filter.cjs");
const search = require("../lib/sonara-search.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMERS = "/business-builder/owner/customers";

const FILTERABLE = ALL_OWNER_PAGES.filter((page) => recordFilter.canFilter(page));
const UNFILTERABLE = ALL_OWNER_PAGES.filter((page) => !recordFilter.canFilter(page));

function buildApp({ rows = [], total = null, calls = [] } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  const authenticate = (req, res, next) => {
    req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" };
    return next();
  };
  registerRoutes(app, {
    layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ method: options.method || "GET", url: target, prefer: options.headers?.Prefer || null });
    const counting = String(options.headers?.Prefer || "").includes("count=exact");
    return {
      ok: true,
      status: 200,
      headers: { get: () => (counting && total !== null ? `0-0/${total}` : "0-0/1") },
      json: async () => (counting ? [] : rows)
    };
  };
  return app;
}

describe("a record can be found without paging to it", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("counts enough filterable pages for this file to mean anything", () => {
    assert.ok(FILTERABLE.length >= 15, `only ${FILTERABLE.length} pages can be filtered; this check has gone blind`);
    assert.ok(UNFILTERABLE.length > 0, "no page is unfilterable, so the reason branch below is never exercised");
  });

  it("takes its columns from the search module rather than a second list", () => {
    // A second list here would be the copy that drifts, and the drift would
    // show up as a filter box matching fewer columns than the search page for
    // the same records -- which nobody would notice, because both return rows.
    for (const page of FILTERABLE) {
      const declared = search.SEARCHABLE.find((entry) => entry.table === page.table);
      assert.deepEqual(recordFilter.filterColumnsFor(page), declared.columns, `${page.path} filters on different columns from the search page`);
    }
  });

  it("says why, rather than nothing, on a page that cannot be filtered", async () => {
    for (const page of UNFILTERABLE) {
      const reason = recordFilter.reasonWithoutFilter(page);
      assert.ok(reason, `${page.table} offers no filter and records no reason`);
      const app = buildApp();
      const result = await request(app).get(page.path).set("accept", "text/html");
      assert.equal(result.status, 200);
      assert.ok(result.text.includes(reason.slice(0, 40)), `${page.path} does not say why it has no filter`);
      assert.ok(!/<input[^>]+name="q"/.test(result.text), `${page.path} offers a filter that would find nothing`);
    }
  });

  it("offers the box on every page that can use it", async () => {
    for (const page of FILTERABLE) {
      const app = buildApp();
      const result = await request(app).get(page.path).set("accept", "text/html");
      assert.equal(result.status, 200, `${page.path} did not render`);
      assert.match(result.text, /<input[^>]+name="q"/, `${page.path} offers no way to find one`);
      assert.match(
        result.text,
        new RegExp(`<form[^>]+action="${page.path.replace(/[/]/g, "\\/")}"[^>]*role="search"`),
        `${page.path}'s filter does not post to itself`
      );
    }
  });

  it("filters the read across the page's own columns", async () => {
    const calls = [];
    const app = buildApp({ calls });
    await request(app).get(`${CUSTOMERS}?q=ada`).set("accept", "text/html");
    const read = calls.find((call) => call.url.includes("/customers?") && !String(call.prefer || "").includes("count"));
    assert.ok(read.url.includes("or=("), "the filter never reached the query");
    for (const column of recordFilter.filterColumnsFor(ALL_OWNER_PAGES.find((page) => page.table === "customers"))) {
      assert.ok(read.url.includes(`${column}.ilike.*ada*`), `the filter does not match ${column}`);
    }
    assert.ok(read.url.includes(`organization_id=eq.${ORGANIZATION_ID}`), "the filter replaced the tenant scope");
  });

  it("counts the filtered rows, not the whole table", async () => {
    const calls = [];
    // A hundred and one rows come back, so the page pages and asks for a count.
    const rows = Array.from({ length: 101 }, (_, index) => ({ id: `id-${index}`, name: `Person ${index}` }));
    const app = buildApp({ rows, total: 812, calls });
    const result = await request(app).get(`${CUSTOMERS}?q=ada`).set("accept", "text/html");
    const counting = calls.find((call) => String(call.prefer || "").includes("count=exact"));
    assert.ok(counting, "no count was taken");
    // "812 records" over a filtered list is a bigger lie than no caption at all.
    assert.ok(counting.url.includes("or=("), "the count ignored the filter");
    assert.match(result.text, /match &quot;ada&quot;/, "the caption does not say the number is a match count");
  });

  it("carries the filter through the pager", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({ id: `id-${index}`, name: `Person ${index}` }));
    const app = buildApp({ rows, total: 812 });
    const result = await request(app).get(`${CUSTOMERS}?q=ada`).set("accept", "text/html");
    // Without this, "Next" takes somebody from three matching customers to a
    // hundred arbitrary ones with nothing on the page saying anything changed.
    assert.match(result.text, /href="[^"]*q=ada[^"]*page=2"/, "the pager drops the filter");
  });

  it("does not say a business has no records when it has none matching", async () => {
    const app = buildApp({ rows: [] });
    const page = ALL_OWNER_PAGES.find((entry) => entry.table === "customers");
    const filtered = await request(app).get(`${CUSTOMERS}?q=zzzz`).set("accept", "text/html");
    assert.match(filtered.text, /None of your records match &quot;zzzz&quot;/);
    assert.ok(!filtered.text.includes(page.empty), "a filtered miss reads as an empty business");
    const unfiltered = await request(app).get(CUSTOMERS).set("accept", "text/html");
    assert.ok(unfiltered.text.includes(page.empty), "an empty page stopped saying it is empty");
  });

  it("treats one letter as no filter, and says why", async () => {
    const calls = [];
    const app = buildApp({ calls });
    const result = await request(app).get(`${CUSTOMERS}?q=a`).set("accept", "text/html");
    const read = calls.find((call) => call.url.includes("/customers?"));
    // One letter matches almost everything, which is a list nobody can use.
    assert.ok(!read.url.includes("or=("), "a one-letter term was sent as a filter");
    assert.match(result.text, /at least 2 characters/i);
    // And the box keeps what was typed, rather than clearing it and looking
    // like the request never happened.
    assert.match(result.text, /name="q" value="a"/);
  });

  it("escapes a term that would otherwise end the column list early", () => {
    const page = ALL_OWNER_PAGES.find((entry) => entry.table === "customers");
    const columns = recordFilter.filterColumnsFor(page);
    const clause = recordFilter.clauseFor(page, 'a,b).x');
    // A bare comma or bracket would close `or=(...)` and silently change which
    // columns are matched. Escaping goes through the search module's own
    // escaper rather than a second one written here.
    assert.equal(clause.split(".ilike.").length - 1, columns.length, "the term changed how many columns are matched");
    assert.ok(!/,b\)/.test(clause), "an unescaped bracket reached the query");
  });

  it("keeps no filter and a filter that matched nothing apart", () => {
    assert.deepEqual(recordFilter.termFrom(""), { ok: true, term: null, tooShort: false });
    assert.deepEqual(recordFilter.termFrom("   "), { ok: true, term: null, tooShort: false });
    assert.equal(recordFilter.termFrom("ada").term, "ada");
    assert.equal(recordFilter.termFrom("a").tooShort, true);
    assert.equal(recordFilter.describeFilter(null, 5), null);
    assert.match(recordFilter.describeFilter("ada", 0), /Nothing matches/);
    // A count that could not be read is not a count of zero.
    assert.match(recordFilter.describeFilter("ada", null), /could not count/i);
  });
});
