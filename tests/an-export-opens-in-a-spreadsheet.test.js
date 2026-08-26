"use strict";

// The failures here are the quiet ones. A CSV with a broken quote does not
// error -- the spreadsheet opens it with the columns shifted, and the accountant
// reads a number under the wrong heading.

const assert = require("node:assert/strict");
const { buildRecordCsv, cell, wasNeutralised } = require("../lib/sonara-record-csv.cjs");

describe("an export opens in a spreadsheet", () => {
  it("quotes and doubles the characters that would otherwise split a row", () => {
    assert.equal(cell("Ada, Ltd"), '"Ada, Ltd"');
    assert.equal(cell('He said "hi"'), '"He said ""hi"""');
    assert.equal(cell("line one\nline two"), '"line one\nline two"');
    // Nothing special: no quotes added, because quoting everything makes a file
    // harder to read for no benefit.
    assert.equal(cell("plain"), "plain");
  });

  it("stops a cell being executed as a formula", () => {
    // This is the security case. A note field a customer typed becomes code
    // running on their accountant's machine when the file is opened.
    // "+1" and "-1" were in this list and are not attacks: a spreadsheet reads
    // both as numbers. They moved to the exemption below, which is what the
    // plain-number rule is for.
    for (const attack of ["=1+1", "@SUM(A1)", "=cmd|' /c calc'!A1", "\t=1+1", "+1+1", "-1-cmd"]) {
      const written = cell(attack);
      assert.equal(/^"?'/.test(written), true, `${JSON.stringify(attack)} was written as ${written}`);
      assert.equal(wasNeutralised(attack), true);
    }
    // A number is not a formula and must not be mangled -- an accountant's
    // column of figures has to stay a column of figures.
    for (const ordinary of ["12.5", "0", "2026-08-18", "Ada", ""]) {
      assert.equal(wasNeutralised(ordinary), false, `${JSON.stringify(ordinary)} should not be altered`);
    }
    // A negative number begins with "-", which is a formula-start character,
    // and neutralising it would turn every credit in an accounting export into
    // text -- '-1, '-12.50 -- in a file whose whole purpose is for somebody to
    // sum it. A plain number is exempt, and the exemption is exact rather than
    // permissive.
    for (const number of ["-1", "-12.50", "+3", "1e6", "-1.5e-3", ".5"]) {
      assert.equal(wasNeutralised(number), false, `${number} must survive as a number`);
      assert.equal(cell(number), number);
    }
    // Anything that only looks like a number is still neutralised.
    for (const notANumber of ["-1+cmd|' /c calc'!A1", "+1-2=3", "-1 and text", "--1"]) {
      assert.equal(wasNeutralised(notANumber), true, `${notANumber} must not be treated as a number`);
    }
  });

  it("counts what it altered instead of changing records silently", () => {
    const built = buildRecordCsv(
      [{ note: "=DANGER()" }, { note: "ordinary" }, { note: "@ALSO()" }],
      ["note"]
    );
    assert.equal(built.ok, true);
    assert.equal(built.neutralised, 2);
    assert.equal(built.rowCount, 3);
  });

  it("writes an absent value as absent, not as the word null", () => {
    // String(null) is "null" -- four characters an accountant reads as a value.
    assert.equal(cell(null), "");
    assert.equal(cell(undefined), "");
    const built = buildRecordCsv([{ a: null, b: undefined, c: 0 }], ["a", "b", "c"]);
    assert.equal(built.body.split("\r\n")[1], ",,0");
    // Zero is a value and must survive.
    assert.equal(built.body.includes("0"), true);
  });

  it("writes an object as JSON rather than as [object Object]", () => {
    assert.equal(cell({ a: 1 }), '"{""a"":1}"');
    assert.equal(cell([1, 2]), '"[1,2]"');
  });

  it("keeps columns aligned when a row is missing a key", () => {
    // Deriving headers from the first row means a later row missing a key
    // shifts every column after it, and nobody is told. Columns are given.
    const built = buildRecordCsv([{ a: 1, b: 2 }, { b: 5 }, { a: 7, b: 8, extra: 9 }], ["a", "b"]);
    const lines = built.body.trim().split("\r\n");
    assert.deepEqual(lines, ["a,b", "1,2", ",5", "7,8"]);
    // Every line has the same number of fields, which is the property that
    // makes the file readable at all.
    assert.equal(new Set(lines.map((line) => line.split(",").length)).size, 1);
  });

  it("separates no records from records it could not read", () => {
    const empty = buildRecordCsv([], ["a"]);
    assert.equal(empty.ok, true);
    assert.equal(empty.rowCount, 0);
    // A header row and nothing else is a correct answer for a period with no
    // records, and it opens.
    assert.equal(empty.body, "a\r\n");

    for (const notAList of [null, undefined, "rows", { rows: [] }]) {
      const refused = buildRecordCsv(notAList, ["a"]);
      assert.equal(refused.ok, false, `expected ${JSON.stringify(notAList)} to be refused`);
      assert.equal(refused.code, "not_a_list");
    }
  });

  it("refuses to write a file with no columns rather than an empty one", () => {
    for (const columns of [[], null, undefined, [""], [null]]) {
      const refused = buildRecordCsv([{ a: 1 }], columns);
      assert.equal(refused.ok, false, `expected ${JSON.stringify(columns)} to be refused`);
      assert.equal(refused.code, "no_columns");
    }
  });

  it("ends every record with CRLF, including the last", () => {
    const built = buildRecordCsv([{ a: 1 }], ["a"]);
    assert.equal(built.body, "a\r\n1\r\n");
    assert.equal(/(^|[^\r])\n(?![\s\S]*")/.test(built.body.replace(/"[\s\S]*?"/g, "")), false);
  });
});
