"use strict";

// A broken PDF opens to a blank page rather than an error.
//
// That is the whole difficulty. A viewer handed a document with one wrong byte
// offset does not say "offset wrong" -- it shows nothing, or shows the first
// page and not the second, or works in Chrome and fails in Preview. Nobody
// finds out from the code; they find out from a customer who says the invoice
// you sent them was empty.
//
// So this file reads the file back the way a viewer does: it walks the
// cross-reference table, checks that every offset lands exactly on the object
// header it claims, inflates each content stream, and reads the text back out
// of the drawing operators. If the writer and the reader disagree, one of them
// is wrong.
//
// The reader is written here rather than imported, and it parses the bytes
// rather than the builder's own structures. Sharing anything with the writer
// would hide the class of bug it exists to catch.

const assert = require("node:assert/strict");
const zlib = require("node:zlib");

const pdf = require("../lib/sonara-pdf.cjs");

// --- an independent reader ---------------------------------------------------

function parse(buffer) {
  const text = buffer.toString("latin1");

  assert.equal(text.slice(0, 8), "%PDF-1.4", "the file does not start with a PDF header");
  assert.ok(text.includes("%%EOF"), "the file has no end-of-file marker");

  const startxrefAt = text.lastIndexOf("startxref");
  assert.ok(startxrefAt > 0, "there is no startxref");
  const xrefOffset = Number(text.slice(startxrefAt + 9).trim().split(/\s/)[0]);
  assert.ok(Number.isInteger(xrefOffset) && xrefOffset > 0, "startxref is not a number");
  assert.equal(text.slice(xrefOffset, xrefOffset + 4), "xref", "startxref does not point at the xref table");

  const xrefBody = text.slice(xrefOffset + 4).trimStart();
  const [countLine, ...entryLines] = xrefBody.split("\n");
  const declared = Number(countLine.trim().split(/\s+/)[1]);
  assert.ok(Number.isInteger(declared) && declared > 1, "the xref table declares no objects");

  // Every entry but the free one must land on "<n> 0 obj".
  const offsets = [];
  for (let i = 1; i < declared; i += 1) {
    const entry = entryLines[i];
    assert.ok(entry, `the xref table stops before object ${i}`);
    const offset = Number(entry.slice(0, 10));
    offsets.push(offset);
    const header = text.slice(offset, offset + 24);
    assert.ok(
      header.startsWith(`${i} 0 obj`),
      `xref says object ${i} is at byte ${offset}, and what is there is ${JSON.stringify(header.slice(0, 16))}`
    );
  }

  const trailerAt = text.lastIndexOf("trailer");
  assert.ok(trailerAt > 0, "there is no trailer");
  const trailer = text.slice(trailerAt, startxrefAt);
  const rootMatch = trailer.match(/\/Root\s+(\d+)\s+0\s+R/);
  assert.ok(rootMatch, "the trailer names no root object");
  const sizeMatch = trailer.match(/\/Size\s+(\d+)/);
  assert.equal(Number(sizeMatch[1]), declared, "the trailer's /Size disagrees with the xref table");

  // Objects, by number.
  const objects = new Map();
  for (let i = 1; i < declared; i += 1) {
    const start = offsets[i - 1];
    const end = text.indexOf("endobj", start);
    objects.set(i, { raw: text.slice(start, end), start, end });
  }

  const root = objects.get(Number(rootMatch[1]));
  assert.ok(root.raw.includes("/Type /Catalog"), "the root object is not a catalog");
  const pagesMatch = root.raw.match(/\/Pages\s+(\d+)\s+0\s+R/);
  const pagesObject = objects.get(Number(pagesMatch[1]));
  assert.ok(pagesObject.raw.includes("/Type /Pages"), "the catalog does not point at a page tree");

  const kids = [...pagesObject.raw.matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1]));
  const count = Number(pagesObject.raw.match(/\/Count\s+(\d+)/)[1]);
  assert.equal(kids.length, count, "the page tree's /Count disagrees with how many kids it lists");

  // Content, inflated from the bytes.
  const streams = [];
  for (const kid of kids) {
    const page = objects.get(kid);
    assert.ok(page.raw.includes("/Type /Page"), `object ${kid} is in the page tree and is not a page`);
    const contentsMatch = page.raw.match(/\/Contents\s+(\d+)\s+0\s+R/);
    const stream = objects.get(Number(contentsMatch[1]));
    const lengthMatch = stream.raw.match(/\/Length\s+(\d+)/);
    const streamStart = stream.start + stream.raw.indexOf("stream\n") + 7;
    const bytes = buffer.subarray(streamStart, streamStart + Number(lengthMatch[1]));
    assert.equal(bytes.length, Number(lengthMatch[1]), "the declared /Length does not match the bytes present");
    streams.push(zlib.inflateSync(bytes).toString("latin1"));
  }

  return { objects, pageCount: count, streams, declared };
}

