"use strict";

// Publishing one record, and everything that must not come with it.
//
// Four kinds are shareable -- a saved tool result, a quote, an invoice and an
// appointment -- and all four live in organization-scoped tables read with the
// service-role key, which bypasses row level security. The organization_id
// filter in the query is therefore the entire tenant boundary, and a public page
// has no organization to filter by. That is the whole risk in this feature.
//
// The resolution order is what answers it, and it is the property this file
// exists to hold: a token finds one `shared_links` row, that row names both the
// resource and the organization, and the resource is then fetched filtered on
// both. The public page never chooses an organization. It is told one by the row
// the customer created when they pressed Share.
//
// Assertions come in two kinds on purpose. "The page did not contain the phone
// number" can be true because the render dropped it, a lookup failed, or the
// fixture was thin. "The application never asked for the phone number" is the
// property worth holding, and the fake Supabase records every query so it can be
// asserted directly.

const assert = require("node:assert/strict");
const request = require("supertest");

const shared = require("../lib/sonara-shared-results.cjs");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const { renderShareControl, renderSavedOutputCards } = require("../lib/sonara-module-crud.cjs");

// Real v4 UUIDs, version and variant nibbles included. The owner record pages
// validate with a strict RFC pattern, and a fixture that is only hex-and-dashes
// is rejected before any read happens -- which is how the first version of the
// record-page test got a 404 while appearing to test rendering.
const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const OTHER_ORG = "bbbbbbbb-0000-4000-8000-00000000000b";
const USER = "11111111-0000-4000-8000-000000000001";
const RESULT_ID = "cccccccc-0000-4000-8000-00000000000c";
const OTHER_RESULT_ID = "dddddddd-0000-4000-8000-00000000000d";
const INVOICE_ID = "eeeeeeee-0000-4000-8000-00000000000e";
const BOOKING_ID = "ffffffff-0000-4000-8000-00000000000f";
const QUOTE_ID = "aaaaaaaa-1111-4000-8000-00000000001a";
const PO_ID = "aaaaaaaa-2222-4000-8000-00000000002a";

const RESULT_TOKEN = "aBcDeFgHiJkLmNoPqRsTuVwXyZ012345";
const INVOICE_TOKEN = "bCdEfGhIjKlMnOpQrStUvWxYz0123456";
const BOOKING_TOKEN = "cDeFgHiJkLmNoPqRsTuVwXyZ01234567";

// Distinctive enough that finding one in a page is unambiguous.
const SECRET_INPUT = "RENT-IS-4200-A-MONTH";
const PUBLISHED_ANSWER = "You cover your costs at 420 sales a month.";
const CUSTOMER_PHONE = "555-PRIVATE-9999";
const CUSTOMER_EMAIL = "private-customer@example.com";
const INTERNAL_NOTE = "CHASES-PAYMENT-ALWAYS-LATE";

