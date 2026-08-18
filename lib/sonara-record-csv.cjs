"use strict";

// Records as a file an accountant can open.
//
// /business-builder/owner/accounting-exports lists rows saying "Queued" and
// "whether each one finished", and nothing in this repository ever produced a
// file or moved a status: `file_url` has no writer, there is no CSV anywhere,
// and the only thing that touches accounting_exports is the endpoint that
// inserts the request. So a customer asked for an export, was shown a status,
// and the answer could never change. That is a page reporting the state of a
// job nothing runs.
//
// CSV rather than the account-wide JSON at /account/data/export, because the
// stated reader is an accountant and the stated use is accounting software.
// Both open CSV; neither opens a nested JSON blob.
//
// Two things this file is careful about.
//
// **A cell is not a formula.** A value beginning `=`, `+`, `-`, `@`, tab or
// carriage return is executed by Excel, Sheets and LibreOffice when the file is
// opened, so a customer's own note field becomes code running on their
// accountant's machine.
//
// The fix is to prefix such a value with an apostrophe, and the honest thing to
// say about it is that this **changes the value**. There is no way to both
// neutralise it and leave it byte-exact. So the count of altered cells is
// returned as `neutralised` and the caller is expected to tell the customer:
// silently rewriting somebody's records is worse than rewriting them and
// saying so. This module does not put that notice in the header row, because
// the header row is the column names and an accountant's software reads it.
//
// **A missing value is empty, not "null".** String(null) is "null", four
// characters an accountant will read as a value. Absent stays absent.

const CRLF = "\r\n";

// RFC 4180: quote when the value contains a comma, quote, or line break, and
// double an embedded quote.
function needsQuoting(value) {
  return /[",\r\n]/.test(value);
}

// The characters a spreadsheet treats as the start of a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

// A plain number is not a formula, and this exception is the difference between
// a usable accounting export and a broken one.
//
// "-" is a formula-start character, so the first version of this neutralised
// every negative amount: a column of credits came out as '-1, '-12.50, text
// rather than figures, in a file whose entire purpose is for an accountant to
// sum it. The test caught it by asserting the behaviour and reading what that
// meant, not by failing.
//
// Safe because it is exact: a value matching this is read as a number by every
// spreadsheet, and "-1+cmd|'/c calc'!A1" does not match it.
const PLAIN_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function cell(value) {
  if (value === null || value === undefined) return "";
  // Objects and arrays would stringify to [object Object], which is the
  // placeholder leak this codebase keeps finding. A jsonb column is JSON.
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (raw === "") return "";

  // Neutralise before quoting, so the guard is inside the quoted value.
  const safe = FORMULA_START.test(raw) && !PLAIN_NUMBER.test(raw) ? `'${raw}` : raw;
  if (!needsQuoting(safe)) return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Whether a value was altered to stop a spreadsheet executing it. The caller
// reports the count; a file that quietly rewrote somebody's data is the thing
// this is meant to avoid.
function wasNeutralised(value) {
  if (value === null || value === undefined) return false;
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  return raw !== "" && FORMULA_START.test(raw) && !PLAIN_NUMBER.test(raw);
}

// Columns are given rather than derived from the first row: deriving them means
// a row missing a key silently shifts every later column, and a row with an
// extra key is dropped without anybody being told.
function buildRecordCsv(rows, columns) {
  const list = Array.isArray(rows) ? rows : null;
  // null and [] are different answers, and a failed read must not render as a
  // business with no records.
  if (!list) {
    return { ok: false, code: "not_a_list", message: "Those records could not be read, so no file was made." };
  }
  const headers = Array.isArray(columns) ? columns.filter((name) => typeof name === "string" && name) : [];
  if (!headers.length) {
    return { ok: false, code: "no_columns", message: "No columns were given, so there is nothing to write." };
  }

  let neutralised = 0;
  const lines = [headers.map(cell).join(",")];
  for (const row of list) {
    const source = row && typeof row === "object" ? row : {};
    for (const header of headers) if (wasNeutralised(source[header])) neutralised += 1;
    lines.push(headers.map((header) => cell(source[header])).join(","));
  }

  return {
    ok: true,
    rowCount: list.length,
    neutralised,
    contentType: "text/csv; charset=utf-8",
    // A trailing CRLF, so a file appended to or concatenated does not run two
    // records together.
    body: `${lines.join(CRLF)}${CRLF}`
  };
}

module.exports = { buildRecordCsv, cell, wasNeutralised, needsQuoting };
