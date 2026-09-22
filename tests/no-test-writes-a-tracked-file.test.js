// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// No test writes into the repository it is testing.
//
// Two tests here had to break something to prove a gate notices, and both did
// it to the **real tracked file**, restoring in a `finally`. A `finally`
// survives a thrown assertion. It does not survive a signal.
//
// That is not a hypothetical. An interrupted run of this suite left
// `supabase/migrations/20260728120000_member_read_policies.sql` truncated to 33
// unterminated `execute '` statements and `.ai/shared/CURRENT_STATE.md` missing
// the `<!-- superseded-by: -->` pointer its own gate reads. Nothing in the
// working tree said why, `pnpm run verify:launch` then failed for reasons that
// looked unrelated, and `git add -A` would have committed both.
// `an-applied-migration-cannot-be-edited` had a case that **deleted** a frozen
// migration outright.
//
// Both now mutate a copy -- tests/helpers/script-sandbox.cjs -- and this stops
// a third arriving. It reads the test sources rather than watching a run,
// because the failure only appears when a run is interrupted, which is not
// something a test can arrange for itself.
//
// ## What this can and cannot see
//
// It finds a write whose path is built from the repository root: `root`,
// `ROOT`, `repoRoot`, or `__dirname` joined with `".."`. A test that computed a
// path some other way would not be caught, so this is a floor rather than a
// proof -- which is why the message names the helper rather than claiming the
// suite is clean.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { withoutComments } = require("../lib/sonara-comment-stripping.cjs");

const testsDirectory = __dirname;

// A path rooted at the repository, not at os.tmpdir(). `sandbox.file(...)` and
// `path.join(base, ...)` are the safe forms and are deliberately not matched.
const ROOT_ANCHOR = /\b(?:root|ROOT|repoRoot)\b|__dirname\s*,\s*["'`]\.\.["'`]/;
const MUTATION = /\bfs\.(writeFileSync|appendFileSync|unlinkSync|rmSync|renameSync|cpSync|copyFileSync|truncateSync)\s*\(/g;

// Which argument is the thing being written. For a copy, a rename and a
// recursive copy the first argument is the SOURCE, and reading from the
// repository into a temp directory is exactly what the sandbox helper does --
// the first version of this check looked at the whole argument list and
// reported `copyFileSync(path.join(ROOT, "server.js"), path.join(base, ...))`
// as a write into the repository, which is backwards.
const DESTINATION_ARGUMENT = Object.freeze({
  writeFileSync: 0,
  appendFileSync: 0,
  unlinkSync: 0,
  rmSync: 0,
  truncateSync: 0,
  copyFileSync: 1,
  cpSync: 1,
  renameSync: 1
});

// A destination is often a variable rather than a path expression, so the text
// at the call site says nothing on its own. `orphan-tables.test.js` writes to
// `migration`, declared twelve lines earlier as
// `path.join(__dirname, "..", "supabase", "migrations", ...)` -- a real write
// into the repository that the first narrowed version of this check missed
// entirely. One level of resolution, from the nearest preceding declaration,
// the same way scripts/report-tenant-scoped-queries.mjs resolves a query
// variable. Deeper chains are not followed, so this stays a floor.
function resolveIdentifier(source, before, name) {
  const declaration = new RegExp(`(?:const|let|var)\\s+${name}\\s*=([^;\\n]*(?:\\n[^;]*)?);`, "g");
  let text = null;
  for (const match of source.slice(0, before).matchAll(declaration)) text = match[1];
  return text;
}

// The argument at `index`, split on commas at bracket depth zero so
// `path.join(a, b)` counts as one argument rather than two.
function argumentAt(source, openParen, index) {
  let depth = 0;
  let current = 0;
  let start = openParen + 1;
  for (let at = start; at < source.length; at += 1) {
    const character = source[at];
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") {
      if (character === ")" && depth === 0) return current === index ? source.slice(start, at) : null;
      depth -= 1;
    } else if (character === "," && depth === 0) {
      if (current === index) return source.slice(start, at);
      current += 1;
      start = at + 1;
    }
  }
  return null;
}

// Writes into a path the repository owns, with the reason each one is not the
// hazard above. Two-sided: an entry naming a file that no longer writes
// anything fails, so a reason cannot outlive its subject.
const ALLOWED = new Map([
  [
    "tests/helpers/script-sandbox.cjs",
    "the helper itself. It copies FROM the repository INTO os.tmpdir(), which is the fix rather than the defect."
  ]
]);

function testFiles() {
  return fs
    .readdirSync(testsDirectory)
    .filter((name) => /\.test\.js$/.test(name))
    .sort();
}

describe("no test writes a tracked file", () => {
  it("finds the test files at all, so this cannot pass by reading nothing", () => {
    const files = testFiles();
    // 363 on 21 September 2026. The floor is far below that and far above zero.
    assert.ok(files.length >= 200, `only ${files.length} test file(s) found; this check has gone blind`);
  });

  it("names no test that writes through a repository-rooted path", () => {
    const offenders = [];
    let mutationsSeen = 0;

    for (const name of testFiles()) {
      const relative = `tests/${name}`;
      if (ALLOWED.has(relative)) continue;
      const source = withoutComments(fs.readFileSync(path.join(testsDirectory, name), "utf8"));

      for (const match of source.matchAll(MUTATION)) {
        mutationsSeen += 1;
        const call = match[1];
        const openParen = source.indexOf("(", match.index + match[0].length - 1);
        const destination = argumentAt(source, openParen, DESTINATION_ARGUMENT[call]);
        if (destination === null) continue;

        const trimmed = destination.trim();
        let target = trimmed;
        // A bare identifier tells us nothing; its declaration does.
        if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
          const declared = resolveIdentifier(source, match.index, trimmed);
          if (declared) target = declared;
        }

        if (ROOT_ANCHOR.test(target)) {
          offenders.push(`${relative}: fs.${call}(${trimmed.slice(0, 60)}) -> ${target.trim().replace(/\s+/g, " ").slice(0, 110)}`);
        }
      }
    }

    // A pattern matching no write at all would pass while watching nothing --
    // the shape this whole file is about, one level up. Tests write to temp
    // directories constantly, so zero is a broken pattern rather than a clean
    // suite.
    assert.ok(
      mutationsSeen >= 20,
      `only ${mutationsSeen} filesystem write(s) found across the suite; this check has gone blind rather than found nothing`
    );

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} test write(s) resolve against the repository root. A \`finally\` that restores them `
        + "survives a failed assertion and not a signal, and an interrupted run leaves the tree dirty or a file "
        + "missing. Use createScriptSandbox from tests/helpers/script-sandbox.cjs and mutate the copy:\n  "
        + offenders.join("\n  ")
    );
  });

  it("keeps the allowances describing something", () => {
    for (const [relative, reason] of ALLOWED) {
      const file = path.join(testsDirectory, "..", relative);
      assert.ok(fs.existsSync(file), `${relative} is allowed and absent. Reason on record: ${reason}`);
      const source = withoutComments(fs.readFileSync(file, "utf8"));
      assert.match(
        source,
        MUTATION,
        `${relative} is allowed to write and no longer writes anything. Remove the entry: a reason that outlives `
          + `its subject is what the next reader believes instead of checking. Reason on record: ${reason}`
      );
    }
  });
});
