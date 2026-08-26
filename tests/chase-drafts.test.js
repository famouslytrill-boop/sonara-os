"use strict";

const assert = require("node:assert/strict");
const drafts = require("../lib/sonara-chase-drafts.cjs");
const { classifyAction } = require("../lib/sonara-agent-authority.cjs");

const NOW = Date.parse("2026-08-12T12:00:00.000Z");

function day(offset) {
  return new Date(NOW + offset * 86400000).toISOString().slice(0, 10);
}

function invoice(overrides = {}) {
  return { id: "i1", invoice_number: "AR-1", due_on: day(-20), total_cents: 50000, status: "sent", customer_id: "c1", ...overrides };
}

const CUSTOMERS = new Map([["c1", { name: "Halton Facilities", email: "ap@example.com" }]]);

function build(overrides = {}) {
  return drafts.build({ invoices: [invoice()], customersById: CUSTOMERS, businessName: "Redgate Plumbing", now: NOW, ...overrides });
}

describe("drafting a chase for an overdue invoice", () => {
  it("drafts under an action the rules allow, and sending is not one", () => {
    // The whole design rests on this split, so it is asserted rather than
    // assumed: writing is self-serve, anything that sends falls to the owner.
    assert.equal(classifyAction("draft_reply").requiresOwnerApproval, false);
    for (const sending of ["send_invoice_reminder", "email_customer", "chase_overdue_invoice"]) {
      assert.equal(classifyAction(sending).requiresOwnerApproval, true, `${sending} must need the owner`);
    }
  });

  it("escalates by how overdue the invoice actually is", () => {
    assert.equal(drafts.stageFor(drafts.daysOverdue(day(-3), NOW)).key, "gentle");
    assert.equal(drafts.stageFor(drafts.daysOverdue(day(-20), NOW)).key, "firm");
    assert.equal(drafts.stageFor(drafts.daysOverdue(day(-90), NOW)).key, "final");
  });

  it("writes nothing for an invoice that is not yet due", () => {
    assert.equal(drafts.daysOverdue(day(3), NOW), null);
    assert.equal(build({ invoices: [invoice({ due_on: day(3) })] }).drafts.length, 0);
    assert.equal(build({ invoices: [invoice({ due_on: day(0) })] }).drafts.length, 0, "due today is not overdue");
  });

  it("writes nothing for a draft invoice the customer has never seen", () => {
    assert.equal(build({ invoices: [invoice({ status: "draft" })] }).drafts.length, 0);
  });

  it("states the real outstanding amount, not the invoice total", () => {
    const result = build({ paidByInvoice: new Map([["i1", 20000]]) });
    assert.equal(result.drafts[0].outstandingCents, 30000);
    assert.match(result.drafts[0].body, /\$300\.00/);
    assert.doesNotMatch(result.drafts[0].body, /\$500\.00/, "chasing the full total after a part payment is the fastest way to lose a customer");
  });

  it("groups thousands, because the customer reads this figure", () => {
    const result = build({ invoices: [invoice({ total_cents: 1840000 })] });
    assert.match(result.drafts[0].subject, /\$18,400\.00/);
  });

  it("reports an invoice it cannot write about instead of dropping it", () => {
    // A shorter list with no explanation reads as less debt.
    const result = build({ invoices: [invoice({ customer_id: null })] });
    assert.equal(result.drafts.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /nobody to address/);
  });

  it("reports a fully paid invoice still marked sent rather than chasing it", () => {
    const result = build({ paidByInvoice: new Map([["i1", 50000]]) });
    assert.equal(result.drafts.length, 0);
    assert.match(result.skipped[0].reason, /paid in full/);
  });

  it("never claims a reminder was already sent", () => {
    // Nothing records how many were sent, so any such sentence can be false to
    // the customer's face.
    for (const stage of ["gentle", "firm", "final"]) {
      const offset = stage === "gentle" ? -3 : stage === "firm" ? -20 : -90;
      const body = build({ invoices: [invoice({ due_on: day(offset) })] }).drafts[0].body;
      assert.doesNotMatch(body, /already (reminded|sent|chased)|second reminder|third reminder|as we (have )?(previously|already)/i, `the ${stage} draft claims a prior reminder`);
    }
  });

  it("never invents payment terms, interest or a late fee", () => {
    for (const offset of [-3, -20, -90]) {
      const body = build({ invoices: [invoice({ due_on: day(offset) })] }).drafts[0].body;
      assert.doesNotMatch(body, /late fee|interest|penalt|surcharge|per cent|%|net \d+|payment terms/i, `a draft names a term no table holds (${offset} days)`);
    }
  });

  it("never threatens legal action, collection or credit reporting", () => {
    for (const offset of [-3, -20, -90]) {
      const body = build({ invoices: [invoice({ due_on: day(offset) })] }).drafts[0].body;
      assert.doesNotMatch(body, /legal|court|solicitor|lawyer|debt collect|collections agency|credit (report|agency|rating)|small claims/i, `a draft threatens a step the owner has not decided (${offset} days)`);
    }
  });

  it("marks the signature rather than guessing the business name", () => {
    const result = build({ businessName: "  " });
    assert.match(result.drafts[0].body, /\[your business name\]/);
  });

  it("puts the most overdue first, because that is the one to send", () => {
    const result = build({
      invoices: [
        invoice({ id: "a", invoice_number: "AR-1", due_on: day(-5) }),
        invoice({ id: "b", invoice_number: "AR-2", due_on: day(-60) })
      ]
    });
    assert.deepEqual(result.drafts.map((entry) => entry.reference), ["AR-2", "AR-1"]);
  });

  it("survives a malformed row rather than failing the page", () => {
    const result = drafts.build({
      invoices: [null, {}, invoice({ due_on: "not-a-date" }), invoice({ total_cents: "abc" })],
      customersById: CUSTOMERS,
      now: NOW
    });
    assert.ok(Array.isArray(result.drafts));
  });


  // Found by the selected-columns hunt: `customers.ok` was computed, pushed
  // into `unavailable`, and then thrown away before build() ran. An unreadable
  // customer table produced an empty map, and every overdue invoice came back
  // reported as "not attached to a customer" -- a specific, false claim about
  // the owner's own records, carrying an instruction they would go and act on.
  describe("when the customer list could not be read", () => {
    const OVERDUE = [{
      id: "inv-1", invoice_number: "INV-001", status: "sent",
      due_on: "2026-07-01", total_cents: 50000, customer_id: "cus-1"
    }];

    it("does not claim the invoice has no customer on it", () => {
      const result = build({
        invoices: OVERDUE,
        customersById: new Map(),
        customersRead: false,
        now: Date.parse("2026-08-01T00:00:00Z")
      });
      assert.equal(result.drafts.length, 0);
      assert.equal(result.skipped.length, 1);
      assert.ok(
        !/not attached to a customer/.test(result.skipped[0].reason),
        "an unreadable customer table was reported as an invoice with no customer set on it"
      );
      assert.ok(
        !/Set the customer on the invoice/.test(result.skipped[0].reason),
        "the owner was told to go and fix data that is not broken"
      );
      assert.match(result.skipped[0].reason, /customer list could not be read/);
    });

    it("marks the cause, so a page can tell the two apart without matching on prose", () => {
      const unreadable = build({ invoices: OVERDUE, customersById: new Map(), customersRead: false, now: Date.parse("2026-08-01T00:00:00Z") });
      const genuinely = build({ invoices: OVERDUE, customersById: new Map(), customersRead: true, now: Date.parse("2026-08-01T00:00:00Z") });
      assert.equal(unreadable.skipped[0].cause, "unreadable");
      assert.equal(genuinely.skipped[0].cause, "invoice");
    });

    it("still says the invoice is one it could not write about", () => {
      // The invoice must not vanish. A shorter list with no explanation reads
      // as less debt, which is the failure this whole module was written for.
      const result = build({ invoices: OVERDUE, customersById: new Map(), customersRead: false, now: Date.parse("2026-08-01T00:00:00Z") });
      assert.equal(result.skipped[0].reference, "INV-001");
    });

    it("keeps saying not attached when the list WAS readable and the invoice really has none", () => {
      const result = build({
        invoices: OVERDUE,
        customersById: new Map(),
        customersRead: true,
        now: Date.parse("2026-08-01T00:00:00Z")
      });
      assert.match(result.skipped[0].reason, /not attached to a customer/,
        "the honest message was lost along with the dishonest one");
      assert.match(result.skipped[0].reason, /Set the customer on the invoice/);
    });

    it("defaults to treating the list as readable, so existing callers are unchanged", () => {
      const result = build({
        invoices: OVERDUE,
        customersById: new Map(),
        now: Date.parse("2026-08-01T00:00:00Z")
      });
      assert.equal(result.skipped[0].cause, "invoice");
    });
  });

});

