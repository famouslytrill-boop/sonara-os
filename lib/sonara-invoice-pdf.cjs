"use strict";

// An invoice as a file, rather than a page.
//
// `/shared/:token` already publishes an invoice a customer can open. What it
// could not do is give them something to keep: a page is fine to look at,
// impossible to file with an accountant, and awkward to attach to an email.
// This is the same invoice as a PDF, built with `lib/sonara-pdf.cjs` and
// therefore with nothing installed.
//
// ## It shows exactly what the shared page shows
//
// The columns are the ones `lib/sonara-shared-results.cjs` reviewed and allows
// -- and nothing else. `notes`, `customer_id`, `quote_id`, `created_by` and
// `metadata` are forbidden there because a link gets forwarded and whoever
// forwards it is not deciding to publish those. A PDF is forwarded more easily
// than a link, so the same list holds, and a test asserts the two agree rather
// than trusting this comment.
//
// ## The balance, not just the total
//
// A business that took a deposit and then sent its customer the whole figure
// again is the defect `lib/sonara-invoice-settlement.cjs` was written for. This
// renders whatever that module says: paid, part paid with a balance, or -- when
// the payments could not be read -- that the balance is not known, rather than
// printing the total as though nothing had been paid.
//
// ## Never a payment instruction
//
// There is no Stripe Connect here, and the shared invoice already tells its
// reader never to pay from a link. A PDF carrying a pay button, a bank account
// or a QR code to somewhere would make that sentence false in the one artifact
// most likely to be forwarded to somebody who never saw the page.

const { createDocument, A4 } = require("./sonara-pdf.cjs");

const MARGIN = 48;
const RIGHT = A4.width - MARGIN;

// Column left edges, and the right edge money is aligned against.
const COLUMNS = Object.freeze({
  description: MARGIN,
  quantity: 330,
  unitPrice: 415,
  lineTotal: RIGHT
});

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Integer cents to a string somebody reads. Never prints a bare cent count at
// a customer, and never prints "0.00" for a figure that is simply absent --
// Number(null) is 0, and an unpriced line rendering as free is how twenty-three
// columns once read wrong.
function money(cents, currency = "usd") {
  const amount = finiteNumber(cents);
  if (amount === null) return null;
  return `${String(currency).toUpperCase()} ${(amount / 100).toFixed(2)}`;
}

function plainDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const time = new Date(text).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Render one invoice.
 *
 *   invoice     the customer_invoices row, with only the reviewed columns
 *   lines       the customer_invoice_lines rows
 *   settlement  whatever lib/sonara-invoice-settlement.cjs said, or null
 *   business    { name } -- what to put at the top. Never invented.
 *
 * Returns a Buffer. Never throws on thin data: an invoice with no lines, no
 * number and no dates still produces a document, because somebody clicked
 * download and a zero-byte response looks like a broken link.
 */
