"use strict";

// A `<select>` is a promise: these are the values this field takes. The server
// then decides separately what it will accept. Nothing in this repository made
// the two agree, and they had already drifted.
//
// `routes/product-lifecycle-routes.cjs` rendered its MoSCoW priority field as
//
//     <option value="must">Must Have</option>
//     <option value="should">Should Have</option>
//     <option>value="could">Could Have</option>     <-- the tag closes early
//     <option value="wont">Won't Have</option>
//
// The third `<option>` has no attributes. HTML parses `value="could">Could Have`
// as its **text**, and an option with no value attribute submits its text. So
// choosing "Could Have" posted the string `value="could">Could Have`, which
// `oneOf(req.body.priority, PRIORITIES, "must")` does not recognise -- and
// silently returned the fallback.
//
// The fallback is `"must"`. Somebody marking a requirement as **explicitly not
// needed for launch** recorded it as **required for launch**, with no error, on
// a page whose whole purpose is deciding what ships. And it is worse than a
// wrong label: line 464 grades `must_have_scope` on
// `requirements.some((row) => row.priority === "must")`, and that criterion
// feeds the readiness score. Picking the lowest-commitment option *raised* the
// score for having scope defined.
//
// That is this repository's recurring defect exactly: not broken code, a signal
// reporting success without being true. It survived because every part of it
// works -- the page renders, the form posts, the row saves, the score computes.
// Only the value is wrong, and nothing was comparing the two ends.
//
// This does the comparison, in two tiers: one general sweep for the broken
// markup itself, and one that pairs every validated field in the runtime with
// the dropdown that feeds it. Nine dropdowns across three route files land in
// the second, both directions each, and none of them is named here -- the pairs
// are read out of the source.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function sourceFiles() {
  const files = [];
  for (const dir of ["lib", "routes"]) {
    const full = path.join(ROOT, dir);
    for (const name of fs.readdirSync(full)) {
      if (name.endsWith(".cjs") || name.endsWith(".js")) files.push(path.join(dir, name));
    }
  }
  files.push("server.js");
  return files;
}

/** Every `<option ...>text</option>` written as a literal in the source. */
function options(text) {
  return [...text.matchAll(/<option\b([^>]*)>([^<]*)</g)].map((match) => ({
    attributes: match[1],
    text: match[2],
    // An option with no value attribute submits its own text content. That is
    // the HTML rule the bug depended on, so it is the rule used here rather
    // than an assumption that every option carries a value.
    value: /value="([^"]*)"/.exec(match[1])?.[1] ?? match[2]
  }));
}

