"use strict";

// A PDF, written with nothing installed.
//
// This application already hands a business its records as a calendar file, a
// contact card, a CSV and a JSON export -- every one of them a text format that
// costs no dependency. The one missing is the one a customer most often needs:
// an invoice they can file with an accountant or attach to an email. Until now
// a shared invoice was a web page, which is fine to look at and impossible to
// keep.
//
// PDF turns out to belong on that list. It is a text container with an offset
// table, the fourteen standard fonts are guaranteed present in every conformant
// viewer so nothing has to be embedded, and node:zlib ships with the runtime.
// No dependency, no binary, no service, and it runs inside a serverless
// function in a few milliseconds.
//
// ## Why the widths are here rather than approximated
//
// Money on an invoice is right-aligned, and right-aligning needs to know how
// wide the text is. The tables below are the WX values from Adobe's own font
// metrics for Helvetica and Helvetica-Bold, character codes 32 to 126, parsed
// out of the AFM files rather than typed -- 95 values each.
//
// That parsing step is the point. The first attempt read the widths out of a
// summary of the file and got 91 of the 95: the values it did have were all
// correct, space was 278 and W was 944 and every spot check passed, and the
// four it had silently dropped would have shifted every column that contained
// one of them. A table that is right where you look and wrong where you do not
// is the exact defect this codebase is organised against, so the numbers came
// from the bytes in the end.
//
// ## What it cannot do, said plainly
//
// Exact widths cover ASCII 32 to 126. A character outside that range is written
// through WinAnsiEncoding, which most viewers render correctly, but its width
// is approximated -- `measure()` returns `approximated` so a caller can know,
// and it is never silently folded into the total. In practice this means a
// customer called Müller has a name a point or two narrower than measured, and
// every money column, being digits, stays exact.
//
// No images, no embedded fonts, no tables of contents, no forms. This is a
// document writer for records, not a layout engine.

const zlib = require("node:zlib");

// Adobe font metrics, character codes 32-126. Parsed from the AFM files on
// 25 August 2026; see the note above about why they were not transcribed.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 222, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  222, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 278, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  278, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
];

const FONTS = Object.freeze({
  regular: { key: "F1", base: "Helvetica", widths: HELVETICA },
  bold: { key: "F2", base: "Helvetica-Bold", widths: HELVETICA_BOLD }
});

// A4 in points, which is what PDF measures in. 72 to the inch.
const A4 = Object.freeze({ width: 595, height: 842 });

// The width used for a character outside 32-126. 'n' is close to the mean for
// both faces, so a name with an accent in it is out by a point rather than by
// a word. Never applied silently -- see measure().
const APPROXIMATE_CODE = "n".charCodeAt(0);

function widthOf(text, { font = "regular", size = 11 } = {}) {
  const table = (FONTS[font] || FONTS.regular).widths;
  let units = 0;
  let approximated = 0;
  for (const character of String(text)) {
    const code = character.codePointAt(0);
    if (code >= 32 && code <= 126) {
      units += table[code - 32];
    } else {
      units += table[APPROXIMATE_CODE - 32];
      approximated += 1;
    }
  }
  return { width: (units * size) / 1000, approximated };
}

// The width, and how many characters it had to guess at. Callers that care --
// anything right-aligned against a hard edge -- can look; callers that do not
// get a number that is right for every ASCII string.
function measure(text, options) {
  return widthOf(text, options);
}

