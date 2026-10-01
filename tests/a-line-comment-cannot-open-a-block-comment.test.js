"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { withoutComments, withoutSqlComments , withoutCssComments } = require("../lib/sonara-comment-stripping.cjs");

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

  describe("the CSS form", () => {
    // `//` is not a comment in CSS. The JavaScript alternation would treat a
    // protocol-relative url() as one and blank the rest of the line, taking the
    // closing brace with it -- so a stylesheet needs its own single branch.
    // Substring checks rather than `assert.match`, because that is what these
    // three actually are: the question is whether stripping left the text in
    // place, not whether the text has a shape. CodeQL was right to object to
    // the first draft -- an unanchored regex over a hostname is a URL check
    // that matches anywhere, and even in a test it is the habit worth not
    // having.
    it("leaves a protocol-relative url alone", () => {
      const css = ".a { background: url(//cdn.example.com/x.png); color: red; }";
      const stripped = withoutCssComments(css);
      assert.ok(stripped.includes("url(//cdn.example.com/x.png)"), "the url was read as a comment");
      assert.ok(stripped.includes("color: red"), "the rest of the rule was swallowed");
      assert.ok(stripped.includes("}"), "the closing brace was swallowed");
    });

    it("still removes the comments it is for", () => {
      assert.doesNotMatch(withoutCssComments("/* note */ .a { color: red }"), /note/);
      assert.doesNotMatch(withoutCssComments(".a { color: red } /* trailing\nover two lines */"), /trailing/);
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

  // Two more failures of the same family, both measured on 1 October 2026.
  describe("a string is not code, and a line is a line", () => {
    // server.js sets a Content-Security-Policy containing
    // `connect-src 'self' https://*.supabase.co`. Those are the characters `/`
    // and `*` adjacent, inside a double-quoted string, and the old block branch
    // read them as an opener and swallowed to the next `*/` anywhere in the
    // file. The `[^:]` guard was written for the https:// half of this and is no
    // help: it is on the line branch, and the damage came from the block branch
    // one character later.
    it("does not let a slash-star inside a string open a comment", () => {
      const source = [
        'res.setHeader("Content-Security-Policy", "connect-src \'self\' https://*.supabase.co");',
        "next();",
        "/* a real comment */",
        "after();"
      ].join("\n");
      const stripped = withoutComments(source);
      assert.match(stripped, /next\(\);/, "the statement after the CSP header was swallowed");
      assert.match(stripped, /after\(\);/, "everything to the next close-comment was swallowed");
      assert.match(stripped, /https:\/\/\*\.supabase\.co/, "the policy value itself was mangled");
      assert.doesNotMatch(stripped, /a real comment/, "the comment it is for survived");
    });

    it("leaves a comment marker inside a string alone", () => {
      for (const source of ['const s = "/* not a comment */"; real();', "const s = '// not a comment'; real();", "const s = `/* nor this */`; real();"]) {
        assert.match(withoutComments(source), /real\(\);/, `swallowed code after ${source}`);
      }
    });

    // A regular expression is not parsed here, but its escapes must not be read
    // as a comment opener: `/https?:\/\//g` ends with an escaped slash and the
    // literal's terminator, which land adjacent to a naive scanner.
    it("does not read a regular expression's escaped slashes as a comment", () => {
      const stripped = withoutComments("const r = /https?:\\/\\//g;\nnext();");
      assert.match(stripped, /next\(\);/, "the line after a regex literal was swallowed");
      assert.match(stripped, /\/https\?:\\\/\\\/\/g/, "the literal itself was cut");
    });

    it("follows a template interpolation back into code, braces and all", () => {
      const source = "const t = `x ${ list.map((i) => { return i; }) } y`; // gone\nz();";
      const stripped = withoutComments(source);
      assert.match(stripped, /z\(\);/);
      assert.match(stripped, /return i;/, "code inside the interpolation was dropped");
      assert.doesNotMatch(stripped, /gone/);
    });

    // What following the interpolation is actually for, and the first version of
    // the case above did not test it: copying a template through verbatim keeps
    // every character inside `${ }` too, comments included. This repository is
    // full of templates that build SQL filters and HTML, and a consumer asking
    // "does this file name `growth_leads`?" would count a commented-out mention
    // inside one as a real one.
    //
    // Removing the interpolation branch leaves the case above green, which is
    // how this one came to be written.
    it("removes a comment that is inside a template interpolation", () => {
      const stripped = withoutComments("const q = `?select=${ /* swallow me */ columns }&limit=1`;");
      assert.doesNotMatch(stripped, /swallow me/, "a comment inside ${} survived into the stripped text");
      assert.match(stripped, /columns/, "the expression beside it was dropped");
      assert.match(stripped, /\?select=/, "the literal text around it was dropped");
    });

    it("removes a line comment inside a multi-line template interpolation", () => {
      const source = [
        "const q = `${",
        "  // a note nobody should count",
        "  table",
        "}`;"
      ].join("\n");
      const stripped = withoutComments(source);
      assert.doesNotMatch(stripped, /a note nobody should count/);
      assert.match(stripped, /table/);
      assert.equal(stripped.split("\n").length, 4, "and the line count still holds");
    });

    it("handles a template nested inside an interpolation", () => {
      const stripped = withoutComments('const t = `a${`b${"c"}`}d`;\nnext();');
      assert.match(stripped, /next\(\);/);
      assert.match(stripped, /`a\$\{`b\$\{"c"\}`\}d`/);
    });

    // The line-number half. sourceBlockForRoute in
    // scripts/generate-capability-inventory.cjs takes a line number from a V8
    // stack trace and indexes into stripped text, so collapsing a multi-line
    // comment to one space made it read the wrong lines -- further wrong the
    // further down the file a route was registered. Adding one three-line JSDoc
    // block to server.js moved data/capability-inventory.json from 50 recorded
    // UI form links to 42.
    it("keeps the line count unchanged", () => {
      const fixture = ["const a = 1;", "/**", " * two", " * three", " */", "const b = 2;", "// four", "const c = 3;"].join("\n");
      assert.equal(withoutComments(fixture).split("\n").length, fixture.split("\n").length);
      assert.equal(withoutComments(fixture).split("\n")[5].trim(), "const b = 2;", "line 6 moved");
    });

    it("does not gain a line per whole-line comment either", () => {
      // Whole-line comments, not trailing ones. The captured character before a
      // trailing `//` is a space; before a comment that starts its own line it
      // is the previous newline, which is the one a naive count counts twice.
      const many = Array.from({ length: 50 }, (unused, index) => `// note ${index}\nstep(${index});`).join("\n");
      assert.equal(withoutComments(many).split("\n").length, 100);
    });

    it("keeps the line count of SQL and CSS unchanged too", () => {
      const sql = ["-- one", "/* two", "   three */", "select 1;"].join("\n");
      assert.equal(withoutSqlComments(sql).split("\n").length, 4);
      assert.equal(withoutSqlComments(sql).split("\n")[3].trim(), "select 1;");
      const css = [".a {", "/* two", "   three */", "  color: red;", "}"].join("\n");
      assert.equal(withoutCssComments(css).split("\n").length, 5);
      assert.equal(withoutCssComments(css).split("\n")[3].trim(), "color: red;");
    });

    // The one that cannot be satisfied by a fixture written to pass it: every
    // JavaScript file the release chain actually strips, asserted to come back
    // with the same number of lines and with every line of code still on its own
    // line.
    describe("measured against the files the release chain strips", () => {
      const root = path.join(__dirname, "..");
      const files = [];
      (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (["node_modules", ".git", ".next", "artifacts"].includes(entry.name)) continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(c|m)?js$/.test(entry.name)) files.push(full);
        }
      })(path.join(root, "lib"));
      for (const directory of ["routes", "scripts", "api"]) {
        (function walk(dir) {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (["node_modules", ".git", ".next"].includes(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(c|m)?js$/.test(entry.name)) files.push(full);
          }
        })(path.join(root, directory));
      }
      files.push(path.join(root, "server.js"));

      it("reads a population worth measuring", () => {
        assert.ok(files.length >= 300, `only ${files.length} JavaScript files found; this check has gone blind`);
      });

      it("renumbers none of them", () => {
        const drifted = [];
        for (const file of files) {
          const raw = fs.readFileSync(file, "utf8");
          if (raw.split("\n").length !== withoutComments(raw).split("\n").length) drifted.push(path.relative(root, file));
        }
        assert.deepEqual(drifted, [], "stripping changed the line count of these files");
      });

      it("swallows no code in any of them", () => {
        const lost = [];
        for (const file of files) {
          const raw = fs.readFileSync(file, "utf8");
          const stripped = withoutComments(raw).split("\n");
          const lines = raw.split("\n");
          const expected = codeOnEachLine(raw);
          for (let index = 0; index < lines.length; index += 1) {
            const want = expected[index];
            if (!want) continue;
            // Whitespace is not the property under test: a removed comment
            // leaves a space behind, so compare with runs of spaces collapsed.
            const flatten = (value) => value.replace(/\s+/g, " ").trim();
            if (!flatten(stripped[index] || "").includes(flatten(want))) {
              lost.push(`${path.relative(root, file)}:${index + 1}`);
            }
          }
        }
        assert.deepEqual(lost.slice(0, 10), [], `${lost.length} line(s) of code were swallowed by stripping`);
      });

      // The limit, recorded as a fact rather than as a claim.
      //
      // The first version of this case searched every file for a regex character
      // class containing `/*` and asserted none existed. It failed, on
      // lib/sonara-comment-stripping.cjs -- and the match was in the *comment*
      // where that limit is written down, `/[/*]/` as an example. A check that
      // reads prose as code is the seventh shape in
      // .claude/skills/checks-that-cannot-lie, found by running the check rather
      // than by reading it, in the very file about not doing this.
      //
      // The repo-wide assertion above already measures the thing that matters --
      // no code swallowed in any file. So this states the known limit directly,
      // where it cannot false-positive and cannot quietly stop being true.
      it("would still misread an unescaped slash-star inside a regex, and says so", () => {
        const stripped = withoutComments("const r = /[/*]/;\nnext();");
        assert.doesNotMatch(stripped, /next\(\);/,
          "the scanner now handles regex literals; update the documented limit in lib/sonara-comment-stripping.cjs");
      });
    });
  });
});

// An independent reading of which code each line must keep, written without
// reference to the implementation so the test is not checking the stripper
// against itself.
function codeOnEachLine(source) {
  const kept = [];
  let inBlock = false;
  for (const line of source.split("\n")) {
    let out = "";
    let quote = null;
    let index = 0;
    while (index < line.length) {
      const char = line[index];
      const next = line[index + 1];
      if (inBlock) {
        if (char === "*" && next === "/") { inBlock = false; index += 2; continue; }
        index += 1;
        continue;
      }
      if (quote) {
        if (char === "\\") { out += line.slice(index, index + 2); index += 2; continue; }
        out += char;
        index += 1;
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") { quote = char; out += char; index += 1; continue; }
      if (char === "\\") { out += line.slice(index, index + 2); index += 2; continue; }
      if (char === "/" && next === "/") break;
      if (char === "/" && next === "*") { inBlock = true; index += 2; continue; }
      out += char;
      index += 1;
    }
    kept.push(out.trim());
  }
  return kept;
}
