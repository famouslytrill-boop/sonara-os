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
// This does the comparison, in two tiers.

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
  // Nothing is listed here. The pairs are read out of the file -- every
  // `oneOf(req.body.<field>, <set>, <fallback>)` call is found, its set is
  // resolved whether it is a named constant or written inline, and the
  // `<select name="<field>">` for it is looked up. A hand-written list of
  // fields is a second copy, and a second copy is what drifts; worse, an entry
  // in it that is skipped reads like coverage that is not there.
  describe("every offered value survives the server's own check", () => {
    const rel = "routes/product-lifecycle-routes.cjs";
    const source = fs.readFileSync(path.join(ROOT, rel), "utf8");

    function stringsIn(text) {
      return [...text.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
    }

    /**
     * `const NAME = ...` -> the strings the set holds, for the two forms this
     * file uses. Anything else returns null rather than an empty list: a set
     * this cannot read must fail the guard below, not quietly pass every option
     * in the field it governs.
     */
    function namedSet(name) {
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

    /** The options inside `<select name="field">`, literal ones only. */
    function selectOptions(field) {
      const block = new RegExp(`<select name="${field}">([\\s\\S]*?)</select>`).exec(source);
      if (!block) return null;
      return options(block[1]).filter((option) => !option.value.includes("${"));
    }

    // Each `oneOf(req.body.X, Y, fallback)` in the file. `Y` is either a bare
    // identifier or an inline `new Set([...])`; both are resolved.
    const pairs = [...source.matchAll(/oneOf\(req\.body\.([a-z_]+)(?:\s*\|\|[^,]*)?,\s*(new Set\(\[[^\]]*\]\)|[A-Z_]+),/g)]
      .map((match) => {
        const [, field, setExpression] = match;
        const values = setExpression.startsWith("new Set")
          ? stringsIn(setExpression)
          : namedSet(setExpression);
        return { field, setExpression, values };
      });

    it("found the validated fields it is about to check", () => {
      assert.ok(pairs.length >= 6, `only ${pairs.length} oneOf(req.body.*) calls found in ${rel}; this check has gone blind`);
      const unresolved = pairs.filter((pair) => !pair.values || pair.values.length === 0);
      assert.deepEqual(
        unresolved.map((pair) => `${pair.field} -> ${pair.setExpression}`),
        [],
        "a validated field's allowed set could not be read out of the source, so this check would pass it by default"
      );
    });

    // A field whose options are generated from the set cannot disagree with it,
    // so there is nothing to compare; the ones written out by hand are exactly
    // where the two ends can drift, and are what this counts.
    const handWritten = pairs.filter((pair) => (selectOptions(pair.field) || []).length > 0);

    it("at least three fields spell their options out by hand", () => {
      assert.ok(
        handWritten.length >= 3,
        `only ${handWritten.length} of ${pairs.length} validated fields render literal options; this check has gone blind`
      );
    });

    for (const pair of pairs) {
      const offered = selectOptions(pair.field);
      if (!offered || offered.length === 0) continue;

      it(`every <select name="${pair.field}"> option is accepted by the handler`, () => {
        for (const option of offered) {
          assert.ok(
            pair.values.includes(option.value),
            `the ${pair.field} field offers "${option.value}" (labelled "${option.text.trim()}"), which ` +
              `${pair.setExpression} does not contain -- oneOf() will silently replace it with the fallback, and the ` +
              "person who chose it will never be told"
          );
        }
      });

      it(`<select name="${pair.field}"> offers every value the handler accepts`, () => {
        // The other direction. A select that quietly stops offering "could" is
        // not a crash -- it is a MoSCoW board with no way to say "not this
        // release", which is the category the method exists for.
        const values = new Set(offered.map((option) => option.value));
        for (const value of pair.values) {
          assert.ok(values.has(value), `${pair.setExpression} accepts "${value}" but no ${pair.field} option offers it`);
        }
      });
    }
  });
});
