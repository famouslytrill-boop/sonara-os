"use strict";

// Turning standing arrangements into drafts, and the three ways it bills wrong.
//
// **It bills twice.** Two clicks, two runs, or a retry, and the customer gets
// the same invoice again. The period arithmetic is the first defence and a
// unique index on (recurring_invoice_id, issued_on) is the second; this file
// asserts the route treats the index doing its job as "already done" rather
// than as a failure to report.
//
// **It advances an arrangement that did not bill.** Writing last_issued_on
// before the invoice exists means a failed insert still moves the arrangement
// on, and that period is never billed by anybody. It is the quiet one: nobody
// complains about an invoice they did not receive.
//
// **It bills the wrong business.** Every read and every write carries the
// organization filter, because the service key bypasses row level security.
//
// Driven against the route module with the guards stubbed. Through server.js
// every assertion would pass over a 303 from requireBusinessManager.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRecurringInvoiceRoutes = require("../routes/sonara-recurring-invoice-routes.cjs");
const { hasColumn, tableColumns } = require("../lib/sonara-migration-columns.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const USER = "b2b2b2b2-0000-4000-8000-00000000002b";
const CUSTOMER = "c3c3c3c3-0000-4000-8000-00000000003c";
const SCHEDULE = "d4d4d4d4-0000-4000-8000-00000000004d";
const PAGE = "/business-builder/owner/recurring";

function dueSchedule(overrides = {}) {
  return {
    id: SCHEDULE, organization_id: ORG, customer_id: CUSTOMER,
    label: "Monthly retainer", enabled: true, cadence: "monthly",
    anchor_day: "1", starts_on: "2020-01-01", ends_on: null,
    payment_terms_days: 14, tax_rate_basis_points: 0, currency: "gbp",
    last_issued_on: "2020-01-01",
    ...overrides
  };
}

function buildApp({
  schedules = [dueSchedule()],
  lines = [{ recurring_invoice_id: SCHEDULE, description: "Retainer", quantity: 1, unit_price_cents: 120000 }],
  customers = [{ id: CUSTOMER, name: "Bright Ltd" }],
  schedulesOk = true, linesOk = true,
  invoiceStatus = 201,
  organization = ORG
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  const authenticate = (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; return next(); };

  const calls = [];
  global.fetch = async (url, init) => {
    const href = String(url);
    const method = String(init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ href, method, body });

    if (method === "GET") {
      if (href.includes("/recurring_invoice_lines")) return { ok: linesOk, status: linesOk ? 200 : 500, json: async () => lines };
      if (href.includes("/recurring_invoices")) return { ok: schedulesOk, status: schedulesOk ? 200 : 500, json: async () => schedules };
      if (href.includes("/customers")) return { ok: true, status: 200, json: async () => customers };
      return { ok: true, status: 200, json: async () => [] };
    }
    if (href.includes("/customer_invoices")) {
      const ok = invoiceStatus >= 200 && invoiceStatus < 300;
      return { ok, status: invoiceStatus, json: async () => (ok ? [{ id: "inv-created" }] : null) };
    }
    return { ok: true, status: 201, json: async () => [{ id: "row" }] };
  };

  registerRecurringInvoiceRoutes(app, {
    layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireBusinessManager: authenticate,
    getCustomerPrimaryOrganization: async () => (organization ? { ok: true, organizationId: organization } : { ok: false }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    supabaseHeaders: () => ({ apikey: "server-only" })
  });
  return { app, calls };
}

// A POST to customer_invoices, which is the invoice itself. The lines go to
// customer_invoice_lines, and matching on the shorter name would count both.
const invoiceWrites = (calls) => calls.filter((call) =>
  call.method === "POST" && /\/customer_invoices(\?|$)/.test(call.href.split("/rest/v1/")[1] ? `/${call.href.split("/rest/v1/")[1]}` : ""));
const scheduleUpdates = (calls) => calls.filter((call) => call.method === "PATCH" && call.href.includes("/recurring_invoices"));

describe("a standing arrangement bills once", () => {
  let savedFetch;
  before(() => { savedFetch = global.fetch; });
  after(() => { global.fetch = savedFetch; });

  describe("the schema it writes to", () => {
    it("names only columns the tables actually have", () => {
      // Seventeen owner forms once shipped naming a column that did not exist;
      // every save failed in production while the tests passed against a stub.
      // This reads supabase/migrations rather than trusting the route.
      for (const [table, columns] of [
        ["recurring_invoices", ["organization_id", "customer_id", "label", "cadence", "anchor_day", "starts_on", "ends_on", "payment_terms_days", "tax_rate_basis_points", "currency", "last_issued_on", "last_run_at", "created_by", "enabled", "notes"]],
        ["recurring_invoice_lines", ["organization_id", "recurring_invoice_id", "description", "quantity", "unit_price_cents", "position"]],
        ["customer_invoices", ["recurring_invoice_id", "issued_on", "due_on", "subtotal_cents", "tax_cents", "total_cents", "currency", "status", "customer_id", "invoice_number"]],
        ["customer_invoice_lines", ["organization_id", "invoice_id", "description", "quantity", "unit_price_cents", "line_total_cents", "service_id"]]
      ]) {
        // hasColumn rather than describedColumns. The latter deliberately
        // omits columns added by a later `alter table` -- it exists to render
        // form fields and will not guess a type it never read -- and
        // customer_invoices.recurring_invoice_id is added exactly that way.
        // Asking the wrong one reports a column that is really there as absent.
        assert.ok((tableColumns(table)?.size || 0) > 0, `no columns found for ${table}, so this check is looking at nothing`);
        for (const column of columns) assert.ok(hasColumn(table, column), `${table} has no column ${column}`);
      }
    });
  });

  describe("running it", () => {
    it("creates a draft invoice for an arrangement that is due", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      assert.equal(response.status, 303);
      assert.match(response.headers.location, /done=1/);

      const writes = invoiceWrites(calls);
      assert.equal(writes.length, 1);
      assert.equal(writes[0].body.organization_id, ORG);
      assert.equal(writes[0].body.recurring_invoice_id, SCHEDULE);
      assert.equal(writes[0].body.customer_id, CUSTOMER);
      assert.equal(writes[0].body.status, "draft", "an invoice went to a customer without the business deciding to send it");
      assert.equal(writes[0].body.total_cents, 120000);
    });

    it("leaves the invoice number empty rather than inventing one", async () => {
      // There is no numbering scheme here. A made-up number disagrees with
      // whatever the business already uses on paper, and a duplicate invoice
      // number is an accounting problem rather than a cosmetic one.
      const { app, calls } = buildApp();
      await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      assert.equal(invoiceWrites(calls)[0].body.invoice_number, null);
    });

    it("does nothing for an arrangement that is not due", async () => {
      const soon = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
      const { app, calls } = buildApp({ schedules: [dueSchedule({ starts_on: soon, last_issued_on: null })] });
      const response = await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      assert.match(response.headers.location, /done=0/);
      assert.equal(invoiceWrites(calls).length, 0);
    });

    it("does nothing for one that is switched off", async () => {
      const { app, calls } = buildApp({ schedules: [dueSchedule({ enabled: false })] });
      await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      assert.equal(invoiceWrites(calls).length, 0);
    });

    it("moves the arrangement on only after the invoice exists", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      const invoiceAt = calls.findIndex((call) => call.method === "POST" && call.href.includes("/customer_invoices"));
      const updateAt = calls.findIndex((call) => call.method === "PATCH" && call.href.includes("/recurring_invoices"));
      assert.ok(invoiceAt >= 0 && updateAt > invoiceAt,
        "last_issued_on is written before the invoice, so a failed insert still moves the arrangement on and that period is never billed");
      assert.equal(scheduleUpdates(calls)[0].body.last_issued_on, "2020-02-01");
    });

    it("does not move it on when the invoice could not be written", async () => {
      const { app, calls } = buildApp({ invoiceStatus: 500 });
      const response = await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      assert.equal(scheduleUpdates(calls).length, 0, "a period was skipped and nobody will ever bill it");
      assert.match(response.headers.location, /problem=partial/);
      assert.match(response.headers.location, /done=0/);
    });

    it("treats the duplicate index doing its job as already done, not as a failure", async () => {
      // 409 is the unique index on (recurring_invoice_id, issued_on) catching a
      // race. Nothing is wrong and nothing was billed twice, so it must not be
      // reported to the owner as an arrangement that failed.
      const { app, calls } = buildApp({ invoiceStatus: 409 });
      const response = await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      assert.ok(!/problem=partial/.test(response.headers.location), "a prevented double-bill was reported as a failure");
      assert.match(response.headers.location, /done=0/);
      assert.equal(scheduleUpdates(calls).length, 0);
    });

    it("refuses to run at all when the lines could not be read", async () => {
      // Issuing from arrangements whose lines are missing would bill for
      // nothing on every one of them.
      const { app, calls } = buildApp({ linesOk: false });
      const response = await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      assert.equal(invoiceWrites(calls).length, 0);
      assert.match(response.headers.location, /problem=not_saved/);
    });

    it("reports the ones it could not build rather than dropping them", async () => {
      const { app, calls } = buildApp({ lines: [] });
      const response = await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      assert.equal(invoiceWrites(calls).length, 0, "an arrangement with nothing on it billed for nothing");
      assert.match(response.headers.location, /problem=partial/);
    });

    it("filters every read and every write by the business", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/business/recurring/run").type("form").send({}).redirects(0);
      const reads = calls.filter((call) => call.method === "GET");
      assert.ok(reads.length > 0, "nothing was read, so this check is looking at nothing");
      for (const read of reads) {
        assert.ok(read.href.includes(`organization_id=eq.${ORG}`), `a read carried no tenant filter: ${read.href}`);
      }
      for (const write of calls.filter((call) => call.method === "POST")) {
        const rows = Array.isArray(write.body) ? write.body : [write.body];
        for (const row of rows) assert.equal(row.organization_id, ORG, `a write carried the wrong tenant: ${write.href}`);
      }
      for (const patch of calls.filter((call) => call.method === "PATCH")) {
        assert.ok(patch.href.includes(`organization_id=eq.${ORG}`), `a patch carried no tenant filter: ${patch.href}`);
      }
    });
  });

  describe("the page", () => {
    it("says what is due and offers to create it", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE).redirects(0);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes("Monthly retainer"));
      assert.ok(response.text.includes("Ready to issue"));
      assert.ok(response.text.includes("Create 1 draft invoice"));
    });

    it("says it could not read them rather than saying there are none", async () => {
      // "You have no arrangements" invites somebody to set up a second copy of
      // one they already have.
      const { app } = buildApp({ schedulesOk: false });
      const response = await request(app).get(PAGE).redirects(0);
      assert.ok(response.text.includes("could not read your arrangements"));
      assert.ok(!response.text.includes("no standing arrangements yet"));
    });

    it("warns rather than showing amounts as zero when the lines are unreadable", async () => {
      const { app } = buildApp({ linesOk: false });
      const response = await request(app).get(PAGE).redirects(0);
      assert.ok(response.text.includes("missing rather than zero"));
    });

    it("does not offer to set one up with nobody to bill", async () => {
      const { app } = buildApp({ customers: [] });
      const response = await request(app).get(PAGE).redirects(0);
      assert.ok(response.text.includes("Add a customer first"));
    });
  });

  describe("setting one up", () => {
    it("refuses a start date that is not one, and writes nothing", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring").type("form")
        .send({ customer_id: CUSTOMER, starts_on: "soon", description: "Retainer", quantity: "1", unit_price: "1200" }).redirects(0);
      assert.match(response.headers.location, /problem=dates/);
      assert.equal(calls.filter((call) => call.method === "POST").length, 0);
    });

    it("refuses an end date before the start", async () => {
      const { app } = buildApp();
      const response = await request(app).post("/api/business/recurring").type("form")
        .send({ customer_id: CUSTOMER, starts_on: "2026-06-01", ends_on: "2026-05-01", description: "R", quantity: "1", unit_price: "10" }).redirects(0);
      assert.match(response.headers.location, /problem=dates/);
    });

    it("refuses a line with no price rather than setting up an arrangement that bills nothing", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring").type("form")
        .send({ customer_id: CUSTOMER, starts_on: "2026-06-01", description: "Retainer", quantity: "1" }).redirects(0);
      assert.match(response.headers.location, /problem=line/);
      assert.equal(calls.filter((call) => call.method === "POST").length, 0);
    });

    it("stores a tax percentage as basis points", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/business/recurring").type("form")
        .send({ customer_id: CUSTOMER, starts_on: "2026-06-01", description: "R", quantity: "1", unit_price: "100", tax_percent: "20" }).redirects(0);
      const write = calls.find((call) => call.method === "POST" && call.href.includes("/recurring_invoices"));
      assert.equal(write.body.tax_rate_basis_points, 2000, "20 percent must be 2000 basis points, or every invoice's tax is wrong by a factor of a hundred");
    });

    it("stores a price in cents", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/business/recurring").type("form")
        .send({ customer_id: CUSTOMER, starts_on: "2026-06-01", description: "R", quantity: "1", unit_price: "1200.50" }).redirects(0);
      const line = calls.find((call) => call.method === "POST" && call.href.includes("/recurring_invoice_lines"));
      assert.equal(line.body.unit_price_cents, 120050);
    });

    it("takes the business from the session and not from the form", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/business/recurring").type("form")
        .send({ customer_id: CUSTOMER, starts_on: "2026-06-01", description: "R", quantity: "1", unit_price: "10", organization_id: "ffffffff-0000-4000-8000-0000000000ff" }).redirects(0);
      const write = calls.find((call) => call.method === "POST" && call.href.includes("/recurring_invoices"));
      assert.equal(write.body.organization_id, ORG);
    });
  });
});
