"use strict";

// Two figures a customer reads as facts, each computed over a capped read that
// could not tell it had been capped.
//
// Found by sweeping for the shape after the same defect turned up twice in the
// export paths: a `limit=` whose rows then feed an aggregate. A capped LIST is
// fine -- it shows what it shows. A capped read that is then counted or summed
// is a wrong number presented as a measurement.
//
//   * `/business-builder/owner/recurring` read every arrangement's lines in one
//     query, `limit=1000`, ordered `position.asc` ACROSS all arrangements, then
//     filtered per arrangement and summed into the money figure on screen. Past
//     the cap the truncation falls wherever the ordering puts it, so an
//     arrangement missing lines showed a subtotal that was simply too low. The
//     route already handled the lines read FAILING; it did not handle it
//     returning fewer rows than exist.
//
//   * `/business-builder/market-intelligence` counted recorded evidence with
//     `select=id&limit=1000` and `rows.length`, so a table holding 4,000 rows
//     reported 1,000 -- three lines under a comment reading "What matters is
//     that the number is real", on the page whose whole subject is not turning
//     estimates into facts.
//
// 200 arrangements averaging five lines each is exactly 1,000, so neither is a
// remote case. Both are the page working correctly right up to the point where
// it quietly stops.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRecurring = require("../routes/sonara-recurring-invoice-routes.cjs");
const registerMarketIntelligence = require("../routes/market-intelligence-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SCHEDULE_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";

const LINE_CAP = 1000;
// Read from routes/market-intelligence-routes.cjs rather than guessed. The
// first version of this file used "market_segments", which matched no table, so
// every count came back 0 and the assertions failed for the wrong reason.
const SEGMENTS_TABLE = "market_intelligence_segments";
const RECURRING_PAGE = "/business-builder/owner/recurring";
const MARKET_PAGE = "/business-builder/market-intelligence";

// PostgREST honours `limit`, so a stub that ignores it proves nothing: the route
// could ask for cap + 1 and still be handed everything. This truncates exactly
// as the database would, and reports an exact count the way
// `Prefer: count=exact` does.
function serve(url, available, { exactCount = false } = {}) {
  const parsed = new URL(url);
  const limit = Number(parsed.searchParams.get("limit") || available.length);
  const body = available.slice(0, limit);
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (exactCount && String(name).toLowerCase() === "content-range" ? `0-0/${available.length}` : null) },
    json: async () => body
  };
}

function line(index) {
  return {
    recurring_invoice_id: SCHEDULE_ID,
    service_id: null,
    description: `Line ${index}`,
    quantity: 1,
    unit_price_cents: 1000
  };
}

function recurringHarness({ lineCount = 3, linesOk = true } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const seen = [];

  registerRecurring(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) =>
      `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireBusinessManager: (req, res, next) => {
      req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
      return next();
    },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    supabaseHeaders: () => ({ apikey: "server-only" })
  });

  const fetchImpl = async (url) => {
    const target = String(url);
    seen.push(target);

    if (target.includes("/rest/v1/recurring_invoice_lines")) {
      if (!linesOk) return { ok: false, status: 500, headers: { get: () => null }, json: async () => [] };
      return serve(target, Array.from({ length: lineCount }, (_, index) => line(index)));
    }
    if (target.includes("/rest/v1/recurring_invoices")) {
      return serve(target, [{
        id: SCHEDULE_ID,
        customer_id: CUSTOMER_ID,
        label: "Monthly retainer",
        enabled: true,
        cadence: "monthly",
        anchor_day: 1,
        starts_on: "2026-01-01",
        ends_on: null,
        payment_terms_days: 14,
        tax_rate_basis_points: 0,
        currency: "gbp",
        last_issued_on: null
      }]);
    }
    if (target.includes("/rest/v1/customers")) {
      return serve(target, [{ id: CUSTOMER_ID, name: "A Customer" }]);
    }
    return serve(target, []);
  };

  return { app, fetchImpl, seen };
}

function marketHarness({ counts = {}, readable = true } = {}) {
  const app = express();
  app.use(express.json());
  const seen = [];

  registerMarketIntelligence(app, {
    requireCustomer: (req, res, next) => {
      req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
      return next();
    },
    requireWorkspaceAccess: () => (req, res, next) => {
      req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
      return next();
    },
    layout: ({ title, heading, body, sections = [], actions = [] }) =>
      `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });

  const fetchImpl = async (url) => {
    const target = String(url);
    seen.push(target);
    if (!readable) return { ok: false, status: 500, headers: { get: () => null }, json: async () => [] };
    const match = target.match(/\/rest\/v1\/([a-z0-9_]+)\?/);
    const table = match ? match[1] : null;
    const total = table && Object.prototype.hasOwnProperty.call(counts, table) ? counts[table] : 0;
    // Ids only, and the exact count in the header -- which is what the fix
    // relies on and what the old code had no way to read.
    return serve(target, Array.from({ length: total }, (_, index) => ({ id: `id-${index}` })), { exactCount: true });
  };

  return { app, fetchImpl, seen };
}

