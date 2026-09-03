"use strict";

// `docs/HANDOFF_PROMPT.md` is generated, and its numbers are what somebody
// reads to decide whether this is shippable. One of them measured a different
// population from the one it named.
//
// The generator counted `tests/*.test.js` at the top level and the sentence
// said "test files run under mocha". Mocha's spec is `tests/**/*.js` and
// `tests/**/*.mjs` -- recursive, and not limited to the `.test.js` suffix. It
// printed 257 while mocha ran 261, and nothing objected, because the generator
// and the runner were never compared to each other.
//
// This is that comparison.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

// Derived here from the runner's own config, independently of the generator --
// two implementations that must agree. A shared helper would make them one
// implementation and this test would prove nothing.
function filesMochaRuns() {
  const spec = JSON.parse(fs.readFileSync(path.join(root, ".mocharc.json"), "utf8")).spec;
  const globs = Array.isArray(spec) ? spec : [spec];
  const extensions = new Set(globs.map((glob) => path.extname(glob)).filter(Boolean));
  const found = new Set();
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (extensions.has(path.extname(entry.name))) found.add(relative);
    }
  };
  walk("tests");
  return found;
}

describe("the handoff counts what mocha runs", () => {
  const running = filesMochaRuns();
  const handoff = fs.readFileSync(path.join(root, "docs", "HANDOFF_PROMPT.md"), "utf8");

  it("found a suite to count, so this is not comparing two zeroes", () => {
    assert.ok(running.size >= 200, `only ${running.size} files matched the mocha spec; this check has gone blind`);
    assert.ok(handoff.length > 5000, "the handoff document came back empty");
  });

  it("says the number mocha would actually load", () => {
    const stated = handoff.match(/(\d+) test files run under mocha/);
    assert.ok(stated, "the handoff no longer states how many test files mocha runs");
    assert.equal(
      Number(stated[1]),
      running.size,
      `the handoff says ${stated[1]} test files; mocha's own spec matches ${running.size}`
    );
  });

  it("counts the extensions the spec asks for, not just one", () => {
    // The original bug in one line: `.mjs` files run and were not counted.
    const spec = JSON.parse(fs.readFileSync(path.join(root, ".mocharc.json"), "utf8")).spec;
    const globs = Array.isArray(spec) ? spec : [spec];
    assert.ok(globs.length >= 1, "the mocha config declares no spec");
    for (const extension of new Set(globs.map((glob) => path.extname(glob)))) {
      const matching = [...running].filter((file) => path.extname(file) === extension);
      assert.ok(
        matching.length > 0,
        `the spec asks for ${extension} files and none were counted, so a whole extension is invisible`
      );
    }
  });

  it("refuses to report a count when the globs stop matching", () => {
    // A confident 0 in a document people read to decide whether to ship is
    // worse than a failure. The generator throws instead.
    const source = fs.readFileSync(path.join(root, "scripts", "generate-handoff-prompt.mjs"), "utf8");
    assert.match(source, /the counter has gone blind/, "the generator no longer refuses an empty count");
    // A *read* of the config, not a mention of it. The first version of this
    // matched the filename anywhere in the file, and a mutation that replaced
    // the read with a hardcoded list of globs still passed -- the error
    // messages below it name the file, so the string was still there.
    assert.match(
      source,
      /(?:read|readFileSync)\(\s*(?:path\.join\([^)]*\)|["'`][^"'`]*)\.mocharc\.json/,
      "the generator no longer reads the runner's own config; a restated list of globs drifts the moment .mocharc.json changes"
    );
  });
});
