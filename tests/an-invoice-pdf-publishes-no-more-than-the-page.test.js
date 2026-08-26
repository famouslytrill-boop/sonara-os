"use strict";

// The PDF must publish exactly what the shared page publishes, and no more.
//
// A link gets forwarded, and lib/sonara-shared-results.cjs already decided
// which invoice columns a stranger holding one may see -- and which they may
// not: `notes` is where a business writes things about a customer rather than
// for them, and `customer_id`, `quote_id`, `created_by` and `metadata` are
// internal.
//
// A PDF is forwarded more easily than a link, so the same list has to hold. It
// is checked against that module's own declaration rather than against a copy,
// because a copy is a list that agrees on the day it is written.

const assert = require("node:assert/strict");
const zlib = require("node:zlib");

const { renderInvoicePdf, money } = require("../lib/sonara-invoice-pdf.cjs");
const shared = require("../lib/sonara-shared-results.cjs");

// Everything a viewer would draw, read out of the file's own streams.
function textOf(buffer) {
  const raw = buffer.toString("latin1");
  const out = [];
  const streamPattern = /\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g;
  let match;
  while ((match = streamPattern.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const inflated = zlib.inflateSync(buffer.subarray(start, start + Number(match[1]))).toString("latin1");
    for (const found of inflated.matchAll(/\((.*?)\)\s*Tj/gs)) {
      out.push(found[1].replace(/\\([\\()])/g, "$1"));
    }
  }
  return out;
}

const SECRET = {
  notes: "ALWAYS-LATE-CHASE-TWICE",
  customer_id: "cus-11111111",
  quote_id: "quo-22222222",
  created_by: "staff-33333333",
  metadata: { internal: "do-not-publish" }
};

const INVOICE = {
  invoice_number: "INV-1042",
  issued_on: "2026-08-01",
  due_on: "2026-08-31",
  subtotal_cents: 120000,
  tax_cents: 24000,
  total_cents: 144000,
  currency: "gbp",
  status: "sent",
  ...SECRET
};

const LINES = [
  { description: "Boiler service", quantity: 1, unit_price_cents: 90000, line_total_cents: 90000, metadata: { cost: 1 }, service_id: "svc-9" },
  { description: "Callout", quantity: 2, unit_price_cents: 15000, line_total_cents: 30000 }
];

describe("an invoice PDF publishes no more than the page", () => {
  const buffer = renderInvoicePdf({
    business: { name: "Bright Plumbing" },
    invoice: INVOICE,
    lines: LINES,
    settlement: { status: "part_paid", paidCents: 50000, balanceCents: 94000 }
  });
  const drawn = textOf(buffer).join("\n");

  it("has something to check, so this is not passing on an empty document", () => {
    assert.ok(buffer.length > 500, "the document is too small to contain an invoice");
    assert.ok(drawn.includes("INV-1042"), "the invoice number is not in the file");
    assert.ok(drawn.includes("Bright Plumbing"));
  });

  it("carries none of the fields the shared link declares forbidden", () => {
    // Read from that module's own declaration, with no fallback. A default
    // here would let this pass against a copy of the list on the day somebody
    // renamed the export -- which is exactly what the test says it does not do.
    const declared = shared.SHAREABLE.customer_invoice;
    assert.ok(declared, "lib/sonara-shared-results.cjs no longer declares customer_invoice");
    const forbidden = declared.forbidden;
    assert.ok(Array.isArray(forbidden) && forbidden.length >= 4,
      "the forbidden list has thinned out or moved; this check is looking at almost nothing");
    for (const field of forbidden) {
      const value = SECRET[field];
      if (value === undefined) continue;
      const needle = typeof value === "object" ? Object.values(value)[0] : String(value);
      assert.ok(!drawn.includes(needle), `the PDF published ${field}`);
    }
  });

  it("publishes no line-level internals either", () => {
    assert.ok(!drawn.includes("svc-9"), "a service id reached the customer's copy");
  });

  it("shows the figures a customer is owed sight of", () => {
    assert.ok(drawn.includes(money(120000, "gbp")), "the subtotal is missing");
    assert.ok(drawn.includes(money(24000, "gbp")), "the tax is missing");
    assert.ok(drawn.includes(money(144000, "gbp")), "the total is missing");
  });

  it("shows the balance rather than the total again, when a deposit was taken", () => {
    assert.ok(drawn.includes("Balance due"), "a part-paid invoice shows no balance");
    assert.ok(drawn.includes(money(94000, "gbp")), "the balance figure is missing");
  });

  it("says the balance is not known rather than printing the total as unpaid", () => {
    // An unreadable payments table is not an invoice nobody has paid.
    const unknown = textOf(renderInvoicePdf({
      invoice: { total_cents: 144000, currency: "gbp" },
      settlement: { status: "unknown" }
    })).join("\n");
    assert.ok(unknown.includes("could not be read"), "an unknown settlement rendered silently");
    assert.ok(!unknown.includes("Balance due"), "a balance was shown for payments that could not be read");
  });

  it("never prints an absent figure as zero", () => {
    // Number(null) is 0, and an unpriced line rendering as free is the defect
    // this codebase names by number.
    const thin = textOf(renderInvoicePdf({
      invoice: { currency: "gbp" },
      lines: [{ description: "Unpriced", quantity: 1, unit_price_cents: null, line_total_cents: null }]
    })).join("\n");
    assert.ok(!thin.includes("GBP 0.00"), "an absent price was printed as zero");
    assert.ok(thin.includes("-"), "an absent price was printed as nothing at all");
  });

  it("says Not set for a date nobody chose", () => {
    const undated = textOf(renderInvoicePdf({ invoice: { currency: "gbp" } })).join("\n");
    assert.ok(undated.includes("Not set"), "a missing due date rendered as blank or as today");
  });

  it("grows no way to pay it", () => {
    // There is no Stripe Connect here, and the shared page tells its reader
    // never to pay from a link. A PDF is forwarded more easily than a link, so
    // the sentence has to be true here too.
    for (const term of ["Pay now", "pay online", "IBAN", "sort code", "account number", "checkout"]) {
      assert.ok(!drawn.toLowerCase().includes(term.toLowerCase()), `the PDF offers a way to pay: ${term}`);
    }
    assert.ok(drawn.includes("Never pay an invoice from a link"), "the warning the page carries is missing from the file");
  });

  it("produces a document from nothing rather than an empty response", () => {
    const empty = renderInvoicePdf({});
    assert.ok(empty.length > 400, "an empty invoice produced something too small to be a file");
    assert.ok(textOf(empty).join("\n").includes("no lines on it"));
  });
});
