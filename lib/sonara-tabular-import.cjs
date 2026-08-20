"use strict";

// Turning a spreadsheet somebody pasted into records.
//
// A small business arrives with its customers in a spreadsheet. Without this,
// starting here means retyping them, which is the single most common reason a
// trial ends -- not because the product was wrong, but because the first hour
// was data entry.
//
// ## Why a paste and not a file upload
//
// This application has one production dependency, express, and Express 4 has no
// multipart parser. Adding one for this would be a real dependency added for a
// text box. A paste is also what copying out of Excel or Google Sheets actually
// gives you, so `sniffDelimiter` reads tabs as readily as commas -- a customer
// who selects cells and presses copy gets TSV and never knows it.
//
// ## What this refuses to do
//
// **It never drops a row quietly.** Every row comes back either as a record to
// create or as a rejection carrying its line number and the reason. An importer
// that imports 94 of 100 rows and says "done" has lost six customers, and
// nobody finds out until one of them is not called back.
//
// **It never guesses a column it cannot find.** A header this does not
// recognise is reported as unrecognised rather than matched to the nearest
// thing. Putting a phone number in the email field is worse than asking.
//
// **It never trims a value into meaning.** An empty cell stays empty; it does
// not become the string "null", and a required field that is empty rejects the
// row rather than writing a blank record that fails a check later.

// RFC 4180, plus the things real spreadsheets emit.
//
// The cases this handles and a naive `split(",")` does not: a quoted field with
// a comma in it, a quoted field with a newline in it, a doubled quote meaning a
// literal quote, CRLF line endings, and a byte-order mark on the first cell --
// which is how "Name" silently becomes "﻿Name" and matches no header.
function parseDelimited(text, delimiter = ",") {
  const source = String(text ?? "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let index = 0;
  let started = false;

  while (index < source.length) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 2; continue; }
        quoted = false; index += 1; continue;
      }
      field += char; index += 1; continue;
    }

    if (char === '"' && field === "") { quoted = true; started = true; index += 1; continue; }
    if (char === delimiter) { row.push(field); field = ""; started = true; index += 1; continue; }
    if (char === "\r") { index += 1; continue; }
    if (char === "\n") {
      row.push(field);
      // A line that is entirely empty is spacing, not a record. A line whose
      // fields are empty but which had a delimiter on it is a real empty row
      // and is kept, so it can be rejected with a line number rather than
      // vanishing.
      if (started || row.length > 1 || row[0] !== "") rows.push(row);
      row = []; field = ""; started = false; index += 1; continue;
    }
    field += char; started = true; index += 1;
  }

  row.push(field);
  if (started || row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

// Comma or tab, decided by the header line rather than by the whole document.
//
// The header is where the delimiter is unambiguous: a body row may contain a
// comma inside a quoted address and outnumber the tabs, which is exactly how a
// TSV paste gets read as a one-column CSV.
function sniffDelimiter(text) {
  const firstLine = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  if (tabs > commas && tabs >= semicolons) return "\t";
  // Semicolons are what a spreadsheet in a comma-decimal locale writes.
  if (semicolons > commas) return ";";
  return ",";
}

function normaliseHeader(value) {
  return String(value ?? "")
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, " ")
    .trim();
}

/**
 * Match the pasted headers against the fields a record accepts.
 *
 * `fields` is [{ column, label, aliases, required, validate }]. Matching is on
 * the normalised label and its aliases only -- never on position and never on a
 * near match, because a column matched to the nearest thing is how a phone
 * number ends up in an email field.
 */
function mapHeaders(headerRow, fields) {
  const mapping = new Map();
  const unrecognised = [];
  const duplicated = [];

  const lookup = new Map();
  for (const field of fields) {
    for (const name of [field.label, field.column, ...(field.aliases || [])]) {
      lookup.set(normaliseHeader(name), field);
    }
  }

  (Array.isArray(headerRow) ? headerRow : []).forEach((raw, position) => {
    const key = normaliseHeader(raw);
    if (!key) return;
    const field = lookup.get(key);
    if (!field) { unrecognised.push(String(raw).trim()); return; }
    // Two columns claiming the same field. Taking the first silently means the
    // second column's values are dropped without anybody being told.
    if ([...mapping.values()].includes(field.column)) { duplicated.push(String(raw).trim()); return; }
    mapping.set(position, field.column);
  });

  const matched = [...mapping.values()];
  const missingRequired = fields.filter((field) => field.required && !matched.includes(field.column)).map((field) => field.label);

  return { mapping, unrecognised, duplicated, missingRequired, matched };
}