// Greedy wrap on spaces, falling back to breaking a word that cannot fit on a
// line of its own. A long unbroken string -- a URL, an account number -- would
// otherwise run off the page silently.
function wrap(text, maxWidth, options = {}) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (widthOf(candidate, options).width <= maxWidth || !current) {
        if (widthOf(candidate, options).width > maxWidth && !current) {
          let piece = "";
          for (const character of word) {
            if (widthOf(piece + character, options).width > maxWidth && piece) {
              lines.push(piece);
              piece = character;
            } else {
              piece += character;
            }
          }
          current = piece;
          continue;
        }
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

// Backslash, and both parentheses, end a literal string early. A customer note
// containing "(see attached)" would truncate the document at that point and
// produce a file that opens to a blank page.
function escapeText(text) {
  return String(text).replace(/[\\()]/g, (character) => `\\${character}`);
}

// Bytes outside ASCII are written as octal escapes against WinAnsiEncoding,
// which is what the font resource declares. A raw multi-byte character in a
// literal string is read as two characters and renders as mojibake.
function encodeForPdf(text) {
  let out = "";
  for (const character of String(text)) {
    const code = character.codePointAt(0);
    if (code >= 32 && code <= 126) {
      out += escapeText(character);
    } else {
      const byte = winAnsiByte(code);
      out += byte === null ? "?" : `\\${byte.toString(8).padStart(3, "0")}`;
    }
  }
  return out;
}

// WinAnsi is Latin-1 for most of its range, with a handful of typographic
// characters in 128-159 that Latin-1 leaves undefined. Only the ones a business
// document actually produces are mapped; anything else becomes "?" rather than
// a byte that renders as something unrelated.
const WIN_ANSI_EXTRAS = new Map([
  [0x20ac, 128], [0x201a, 130], [0x0192, 131], [0x201e, 132], [0x2026, 133],
  [0x2020, 134], [0x2021, 135], [0x02c6, 136], [0x2030, 137], [0x0160, 138],
  [0x2039, 139], [0x0152, 140], [0x017d, 142], [0x2018, 145], [0x2019, 146],
  [0x201c, 147], [0x201d, 148], [0x2022, 149], [0x2013, 150], [0x2014, 151],
  [0x02dc, 152], [0x2122, 153], [0x0161, 154], [0x203a, 155], [0x0153, 156],
  [0x017e, 158], [0x0178, 159]
]);

function winAnsiByte(code) {
  if (code >= 32 && code <= 126) return code;
  if (WIN_ANSI_EXTRAS.has(code)) return WIN_ANSI_EXTRAS.get(code);
  if (code >= 160 && code <= 255) return code;
  return null;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * A document.
 *
 * Coordinates are given from the TOP left, because that is how everybody thinks
 * about a page and PDF's own origin is the bottom left. The conversion happens
 * in one place rather than at every call site.
 */
function createDocument({ size = A4, margin = 48 } = {}) {
  const pages = [];
  let current = null;
  let approximated = 0;

  function page() {
    current = { parts: [] };
    pages.push(current);
    return api;
  }

  function ensure() {
    if (!current) page();
    return current;
  }

  const api = {
    size,
    margin,

    page,

    text(value, { x = margin, y = margin, font = "regular", size: fontSize = 11, align = "left", width = null, colour = null } = {}) {
      const measured = widthOf(value, { font, size: fontSize });
      approximated += measured.approximated;
      let left = x;
      if (align === "right") left = x - measured.width;
      else if (align === "centre" && width !== null) left = x + (width - measured.width) / 2;

      const parts = ensure().parts;
      if (colour) parts.push(`${colour.map(round).join(" ")} rg`);
      parts.push(
        "BT",
        `/${FONTS[font] ? FONTS[font].key : FONTS.regular.key} ${round(fontSize)} Tf`,
        `1 0 0 1 ${round(left)} ${round(size.height - y - fontSize)} Tm`,
        `(${encodeForPdf(value)}) Tj`,
        "ET"
      );
      if (colour) parts.push("0 0 0 rg");
      return api;
    },

    paragraph(value, { x = margin, y = margin, width = size.width - margin * 2, font = "regular", size: fontSize = 11, leading = null } = {}) {
      const step = leading || fontSize * 1.35;
      const lines = wrap(value, width, { font, size: fontSize });
      lines.forEach((line, index) => api.text(line, { x, y: y + index * step, font, size: fontSize }));
      return { lines: lines.length, height: lines.length * step };
    },

    line(x1, y1, x2, y2, { thickness = 0.75, grey = 0.8 } = {}) {
      ensure().parts.push(
        `${round(grey)} G`,
        `${round(thickness)} w`,
        `${round(x1)} ${round(size.height - y1)} m ${round(x2)} ${round(size.height - y2)} l S`,
        "0 G"
      );
      return api;
    },

    rect(x, y, width, height, { grey = 0.95 } = {}) {
      ensure().parts.push(
        `${round(grey)} g`,
        `${round(x)} ${round(size.height - y - height)} ${round(width)} ${round(height)} re f`,
        "0 g"
      );
      return api;
    },

    measure,
    wrap,

    // How many characters had their width guessed at. Zero for any document
    // that is entirely ASCII, which is most invoices and every money column.
    get approximatedCharacters() {
      return approximated;
    },

    toBuffer() {
      if (!pages.length) page();
      return assemble(pages, size);
    }
  };

  return api;
}

// The file itself: objects, then a cross-reference table of byte offsets, then
// a trailer pointing at it. The offsets are the part a viewer trusts absolutely
// and the part that is invisible when wrong -- which is why the test walks them
// and checks each one lands on the object it claims.
function assemble(pages, size) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  const catalogNumber = add(null);
  const pagesNumber = add(null);
  const fontRegular = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS.regular.base} /Encoding /WinAnsiEncoding >>`);
  const fontBold = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS.bold.base} /Encoding /WinAnsiEncoding >>`);

  const pageNumbers = [];
  for (const page of pages) {
    const content = Buffer.from(page.parts.join("\n"), "latin1");
    const compressed = zlib.deflateSync(content);
    const streamNumber = add({ dictionary: `<< /Length ${compressed.length} /Filter /FlateDecode >>`, stream: compressed });
    const pageNumber = add(
      `<< /Type /Page /Parent ${pagesNumber} 0 R /MediaBox [0 0 ${size.width} ${size.height}] `
      + `/Resources << /Font << /${FONTS.regular.key} ${fontRegular} 0 R /${FONTS.bold.key} ${fontBold} 0 R >> >> `
      + `/Contents ${streamNumber} 0 R >>`
    );
    pageNumbers.push(pageNumber);
  }

  objects[catalogNumber - 1] = `<< /Type /Catalog /Pages ${pagesNumber} 0 R >>`;
  objects[pagesNumber - 1] = `<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNumbers.length} >>`;

  const chunks = [];
  let offset = 0;
  const push = (buffer) => { chunks.push(buffer); offset += buffer.length; };

  push(Buffer.from("%PDF-1.4\n", "latin1"));
  // A binary comment on line two tells anything transferring the file that it
  // is not text. Without it a naive FTP or mail gateway may translate line
  // endings and corrupt every stream in the document.
  push(Buffer.from("%\xe2\xe3\xcf\xd3\n", "latin1"));

  const offsets = [0];
  objects.forEach((body, index) => {
    offsets[index + 1] = offset;
    push(Buffer.from(`${index + 1} 0 obj\n`, "latin1"));
    if (body && typeof body === "object" && body.stream) {
      push(Buffer.from(`${body.dictionary}\nstream\n`, "latin1"));
      push(body.stream);
      push(Buffer.from("\nendstream\n", "latin1"));
    } else {
      push(Buffer.from(`${body}\n`, "latin1"));
    }
    push(Buffer.from("endobj\n", "latin1"));
  });

  const xrefOffset = offset;
  const lines = [`xref`, `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let i = 1; i <= objects.length; i += 1) {
    lines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  push(Buffer.from(`${lines.join("\n")}\n`, "latin1"));
  push(Buffer.from(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    "latin1"
  ));

  return Buffer.concat(chunks);
}

module.exports = { createDocument, measure, wrap, widthOf, encodeForPdf, escapeText, winAnsiByte, A4, FONTS, HELVETICA, HELVETICA_BOLD };