function seed() {
  return {
    organizations: [
      { id: ORG, name: "Shared Co", slug: "shared-co" },
      { id: OTHER_ORG, name: "Somebody Else Ltd", slug: "else" }
    ],
    organization_memberships: [
      { id: "mem-1", organization_id: ORG, user_id: USER, status: "active", role: "owner", created_at: "2026-01-01" }
    ],
    // The owner record pages are behind requireBusinessManager, which reads this
    // table rather than organization_memberships. Without it the detail pages
    // answer 303 and every assertion about what they render passes over a
    // redirect -- which is exactly what happened when this was first written.
    business_memberships: [
      { id: "bmem-1", organization_id: ORG, workspace_id: null, user_id: USER, status: "active", role: "owner", created_at: "2026-01-01" }
    ],
    module_outputs: [
      {
        id: RESULT_ID, organization_id: ORG, product_key: "business_builder", module_key: "break_even",
        input_payload: { fixedCosts: SECRET_INPUT },
        output_payload: { summary: PUBLISHED_ANSWER, unitsPerMonth: 420 },
        created_at: "2026-08-19T09:00:00.000Z"
      },
      {
        id: OTHER_RESULT_ID, organization_id: OTHER_ORG, product_key: "business_builder", module_key: "break_even",
        input_payload: {}, output_payload: { summary: "Somebody else's answer." }, created_at: "2026-08-19T09:00:00.000Z"
      }
    ],
    quotes: [
      { id: QUOTE_ID, organization_id: ORG, title: "Roof repair", amount_cents: null, status: "draft", created_at: "2026-08-01T09:00:00.000Z", created_by: USER }
    ],
    customer_invoices: [
      {
        id: INVOICE_ID, organization_id: ORG, invoice_number: "INV-2026-004",
        issued_on: "2026-08-01", due_on: "2026-08-31",
        subtotal_cents: 120000, tax_cents: 24000, total_cents: 144000, currency: "gbp", status: "sent",
        notes: INTERNAL_NOTE, created_by: USER, customer_id: "9999"
      }
    ],
    customer_invoice_payments: [
      // A deposit. The page used to show this customer the whole GBP 1,440
      // again, which is either paid twice or, far more likely, paperwork
      // nobody trusts.
      { id: "pay-1", organization_id: ORG, invoice_id: INVOICE_ID, amount_cents: 44000, received_on: "2026-08-05" }
    ],
    customer_invoice_lines: [
      { id: "line-1", organization_id: ORG, invoice_id: INVOICE_ID, description: "Design work", quantity: 12, unit_price_cents: 10000, line_total_cents: 120000, created_at: "2026-08-01" }
    ],
    business_bookings: [
      {
        id: BOOKING_ID, organization_id: ORG, starts_at: "2026-09-02T14:30:00.000Z", ends_at: "2026-09-02T15:30:00.000Z",
        status: "confirmed", customer_name: "Nadia Okonkwo", customer_email: CUSTOMER_EMAIL, customer_phone: CUSTOMER_PHONE,
        notes: INTERNAL_NOTE
      }
    ],
    shared_links: [
      { id: "sl-1", organization_id: ORG, resource_type: "module_output", resource_id: RESULT_ID, token: RESULT_TOKEN, shared_at: "2026-08-19T10:00:00.000Z", revoked_at: null },
      { id: "sl-2", organization_id: ORG, resource_type: "customer_invoice", resource_id: INVOICE_ID, token: INVOICE_TOKEN, shared_at: "2026-08-19T10:00:00.000Z", revoked_at: null },
      { id: "sl-3", organization_id: ORG, resource_type: "business_booking", resource_id: BOOKING_ID, token: BOOKING_TOKEN, shared_at: "2026-08-19T10:00:00.000Z", revoked_at: null }
    ]
  };
}

