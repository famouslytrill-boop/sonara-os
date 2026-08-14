"use strict";

// Search is the feature where a wrong answer is indistinguishable from a right
// one. "No results" means the record is not there, and it is also what a broken
// query, a missing column, an unreachable table and a bad escape all look like.
// Every check here is about keeping those apart.

const assert = require("node:assert/strict");
const {
  SEARCHABLE,
  MINIMUM_TERM,
  validate,
  escapeTerm,
  isUsableTerm,
  queryFor,
  matchedField,
  summarise
} = require("../lib/sonara-search.cjs");

describe("search", () => {
  it("names only columns the schema actually has", () => {
    // A column PostgREST does not have returns an error the page renders as
    // "nothing found", which tells the owner their record is gone.
    assert.deepEqual(validate(), [], "these searchable columns or tables are not in supabase/migrations");
  });

  it("searches something", () => {
    assert.ok(SEARCHABLE.length >= 8, `expected a useful set of searchable tables; found ${SEARCHABLE.length}`);
  });

  describe("tenant scoping", () => {
    it("filters by organization outside the or() group, never inside it", () => {
      // Inside or(), the organization filter becomes one alternative among
      // many -- so a row matching on name would come back regardless of which
      // business it belongs to. This is the whole ballgame.
      for (const entry of SEARCHABLE) {
        const query = queryFor(entry, "smith", "org-1");
        assert.match(query, /&organization_id=eq\.org-1&/, `${entry.table} does not filter by organization as its own term`);
        const orGroup = query.match(/or=\(([^)]*)\)/)?.[1] || "";
        assert.ok(orGroup.length > 0, `${entry.table} builds no or() group`);
        assert.doesNotMatch(orGroup, /organization_id/, `${entry.table} puts organization_id inside or(), which makes it optional`);
      }
    });

    it("selects an id so a result can be pointed at a record", () => {
      for (const entry of SEARCHABLE) {
        assert.match(queryFor(entry, "smith", "org-1"), /select=id[,&]/, `${entry.table} must select id`);
      }
    });
  });

  describe("the term", () => {
    it("strips characters that mean something to PostgREST", () => {
      // A comma separates filters inside or(); a closing paren ends the group.
      // Either one, unescaped, changes the query rather than the search.
      for (const hostile of ["a,b", "x)", "(y", "a.b", "a*b", `a"b`, "a'b"]) {
        const escaped = escapeTerm(hostile);
        for (const character of [",", ")", "(", ".", "*", '"', "'"]) {
          assert.ok(!escaped.includes(character), `escapeTerm left ${character} in ${JSON.stringify(hostile)}`);
        }
      }
    });

    it("keeps a hostile term out of the built query", () => {
      // The danger is not the word "neq" -- it is the dot-delimited operator
      // form `column.neq.value` and the paren that would close the group early.
      // Escaping turns the whole thing into one literal search string, so
      // "organization_id neq x" surviving as text is correct: it is a phrase
      // nobody's records contain, not a filter.
      //
      // The first version of this check asserted the substring "neq" was
      // absent, which failed against working code. The check was wrong, not the
      // escaping.
      const query = queryFor(SEARCHABLE[0], "smith),organization_id.neq.x", "org-1");
      const orGroup = query.match(/or=\(([^)]*)\)/)?.[1] || "";
      assert.doesNotMatch(orGroup, /\.neq\./, "a dot-delimited operator survived into the or() group");
      assert.doesNotMatch(orGroup, /\)/, "a closing paren survived, which would end the group early");
      // Exactly one filter per searchable column, and no more -- an injected
      // comma would add another.
      const filters = orGroup.split(",").filter(Boolean);
      assert.equal(filters.length, SEARCHABLE[0].columns.length, "the or() group has a different number of filters than columns");
    });

    it("refuses a term too short to mean anything", () => {
      // One character matches most rows in most tables: technically correct,
      // and a result list nobody can use.
      assert.equal(isUsableTerm("a"), false);
      assert.equal(isUsableTerm(" "), false);
      assert.equal(isUsableTerm(""), false);
      assert.equal(isUsableTerm(null), false);
      assert.equal(isUsableTerm("ab"), true);
      assert.equal(MINIMUM_TERM, 2);
    });
  });

  describe("results", () => {
    const bookings = SEARCHABLE.find((entry) => entry.table === "business_bookings");

    it("says which field matched", () => {
      // A hit on a phone number when somebody typed a name is worth explaining,
      // or the result looks like a mistake.
      const hit = matchedField(bookings, { customer_name: "Ada Smith", customer_phone: null }, "smith");
      assert.equal(hit.column, "customer_name");
      assert.equal(hit.value, "Ada Smith");
    });

    it("returns nothing for a row that does not match", () => {
      assert.equal(matchedField(bookings, { customer_name: "Grace Hopper" }, "smith"), null);
    });

    it("survives a row with nothing in it", () => {
      assert.doesNotThrow(() => matchedField(bookings, {}, "smith"));
      assert.doesNotThrow(() => matchedField(bookings, { customer_name: null }, "smith"));
    });
  });

  describe("the summary", () => {
    it("counts a table it could not read separately from one with no matches", () => {
      // These are opposite answers. "Nothing found" is a fact about the
      // records; "could not read" is a fact about the connection, and merging
      // them tells an owner their record is gone when it is not.
      const summary = summarise([
        { label: "Bookings", rows: [{ id: "1" }] },
        { label: "Services", rows: [] },
        { label: "Inventory", rows: [], unavailable: true }
      ], "smith");
      assert.equal(summary.total, 1);
      assert.equal(summary.unavailable, 1);
      assert.equal(summary.searched, 2, "a table that could not be read was not searched");
      assert.equal(summary.groups.length, 1, "only groups with matches are shown");
    });

    it("reports zero honestly when everything was searched and nothing matched", () => {
      const summary = summarise([
        { label: "Bookings", rows: [] },
        { label: "Services", rows: [] }
      ], "smith");
      assert.equal(summary.total, 0);
      assert.equal(summary.unavailable, 0);
      assert.equal(summary.searched, 2);
    });
  });

  it("never searches a secret-shaped column", () => {
    // validate() refuses one, and this checks the list independently rather
    // than trusting the function that is supposed to be checking it.
    for (const entry of SEARCHABLE) {
      for (const column of entry.columns) {
        assert.doesNotMatch(
          column,
          /secret|token|key|password|credential|signature|apikey/i,
          `${entry.table}.${column} is secret-shaped and must not be searchable`
        );
      }
    }
  });
});

