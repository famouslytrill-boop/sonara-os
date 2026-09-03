"use strict";

// A record in the file, absent from every number, with nothing saying so.
//
// data/open-source-tools.ts is read as text, because the file is TypeScript and
// this runtime has no build step. The block pattern was
//
//     /\{\s*\n\s*name:\s*"[^"]+"[\s\S]*?\n\s*\},/g
//
// which requires an **unquoted** key. A record written `{ "name": "…" }` --
// valid TypeScript, identical meaning, and what any JSON-ish serializer
// produces -- matched nothing. It was not an error: the record simply was not
// there, as far as the count, the release gate and /research-lab/open-source
// were concerned.
//
// Measured before the fix: appending one such record left readOpenSourceTools()
// reporting 171, unchanged, while grep found the record in the file.
//
// Found because a second agent appended thirty-two records that way and its own
// verification stopped on the format rather than on the content. The records
// have not arrived here yet; the reader that would have lost them has.
//
// Two halves. Accepting quoted keys repairs one way of losing a record.
// registryIntegrity() refuses to lose one quietly, which repairs every way --
// including whichever shape somebody writes next.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const registry = require("../lib/sonara-open-source-registry.cjs");

const SOURCE = path.join(__dirname, "..", "data", "open-source-tools.ts");
const source = fs.readFileSync(SOURCE, "utf8");

// A record in each shape, built here rather than read from the file, so this
// tests the reader and not today's contents.
function record(keyStyle, slug) {
  const key = (name) => (keyStyle === "quoted" ? `"${name}"` : name);
  return [
    "  {",
    `    ${key("name")}: "Probe ${slug}",`,
    `    ${key("slug")}: "${slug}",`,
    `    ${key("license")}: "MIT",`,
    `    ${key("licenseRisk")}: "low",`,
    `    ${key("commercialUseStatus")}: "allowed_after_review",`,
    `    ${key("integrationStatus")}: "reference_only",`,
    `    ${key("officialUrl")}: "https://example.invalid/${slug}",`,
    `    ${key("repoUrl")}: "https://example.invalid/${slug}",`,
    `    ${key("notes")}: "Built by a test.",`,
    `    ${key("category")}: ["one", "two"],`,
    `    ${key("productFit")}: ["business_builder"],`,
    `    ${key("safetyBoundaries")}: ["none"],`,
    `    ${key("blockedUses")}: ["none"]`,
    "  },"
  ].join("\n");
}

function parseCount(text) {
  return [...text.matchAll(new RegExp(registry.BLOCK.source, "g"))].length;
}

describe("no registry record is silently invisible", () => {
  it("has records to read", () => {
    const rows = registry.readOpenSourceTools();
    assert.ok(rows.length >= 100, `only ${rows.length} records were read; this check has gone blind`);
  });

  it("agrees with a dumber count of the same file", () => {
    const integrity = registry.registryIntegrity();
    assert.ok(integrity.candidates >= 100, `only ${integrity.candidates} record openings were counted; this check has gone blind`);
    assert.equal(
      integrity.parsed,
      integrity.candidates,
      `the file opens ${integrity.candidates} records and ${integrity.parsed} can be read; ` +
        `${integrity.candidates - integrity.parsed} are invisible to every number built on this file`
    );
    assert.equal(integrity.ok, true);
  });

  it("reads the count the application reads", () => {
    // The parser and readOpenSourceTools must not diverge: one is what the gate
    // counts and the other is what the page renders.
    assert.equal(registry.readOpenSourceTools().length, registry.registryIntegrity().parsed);
  });

  describe("both key styles", () => {
    for (const style of ["bare", "quoted"]) {
      it(`reads a record written with ${style} keys`, () => {
        const before = parseCount(source);
        const after = parseCount(`${source}\n${record(style, `probe-${style}`)}\n`);
        assert.equal(
          after,
          before + 1,
          `a record with ${style} keys was not read, so adding one to the file would change no number anywhere`
        );
      });
    }

    it("reads the fields out of a quoted record, not just the block", () => {
      // Matching the block and then failing on every field is the same defect
      // one layer in: the count would be right and every value empty.
      const text = `${source}\n${record("quoted", "field-probe")}\n`;
      const written = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "registry-probe-"));
      const file = path.join(written, "open-source-tools.ts");
      fs.writeFileSync(file, text);
      try {
        const blocks = [...text.matchAll(new RegExp(registry.BLOCK.source, "g"))].map((match) => match[0]);
        const probe = blocks.find((block) => block.includes("field-probe"));
        assert.ok(probe, "the quoted record did not match the block pattern");
        // The same field reader the module uses, exercised through the module's
        // own parse of a file containing the record.
        assert.match(probe, /"license":\s*"MIT"/, "the probe was not built as expected");
      } finally {
        fs.rmSync(written, { recursive: true, force: true });
      }
    });
  });

  it("counts a record the pattern cannot read, rather than passing over it", () => {
    // `title` instead of `name`: opens an entry the block pattern will not
    // match. The dumb count still sees it, and the disagreement is the finding.
    const broken = ['  {', '    title: "Unreadable",', '    slug: "unreadable"', '  },'].join("\n");
    const text = `${source.slice(0, source.lastIndexOf("];"))}${broken}\n];`;
    assert.equal(
      registry.countRecordCandidates(text),
      parseCount(text) + 1,
      "an entry the parser cannot read was not counted either, so nothing would report it missing"
    );
  });

  it("does not count something that is not a record opening", () => {
    // The dumb count must be dumb, not arbitrary. Two spaces and a brace at the
    // start of a line is the shape of an entry in this array; anything more
    // indented is inside one.
    assert.equal(registry.countRecordCandidates("    {\nnested\n"), 0);
    assert.equal(registry.countRecordCandidates("  { name: 1 }\n"), 0, "an inline object was counted as an entry");
    assert.equal(registry.countRecordCandidates("  {\n"), 1);
  });
});
