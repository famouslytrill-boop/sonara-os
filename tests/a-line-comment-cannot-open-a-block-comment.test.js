"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { withoutComments } = require("../lib/sonara-comment-stripping.cjs");

// Two release-chain reports decide what the code "names" by stripping comments
// first, so this function is the parser both of them measure through. When it
// stops matching, they do not fail -- they report confidently about a smaller
// file than the one on disk.
describe("stripping comments before measuring what code names", () => {
  it("removes a block comment", () => {
    assert.equal(/keep/.test(withoutComments("keep /* drop */ keep")), true);
    assert.equal(/drop/.test(withoutComments("keep /* drop */ keep")), false);
  });

  it("removes a line comment", () => {
    assert.equal(/drop/.test(withoutComments("keep // drop\nkeep")), false);
  });

  // The bug. A line comment mentioning a path contains `/*`; two-pass stripping
  // treats it as an opener and deletes everything up to the next `*/`.
  it("does not let a slash-star inside a line comment swallow the code after it", () => {
    const source = [
      "// serves /business-builder/owner/* and nothing else",
      "const kept = invoice.invoice_number;",
      "try { work(); } catch { /* deliberately ignored */ }",
      "const alsoKept = row.total_cents;"
    ].join("\n");

    const stripped = withoutComments(source);
    assert.match(stripped, /invoice_number/, "code between the two markers was swallowed");
    assert.match(stripped, /total_cents/);
    assert.doesNotMatch(stripped, /deliberately ignored/, "the real block comment should still go");
  });

  // The guard that was already there, kept because removing it is the obvious
  // "simplification" and it breaks every URL in the codebase.
  it("does not treat the slashes in an https URL as a comment", () => {
    assert.match(withoutComments('const u = "https://example.supabase.co/rest/v1/x";'), /example\.supabase\.co/);
  });

  it("replaces a comment with a space rather than nothing", () => {
    // Otherwise removing a comment can weld two identifiers into a third that
    // was never written, and the measurement finds a name nobody typed.
    assert.doesNotMatch(withoutComments("alpha/* x */beta"), /alphabeta/);
  });

  describe("the two reports that depend on it", () => {
    const scripts = ["scripts/report-orphan-tables.mjs", "scripts/report-unused-selected-columns.mjs"];

    // Both had their own copy and both copies had the same bug. One
    // implementation is the only reason fixing it once is enough.
    it("share this one implementation rather than each keeping a copy", () => {
      for (const script of scripts) {
        const source = fs.readFileSync(require.resolve(`../${script}`), "utf8");
        assert.match(source, /sonara-comment-stripping\.cjs/, `${script} should use the shared stripper`);
        assert.doesNotMatch(
          source,
          /function withoutComments/,
          `${script} has its own copy again; the next bug in it will only be fixed here`
        );
      }
    });
  });
});
