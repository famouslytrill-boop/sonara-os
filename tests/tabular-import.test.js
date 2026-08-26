"use strict";

// Reading a spreadsheet somebody pasted, and the ways an importer loses rows.
//
// The failure that matters here is not a crash. It is an import that reports
// "done" having created 94 of 100 customers, because six rows were dropped by a
// parser that could not see them. Nobody finds out until one of the six is not
// called back, and by then the sheet has been thrown away.
//
// So every test below is about a row surviving, being rejected out loud, or the
// numbers adding up.

const assert = require("node:assert/strict");
const {
  parseDelimited,
  sniffDelimiter,
  normaliseHeader,
  mapHeaders,
  readSheet,
  summarise
} = require("../lib/sonara-tabular-import.cjs");

function emailish(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? { ok: true, value }
    : { ok: false, reason: `"${value}" is not an email address` };
}

const FIELDS = [
  { column: "name", label: "Name", aliases: ["full name", "customer", "client"], required: true, validate: (value) => ({ ok: true, value }) },
  { column: "email", label: "Email", aliases: ["email address", "e-mail"], required: false, validate: emailish },
  { column: "phone", label: "Phone", aliases: ["telephone", "mobile", "phone number"], required: false, validate: (value) => ({ ok: true, value }) }
];

describe("reading a pasted spreadsheet", () => {
  describe("the parser", () => {
    it("reads plain rows", () => {
      assert.deepEqual(parseDelimited("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
    });

    it("keeps a comma that is inside quotes", () => {
      // The single most common way a naive split loses data: an address.
      assert.deepEqual(parseDelimited('name,address\nJo,"12 High St, Leeds"'),
        [["name", "address"], ["Jo", "12 High St, Leeds"]]);
    });

    it("keeps a newline that is inside quotes", () => {
      assert.deepEqual(parseDelimited('name,notes\nJo,"line one\nline two"'),
        [["name", "notes"], ["Jo", "line one\nline two"]]);
    });

    it("reads a doubled quote as one quote", () => {
      assert.deepEqual(parseDelimited('name\n"Jo ""The Roof"" Smith"'),
        [["name"], ['Jo "The Roof" Smith']]);
    });

    it("survives CRLF line endings", () => {
      assert.deepEqual(parseDelimited("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
    });

    it("strips a byte-order mark from the first cell", () => {
      // Excel writes one. Without this, "Name" is "﻿Name" and matches no
      // header, so a sheet with perfectly good columns reports none recognised.
      const rows = parseDelimited("﻿Name,Email\nJo,jo@example.com");
      assert.equal(rows[0][0], "Name");
    });

    it("does not turn a trailing newline into an empty record", () => {
      assert.equal(parseDelimited("a\n1\n").length, 2);
    });

    it("keeps an empty last field rather than shortening the row", () => {
      // A row that is one field short lines every later column up against the
      // wrong header, which is how a phone number becomes an email address.
      assert.deepEqual(parseDelimited("a,b,c\n1,2,"), [["a", "b", "c"], ["1", "2", ""]]);
    });
  });

  describe("working out the delimiter", () => {
    it("reads a tab-separated paste, which is what copying out of a spreadsheet gives you", () => {
      assert.equal(sniffDelimiter("Name\tEmail\nJo\tjo@example.com"), "\t");
    });

    it("reads a semicolon sheet, which is what a comma-decimal locale writes", () => {
      assert.equal(sniffDelimiter("Name;Email\nJo;jo@example.com"), ";");
    });

    it("decides on the header, not on the whole document", () => {
      // A body row with a comma inside a quoted address would otherwise
      // outnumber the tabs and turn a TSV paste into a one-column CSV.
      const text = 'Name\tAddress\nJo\t"12 High St, Leeds, West Yorkshire, UK"';
      assert.equal(sniffDelimiter(text), "\t");
    });

    it("defaults to a comma", () => {
      assert.equal(sniffDelimiter("Name\nJo"), ",");
    });
  });

  describe("matching the headings", () => {
    it("matches however somebody wrote it", () => {
      for (const heading of ["Email", "email", " E-Mail ", "email_address", "Email Address"]) {
        const { mapping } = mapHeaders([heading], FIELDS);
        assert.equal([...mapping.values()][0], "email", `did not match ${JSON.stringify(heading)}`);
      }
    });

    it("reports a heading it does not know rather than guessing at it", () => {
      const { mapping, unrecognised } = mapHeaders(["Name", "Favourite colour"], FIELDS);
      assert.deepEqual(unrecognised, ["Favourite colour"]);
      assert.equal(mapping.size, 1, "an unknown heading was matched to something");
    });

    it("reports two columns claiming the same field", () => {
      // Taking the first silently means the second column's values are dropped
      // and nobody is told.
      const { duplicated } = mapHeaders(["Email", "E-mail"], FIELDS);
      assert.deepEqual(duplicated, ["E-mail"]);
    });

    it("says which required column is missing", () => {
      const { missingRequired } = mapHeaders(["Email"], FIELDS);
      assert.deepEqual(missingRequired, ["Name"]);
    });

    it("normalises the way people actually type headings", () => {
      assert.equal(normaliseHeader("  Phone_Number "), "phone number");
      assert.equal(normaliseHeader("﻿Name"), "name");
    });
  });

  describe("reading a whole sheet", () => {
    it("turns good rows into records", () => {
      const result = readSheet({ text: "Name,Email\nJo,jo@example.com\nKim,kim@example.com", fields: FIELDS });
      assert.equal(result.ok, true);
      assert.equal(result.records.length, 2);
      assert.deepEqual(result.records[0].record, { name: "Jo", email: "jo@example.com" });
      assert.equal(result.rejected.length, 0);
    });

    it("rejects a bad row out loud, with the line number in the sheet", () => {
      const result = readSheet({ text: "Name,Email\nJo,jo@example.com\nKim,not-an-email", fields: FIELDS });
      assert.equal(result.records.length, 1);
      assert.equal(result.rejected.length, 1);
      // Line 3: one for the header, one because people count from one.
      assert.equal(result.rejected[0].line, 3);
      assert.match(result.rejected[0].problems[0], /Email: "not-an-email" is not an email address/);
    });

    it("rejects a row missing something required rather than writing a blank record", () => {
      const result = readSheet({ text: "Name,Email\n,jo@example.com", fields: FIELDS });
      assert.equal(result.records.length, 0);
      assert.equal(result.rejected.length, 1);
      assert.match(result.rejected[0].problems[0], /Name is empty/);
    });

    it("leaves an empty cell out rather than writing the string it prints as", () => {
      const result = readSheet({ text: "Name,Email,Phone\nJo,,555-0100", fields: FIELDS });
      assert.deepEqual(result.records[0].record, { name: "Jo", phone: "555-0100" });
      assert.ok(!("email" in result.records[0].record), "an empty cell was written as a value");
    });

    it("ignores a blank line without calling it an error", () => {
      // Calling spacing an error trains people to ignore errors, which is how
      // a real rejection goes unread.
      const result = readSheet({ text: "Name,Email\nJo,jo@example.com\n\nKim,kim@example.com", fields: FIELDS });
      assert.equal(result.records.length, 2);
      assert.equal(result.rejected.length, 0);
    });

    it("accounts for every row it was given", () => {
      // The property that makes a lost row impossible to hide.
      const text = "Name,Email\nJo,jo@example.com\nKim,nope\n,orphan@example.com\nPat,pat@example.com";
      const result = readSheet({ text, fields: FIELDS });
      assert.equal(result.records.length + result.rejected.length, result.total,
        "the rows do not add up, so at least one was dropped without being reported");
    });

    it("says it stopped rather than silently importing the first few", () => {
      const rows = Array.from({ length: 12 }, (_, index) => `Person ${index},p${index}@example.com`).join("\n");
      const result = readSheet({ text: `Name,Email\n${rows}`, fields: FIELDS, limit: 5 });
      assert.equal(result.truncated, true);
      assert.equal(result.records.length, 5);
      assert.match(summarise(result), /more below the limit/);
    });

    it("refuses a paste whose first line is not headings, and says what it saw", () => {
      const result = readSheet({ text: "Jo,jo@example.com\nKim,kim@example.com", fields: FIELDS });
      assert.equal(result.ok, false);
      // Naming what it found matters: "no columns recognised" against a sheet
      // that plainly has columns reads as the product being broken.
      assert.match(result.reason, /Jo/);
      assert.match(result.reason, /first line has to be the column names/);
    });

    it("refuses when a required column is absent, rather than importing nameless rows", () => {
      const result = readSheet({ text: "Email\njo@example.com", fields: FIELDS });
      assert.equal(result.ok, false);
      assert.match(result.reason, /Name/);
      assert.equal(result.records.length, 0);
    });

    it("refuses an empty paste", () => {
      assert.equal(readSheet({ text: "", fields: FIELDS }).ok, false);
      assert.equal(readSheet({ text: "   \n  ", fields: FIELDS }).ok, false);
    });

    it("reads a spreadsheet paste with tabs and quoted commas together", () => {
      const text = 'Name\tEmail\tPhone\nJo Smith\tjo@example.com\t555-0100\n"Smith, Kim"\tkim@example.com\t';
      const result = readSheet({ text, fields: FIELDS });
      assert.equal(result.ok, true);
      assert.equal(result.records.length, 2);
      assert.equal(result.records[1].record.name, "Smith, Kim");
      assert.ok(!("phone" in result.records[1].record));
    });
  });

  describe("the sentence above the preview", () => {
    it("adds up", () => {
      const result = readSheet({ text: "Name,Email\nJo,jo@example.com\nKim,nope", fields: FIELDS });
      assert.equal(summarise(result), "1 to add, 1 that cannot be added yet.");
    });

    it("says what went wrong when nothing could be read at all", () => {
      assert.match(summarise(readSheet({ text: "", fields: FIELDS })), /nothing here to read/);
    });
  });
});