describe("a shared link is a link, not a leak", () => {
  describe("the token", () => {
    it("is long enough that guessing one is not a strategy", () => {
      const token = shared.mintShareToken();
      assert.match(token, shared.SHARE_TOKEN_PATTERN);
      // 32 base64url characters is 192 bits. The link is the only credential --
      // there is nothing behind it to check, because the point is that a person
      // with no account can open it.
      assert.equal(token.length, 32);
    });

    it("does not repeat", () => {
      const minted = new Set();
      for (let index = 0; index < 2000; index += 1) minted.add(shared.mintShareToken());
      assert.equal(minted.size, 2000, "two mints collided, so this is not random");
    });

    it("refuses everything that is not one, including the empty string", () => {
      // `token=eq.` with nothing after it matches rows whose token is empty
      // rather than none -- the same shape of mistake as an organization filter
      // with nothing after the eq.
      for (const bad of ["", " ", "short", "a".repeat(31), "a".repeat(33), `${RESULT_TOKEN}&limit=99`, `${RESULT_TOKEN}.`, "../../etc", null, undefined, 12345, {}]) {
        assert.equal(shared.isShareToken(bad), false, `accepted ${JSON.stringify(bad)}`);
      }
      assert.equal(shared.isShareToken(RESULT_TOKEN), true, "rejected a well-formed token, so every check above is vacuous");
    });
  });

  describe("what each kind is allowed to select", () => {
    it("covers all four kinds, so no kind is silently outside these checks", () => {
      assert.deepEqual([...shared.SHAREABLE_TYPES].sort(), ["business_booking", "customer_invoice", "module_output", "quote"]);
    });

    it("names no identifier, no contact detail and no internal note", () => {
      for (const type of shared.SHAREABLE_TYPES) {
        const spec = shared.shareableFor(type);
        assert.ok(spec.columns.length > 0, `${type} selects nothing, which would make every check here vacuous`);
        for (const forbidden of [...spec.forbidden, ...shared.NEVER_SHARED_COLUMNS]) {
          assert.ok(!spec.columns.includes(forbidden), `${type} selects ${forbidden} for a public page`);
        }
        if (spec.lines) {
          for (const forbidden of [...spec.lines.forbidden, ...shared.NEVER_SHARED_COLUMNS]) {
            assert.ok(!spec.lines.columns.includes(forbidden), `${type} lines select ${forbidden}`);
          }
        }
      }
    });

    it("forbids every contact column an appointment carries", () => {
      // Named individually rather than trusted to the loop above: a link gets
      // forwarded, and whoever forwards it is not deciding to publish somebody
      // else's phone number.
      const booking = shared.shareableFor("business_booking");
      for (const column of ["customer_name", "customer_email", "customer_phone", "notes"]) {
        assert.ok(booking.forbidden.includes(column), `${column} is not on the appointment's forbidden list`);
      }
    });

    it("is what the routes actually select", () => {
      // The lists are only a boundary if the route uses them. A select spelled
      // inline at the call site would drift from these and nothing would say so.
      const source = require("node:fs").readFileSync(require.resolve("../routes/sonara-shared-result-routes.cjs"), "utf8");
      assert.match(source, /shareable\.columns\.join\(","\)/, "the shared page does not select through the reviewed column list");
      assert.match(source, /shareable\.lines\.columns\.join\(","\)/, "the invoice lines do not select through the reviewed column list");
      assert.doesNotMatch(source, /select=\*/, "the shared page selects every column somewhere");
    });
  });

  describe("money and absent values", () => {
    it("renders integer cents as money, in the row's own currency", () => {
      assert.equal(shared.money(144000, "gbp"), "£1,440.00");
      assert.equal(shared.money(50, "usd"), "$0.50");
      assert.equal(shared.money(120000, "sek"), "1,200.00 SEK");
    });

    it("says nothing rather than zero for a price nobody set", () => {
      // Number(null) is 0, and that once made an unpriced service read as free
      // across twenty-three columns.
      assert.equal(shared.money(null), null);
      assert.equal(shared.money(undefined), null);
      assert.equal(shared.money(""), null);
      assert.equal(shared.finiteNumber(null), null);
      assert.equal(shared.finiteNumber(0), 0, "zero is a real amount and must survive");
    });

    it("shows an unpriced quote as not set, never as free", () => {
      const view = shared.sharedView({ resourceType: "quote", row: { title: "Roof", amount_cents: null, status: "draft" } });
      const amount = view.lines.find((line) => line.label === "Amount");
      assert.equal(amount.value, "Not set");
      assert.ok(!/\$0\.00/.test(JSON.stringify(view)), "an unpriced quote rendered as free");
    });
  });

  describe("the public page", () => {
    let app;
    let fake;
    let savedFetch;
    let savedEnv;

    before(() => {
      savedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
      fake = createFakeSupabase({ users: { "token-a": { id: USER, email: "a@example.com" } }, tables: seed() });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      app = require("../server");
    });

    after(() => {
      if (savedFetch) global.fetch = savedFetch;
      for (const [key, value] of Object.entries(savedEnv || {})) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("opens a saved result for somebody with no account at all", async () => {
      const response = await request(app).get(`/shared/${RESULT_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200, "a shared link that needs an account is not a shared link");
      assert.ok(response.text.includes(PUBLISHED_ANSWER), "the answer it was shared for is not on the page");
      assert.ok(!response.text.includes(SECRET_INPUT), "the figures it was worked out from reached the page");
    });

    it("opens an invoice with its lines and totals", async () => {
      const response = await request(app).get(`/shared/${INVOICE_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes("INV-2026-004"), "the invoice number is missing");
      assert.ok(response.text.includes("£1,440.00"), "the total is missing or not rendered as money");
      assert.ok(response.text.includes("Design work"), "the invoice lines are missing");
      assert.ok(!response.text.includes("144000"), "raw cents were printed at somebody reading their own bill");
      assert.ok(!response.text.includes(INTERNAL_NOTE), "the internal note reached the page");
    });

    it("shows what is still owed, not only what was charged", async () => {
      const response = await request(app).get(`/shared/${INVOICE_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      // GBP 1,440 charged, GBP 440 received. Showing the total alone is how a
      // customer pays a deposit twice.
      assert.ok(response.text.includes("Still owed"), "the page shows a total and never a balance");
      assert.ok(response.text.includes("£1,000.00"), "the balance is missing or not rendered as money");
      assert.ok(response.text.includes("£440.00"), "what has already been received is not shown");
      assert.ok(response.text.includes("£1,440.00"), "the original total must stay, so a customer can check it against their own records");
    });

    it("still tells the reader not to pay from the link", async () => {
      // The balance makes this page more useful and not more payable. There is
      // no pay button, because this application cannot route the money to the
      // business rather than to itself -- and the advice only protects anybody
      // if it is always true.
      const response = await request(app).get(`/shared/${INVOICE_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.match(response.text, /never from a link/i);
      assert.doesNotMatch(response.text, /<form[^>]*checkout|Pay now|Pay this invoice/i, "a shared invoice grew a pay button");
    });

    it("says it could not check rather than showing the whole total again", async () => {
      // The module refuses to state a balance it could not work out. This is
      // the assertion that the ROUTE tells it so: hardcoding paymentsRead:true
      // passes every other test in this file, because every other fixture has
      // a readable payments table.
      const installed = global.fetch;
      global.fetch = async (input, init) => {
        if (String(input).includes("customer_invoice_payments")) throw new Error("payments are unreachable");
        return installed(input, init);
      };
      try {
        const response = await request(app).get(`/shared/${INVOICE_TOKEN}`).set("accept", "text/html").redirects(0);
        assert.equal(response.status, 200, "the invoice is still worth showing; it is the balance that is unknown");
        assert.ok(response.text.includes("could not check"), "an unreadable payments table rendered as a balance");
        assert.ok(!response.text.includes("£1,000.00"), "a balance was shown that nothing could have worked out");
        assert.ok(response.text.includes("£1,440.00"), "the total is known and should still be shown");
      } finally {
        global.fetch = installed;
      }
    });

    it("opens an appointment without publishing anybody's contact details", async () => {
      const response = await request(app).get(`/shared/${BOOKING_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      assert.ok(/2 September 2026/.test(response.text), "the appointment time is missing");
      for (const secret of [CUSTOMER_PHONE, CUSTOMER_EMAIL, "Nadia Okonkwo", INTERNAL_NOTE]) {
        assert.ok(!response.text.includes(secret), `the appointment page published ${secret}`);
      }
    });

    it("names the business that published it, and nothing else about them", async () => {
      const response = await request(app).get(`/shared/${INVOICE_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.ok(response.text.includes("Shared Co"), "the business that sent the invoice is not named");
      assert.ok(!response.text.includes(ORG), "the organization id reached the page");
      assert.ok(!response.text.includes("Somebody Else Ltd"), "another organization's name reached the page");
    });

    it("never asks the database for a forbidden column either", async () => {
      for (const [token, type] of [[RESULT_TOKEN, "module_output"], [INVOICE_TOKEN, "customer_invoice"], [BOOKING_TOKEN, "business_booking"]]) {
        fake.reset();
        await request(app).get(`/shared/${token}`).set("accept", "text/html").redirects(0);
        const spec = shared.shareableFor(type);
        const reads = fake.queries.filter((query) => query.table === spec.table);
        assert.equal(reads.length, 1, `${type}: expected one read of ${spec.table}, saw ${reads.length}`);
        const select = (new URLSearchParams(reads[0].search).get("select") || "").split(",");
        for (const forbidden of [...spec.forbidden, ...shared.NEVER_SHARED_COLUMNS]) {
          assert.ok(!select.includes(forbidden), `${type}: the shared page asked for ${forbidden}`);
        }
        // Both filters, always. The id alone would serve another organization's
        // row if a token were ever attached to the wrong resource.
        const columns = reads[0].filters.map((filter) => filter.column).sort();
        assert.deepEqual(columns, ["id", "organization_id"], `${type}: the resource read filtered on ${columns.join(", ")}`);
      }
    });

    it("takes the organization from the link row and never from the request", async () => {
      fake.reset();
      await request(app).get(`/shared/${INVOICE_TOKEN}`).set("accept", "text/html").redirects(0);
      const linkRead = fake.queries.find((query) => query.table === "shared_links");
      assert.ok(linkRead, "the token was not resolved through shared_links at all");
      // The link lookup is by token and liveness only. Anything else in that
      // filter would be something the request could influence.
      assert.deepEqual(linkRead.filters.map((filter) => filter.column).sort(), ["revoked_at", "token"]);
    });

    it("answers a revoked link exactly as it answers a made-up one", async () => {
      // Telling them apart would tell somebody guessing that they had guessed a
      // token which used to exist, and would tell a recipient that the person
      // who shared it took it back -- which is that person's news to give.
      const madeUp = await request(app).get("/shared/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz").set("accept", "text/html").redirects(0);
      const wrongShape = await request(app).get("/shared/nope").set("accept", "text/html").redirects(0);
      assert.equal(madeUp.status, 404);
      assert.equal(wrongShape.status, 404);
      assert.equal(madeUp.text, wrongShape.text, "the two refusals read differently, so one of them is informative");
    });

    it("has an explainer for whoever trims the link, and it promises no form", async () => {
      const response = await request(app).get("/shared").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      assert.match(response.text, /shared something with you/i);
      // A page that shows somebody an invoice is a page a phisher would copy.
      // Saying plainly that ours never asks for anything is the cheapest defence
      // available and costs a sentence.
      assert.match(response.text, /never asks you for anything/i);
    });
  });

  describe("the invoice as a file somebody can keep", () => {
    let app;
    let fake;
    let savedFetch;
    let savedEnv;

    before(() => {
      savedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
      fake = createFakeSupabase({ users: { "token-a": { id: USER, email: "a@example.com" } }, tables: seed() });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      app = require("../server");
    });

    after(() => {
      if (savedFetch) global.fetch = savedFetch;
      for (const [key, value] of Object.entries(savedEnv || {})) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("downloads for somebody with no account at all", async () => {
      const response = await request(app).get(`/shared/${INVOICE_TOKEN}/invoice.pdf`).redirects(0);
      assert.equal(response.status, 200, "a public invoice download that needs an account is not one");
      assert.equal(response.headers["content-type"], "application/pdf");
      assert.match(response.headers["content-disposition"], /^attachment; filename="invoice-[A-Za-z0-9._-]*\.pdf"$/);
      assert.equal(response.body.subarray(0, 5).toString("latin1"), "%PDF-");
    });

    it("is not cached anywhere a later visitor could reach it", async () => {
      // The link is the only credential and its holder was given it on purpose.
      const response = await request(app).get(`/shared/${INVOICE_TOKEN}/invoice.pdf`).redirects(0);
      assert.match(response.headers["cache-control"], /no-store/);
      assert.ok(!/public/.test(response.headers["cache-control"] || ""));
    });

    it("reads through the same organization filter the page does", async () => {
      fake.reset();
      await request(app).get(`/shared/${INVOICE_TOKEN}/invoice.pdf`).redirects(0);
      const reads = fake.queries.filter((query) => query.method === "GET" && query.table === "customer_invoices");
      assert.ok(reads.length >= 1, "no invoice was read, so this check is looking at nothing");
      for (const read of reads) {
        assert.ok(
          String(read.search).includes(`organization_id=eq.${ORG}`),
          "the invoice was fetched by id alone, without the organization the link row named"
        );
      }
    });

    it("answers a token that opens something else the same way as one that does not exist", async () => {
      // A quote, an appointment and a saved result have pages rather than
      // documents. Telling those apart from a bad token tells somebody guessing.
      const other = await request(app).get(`/shared/${RESULT_TOKEN}/invoice.pdf`).redirects(0);
      const missing = await request(app).get(`/shared/${"z".repeat(32)}/invoice.pdf`).redirects(0);
      assert.equal(other.status, 404);
      assert.equal(missing.status, other.status);
    });

    it("refuses a token shaped wrongly before it reaches a query", async () => {
      fake.reset();
      const response = await request(app).get("/shared/short/invoice.pdf").redirects(0);
      assert.equal(response.status, 404);
      const asked = fake.queries.filter((query) => String(query.search).includes("token=eq."));
      assert.equal(asked.length, 0, "a malformed token was interpolated into a filter");
    });

    it("offers the download from the page itself, and only for an invoice", async () => {
      const invoicePage = await request(app).get(`/shared/${INVOICE_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.ok(invoicePage.text.includes(`/shared/${INVOICE_TOKEN}/invoice.pdf`), "the invoice page does not offer the file");

      const resultPage = await request(app).get(`/shared/${RESULT_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.ok(!resultPage.text.includes("invoice.pdf"), "a saved result offered an invoice download");
    });
  });

  describe("turning it on and taking it back", () => {
    let app;
    let fake;
    let savedFetch;
    let savedEnv;

    beforeEach(() => {
      savedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
      fake = createFakeSupabase({ users: { "token-a": { id: USER, email: "a@example.com" } }, tables: seed() });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
      app = require("../server");
    });

    afterEach(() => {
      if (savedFetch) global.fetch = savedFetch;
      for (const [key, value] of Object.entries(savedEnv || {})) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("refuses a stranger", async () => {
      const response = await request(app)
        .post(`/api/shared-links/quote/${QUOTE_ID}/share`)
        .set("accept", "application/json")
        .send({});
      assert.notEqual(response.status, 200, "anybody could publish anybody's record");
      assert.ok([401, 403, 303].includes(response.status), `unexpected refusal status ${response.status}`);
      assert.equal(fake.rows("shared_links").some((row) => row.resource_id === QUOTE_ID), false);
    });

    it("refuses a kind that is not shareable", async () => {
      // Without this, resourceType is a table name taken from the URL.
      const response = await request(app)
        .post(`/api/shared-links/organizations/${ORG}/share`)
        .set("accept", "application/json")
        .set("Authorization", "Bearer token-a")
        .send({});
      assert.equal(response.status, 404);
      assert.equal(response.body.code, "unknown_kind");
      assert.equal(fake.rows("shared_links").length, 3, "a link was created for a kind that is not shareable");
    });

    it("does not publish a record belonging to another organization", async () => {
      const response = await request(app)
        .post(`/api/shared-links/module_output/${OTHER_RESULT_ID}/share`)
        .set("accept", "application/json")
        .set("Authorization", "Bearer token-a")
        .send({});
      assert.equal(response.status, 404, `a signed-in customer got ${response.status} for another tenant's row`);
      assert.equal(
        fake.rows("shared_links").some((row) => row.resource_id === OTHER_RESULT_ID),
        false,
        "another organization's record was published"
      );
    });

    it("checks the record is the caller's before minting anything", async () => {
      fake.reset();
      await request(app)
        .post(`/api/shared-links/module_output/${OTHER_RESULT_ID}/share`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      const inserts = fake.queries.filter((query) => query.table === "shared_links" && query.method === "POST");
      assert.deepEqual(inserts, [], "a token was minted before the record was confirmed to belong to the caller");
    });

    it("publishes a quote and gives back a link that opens it", async () => {
      const created = await request(app)
        .post(`/api/shared-links/quote/${QUOTE_ID}/share`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      assert.equal(created.status, 200);
      assert.ok(shared.isShareToken(created.body.token), "no usable token came back");
      assert.equal(created.body.path, `/shared/${created.body.token}`);

      const opened = await request(app).get(created.body.path).set("accept", "text/html").redirects(0);
      assert.equal(opened.status, 200, "the link that was just minted does not open");
      assert.ok(opened.text.includes("Roof repair"), "the quote is not on its own page");
    });

    it("scopes every write by organization as well as by resource", async () => {
      fake.reset();
      await request(app)
        .post(`/api/shared-links/module_output/${RESULT_ID}/revoke`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      const writes = fake.queries.filter((query) => query.table === "shared_links" && query.method === "PATCH");
      assert.ok(writes.length >= 1, "no write was issued, so this check is vacuous");
      for (const write of writes) {
        const columns = write.filters.map((filter) => filter.column);
        assert.ok(columns.includes("organization_id"), `a write filtered on ${columns.join(", ")} with no organization`);
        assert.ok(columns.includes("resource_id"), "a write did not name the resource");
      }
    });

    it("takes a shared record back, keeps the record that it was shared, and the link stops opening", async () => {
      const revoked = await request(app)
        .post(`/api/shared-links/module_output/${RESULT_ID}/revoke`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      assert.equal(revoked.status, 200);
      assert.equal(revoked.body.code, "revoked");

      const row = fake.rows("shared_links").find((entry) => entry.resource_id === RESULT_ID);
      assert.ok(row.revoked_at, "the link was not stamped as revoked");
      // Kept rather than deleted: a customer who unshares something and later
      // wonders whether it was ever public is owed an answer.
      assert.equal(row.token, RESULT_TOKEN, "the token was erased, so the history is gone");
      assert.ok(row.shared_at, "when it was shared was erased");

      const after = await request(app).get(`/shared/${RESULT_TOKEN}`).set("accept", "text/html").redirects(0);
      assert.equal(after.status, 404, "a revoked link still opens");
    });

    it("says so plainly when there was nothing to take back", async () => {
      await request(app).post(`/api/shared-links/module_output/${RESULT_ID}/revoke`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      const second = await request(app).post(`/api/shared-links/module_output/${RESULT_ID}/revoke`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      // Pressing Stop sharing on something already private is a customer getting
      // what they asked for, not a failure.
      assert.equal(second.status, 200);
      assert.equal(second.body.code, "already_private");
    });

    it("keeps the existing link when the same record is shared twice", async () => {
      // A fresh token on every press would silently break every copy of the old
      // link, and nothing on the page warns that pressing twice does that.
      const first = await request(app).post(`/api/shared-links/quote/${QUOTE_ID}/share`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      const second = await request(app).post(`/api/shared-links/quote/${QUOTE_ID}/share`)
        .set("accept", "application/json").set("Authorization", "Bearer token-a").send({});
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(second.body.token, first.body.token, "sharing twice changed the link");
      assert.equal(second.body.code, "already_shared");
      assert.equal(fake.rows("shared_links").filter((row) => row.resource_id === QUOTE_ID && !row.revoked_at).length, 1);
    });

    it("sends a browser back to the page it came from, and nowhere off this site", async () => {
      const offsite = await request(app)
        .post(`/api/shared-links/module_output/${RESULT_ID}/revoke`)
        .type("form")
        .send({ back: "https://example.com/phish" });
      // A form post with no session is refused before the redirect target
      // matters; what must never happen is a 303 to another origin.
      if (offsite.status === 303) {
        assert.ok(offsite.headers.location.startsWith("/"), `redirected off-site to ${offsite.headers.location}`);
      }
      const onsite = await request(app)
        .post(`/api/shared-links/module_output/${RESULT_ID}/revoke`)
        .set("Authorization", "Bearer token-a")
        .type("form")
        .send({ back: "/business-builder/records/free" });
      assert.equal(onsite.status, 303);
      assert.equal(onsite.headers.location, "/business-builder/records/free");
    });
  });

  describe("the door on the record's own page", () => {
    const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");

    it("puts a share card on every kind the share endpoint accepts, and on no other", () => {
      // The two lists have to agree in both directions. A page declaring a kind
      // the endpoint refuses is a button that always fails; a kind the endpoint
      // accepts with no page is an endpoint only an API client can reach, which
      // is how "turn a quote into an invoice" shipped with nothing to press.
      const declared = ALL_OWNER_PAGES.filter((page) => page.shareableAs).map((page) => page.shareableAs).sort();
      assert.ok(declared.length >= 3, `only ${declared.length} record pages offer a share link; this check has gone blind`);
      for (const kind of declared) {
        assert.ok(shared.shareableFor(kind), `${kind} is offered on a page and refused by the share endpoint`);
      }
      // module_output is the exception and has its own door, on the saved
      // results list rather than an owner record page.
      const withoutPage = shared.SHAREABLE_TYPES.filter((kind) => kind !== "module_output" && !declared.includes(kind));
      assert.deepEqual(withoutPage, [], `these kinds can be shared and have nowhere to press: ${withoutPage.join(", ")}`);
    });

    it("says on the page what a shared link gives away", () => {
      for (const page of ALL_OWNER_PAGES.filter((entry) => entry.shareableAs)) {
        assert.ok(page.shareShows, `${page.path} offers a share link without saying what it publishes`);
        assert.match(page.shareShows, /never shows/i, `${page.path} does not say what the link withholds`);
      }
    });

    // Built directly rather than through server.js, the way
    // tests/business-owner-record-pages.test.js does. These pages sit behind
    // requireBusinessManager, and driving the real guard here would be testing
    // the guard rather than the card. The first version went through server.js,
    // got a 303, and wrapped every assertion in `if (status === 200)` -- so the
    // whole block reported green while checking nothing.
    function buildOwnerApp(sharedLinksAnswer, { invoiceMissing = false } = {}) {
      const express = require("express");
      const registerRoutes = require("../routes/sonara-last9-routes.cjs");
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      app.use(express.json());
      const authenticate = (req, res, next) => {
        req.sonaraUser = { id: USER };
        return next();
      };
      const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
      registerRoutes(app, {
        layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
        brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        escapeHtml: escape,
        requireCustomer: authenticate,
        requireBusinessManager: authenticate,
        requireWorkspaceAccess: () => authenticate,
        getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
        getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
      });
      const rows = {
        customer_invoices: invoiceMissing
          ? []
          : [{ id: INVOICE_ID, organization_id: ORG, invoice_number: "INV-2026-004", total_cents: 144000, currency: "gbp", status: "sent", issued_on: "2026-08-01" }],
        customer_invoice_lines: [],
        // A record on a different page, so the "no download here" test below
        // renders something rather than passing over a 404.
        purchase_orders: [{ id: PO_ID, organization_id: ORG, po_number: "PO-2026-001", status: "sent", total_cents: 5000, currency: "gbp" }],
        purchase_order_lines: [],
        shared_links: [{ resource_id: INVOICE_ID, token: INVOICE_TOKEN }]
      };
      global.fetch = async (url, options = {}) => {
        const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
        if (table === "shared_links" && sharedLinksAnswer === "fails") {
          return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
        }
        if ((options.method || "GET") === "POST") return { ok: true, status: 201, headers: { get: () => null }, json: async () => [{ id: "created" }] };
        return { ok: true, status: 200, headers: { get: () => "0-0/1" }, json: async () => rows[table] || [] };
      };
      return app;
    }

    it("shows the existing link on the record it belongs to", async () => {
      const savedFetch = global.fetch;
      try {
        const app = buildOwnerApp("answers");
        const response = await request(app).get(`/business-builder/owner/receivables/${INVOICE_ID}`).set("accept", "text/html");
        assert.equal(response.status, 200, `the invoice page answered ${response.status}, so nothing below was checked`);
        assert.match(response.text, /Sending this to somebody/, "the invoice page has no way to share it");
        assert.ok(response.text.includes(`/shared/${INVOICE_TOKEN}`), "the existing link is not shown on the record it belongs to");
        assert.match(response.text, /Stop sharing this/);
        assert.match(response.text, /never shows/i, "the page does not say what the link withholds");
      } finally {
        global.fetch = savedFetch;
      }
    });

    it("says it could not tell, rather than offering to publish something already public", async () => {
      const savedFetch = global.fetch;
      try {
        const app = buildOwnerApp("fails");
        const response = await request(app).get(`/business-builder/owner/receivables/${INVOICE_ID}`).set("accept", "text/html");
        assert.equal(response.status, 200, `the invoice page answered ${response.status} with the link table down`);
        assert.match(response.text, /could not check whether this invoice has been shared/i);
        assert.ok(!/Create a link/.test(response.text), "a failed read offered to publish the invoice");
        assert.ok(!response.text.includes(`/shared/${INVOICE_TOKEN}`), "a failed read showed a link it had not confirmed");
        // And the rest of the page still works. A share card that could not
        // load must not take the invoice down with it.
        assert.match(response.text, /INV-2026-004/, "the invoice itself stopped rendering");
      } finally {
        global.fetch = savedFetch;
      }
    });
    it("offers the invoice as a file from the record it belongs to", async () => {
      const savedFetch = global.fetch;
      try {
        const app = buildOwnerApp("answers");
        const response = await request(app).get(`/business-builder/owner/receivables/${INVOICE_ID}`).set("accept", "text/html");
        assert.equal(response.status, 200, `the invoice page answered ${response.status}, so nothing below was checked`);
        assert.ok(
          response.text.includes(`/business-builder/owner/invoices/${INVOICE_ID}/pdf`),
          "the record page does not offer the invoice as a file, so the download route is one nobody finds"
        );
        assert.match(response.text, /Download this invoice/);
      } finally {
        global.fetch = savedFetch;
      }
    });

    it("does not offer a file for a record it could not find", async () => {
      const savedFetch = global.fetch;
      try {
        const app = buildOwnerApp("answers", { invoiceMissing: true });
        const response = await request(app).get(`/business-builder/owner/receivables/${INVOICE_ID}`).set("accept", "text/html");
        assert.equal(response.status, 404, `a missing invoice answered ${response.status}`);
        assert.ok(
          !response.text.includes("/pdf"),
          "a page that just said the record is not there still offered to download it"
        );
      } finally {
        global.fetch = savedFetch;
      }
    });

    // The field is per page, not per application. A page that never declared a
    // download must not grow one because the renderer stopped checking.
    //
    // Purchase orders rather than quotes: quotes has no child table, so it has
    // no detail route at all, and asking for one answers 404 with an empty body
    // that contains no "/pdf" for reasons that have nothing to do with this
    // guard. The first version of this test did exactly that and passed while
    // the guard was removed. The 200 below is the half that makes it mean
    // something.
    it("offers no such file on a record page that has not declared one", async () => {
      const savedFetch = global.fetch;
      try {
        const app = buildOwnerApp("answers");
        const response = await request(app).get(`/business-builder/owner/purchase-orders/${PO_ID}`).set("accept", "text/html");
        assert.equal(response.status, 200, `the purchase order page answered ${response.status}, so the check below saw no page`);
        assert.match(response.text, /PO-2026-001/, "the purchase order did not render, so there was nothing to find a link in");
        assert.ok(
          !response.text.includes("/pdf"),
          "a page that declared no download offered one anyway"
        );
      } finally {
        global.fetch = savedFetch;
      }
    });
  });

  describe("the control the customer presses", () => {
    it("offers to share a record that is private", () => {
      const html = renderShareControl({ record: { id: RESULT_ID }, shared: {}, backHref: "/business-builder/records/free" });
      assert.match(html, /Share this result/);
      assert.match(html, new RegExp(`/api/shared-links/module_output/${RESULT_ID}/share`));
      assert.ok(!/Stop sharing/.test(html), "a private result offered to stop sharing");
    });

    it("shows the link, in full, for a record that is shared", () => {
      const html = renderShareControl({ record: { id: RESULT_ID }, shared: { [RESULT_ID]: { token: RESULT_TOKEN } }, backHref: "/x" });
      // As text as well as a link: the point of it is that somebody copies it
      // into a message, and a bare anchor gives them nothing to copy.
      assert.ok(html.includes(`>/shared/${RESULT_TOKEN}<`), "the link is not readable as text");
      assert.match(html, /Stop sharing this/);
    });

    it("says it could not tell, rather than offering to share something already public", () => {
      // null is a failed read of shared_links, and it is not an unshared record.
      // A Share button shown for this reason invites somebody to publish
      // something that is already published; a missing Stop sharing button
      // leaves them believing it is private.
      const html = renderShareControl({ record: { id: RESULT_ID }, shared: null, backHref: "/x" });
      assert.match(html, /could not check whether this one is shared/i);
      assert.ok(!/Share this result/.test(html), "a failed read offered to share");
      assert.ok(!/Stop sharing/.test(html), "a failed read offered to stop sharing");
    });

    it("reaches the saved-results list", () => {
      const html = renderSavedOutputCards({
        records: [{ id: RESULT_ID, module_key: "break_even", created_at: "2026-08-19", output_payload: { summary: PUBLISHED_ANSWER } }],
        shared: {},
        productLabel: "Business Builder",
        backHref: "/business-builder/records/free"
      });
      assert.match(html, /Share this result/, "the share control never reaches the page a customer looks at");
      assert.match(html, /never the figures you typed in/, "the list does not say what sharing gives away");
    });
  });
});