/**
 * Read a pasted sheet into rows to create and rows to reject.
 *
 * Returns `{ ok, reason, columns, records, rejected, unrecognised, duplicated, total }`.
 * `ok: false` carries a reason a person can act on -- a paste this cannot read
 * at all is a different problem from one whose rows fail validation, and the
 * page says which.
 */
function readSheet({ text, fields, limit = 500 } = {}) {
  const delimiter = sniffDelimiter(text);
  const rows = parseDelimited(text, delimiter);

  if (!rows.length) {
    return { ok: false, reason: "There is nothing here to read.", records: [], rejected: [], columns: [], unrecognised: [], duplicated: [], total: 0 };
  }

  const { mapping, unrecognised, duplicated, missingRequired, matched } = mapHeaders(rows[0], fields);

  if (!matched.length) {
    return {
      ok: false,
      // Names the headers it did find, because "no columns recognised" against
      // a sheet that plainly has columns reads as the product being broken.
      reason: `None of these headings were recognised: ${rows[0].map((cell) => String(cell).trim()).filter(Boolean).slice(0, 12).join(", ") || "(the first line is empty)"}. The first line has to be the column names.`,
      records: [], rejected: [], columns: [], unrecognised, duplicated, total: 0
    };
  }

  if (missingRequired.length) {
    return {
      ok: false,
      reason: `These columns are needed and are not in the sheet: ${missingRequired.join(", ")}.`,
      records: [], rejected: [], columns: matched, unrecognised, duplicated, total: 0
    };
  }

  const byColumn = new Map(fields.map((field) => [field.column, field]));
  const records = [];
  const rejected = [];
  const body = rows.slice(1);
  let truncated = false;

  body.forEach((cells, offset) => {
    // The line number in the sheet the person is looking at: one for the
    // header, one because people count from one.
    const line = offset + 2;
    if (records.length + rejected.length >= limit) { truncated = true; return; }

    const record = {};
    const problems = [];

    for (const [position, column] of mapping.entries()) {
      const field = byColumn.get(column);
      const raw = cells[position];
      const value = raw === undefined || raw === null ? "" : String(raw).trim();

      if (!value) {
        if (field.required) problems.push(`${field.label} is empty`);
        // Deliberately not written. An empty cell must not become "" in a
        // column that means something by being null, and must never become the
        // string "null", which is what a template literal does to it.
        continue;
      }

      const checked = typeof field.validate === "function" ? field.validate(value) : { ok: true, value };
      if (!checked.ok) { problems.push(`${field.label}: ${checked.reason}`); continue; }
      record[column] = checked.value;
    }

    // A row where every cell was blank is spacing somebody left in the sheet,
    // not a record they meant to import. Counted as skipped rather than
    // rejected, because calling it an error trains people to ignore errors.
    if (!Object.keys(record).length && !problems.length) return;

    if (problems.length) { rejected.push({ line, problems, cells: cells.map((cell) => String(cell ?? "").trim()) }); return; }
    records.push({ line, record });
  });

  return {
    ok: true,
    reason: null,
    columns: matched,
    records,
    rejected,
    unrecognised,
    duplicated,
    truncated,
    total: body.length
  };
}

// The sentence above a preview. Written so that the numbers add up out loud --
// a summary whose parts do not sum to the total is how a lost row hides.
function summarise(result) {
  if (!result?.ok) return result?.reason || "This could not be read.";
  const parts = [`${result.records.length} to add`];
  if (result.rejected.length) parts.push(`${result.rejected.length} that cannot be added yet`);
  const accounted = result.records.length + result.rejected.length;
  if (result.total > accounted && !result.truncated) parts.push(`${result.total - accounted} blank ${result.total - accounted === 1 ? "line" : "lines"} ignored`);
  if (result.truncated) parts.push("and more below the limit this can read at once");
  return `${parts.join(", ")}.`;
}

module.exports = { parseDelimited, sniffDelimiter, normaliseHeader, mapHeaders, readSheet, summarise };