describe("a dropdown offers values the server accepts", () => {
  const files = sourceFiles();
  const all = files.flatMap((rel) => options(fs.readFileSync(path.join(ROOT, rel), "utf8")).map((o) => ({ ...o, rel })));

  describe("the harness is capable of failing", () => {
    it("found the forms it is checking", () => {
      assert.ok(files.length >= 50, `only ${files.length} source files; this check has gone blind`);
      assert.ok(all.length >= 100, `only ${all.length} options found across ${files.length} files; this check has gone blind`);
    });
  });

  // Tier 1. General, and it is the tier that catches the bug above: a tag that
  // closes early leaks attribute syntax into what the browser treats as text,
  // and an option submitting `value="could">Could Have` is never what anybody
  // wrote on purpose.
  describe("no option submits its own broken markup", () => {
    it("has no option whose text carries attribute syntax", () => {
      const broken = all.filter((o) => /=("|')/.test(o.text) || o.text.includes(">"));
      assert.deepEqual(
        broken.map((o) => `${o.rel}: <option${o.attributes}>${o.text}`),
        [],
        "an <option> tag closed before its attributes, so the browser reads them as the option's text and submits " +
          "that text as the value"
      );
    });
  });

  // Tier 2. The narrower question, and the one that says the fix is real rather
  // than that the markup is tidy: does every value a page offers survive the
  // check the server runs on that same field?
  //
  // Nothing is listed here, not even the files. Every source file holding both
  // an `oneOf(req.body.<field>, <set>, <fallback>)` call and a
  // `<select name="<field>">` is found, the set is resolved whether it is a
  // named constant or written inline, and the two ends are compared. A
  // hand-written list is a second copy, and a second copy is what drifts;
  // worse, an entry in it that is skipped reads like coverage that is not
  // there.
  describe("every offered value survives the server's own check", () => {
    function stringsIn(text) {
      return [...text.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
    }

    /**
     * `const NAME = ...` -> the strings the set holds, for the two forms these
     * files use. Anything else returns null rather than an empty list: a set
     * this cannot read must fail the guard below, not quietly pass every option
     * in the field it governs.
     */
    function namedSet(source, name) {
      const literal = new RegExp(`const ${name} = (?:Object\\.freeze\\()?new Set\\(\\[([^\\]]*)\\]`).exec(source);
      if (literal) return stringsIn(literal[1]);

      // `const STAGE_KEYS = new Set(STAGES.map((stage) => stage.key));` -- a set
      // built by projecting one property out of an array of objects.
      const projected = new RegExp(`const ${name} = new Set\\(([A-Z_]+)\\.map\\(\\([a-z]+\\) => [a-z]+\\.([a-z_]+)\\)\\)`).exec(source);
      if (!projected) return null;
      const [, arrayName, property] = projected;
      const array = new RegExp(`const ${arrayName} = (?:Object\\.freeze\\()?\\[([\\s\\S]*?)\\n\\]`).exec(source);
      if (!array) return null;
      const values = [...array[1].matchAll(new RegExp(`\\b${property}: "([^"]*)"`, "g"))].map((match) => match[1]);
      return values.length ? values : null;
    }

    /**
     * The values a `<select name="field">` offers, where they are written out
     * rather than generated from the set being validated against.
     *
     * Two spellings, because both are hand-written lists that can drift from
     * the handler beside them: literal `<option>` tags, and
     * `${options([["value", "Label"], ...])}` -- a helper several route files
     * use. A select whose options are mapped from the validating set itself is
     * excluded on purpose: it cannot disagree, so there is nothing to compare.
     */
    function selectOptions(source, field) {
      const block = new RegExp(`<select name="${field}"[^>]*>([\\s\\S]*?)</select>`).exec(source);
      if (!block) return null;

      const literal = options(block[1]).filter((option) => !option.value.includes("${"));
      if (literal.length) return literal;

      const helper = /\$\{options\(\[([\s\S]*?)\]\)\}/.exec(block[1]);
      if (!helper) return null;
      return [...helper[1].matchAll(/\["([^"]*)",\s*"([^"]*)"\]/g)]
        .map((match) => ({ value: match[1], text: match[2], attributes: "" }));
    }

    /**
     * Each `oneOf(req.body.X, Y, fallback)` in a file. `Y` takes three forms
     * across this repository -- a named constant, an inline `new Set([...])`,
     * and a bare array literal -- and all three are resolved. A fourth form
     * would resolve to null and fail the guard below rather than pass silently.
     */
    function validatedFields(source) {
      const seen = new Map();
      const call = /oneOf\(req\.body\.([a-z_]+)(?:\s*\|\|\s*req\.body\.[A-Za-z_]+)?,\s*(new Set\(\[[^\]]*\]\)|\[[^\]]*\]|[A-Z_]+),\s*([^)]*)\)/g;
      for (const match of source.matchAll(call)) {
        const [, field, setExpression, fallback] = match;
        if (seen.has(field)) continue;
        const values = setExpression.startsWith("[") || setExpression.startsWith("new Set")
          ? stringsIn(setExpression)
          : namedSet(source, setExpression);
        const offered = selectOptions(source, field);
        seen.set(field, { field, setExpression, fallback: fallback.trim(), values, offered });
      }
      return [...seen.values()];
    }

    const scanned = files
      .map((rel) => ({ rel, fields: validatedFields(fs.readFileSync(path.join(ROOT, rel), "utf8")) }))
      // A field whose options are generated from the set cannot disagree with
      // it, so there is nothing to compare; the ones written out by hand are
      // exactly where the two ends can drift, and are what this counts.
      .map((entry) => ({ ...entry, fields: entry.fields.filter((field) => field.offered && field.offered.length > 0) }))
      .filter((entry) => entry.fields.length > 0);

    it("found the hand-written dropdowns it is about to check", () => {
      const total = scanned.reduce((sum, entry) => sum + entry.fields.length, 0);
      assert.ok(
        scanned.length >= 3,
        `only ${scanned.length} files pair a validated field with a literal <select>; this check has gone blind`
      );
      assert.ok(total >= 6, `only ${total} hand-written dropdowns found; this check has gone blind`);
    });

    it("could read the allowed set behind every one of them", () => {
      // Returning an empty set for one it cannot parse would pass every option
      // in that field by default, which is the failure mode this whole file is
      // about. It fails instead, naming the field.
      const unresolved = scanned.flatMap((entry) =>
        entry.fields.filter((field) => !field.values || field.values.length === 0)
          .map((field) => `${entry.rel}: ${field.field} -> ${field.setExpression}`)
      );
      assert.deepEqual(unresolved, [], "a validated field's allowed set could not be read out of the source");
    });

    for (const { rel, fields } of scanned) {
      describe(rel, () => {
        for (const field of fields) {
          it(`every <select name="${field.field}"> option is accepted by the handler`, () => {
            for (const option of field.offered) {
              assert.ok(
                (field.values || []).includes(option.value),
                `the ${field.field} field offers "${option.value}" (labelled "${option.text.trim()}"), which ` +
                  `${field.setExpression} does not contain. oneOf() replaces it with ${field.fallback}` +
                  (field.fallback === "null"
                    // A null fallback is refused somewhere downstream, so the
                    // person is at least told something went wrong.
                    ? ", so the choice is thrown away"
                    // A concrete fallback is the dangerous one: the row saves,
                    // nothing errors, and it holds a value nobody picked.
                    : ", so the row saves holding a value the person never chose and nothing says so")
              );
            }
          });

          it(`<select name="${field.field}"> offers every value the handler accepts`, () => {
            // The other direction. A select that quietly stops offering "could"
            // is not a crash -- it is a MoSCoW board with no way to say "not
            // this release", which is the category the method exists for.
            const offered = new Set(field.offered.map((option) => option.value));
            for (const value of field.values || []) {
              assert.ok(
                offered.has(value),
                `${field.setExpression} accepts "${value}" but no ${field.field} option offers it`
              );
            }
          });
        }
      });
    }
  });
});