async function withFetch(fetchImpl, run) {
  const original = global.fetch;
  global.fetch = fetchImpl;
  try {
    return await run();
  } finally {
    global.fetch = original;
  }
}

describe("a total over a truncated read is a wrong number", () => {
  describe("standing arrangements", () => {
    it("shows the amount when every line was read", async () => {
      // The control. Without it, every assertion below passes against a page
      // that has stopped showing amounts at all.
      const { app, fetchImpl } = recurringHarness({ lineCount: 3 });
      const page = await withFetch(fetchImpl, () => request(app).get(RECURRING_PAGE).set("Accept", "text/html"));

      assert.equal(page.status, 200);
      assert.match(page.text, /GBP 30\.00/, "three lines at GBP 10 did not total to GBP 30");
      assert.doesNotMatch(page.text, /amount not shown/i);
      assert.doesNotMatch(page.text, /cannot total these accurately/i);
    });

    it("leaves the amount off rather than showing one that is too low", async () => {
      const { app, fetchImpl } = recurringHarness({ lineCount: LINE_CAP + 1 });
      const page = await withFetch(fetchImpl, () => request(app).get(RECURRING_PAGE).set("Accept", "text/html"));

      assert.equal(page.status, 200);

      // The harm first. A page that printed GBP 10,000.00 over 1,001 lines of
      // GBP 10 is out by a line and says nothing, and that is a number somebody
      // invoices from.
      assert.doesNotMatch(page.text, /GBP [0-9,]+\.00/, "a subtotal was printed over a truncated line read");
      assert.match(page.text, /amount not shown -- too many lines to total here/);

      // And said once at the top, before any figure, because the lines are
      // ordered across every arrangement: when the read is short there is no
      // way to tell WHICH arrangements lost lines, so every amount is suspect.
      assert.match(page.text, /We cannot total these accurately right now/);
      assert.match(page.text, /nothing about your billing has changed/i);
    });

    it("still lists the arrangement it cannot total", async () => {
      // Suppressing the figure must not suppress the record. An owner who
      // cannot see that an arrangement exists will set up a second copy of it.
      const { app, fetchImpl } = recurringHarness({ lineCount: LINE_CAP + 1 });
      const page = await withFetch(fetchImpl, () => request(app).get(RECURRING_PAGE).set("Accept", "text/html"));

      assert.match(page.text, /Monthly retainer/, "the arrangement vanished along with its total");
      assert.match(page.text, /A Customer/);
    });

    it("tells a failed line read apart from a short one", async () => {
      // Different causes, different actions: one is an outage to retry, the
      // other is a size nothing about retrying changes.
      const { app, fetchImpl } = recurringHarness({ linesOk: false });
      const page = await withFetch(fetchImpl, () => request(app).get(RECURRING_PAGE).set("Accept", "text/html"));

      assert.match(page.text, /amount not shown -- lines could not be read/);
      assert.doesNotMatch(page.text, /too many lines to total here/);
    });

    it("asks for one line more than it will use, or it could not tell", async () => {
      // The mechanism. A route asking for exactly the cap gets the cap back
      // from a table holding ten times that and cannot distinguish the two.
      const { app, fetchImpl, seen } = recurringHarness({ lineCount: 3 });
      await withFetch(fetchImpl, () => request(app).get(RECURRING_PAGE).set("Accept", "text/html"));

      const read = seen.find((url) => url.includes("/rest/v1/recurring_invoice_lines?"));
      assert.ok(read, "the page never read the arrangement lines");
      assert.match(read, new RegExp(`limit=${LINE_CAP + 1}`), `the page asked for a limit it cannot interpret: ${read}`);
    });
  });

  describe("recorded evidence", () => {
    it("reports a count larger than any page cap", async () => {
      // 4,000 rows used to report 1,000, because the count WAS the row array's
      // length and the array was capped.
      const { app, fetchImpl } = marketHarness({ counts: { [SEGMENTS_TABLE]: 4000 } });
      const page = await withFetch(fetchImpl, () => request(app).get(MARKET_PAGE).set("Accept", "text/html"));

      assert.equal(page.status, 200);
      assert.match(page.text, /Customer segments: 4000/, "the count is still the cap rather than the total");
      assert.doesNotMatch(page.text, /Customer segments: 1000\b/);
    });

    it("counts by asking the database, not by measuring what it transferred", async () => {
      const { app, fetchImpl, seen } = marketHarness({ counts: { [SEGMENTS_TABLE]: 7 } });
      await withFetch(fetchImpl, () => request(app).get(MARKET_PAGE).set("Accept", "text/html"));

      const read = seen.find((url) => url.includes(`/rest/v1/${SEGMENTS_TABLE}?`));
      assert.ok(read, "the page never counted the segments");
      // One row, not a thousand ids. The count comes from Content-Range.
      assert.match(read, /limit=1(?!\d)/, `the count still transfers rows to measure them: ${read}`);
      assert.match(read, new RegExp(`organization_id=eq\\.${ORGANIZATION_ID}`), "the count is not scoped to the organization");
    });

    it("still reports a real small count", async () => {
      // Or the assertions above are satisfied by a page that prints nothing,
      // and "no number" would pass a check written about a wrong number.
      const { app, fetchImpl } = marketHarness({ counts: { [SEGMENTS_TABLE]: 7 } });
      const page = await withFetch(fetchImpl, () => request(app).get(MARKET_PAGE).set("Accept", "text/html"));

      assert.match(page.text, /Customer segments: 7/);
    });

    it("does not report a failed count as none recorded", async () => {
      // The care the original code already took, kept. A read that did not
      // happen is not a record type with nothing in it, and this is the page
      // whose subject is not turning estimates into facts.
      const { app, fetchImpl } = marketHarness({ readable: false });
      const page = await withFetch(fetchImpl, () => request(app).get(MARKET_PAGE).set("Accept", "text/html"));

      assert.equal(page.status, 200);
      assert.doesNotMatch(page.text, /Customer segments: 0/, "a failed count was reported as zero");
      assert.match(page.text, /could not be read/i);
    });

    it("does not report a count from a header it could not parse", async () => {
      // A successful request whose Content-Range is missing or malformed is a
      // failed MEASUREMENT, and 0 is a fact about the business. Reported as
      // unknown, which is the third state.
      const app = marketHarness().app;
      const page = await withFetch(
        async () => ({ ok: true, status: 200, headers: { get: () => "*/*" }, json: async () => [] }),
        () => request(app).get(MARKET_PAGE).set("Accept", "text/html")
      );

      assert.equal(page.status, 200);
      assert.doesNotMatch(page.text, /Customer segments: 0/, "an unparseable count became zero");
      assert.match(page.text, /could not be read/i);
    });
  });
});