// Driven through the real route, because the bug was in the wiring rather than
// in the builder.
//
// `customers.ok` was computed, pushed into `unavailable`, and then dropped
// before build() was called. Every unit test of build() passed, and every one
// of them would go on passing if somebody deleted the argument again -- which a
// probe confirmed. The claim this protects is made on a page, so it is checked
// on a page.
describe("the chase page, when a table will not load", () => {
  const express = require("express");
  const request = require("supertest");
  const registerRoutes = require("../routes/sonara-assistant-routes.cjs");

  const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
  const OVERDUE_INVOICE = {
    id: "33333333-3333-4333-8333-333333333333",
    invoice_number: "INV-2026-014",
    status: "sent",
    due_on: "2026-07-01",
    total_cents: 120000,
    customer_id: "44444444-4444-4444-8444-444444444444"
  };

  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  function buildApp() {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    const authenticate = (req, res, next) => {
      req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" };
      req.sonaraAccess = { user: { id: "22222222-2222-4222-8222-222222222222" } };
      return next();
    };
    registerRoutes(app, {
      layout: ({ title, heading, body, sections = [] }) =>
        `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
      brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value),
      requireCustomer: authenticate,
      requireWorkspaceAccess: () => authenticate,
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID, organizationName: "Shared Co" }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
      supabaseHeaders: () => ({})
    });
    return app;
  }

  // `customersFail` is the whole point: everything else answers normally, so a
  // failure here cannot be confused with a page that could not load at all.
  function answering({ customersFail = false } = {}) {
    return async (url) => {
      const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
      if (table === "customers" && customersFail) {
        return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      }
      const rows = {
        customer_invoices: [OVERDUE_INVOICE],
        customer_invoice_payments: [],
        customers: [{ id: OVERDUE_INVOICE.customer_id, name: "A Real Customer", email: "them@example.com" }]
      }[table] || [];
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => rows };
    };
  }

  it("writes a draft when everything reads", async () => {
    global.fetch = answering();
    const response = await request(buildApp()).get("/business-builder/owner/chase-drafts").set("accept", "text/html");
    assert.equal(response.status, 200);
    assert.match(response.text, /A Real Customer/, "the happy path stopped drafting, so the checks below prove nothing");
    assert.match(response.text, /INV-2026-014/);
  });

  it("does not tell the owner to set a customer that is already set", async () => {
    global.fetch = answering({ customersFail: true });
    const response = await request(buildApp()).get("/business-builder/owner/chase-drafts").set("accept", "text/html");
    assert.equal(response.status, 200);
    assert.ok(
      !/Set the customer on the invoice/.test(response.text),
      "an unreadable customer table produced an instruction to go and fix an invoice that is not broken"
    );
    assert.ok(
      !/not attached to a customer/.test(response.text),
      "an unreadable customer table was reported as a specific fact about the invoice"
    );
  });

  it("says the customer list is what could not be read", async () => {
    global.fetch = answering({ customersFail: true });
    const response = await request(buildApp()).get("/business-builder/owner/chase-drafts").set("accept", "text/html");
    assert.match(response.text, /could not be read/i);
    assert.match(response.text, /your customers/i, "the page did not say which records were missing");
  });

  it("does not head the page with work for the owner to do", async () => {
    global.fetch = answering({ customersFail: true });
    const response = await request(buildApp()).get("/business-builder/owner/chase-drafts").set("accept", "text/html");
    assert.ok(
      !/see below for what each invoice needs first/.test(response.text),
      "the headline sent the owner to a list of reasons that are not about their invoices"
    );
    assert.match(response.text, /not a statement about what you are owed/);
  });

  it("never says nothing is overdue on the strength of a read that failed", async () => {
    global.fetch = answering({ customersFail: true });
    const response = await request(buildApp()).get("/business-builder/owner/chase-drafts").set("accept", "text/html");
    assert.ok(
      !/Nothing is overdue/.test(response.text),
      "a failed read was reported as a business with no overdue invoices, which is the most reassuring possible way to be wrong"
    );
  });

  it("still names the invoice it could not write about", async () => {
    // The invoice must not vanish. A shorter list with no explanation reads as
    // less debt, which is what this whole page exists to avoid.
    global.fetch = answering({ customersFail: true });
    const response = await request(buildApp()).get("/business-builder/owner/chase-drafts").set("accept", "text/html");
    assert.match(response.text, /INV-2026-014/, "the invoice disappeared from the page entirely");
  });
});
