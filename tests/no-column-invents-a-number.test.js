"use strict";

// A column must not print a number nobody recorded.
//
// `Number(null)` is 0 and `Number("")` is 0, and both are finite. Every display
// helper in this repository guarded with `Number.isFinite(Number(value))`, so a
// column with nothing in it rendered a confident figure: "$0.00" for a service
// with no price, "0" for an item nobody had counted, "0.0%" for a target nobody
// had set. Twenty-three columns across the record pages did it, and the worst
// was the menu page reporting a 100% margin on every dish -- theoretical cost
// is `integer default 0` and nothing wrote it, so the whole selling price read
// as profit on the screen a restaurant uses to decide what to charge.
//
// The individual columns are not the check. The helpers were, and they are
// fixed; this is what stops a new column, or a new helper, doing it again.
//
// A stored 0 still renders as 0 and that is deliberate: absent and zero are
// different facts, and the helpers can now tell them apart.

const assert = require("node:assert/strict");
const { ALL_OWNER_PAGES, money, quantity, percent } = require("../lib/sonara-owner-record-pages.cjs");
const growth = require("../lib/sonara-growth-record-pages.cjs");

const pages = [
  ...ALL_OWNER_PAGES.map((page) => ["owner", page]),
  ...growth.GROWTH_RECORD_PAGES.map((page) => ["growth", page])
];

// Which keys does this column read? A Proxy is used rather than a guessed row,
// because guessing which fields a column touches is how the first version of
// this check missed the menu margin: it probed an all-empty row, and that
// column only lies when the price is present and the cost is not.
function keysRead(value) {
  const seen = new Set();
  const probe = new Proxy({}, { get: (_target, key) => { if (typeof key === "string") seen.add(key); return undefined; } });
  try { value(probe); } catch { /* a column need not survive an all-undefined row */ }
  return [...seen];
}

const NUMERIC = /_cents$|_percent$|quantity|count|level|progress|amount|price|total|exposures|conversions/;
const plausible = (key) =>
  NUMERIC.test(key) ? 100
    : /_at$|_on$|date/.test(key) ? "2026-08-01T10:00:00Z"
      : /_id$/.test(key) ? "11111111-1111-4111-8111-111111111111"
        : "Something";

// Wording that admits it does not know. A column may say any of these instead
// of a figure; what it may not do is print a figure it made up.
const SAYS_IT_DOES_NOT_KNOW = /not (set|costed|counted|recorded|measured|known|given|priced|enough)|none|unknown|no price|n\/a/i;

describe("no column invents a number", () => {
  it("is reading enough columns to be measuring something", () => {
    const columns = pages.reduce((total, [, page]) => total + (page.columns || []).length, 0);
    assert.ok(pages.length >= 30, `only ${pages.length} record pages found`);
    assert.ok(columns >= 150, `only ${columns} columns found; this check has gone blind`);
  });

  it("does not report a figure for a field nobody filled in", () => {
    const invented = [];
    for (const [kind, page] of pages) {
      for (const column of page.columns || []) {
        const keys = keysRead(column.value);
        const numeric = keys.filter((key) => NUMERIC.test(key));
        if (!numeric.length) continue;

        const full = Object.fromEntries(keys.map((key) => [key, plausible(key)]));
        let baseline;
        try { baseline = String(column.value(full)); } catch { continue; }

        for (const absent of numeric) {
          let out;
          try { out = String(column.value({ ...full, [absent]: null })); } catch { continue; }
          // The missing field changed nothing, so it was not being reported.
          if (out === baseline) continue;
          if (SAYS_IT_DOES_NOT_KNOW.test(out)) continue;
          if (!/[0-9]/.test(out)) continue;
          invented.push(`${kind} ${page.path || page.title} | ${column.label} | ${absent} absent renders "${out}"`);
        }
      }
    }
    assert.deepEqual(
      invented,
      [],
      `these columns print a number for a field that has none:\n  ${invented.join("\n  ")}\n\n` +
        "Use money(), quantity() or percent() -- they tell absent from zero -- or say what is not recorded."
    );
  });

  // The helpers themselves, stated rather than inferred, because every column
  // above depends on this distinction holding.
  it("tells absent from zero in the shared helpers", () => {
    for (const absent of [null, undefined, ""]) {
      assert.equal(money(absent), "Not set", `money(${JSON.stringify(absent)}) reported an amount`);
      assert.equal(quantity(absent), "Not counted", `quantity(${JSON.stringify(absent)}) reported a count`);
      assert.equal(percent(absent), "Not set", `percent(${JSON.stringify(absent)}) reported a rate`);
      assert.equal(growth.countText(absent), "Not counted");
      assert.equal(growth.percentText(absent), "Not set");
    }
    // Zero is a value something wrote, and stays visible as one.
    assert.equal(money(0), "$0.00");
    assert.equal(quantity(0), "0");
    assert.equal(percent(0), "0.0%");
    assert.equal(growth.countText(0), "0");
    assert.equal(growth.percentText(0), "0%");
    // And real values are untouched.
    assert.equal(money(1250), "$12.50");
    assert.equal(percent(0.05), "5.0%");
  });

  // percent() multiplies by 100, so every column feeding it must hold a
  // fraction. Recipe waste was written as a whole number against that helper
  // and a 5% waste displayed as 500.0% -- the convention was set for one column
  // without checking what its neighbours already used.
  it("keeps one meaning for a percentage", () => {
    assert.equal(percent(0.05), "5.0%", "percent() takes a fraction");
    assert.equal(percent(5), "500.0%", "and would say so loudly if given a whole number");
    const recipes = ALL_OWNER_PAGES.find((page) => page.path === "/business-builder/owner/recipes");
    const ingredients = require("../lib/sonara-owner-record-pages.cjs").childrenOf(recipes)[0];
    const stored = ingredients.derive({ quantity: "1", unit_cost_cents: "100", waste_percent: "5" });
    assert.equal(stored.waste_percent, 0.05, "a column rendered by percent() must be stored as a fraction");
  });
});

// The same fault outside the record pages, where the general sweep above cannot
// reach: these render through their own formatters rather than through a column
// definition, and each was a separate copy of `Number(x || 0)`.
describe("the same fault outside the record pages", () => {
  // Comments stripped before matching. The first version of these assertions
  // searched the raw source for `Number(x || 0)` and failed on the comment
  // written directly above the fix, which quotes the pattern to say what it
  // replaced. Same trap scripts/verify-open-source-registry.mjs hit reading a
  // type union out of a file whose comment contained a semicolon: a regex over
  // source that prose can satisfy.
  const read = (file) =>
    require("node:fs")
      .readFileSync(require("node:path").join(__dirname, "..", file), "utf8")
      .replace(/^\s*\/\/.*$/gm, "");

  it("does not report a generation job as 0% when nothing has said", () => {
    const source = read("routes/creator-generation-routes.cjs");
    assert.doesNotMatch(source, /Number\(job\.progress_percent \|\| 0\)/, "a job with no progress reported reads as started and stalled");
    assert.match(source, /finiteNumber\(job\.progress_percent\)/);
  });

  it("does not fold a sale with no value into the total as zero", () => {
    const source = read("routes/growth-studio-control-routes.cjs");
    assert.doesNotMatch(source, /sum \+ Number\(row\.value \|\| 0\)/, "an unpriced sale counted as nothing and vanished into the total");
    // And the figure says how many it left out, which is the difference
    // between a total and a total that happens to be short.
    assert.match(source, /withoutValue: conversionsWithoutValue/);
    assert.match(source, /excluding \$\{unpriced\} with no value recorded/);
  });
});
