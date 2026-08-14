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
});
