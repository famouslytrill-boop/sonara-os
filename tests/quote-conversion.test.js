"use strict";

const assert = require("node:assert/strict");
const convert = require("../lib/sonara-quote-conversion.cjs");
const { describedColumns } = require("../lib/sonara-migration-columns.cjs");

const ORG = "11111111-1111-1111-1111-111111111111";

function quote(overrides = {}) {
  return { id: "q-1", status: "accepted", customer_id: "c-1", amount_cents: 42000, title: "Bathroom rewire", ...overrides };
}

describe("turning a won quote into an invoice", () => {
  it("writes only columns the invoice and line tables actually have", () => {
    const invoiceColumns = new Set((describedColumns("customer_invoices") || []).map((column) => column.name));
    const lineColumns = new Set((describedColumns("customer_invoice_lines") || []).map((column) => column.name));
    assert.ok(invoiceColumns.size > 0 && lineColumns.size > 0, "the migrations were not read");

    const wrong = [];
    for (const key of Object.keys(convert.invoiceFromQuote(quote(), { organizationId: ORG }))) {
      if (!invoiceColumns.has(key)) wrong.push(`customer_invoices has no column ${key}`);
    }
    for (const key of Object.keys(convert.lineFromQuote(quote(), { organizationId: ORG }))) {
      if (!lineColumns.has(key)) wrong.push(`customer_invoice_lines has no column ${key}`);
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("converts an accepted quote", () => {
    assert.equal(convert.reasonNotConvertible(quote(), []), null);
  });

  it("refuses a quote that was only sent, because sent is not agreed", () => {
    const reason = convert.reasonNotConvertible(quote({ status: "sent" }), []);
    assert.match(reason, /not accepted yet/);
  });

  it("refuses a declined or draft quote", () => {
    for (const status of ["draft", "declined", "expired", ""]) {
      assert.ok(convert.reasonNotConvertible(quote({ status }), []), `${status || "(blank)"} must not convert`);
    }
  });

  it("refuses a quote with no customer, because the invoice would have nobody to go to", () => {
    assert.match(convert.reasonNotConvertible(quote({ customer_id: null }), []), /nobody to go to/);
  });

  it("refuses a quote with no amount rather than raising an invoice for nothing", () => {
    for (const amount of [0, null, undefined, "abc", -100]) {
      assert.ok(convert.reasonNotConvertible(quote({ amount_cents: amount }), []), `${amount} must not convert`);
    }
  });

  it("refuses to invoice the same quote twice", () => {
    // A double submit, a refresh, or two presses bills one job twice, and the
    // second invoice looks exactly as legitimate as the first.
    const existing = [{ id: "inv-1", quote_id: "q-1", invoice_number: "AR-9" }];
    assert.match(convert.reasonNotConvertible(quote(), existing), /already been invoiced as AR-9/);
  });

  it("does not confuse another quote's invoice for this one's", () => {
    const existing = [{ id: "inv-1", quote_id: "q-2", invoice_number: "AR-9" }];
    assert.equal(convert.reasonNotConvertible(quote(), existing), null);
  });

  it("carries the amount across without altering it", () => {
    const invoice = convert.invoiceFromQuote(quote(), { organizationId: ORG });
    assert.equal(invoice.total_cents, 42000);
    assert.equal(invoice.subtotal_cents, 42000);
    assert.equal(invoice.quote_id, "q-1");
    assert.equal(invoice.customer_id, "c-1");
    assert.equal(invoice.organization_id, ORG);
  });

  it("starts as a draft rather than deciding it is ready to send", () => {
    assert.equal(convert.invoiceFromQuote(quote(), { organizationId: ORG }).status, "draft");
  });

  it("sets no due date, because payment terms are recorded nowhere", () => {
    // An invented due date is worse than none: customer_invoices_overdue would
    // then chase a deadline nobody agreed to.
    const invoice = convert.invoiceFromQuote(quote(), { organizationId: ORG });
    assert.equal("due_on" in invoice, false);
  });

  it("gives the invoice a line so it is not a total with nothing behind it", () => {
    const line = convert.lineFromQuote(quote(), { organizationId: ORG });
    assert.equal(line.line_total_cents, 42000);
    assert.equal(line.description, "Bathroom rewire");
  });

  it("still describes a quote with no title rather than writing an empty line", () => {
    assert.equal(convert.lineFromQuote(quote({ title: "  " }), { organizationId: ORG }).description, "Work as quoted");
  });

  it("refuses to build anything without an organization", () => {
    assert.throws(() => convert.invoiceFromQuote(quote(), {}), /organizationId/);
    assert.throws(() => convert.lineFromQuote(quote(), {}), /organizationId/);
  });
});