// Search covered twelve tables and none of the money records added after it was
// written. customers, quotes and invoices were all invisible, and an empty
// result reads exactly like "you have no invoices" -- the failure this codebase
// keeps finding, pointed at the one page whose whole job is finding things.
//
// The list rotted quietly because nothing compared it against the pages that
// exist. This is that comparison.
describe("search keeps up with the pages that exist", () => {
  const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
  const { SEARCHABLE, NOT_SEARCHABLE } = require("../lib/sonara-search.cjs");

  it("accounts for every owner record page, as searchable or with a reason", () => {
    const searchable = new Set(SEARCHABLE.map((entry) => entry.table));
    const unaccounted = ALL_OWNER_PAGES
      .map((page) => page.table)
      .filter((table) => !searchable.has(table) && !NOT_SEARCHABLE[table]);

    assert.ok(ALL_OWNER_PAGES.length > 15, `only ${ALL_OWNER_PAGES.length} owner pages found; this check has gone blind`);
    assert.deepEqual(
      unaccounted,
      [],
      "These tables have an owner page and cannot be searched:\n  " +
        `${unaccounted.join("\n  ")}\n` +
        "Add them to SEARCHABLE, or to NOT_SEARCHABLE with the reason a search term would never find one."
    );
  });

  it("gives every exclusion a reason somebody can disagree with", () => {
    for (const [table, reason] of Object.entries(NOT_SEARCHABLE)) {
      assert.ok(String(reason).length > 30, `${table} is excluded without a real reason`);
    }
  });

  it("does not exclude a table it also searches", () => {
    const searchable = new Set(SEARCHABLE.map((entry) => entry.table));
    const both = Object.keys(NOT_SEARCHABLE).filter((table) => searchable.has(table));
    assert.deepEqual(both, [], `listed as both searchable and excluded: ${both.join(", ")}`);
  });

  it("can find an invoice, a quote and a customer", () => {
    // Named explicitly because these three were the gap, and a count-based
    // check would pass again the next time something is added and forgotten.
    const searchable = new Set(SEARCHABLE.map((entry) => entry.table));
    for (const table of ["customers", "quotes", "customer_invoices"]) {
      assert.ok(searchable.has(table), `${table} must be searchable; an owner who raised one has to be able to find it`);
    }
  });
});

// Eighteen tables, and how long the customer waits for them.
//
// The search page awaited inside its loop, so it made eighteen round trips in
// series -- measured at 387ms against a 20ms stub, with a peak concurrency of
// exactly one, on the most latency-sensitive screen in the product. None of
// those queries depended on any other; every wait was for nothing.
//
// Measured rather than asserted structurally: a check that greps for
// "Promise.all" passes on any code that mentions it, including code that then
// awaits in a loop anyway. Watching how many queries are in flight at once is
// the property that actually matters.
describe("a search asks its tables at the same time", () => {
  const express = require("express");
  const request = require("supertest");
  const registerRoutes = require("../routes/sonara-assistant-routes.cjs");
  const { SEARCHABLE } = require("../lib/sonara-search.cjs");

  const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  function buildApp() {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    const authenticate = (req, res, next) => {
      req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" };
      return next();
    };
    registerRoutes(app, {
      layout: ({ title, sections = [] }) => `<html><title>${title}</title>${sections.join("")}</html>`,
      brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value),
      requireCustomer: authenticate,
      requireWorkspaceAccess: () => authenticate,
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
      supabaseHeaders: () => ({})
    });
    return app;
  }

  it("has more than a couple of tables, or this proves nothing", () => {
    assert.ok(SEARCHABLE.length >= 10, `only ${SEARCHABLE.length} searchable tables; the saving this protects is not worth protecting`);
  });

  it("keeps more than one query in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    global.fetch = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => [] };
    };

    const response = await request(buildApp()).get("/search?q=sam");
    assert.equal(response.status, 200);
    assert.ok(
      peak >= SEARCHABLE.length,
      `only ${peak} of ${SEARCHABLE.length} searches ran at once, so the page is waiting for each table before asking the next`
    );
  });

  it("still renders its groups in a stable order", async () => {
    // Parallelising must not shuffle the results. Somebody who searches twice
    // should see the same arrangement, which is why this uses Promise.all
    // rather than settling them as they arrive.
    global.fetch = async (url) => {
      const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
      // Slowest first, so an as-they-arrive implementation would reverse them.
      await new Promise((resolve) => setTimeout(resolve, table === SEARCHABLE[0].table ? 20 : 1));
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => [] };
    };
    const response = await request(buildApp()).get("/search?q=sam");
    const order = SEARCHABLE.map((entry) => response.text.indexOf(entry.label)).filter((index) => index >= 0);
    const sorted = [...order].sort((left, right) => left - right);
    assert.deepEqual(order, sorted, "search groups render out of SEARCHABLE order");
  });
});
