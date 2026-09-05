"use strict";

// A test file can be loaded by mocha, print nothing wrong, and assert nothing.
//
// On 4 September 2026 a file was added to `tests/` that used `node:test`:
//
//     const test = require("node:test");
//     test("the gate fails when ...", () => { ... });
//
// It ran green under `node --test`. Under `pnpm test` mocha loaded it, the
// `test()` calls registered nine cases with **node's** runner, node's runner
// never ran, and mocha reported exactly the same total as before. Nine
// assertions written specifically to prove a gate could fail were themselves
// incapable of failing anything. It was caught because the total did not move.
//
// Nothing in this repository would have caught it. `the-handoff-counts-what-
// mocha-runs.test.js` counts the files mocha *loads*, which included it.
//
// ## The property, stated so it is checkable
//
// **Every file under `tests/` must be able to turn the suite red.** There are
// two honest ways to satisfy that, and one way to look like you have:
//
//   registers mocha cases     `describe` / `it` -- 284 files do this
//   asserts at load time      four `.mjs` files do this; mocha runs top-level
//                             code when it loads a file, so a failed assert
//                             aborts the load and fails the run. Verified on
//                             4 September 2026 by pointing
//                             `platform-prep.test.mjs` at a document that does
//                             not exist and watching `pnpm test` go red.
//   registers with node:test  looks like the first and behaves like neither
//
// So the first check below is a flat prohibition on the third, and the second
// is a two-sided register of the files that take the load-time route.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const portablePath = (value) => value.split(path.sep).join("/");

// The four files that assert at load time rather than registering cases. This
// is deliberately a register and not a threshold: a fifth file appearing here
// is a decision somebody should make on purpose, and a file leaving it is a
// reason that has expired. Both directions fail.
const ASSERTS_AT_LOAD_TIME = new Map([
  ["tests/brand-assets.test.mjs", "checks the SVG brand assets and the web manifest that ship in public/"],
  ["tests/brand-registry.test.mjs", "checks lib/sonara-brand-registry.cjs, the registry the deployed pages read"],
  ["tests/brand-routes.test.mjs", "renders the real Express app and checks the brand copy a customer sees"],
  ["tests/platform-prep.test.mjs", "checks the package scripts, manifest and launch documents exist"]
]);

/**
 * Source with comments removed, so a file that *describes* the mistake is not
 * mistaken for one that makes it. The first version of the check below scanned
 * raw text and flagged this very file, because the paragraph above quotes the
 * offending line. Prose is not code, and a check that cannot tell them apart is
 * one somebody switches off.
 *
 * Line comments only when `//` opens the line, and block comments wholesale --
 * enough to read an import statement, and deliberately not a JavaScript parser.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/** Every file mocha's own spec matches, derived from `.mocharc.json`. */
function filesMochaLoads() {
  const spec = JSON.parse(fs.readFileSync(path.join(root, ".mocharc.json"), "utf8")).spec;
  const extensions = new Set([spec].flat().map((glob) => path.extname(glob)).filter(Boolean));
  const found = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (extensions.has(path.extname(entry.name))) found.push(relative);
    }
  };
  walk("tests");
  return found;
}

/**
 * Which files actually register a case, asked of mocha rather than inferred
 * from the source. `--dry-run` loads every file and reports the cases without
 * running their bodies, which is the only answer that cannot disagree with the
 * runner. Load-time assertions do still execute during it, which is why this
 * costs a couple of seconds rather than nothing.
 */
function filesRegisteringCases() {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mocha-dry-")), "dry.json");
  const run = spawnSync(
    "npx",
    ["mocha", "--dry-run", "--reporter", "json", "--reporter-option", `output=${output}`],
    { cwd: root, encoding: "utf8", timeout: 300000 }
  );
  assert.ok(fs.existsSync(output), `mocha --dry-run produced no report:\n${run.stdout}\n${run.stderr}`);
  const report = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.ok(
    report.stats.tests >= 3000,
    `mocha --dry-run reported only ${report.stats.tests} cases; this check has gone blind`
  );
  return new Set(report.tests.map((entry) => portablePath(path.relative(root, entry.file))));
}

describe("every test file can fail the suite", () => {
  const loaded = filesMochaLoads();

  it("found a suite to examine, so this is not comparing two empty lists", () => {
    assert.ok(loaded.length >= 200, `only ${loaded.length} files matched the mocha spec; this check has gone blind`);
  });

  it("no test file registers cases with a runner that is not the one running", () => {
    // The exact bug. `node:test` is not wrong in itself -- it is wrong here,
    // because `.mocharc.json` makes mocha the runner and node's registrations
    // are silently discarded. A file using it reports nothing and looks like a
    // file reporting everything.
    const offenders = loaded.filter((file) => {
      const source = withoutComments(fs.readFileSync(path.join(root, file), "utf8"));
      return /\b(?:require\(|from\s+)["']node:test["']/.test(source);
    });
    assert.deepEqual(
      offenders,
      [],
      `${offenders.join(", ")} import node:test. Mocha runs this suite (.mocharc.json), so cases registered ` +
        "with node's runner never execute and the file reports nothing while appearing to test something. " +
        "Use describe/it, or assert at the top level."
    );
  });

  it("every file that registers no case is one we decided asserts at load time", () => {
    const registering = filesRegisteringCases();
    const silent = loaded.filter((file) => !registering.has(file));
    const unaccounted = silent.filter((file) => !ASSERTS_AT_LOAD_TIME.has(file));
    assert.deepEqual(
      unaccounted,
      [],
      `${unaccounted.join(", ")} contribute no case to mocha. Either they assert at the top level -- in which ` +
        "case add them to ASSERTS_AT_LOAD_TIME with what they check -- or they test nothing at all."
    );
  });

  it("every file recorded as asserting at load time still does", () => {
    // The other side. A file rewritten into describe/it stops needing its
    // entry, and an entry that no longer describes anything is what the next
    // person reads instead of checking -- the failure shape
    // `.claude/skills/checks-that-cannot-lie` records as number five.
    const registering = filesRegisteringCases();
    const expired = [...ASSERTS_AT_LOAD_TIME.keys()].filter(
      (file) => !fs.existsSync(path.join(root, file)) || registering.has(file)
    );
    assert.deepEqual(
      expired,
      [],
      `${expired.join(", ")} no longer assert at load time -- they were rewritten or removed. ` +
        "Drop them from ASSERTS_AT_LOAD_TIME."
    );
  });

  it("the files asserting at load time actually contain a top-level assertion", () => {
    // Being in the register must not be what makes a file look checked. That is
    // shape three: a value fetched into a decision and never used.
    for (const [file, reason] of ASSERTS_AT_LOAD_TIME) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      const topLevel = source
        .split("\n")
        .filter((line) => /^\s{0,2}assert[.(]/.test(line));
      assert.ok(
        topLevel.length > 0,
        `${file} is recorded as asserting at load time (${reason}) but has no top-level assert call, ` +
          "so nothing in it can fail the suite"
      );
    }
  });
});
