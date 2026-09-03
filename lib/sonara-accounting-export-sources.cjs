"use strict";

// What an accounting export can actually be built from.
//
// This was written twice, and the two copies disagreed. The download route in
// routes/sonara-last9-routes.cjs knew how to build three kinds of file --
// bills, sales and inventory -- and refused everything else by name. The form
// on /business-builder/owner/accounting-exports offered six:
//
//     options: ["bills", "sales", "inventory", "payroll_summary", "journal_entries", "other"]
//
// So a business owner could ask for a payroll summary, watch the row appear on
// the page, and only discover on pressing Download that no such file exists.
// The refusal was well written and arrived far too late: the choice had already
// been offered, and offering a job nothing can do is the defect, not the
// wording of the apology.
//
// One table now, imported by both. The form cannot offer a type that has no
// source here, because the options ARE the keys.
//
// payroll_summary and journal_entries are deliberately absent rather than
// unfinished. Both need accounting judgement this code has not been given --
// what belongs in a journal line, and how gross pay reconciles to cost -- and
// producing them from guesses would put wrong figures in front of an
// accountant, which is worse than producing none. "other" is absent for a
// duller reason: it names no table, so there is nothing to read.
const ACCOUNTING_EXPORT_SOURCES = Object.freeze({
  bills: Object.freeze({
    table: "vendor_invoices",
    dateColumn: "created_at",
    columns: Object.freeze([
      "id", "created_at", "vendor_id", "invoice_number", "invoice_date", "due_date",
      "subtotal_cents", "tax_cents", "total_cents", "currency",
      "payment_status", "processing_status", "archived_at"
    ])
  }),
  sales: Object.freeze({
    table: "pos_sales_summaries",
    dateColumn: "created_at",
    columns: Object.freeze([
      "id", "created_at", "business_date",
      "gross_sales_cents", "discounts_cents", "refunds_cents", "net_sales_cents",
      "tax_cents", "tips_cents", "tickets_count", "source", "archived_at"
    ])
  }),
  inventory: Object.freeze({
    table: "inventory_items",
    dateColumn: "created_at",
    columns: Object.freeze([
      "id", "created_at", "name", "sku", "category", "unit",
      "quantity", "cost_cents", "price_cents", "reorder_level", "status", "archived_at"
    ])
  })
});

// Where the money is, per export, so a check can insist it is there. The first
// draft of this file named columns none of these tables have -- vendor_name,
// amount, gross_sales, quantity_on_hand -- and buildRecordCsv writes a blank
// cell for a header the row does not carry rather than refusing. So a bills
// export downloaded by an accountant had an "amount" column that was empty on
// every line, and no column carrying total_cents at all. The file opened, the
// row count was right, and the figures were gone.
//
// inventory has no single money column: quantity is the count, cost_cents is
// what one costs. Both are named, because an inventory file missing either is
// not an inventory file.
const MONEY_COLUMNS = Object.freeze({
  bills: Object.freeze(["total_cents"]),
  sales: Object.freeze(["gross_sales_cents", "net_sales_cents"]),
  inventory: Object.freeze(["quantity", "cost_cents"])
});

// The order the form offers them in, which is the order they are declared.
const ACCOUNTING_EXPORT_TYPES = Object.freeze(Object.keys(ACCOUNTING_EXPORT_SOURCES));

// Types a row may still carry from before the form was narrowed, each with the
// sentence the download route says when it refuses. Kept here rather than in the
// route so the reason and the absence sit together: a reader who asks why
// payroll_summary is missing above finds the answer without leaving the file.
const REFUSED_EXPORT_TYPES = Object.freeze({
  payroll_summary: "Payroll summaries need accounting decisions this system has not been given.",
  journal_entries: "Journal entries need accounting decisions this system has not been given.",
  other: "An export has to name what it covers before a file can be built from it."
});

function exportSourceFor(exportType) {
  return ACCOUNTING_EXPORT_SOURCES[String(exportType || "")] || null;
}

module.exports = {
  ACCOUNTING_EXPORT_SOURCES,
  MONEY_COLUMNS,
  ACCOUNTING_EXPORT_TYPES,
  REFUSED_EXPORT_TYPES,
  exportSourceFor
};
