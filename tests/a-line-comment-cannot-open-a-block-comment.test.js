"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { withoutComments, withoutSqlComments } = require("../lib/sonara-comment-stripping.cjs");

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

  describe("every script that strips comments", () => {
    // This list was two names, typed by hand: report-orphan-tables and
    // report-unused-selected-columns, the two whose copies were fixed when the
    // shared module was written.
    //
    // Two others were never added to it. scripts/report-unreferenced-modules.mjs
    // kept the original two-pass strip for as long as the module has existed --
    // and it was not harmless there: on routes/sonara-last9-routes.cjs the line
    // comment `// /business-builder/owner/*` opened a false block that ran 971
    // lines, erasing 57% of the file and with it a require. That direction of
    // error makes a module that IS required look unreferenced, and --check
    // fails the build over it. scripts/report-security-definer-exposure.mjs had
    // the same shape for SQL.
    //
    // A hand-typed list is updated by whoever remembers, and the person adding
    // a fourth copy is the person who forgets. So the population is read from
    // scripts/ instead: anything that looks like it strips comments must use
    // the shared module.
    const scriptsDirectory = path.join(__dirname, "..", "scripts");

    // How a stripping script is recognised, and why it is not "contains the
    // buggy regex".
    //
    // That was the first version of this and it defeats itself: the moment a
    // script is fixed it stops containing the literal, so the population decays
    // to zero as the bug is fixed and the check goes quiet exactly when it has
    // finished working. The gone-blind guard below caught it on the first run.
    //
    // So the population is "scripts that strip comments at all" -- by calling
    // one of the shared functions, or by carrying a private block-comment regex
    // literal. A fixed script still matches through its call; a new script with
    // its own copy matches through the literal. Both are then required to use
    // the shared module, which only the second can fail.
    const PRIVATE_BLOCK_REGEX = "/\\*[\\s\\S]*?\\*\\/";

    const strippers = fs
      .readdirSync(scriptsDirectory)
      .filter((name) => /\.(mjs|cjs|js)$/.test(name))
      .filter((name) => {
        const source = fs.readFileSync(path.join(scriptsDirectory, name), "utf8");
        // Importing the shared module keeps a fixed script in the population,
        // so the check cannot decay to zero as the bug is fixed. The literal
        // catches a new private copy. A script that strips only `--` line
        // comments and never looks at block comments -- as
        // generate-tenant-scoped-tables.cjs did -- has no ordering hazard to
        // get wrong, so naming a variable `withoutComments` is not enough to
        // be in scope here.
        return source.includes("sonara-comment-stripping.cjs") || source.includes(PRIVATE_BLOCK_REGEX);
      });

    it("finds the scripts that strip, so this does not pass by matching none", () => {
      assert.ok(
        strippers.length >= 2,
        `only ${strippers.length} comment-stripping scripts found in scripts/; this check has gone blind`
      );
    });

    // Four copies of one function is four chances for one of them to be subtly
    // wrong, and the wrong one is the one nobody re-reads.
    it("share this one implementation rather than each keeping a copy", () => {
      for (const name of strippers) {
        const source = fs.readFileSync(path.join(scriptsDirectory, name), "utf8");
        assert.match(
          source,
          /sonara-comment-stripping\.cjs/,
          `scripts/${name} strips comments without using the shared stripper; that is how the same bug shipped three times`
        );
      }
    });

    it("does not define a local withoutComments alongside the shared one", () => {
      for (const name of strippers) {
        const source = fs.readFileSync(path.join(scriptsDirectory, name), "utf8");
        assert.doesNotMatch(
          source,
          /function withoutComments/,
          `scripts/${name} has its own copy again; the next bug in it will only be fixed here`
        );
      }
    });
  });

  describe("the SQL form", () => {
    it("does not let a slash-star inside a line comment swallow the SQL after it", () => {
      // The real case: six migrations carry this line.
      const sql = [
        "-- lib/catalog/*.cjs, so the table wins wherever it holds a value.",
        "create function f() returns void as $x$ begin end $x$ security definer;"
      ].join("\n");
      assert.match(withoutSqlComments(sql), /security definer/, "the statement after the line comment was swallowed");
    });

    it("still removes the comments it is for", () => {
      assert.doesNotMatch(withoutSqlComments("/* block */ select 1;"), /block/);
      assert.doesNotMatch(withoutSqlComments("select 1; -- trailing note"), /trailing note/);
    });
  });
});