// The text a viewer would draw, pulled out of the Tj operators.
function drawnText(streams) {
  return streams
    .flatMap((stream) => [...stream.matchAll(/\((.*?)\)\s*Tj/gs)].map((m) => m[1]))
    .map((value) => value.replace(/\\([\\()])/g, "$1"));
}

describe("a PDF opens in something that is not us", () => {
  describe("the font metrics are the real ones", () => {
    it("has a width for every character from space to tilde, in both faces", () => {
      assert.equal(pdf.HELVETICA.length, 95, "Helvetica is missing widths; codes 32-126 is 95 characters");
      assert.equal(pdf.HELVETICA_BOLD.length, 95, "Helvetica-Bold is missing widths");
      assert.ok(pdf.HELVETICA.every((w) => Number.isInteger(w) && w > 0), "a width is not a positive integer");
    });

    it("matches values anybody can look up in Adobe's metrics", () => {
      const at = (character) => pdf.HELVETICA[character.charCodeAt(0) - 32];
      assert.equal(at(" "), 278);
      assert.equal(at("A"), 667);
      assert.equal(at("M"), 833);
      assert.equal(at("W"), 944);
      assert.equal(at("i"), 222);
      assert.equal(at("l"), 222);
      // Every digit is the same width in Helvetica, which is why a money column
      // lines up at all.
      const digits = "0123456789".split("").map(at);
      assert.deepEqual(new Set(digits), new Set([556]), "the digits are not all one width");
    });

    it("bold is wider than regular for the same letters", () => {
      let wider = 0;
      for (let i = 0; i < 95; i += 1) if (pdf.HELVETICA_BOLD[i] > pdf.HELVETICA[i]) wider += 1;
      assert.ok(wider > 40, `only ${wider} of 95 bold characters are wider; the two tables may be the same file`);
    });
  });

  describe("measuring", () => {
    it("scales with the point size", () => {
      const small = pdf.measure("Hello", { size: 10 }).width;
      const large = pdf.measure("Hello", { size: 20 }).width;
      assert.ok(Math.abs(large - small * 2) < 0.001, "doubling the size did not double the width");
    });

    it("says when it had to guess, rather than folding it into the number", () => {
      assert.equal(pdf.measure("Muller").approximated, 0);
      const guessed = pdf.measure("Müller");
      assert.equal(guessed.approximated, 1, "a character with no width was measured as though it had one");
      assert.ok(guessed.width > 0);
    });

    it("counts a money string exactly, because that is what gets right-aligned", () => {
      assert.equal(pdf.measure("1,234.56").approximated, 0);
      assert.equal(pdf.measure("£1,234.56").approximated, 1, "the currency symbol is outside the exact range and must say so");
    });
  });

  describe("wrapping", () => {
    it("breaks on spaces and keeps every word", () => {
      const source = "The quick brown fox jumps over the lazy dog";
      const lines = pdf.wrap(source, 100, { size: 11 });
      assert.ok(lines.length > 1, "nothing wrapped");
      assert.equal(lines.join(" "), source, "wrapping lost or reordered a word");
      for (const line of lines) {
        assert.ok(pdf.measure(line, { size: 11 }).width <= 100.001, `"${line}" is wider than the column`);
      }
    });

    it("breaks a single word that cannot fit rather than running off the page", () => {
      const lines = pdf.wrap("supercalifragilisticexpialidocious", 40, { size: 11 });
      assert.ok(lines.length > 1, "an unbreakable word was left to overflow");
      assert.equal(lines.join(""), "supercalifragilisticexpialidocious", "breaking a long word lost characters");
    });

    it("keeps deliberate line breaks", () => {
      assert.equal(pdf.wrap("one\ntwo", 500).length, 2);
    });
  });

  describe("the file a viewer reads", () => {
    function build() {
      const doc = pdf.createDocument();
      doc.text("SONARA Industries", { x: 48, y: 48, font: "bold", size: 18 });
      doc.text("1,234.56", { x: 547, y: 48, align: "right" });
      doc.line(48, 80, 547, 80);
      doc.paragraph("A note that runs across more than one line so the wrap is exercised in a real document.", { x: 48, y: 100, width: 240 });
      return doc;
    }

    it("has an xref entry that lands on every object it claims", () => {
      const parsed = parse(build().toBuffer());
      assert.ok(parsed.declared > 4, "suspiciously few objects; this check is looking at almost nothing");
    });

    it("puts the text in, and gets it back out", () => {
      const drawn = drawnText(parse(build().toBuffer()).streams);
      assert.ok(drawn.includes("SONARA Industries"), "the heading is not in the file");
      assert.ok(drawn.includes("1,234.56"), "the figure is not in the file");
    });

    it("carries a binary comment so a text-mode transfer cannot corrupt it", () => {
      const buffer = build().toBuffer();
      const secondLine = buffer.subarray(9, 14).toString("latin1");
      assert.equal(secondLine[0], "%", "the second line is not a comment");
      assert.ok(
        [...secondLine.slice(1, 5)].every((c) => c.charCodeAt(0) > 127),
        "the comment on line two contains no high bytes, so nothing marks this file as binary"
      );
    });

    it("makes a second page when asked, and the tree agrees", () => {
      const doc = pdf.createDocument();
      doc.text("first", { x: 48, y: 48 });
      doc.page();
      doc.text("second", { x: 48, y: 48 });
      const parsed = parse(doc.toBuffer());
      assert.equal(parsed.pageCount, 2);
      const drawn = drawnText(parsed.streams);
      assert.ok(drawn.includes("first") && drawn.includes("second"));
    });

    it("produces a document even when nothing was drawn", () => {
      // An empty invoice is still a file somebody clicked download for. A
      // zero-byte response would look like a broken link.
      const parsed = parse(pdf.createDocument().toBuffer());
      assert.equal(parsed.pageCount, 1);
    });
  });

  describe("text that would otherwise break the file", () => {
    it("escapes the two brackets and the backslash, in the bytes", () => {
      // Asserted on the output rather than on a round trip. The first version
      // of this drew "Repair (see attached)" and read it back, and removing
      // escaping entirely failed nothing -- because those brackets are BALANCED,
      // and a reader walking to the last ")" before "Tj" recovers the same
      // string either way. The probe did not fire, which is how that was found.
      assert.equal(pdf.escapeText("a(b"), "a\\(b");
      assert.equal(pdf.escapeText("a)b"), "a\\)b");
      assert.equal(pdf.escapeText("a\\b"), "a\\\\b");
      assert.equal(pdf.encodeForPdf("Repair (see attached)"), "Repair \\(see attached\\)");
    });

    it("survives an UNMATCHED bracket, which is what actually corrupts a document", () => {
      // One ")" with no "(" ends the literal string early. Everything after it
      // is read as drawing operators, and the page renders as fragments or as
      // nothing at all. This is the case a balanced pair cannot catch.
      const doc = pdf.createDocument();
      doc.text("50%) off until Friday", { x: 48, y: 48 });
      doc.text("Total (net", { x: 48, y: 70 });
      const drawn = drawnText(parse(doc.toBuffer()).streams);
      assert.ok(
        drawn.includes("50%) off until Friday"),
        `an unmatched closing bracket truncated the text: ${JSON.stringify(drawn)}`
      );
      assert.ok(
        drawn.includes("Total (net"),
        `an unmatched opening bracket swallowed the text: ${JSON.stringify(drawn)}`
      );
    });

    it("writes a character outside ASCII as an escape rather than raw bytes", () => {
      const encoded = pdf.encodeForPdf("Müller");
      assert.ok(!/[^\x20-\x7e\\]/.test(encoded), `raw high bytes reached the literal string: ${JSON.stringify(encoded)}`);
      assert.ok(encoded.includes("\\374"), "the u-umlaut was not written as its WinAnsi octal escape");
    });

    it("writes a character it cannot represent as a question mark rather than a wrong one", () => {
      // Better a visibly missing character than a byte that renders as
      // something unrelated on the customer's copy.
      assert.equal(pdf.winAnsiByte("漢".codePointAt(0)), null);
      assert.equal(pdf.encodeForPdf("漢"), "?");
    });

    it("still parses with awkward text in it", () => {
      const doc = pdf.createDocument();
      doc.text("()\\()\\ Müller 漢 £100", { x: 48, y: 48 });
      parse(doc.toBuffer());
    });
  });

  describe("right alignment, which is the reason the widths are here", () => {
    it("ends two different figures at the same edge", () => {
      const doc = pdf.createDocument();
      doc.text("9.99", { x: 500, y: 48, align: "right" });
      doc.text("12,345.67", { x: 500, y: 60, align: "right" });
      const stream = parse(doc.toBuffer()).streams[0];
      const positions = [...stream.matchAll(/1 0 0 1 ([\d.]+) [\d.]+ Tm\n\((.*?)\) Tj/g)]
        .map((m) => ({ left: Number(m[1]), text: m[2] }));
      assert.equal(positions.length, 2);
      for (const position of positions) {
        const right = position.left + pdf.measure(position.text).width;
        assert.ok(Math.abs(right - 500) < 0.02, `"${position.text}" ends at ${right} rather than 500`);
      }
      // And the check is not vacuous: the two must have started in different
      // places, or alignment did nothing.
      assert.notEqual(positions[0].left, positions[1].left);
    });
  });
});