function renderInvoicePdf({ invoice = {}, lines = [], settlement = null, business = {} } = {}) {
  const doc = createDocument({ size: A4, margin: MARGIN });
  const currency = String(invoice.currency || "usd");
  let y = MARGIN;

  const businessName = String(business.name || "").trim();
  doc.text(businessName || "Invoice", { x: MARGIN, y, font: "bold", size: 20 });

  const number = String(invoice.invoice_number || "").trim();
  doc.text(number ? `Invoice ${number}` : "Invoice", { x: RIGHT, y: y + 2, align: "right", font: "bold", size: 12 });
  y += 30;

  const issued = plainDate(invoice.issued_on);
  const due = plainDate(invoice.due_on);
  // "Not set" rather than a blank or an invented date. A due date nobody chose
  // is not a due date of today.
  doc.text(`Issued: ${issued || "Not set"}`, { x: RIGHT, y, align: "right", size: 9.5 });
  y += 14;
  doc.text(`Due: ${due || "Not set"}`, { x: RIGHT, y, align: "right", size: 9.5 });
  y += 26;

  doc.rect(MARGIN, y - 4, RIGHT - MARGIN, 20, { grey: 0.94 });
  doc.text("Description", { x: COLUMNS.description + 6, y, font: "bold", size: 9.5 });
  doc.text("Qty", { x: COLUMNS.quantity, y, font: "bold", size: 9.5 });
  doc.text("Unit", { x: COLUMNS.unitPrice, y, font: "bold", size: 9.5 });
  doc.text("Amount", { x: COLUMNS.lineTotal - 6, y, align: "right", font: "bold", size: 9.5 });
  y += 24;

  const rows = Array.isArray(lines) ? lines : [];
  if (!rows.length) {
    doc.text("This invoice has no lines on it.", { x: MARGIN + 6, y, size: 10 });
    y += 20;
  }

  for (const row of rows) {
    const description = String(row.description || "").trim() || "No description";
    const wrapped = doc.wrap(description, COLUMNS.quantity - MARGIN - 18, { size: 10 });
    wrapped.forEach((line, index) => doc.text(line, { x: COLUMNS.description + 6, y: y + index * 13, size: 10 }));

    const quantity = finiteNumber(row.quantity);
    doc.text(quantity === null ? "-" : String(quantity), { x: COLUMNS.quantity, y, size: 10 });
    doc.text(money(row.unit_price_cents, currency) || "-", { x: COLUMNS.unitPrice, y, size: 10 });
    doc.text(money(row.line_total_cents, currency) || "-", { x: COLUMNS.lineTotal - 6, y, align: "right", size: 10 });

    y += Math.max(wrapped.length * 13, 13) + 6;
    doc.line(MARGIN, y - 4, RIGHT, y - 4, { grey: 0.9 });
  }

  y += 10;
  const totals = [
    ["Subtotal", money(invoice.subtotal_cents, currency)],
    ["Tax", money(invoice.tax_cents, currency)],
    ["Total", money(invoice.total_cents, currency)]
  ];
  for (const [label, value] of totals) {
    if (value === null) continue;
    const bold = label === "Total";
    doc.text(label, { x: COLUMNS.unitPrice, y, size: bold ? 11 : 10, font: bold ? "bold" : "regular" });
    doc.text(value, { x: RIGHT, y, align: "right", size: bold ? 11 : 10, font: bold ? "bold" : "regular" });
    y += bold ? 20 : 15;
  }

  // The settlement line. Three states, and the third is the one that matters:
  // an unreadable payments table must not print as an unpaid invoice.
  if (settlement) {
    y += 6;
    if (settlement.status === "unknown") {
      doc.text("The amount paid could not be read, so the balance is not shown here.",
        { x: MARGIN, y, size: 9.5, colour: [0.45, 0.3, 0] });
    } else {
      const paid = money(settlement.paidCents, currency);
      const balance = money(settlement.balanceCents, currency);
      if (paid) {
        doc.text("Paid", { x: COLUMNS.unitPrice, y, size: 10 });
        doc.text(paid, { x: RIGHT, y, align: "right", size: 10 });
        y += 15;
      }
      if (balance) {
        doc.text("Balance due", { x: COLUMNS.unitPrice, y, font: "bold", size: 11 });
        doc.text(balance, { x: RIGHT, y, align: "right", font: "bold", size: 11 });
        y += 20;
      }
    }
  }

  y += 16;
  doc.line(MARGIN, y, RIGHT, y, { grey: 0.85 });
  y += 14;
  // The same sentence the shared page carries, and for the same reason: it only
  // protects anybody if it is always true, on every artifact.
  doc.paragraph(
    "Never pay an invoice from a link or a document you were sent. If you were expecting this and want to pay it, "
    + "contact the business using details you already had.",
    { x: MARGIN, y, width: RIGHT - MARGIN, size: 9 }
  );

  return doc.toBuffer();
}

module.exports = { renderInvoicePdf, money, plainDate, COLUMNS };
