"use strict";

// A malformed .vcf does not error. The phone imports nothing, or imports a
// contact with the name split across two fields, and nobody is told. So these
// assert the parts that fail silently.

const assert = require("node:assert/strict");
const {
  buildContactCard,
  buildContactBook,
  escapeText,
  foldLine
} = require("../lib/sonara-contact-card.cjs");
const calendar = require("../lib/sonara-calendar-invite.cjs");

const CUSTOMER = Object.freeze({
  id: "77777777-8888-4999-a000-b11111111111",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+44 7700 900123",
  status: "active",
  source: "referral"
});

const linesOf = (body) => body.split("\r\n");

describe("a customer becomes a contact", () => {
  it("ends every line with CRLF, including the last", () => {
    const card = buildContactCard(CUSTOMER, {});
    assert.equal(card.ok, true);
    assert.equal(/(^|[^\r])\n/.test(card.body), false, "found a newline not preceded by a carriage return");
    assert.ok(card.body.endsWith("\r\n"));
  });

  it("escapes a semicolon, which would otherwise split the name in two", () => {
    // This is the assertion the module exists to keep honest. A vCard's N
    // property is positional and semicolon-separated, so an unescaped semicolon
    // inside a name silently becomes a field boundary: "Ashby; Ltd" imports as
    // a family name and a given name.
    assert.equal(escapeText("Ashby; Ltd"), "Ashby\\; Ltd");
    assert.equal(escapeText("Ada, of Ashby"), "Ada\\, of Ashby");
    assert.equal(escapeText("line one\nline two"), "line one\\nline two");
    assert.equal(escapeText("a\\b"), "a\\\\b");

    const card = buildContactCard({ ...CUSTOMER, name: "Ashby; Ltd" }, {});
    const n = linesOf(card.body).find((line) => line.startsWith("N:"));
    // Four trailing semicolons are the empty structured components and are
    // separators; the one inside the name must be escaped.
    assert.equal(n, "N:Ashby\\; Ltd;;;;");
  });

  // Written as a pair on purpose. The same mistake -- `.replace(/;/g, "\;")`,
  // which is just ";" once JavaScript has read the literal -- was made in the
  // calendar module and then repeated verbatim in the contact module. Each
  // module's own test would have caught only its own copy, and the second copy
  // was written after the first was fixed.
  it("escapes a semicolon in both text formats, not just this one", () => {
    for (const [name, escape] of [["contact card", escapeText], ["calendar invite", calendar.escapeText]]) {
      assert.equal(escape("a;b"), "a\\;b", `${name} leaves a semicolon unescaped`);
      assert.equal(escape("a,b"), "a\\,b", `${name} leaves a comma unescaped`);
      assert.equal(escape("a\\b"), "a\\\\b", `${name} leaves a backslash unescaped`);
    }
  });

  it("folds long lines by octet, not by character", () => {
    const folded = foldLine(`FN:${"é".repeat(80)}`);
    for (const segment of folded.split("\r\n")) {
      assert.ok(Buffer.byteLength(segment, "utf8") <= 75, `segment is ${Buffer.byteLength(segment, "utf8")} octets`);
    }
    assert.equal(folded.split("\r\n ").join(""), `FN:${"é".repeat(80)}`);
  });

  it("refuses a contact nobody could actually contact", () => {
    // A name and nothing else is a valid vCard and a useless one.
    const unreachable = buildContactCard({ id: "a", name: "Somebody" }, {});
    assert.equal(unreachable.ok, false);
    assert.equal(unreachable.code, "no_way_to_reach_them");
    assert.match(unreachable.message, /email|phone/i);

    assert.equal(buildContactCard({ id: "a", email: "a@b.c" }, {}).code, "no_name");
    assert.equal(buildContactCard({ name: "Somebody", email: "a@b.c" }, {}).code, "no_identifier");

    // Either one is enough.
    assert.equal(buildContactCard({ id: "a", name: "Somebody", phone: "1" }, {}).ok, true);
    assert.equal(buildContactCard({ id: "a", name: "Somebody", email: "a@b.c" }, {}).ok, true);
  });

  it("does not guess which part of a name is the surname", () => {
    // The product stores one `name` column. Treating the last word as a family
    // name is wrong for most of the world, so N carries the whole value in the
    // first component and leaves the rest empty.
    const card = buildContactCard({ ...CUSTOMER, name: "Nguyen Van An" }, {});
    assert.equal(linesOf(card.body).find((line) => line.startsWith("N:")), "N:Nguyen Van An;;;;");
    assert.equal(linesOf(card.body).find((line) => line.startsWith("FN:")), "FN:Nguyen Van An");
  });

  it("keeps the same UID so re-importing updates rather than duplicates", () => {
    const uid = (card) => linesOf(card.body).find((line) => line.startsWith("UID:"));
    assert.equal(uid(buildContactCard(CUSTOMER, {})), uid(buildContactCard(CUSTOMER, {})));
  });

  it("puts a whole list in one file, built by the same code as one card", () => {
    const book = buildContactBook([CUSTOMER, { ...CUSTOMER, id: "second", name: "Grace Hopper" }], {});
    assert.equal(book.ok, true);
    assert.equal(book.included, 2);
    assert.deepEqual(book.skipped, []);
    assert.equal(book.body.split("BEGIN:VCARD").length - 1, 2);
    assert.equal(book.body.split("END:VCARD").length - 1, 2);

    const single = buildContactCard(CUSTOMER, {});
    assert.ok(book.body.startsWith(single.body.slice(0, single.body.indexOf("UID:"))));
  });

  it("counts who it left out rather than quietly shortening the address book", () => {
    const book = buildContactBook(
      [CUSTOMER, { id: "no-contact", name: "Unreachable" }, { id: "no-name", email: "x@y.z" }],
      {}
    );
    assert.equal(book.included, 1);
    assert.equal(book.skipped.length, 2);
    assert.deepEqual(book.skipped.map((entry) => entry.code).sort(), ["no_name", "no_way_to_reach_them"]);
    assert.deepEqual(book.skipped.map((entry) => entry.id).sort(), ["no-contact", "no-name"]);
  });

  it("separates a business with no customers from customers it could not read", () => {
    const empty = buildContactBook([], {});
    assert.equal(empty.ok, true);
    assert.equal(empty.included, 0);
    // No VCARD wrapper to write when there are no cards; an empty file is the
    // honest form of an empty address book.
    assert.equal(empty.body, "");

    for (const notAList of [null, undefined, "rows", { rows: [] }]) {
      const refused = buildContactBook(notAList, {});
      assert.equal(refused.ok, false, `expected ${JSON.stringify(notAList)} to be refused`);
      assert.equal(refused.code, "not_a_list");
    }
  });

  it("carries the structure a phone needs to import it at all", () => {
    const card = buildContactCard(CUSTOMER, { businessName: "Ashby Studio" });
    const lines = linesOf(card.body);
    for (const required of ["BEGIN:VCARD", "VERSION:3.0", "END:VCARD"]) {
      assert.ok(lines.includes(required), `missing ${required}`);
    }
    assert.ok(lines.some((line) => line.startsWith("TEL;")));
    assert.ok(lines.some((line) => line.startsWith("EMAIL;")));
    assert.ok(lines.includes("ORG:Ashby Studio"));
    assert.equal(card.contentType, "text/vcard; charset=utf-8");
    assert.match(card.filename, /^customer-[a-zA-Z0-9-]+\.vcf$/);
    // The status and source belong in a note, not in invented fields a phone
    // has nowhere to put.
    assert.ok(lines.some((line) => line.startsWith("NOTE:") && line.includes("Status: active")));
  });

  it("never leaks a placeholder into a card", () => {
    const card = buildContactCard({ ...CUSTOMER, status: null, source: undefined, tags: null }, {});
    assert.equal(card.ok, true);
    assert.doesNotMatch(card.body, /\b(null|undefined|NaN|\[object Object\])\b/);
  });
});
