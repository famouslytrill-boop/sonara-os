"use strict";

// The language control changes about a tenth of the page.
//
// The dictionaries are not the problem -- all five languages carry all 36 keys
// and cover every one of the 24 data-i18n keys the server renders. The problem
// is how little of a page those keys reach. Measured on the homepage: 905 of
// 7,672 visible characters, so picking Español translates the navigation, the
// buttons, and the section headings, and leaves 88% of what a customer reads in
// English.
//
// The help text said "Updates the core interface language", which is true in
// the narrow sense and not how anyone selecting Español would read it. The
// honest fix is not to claim less quietly -- it is to say what the control
// does. Translating the product properly needs human translators and is a
// separate piece of work.
//
// What these checks hold:
//
//   Every language keeps the same key set, so choosing one cannot leave a
//   control blank while another language fills it.
//
//   Every key the server renders exists in every language, which is the failure
//   that would silently fall back to English one string at a time.
//
//   The help text keeps describing the real scope. If the coverage is ever
//   extended to page content, this test should fail and be updated -- that is
//   the point.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const source = read("public/sonara-one.js");

function dictionaries() {
  const start = source.indexOf("const dictionaries");
  const block = source.slice(start, source.indexOf("\n  };", start) + 5);
  const found = {};
  for (const match of block.matchAll(/^\s{4}([a-z]{2}):\s*\{([\s\S]*?)\n\s{4}\}/gm)) {
    found[match[1]] = new Set([...match[2].matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*:/g)].map((key) => key[1]));
  }
  return found;
}

function renderedKeys() {
  const files = ["server.js"];
  for (const dir of ["lib", "routes"]) {
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(cjs|js|mjs)$/.test(entry.name)) files.push(path.relative(root, full));
      }
    };
    walk(path.join(root, dir));
  }
  const keys = new Set();
  for (const file of files) {
    for (const match of read(file).matchAll(/data-i18n="([a-zA-Z]+)"/g)) keys.add(match[1]);
  }
  return keys;
}

describe("the language control", () => {
  const dicts = dictionaries();
  const languages = Object.keys(dicts);

  it("parses enough to mean something", () => {
    assert.ok(languages.length >= 5, `only ${languages.length} languages parsed; this check has gone blind`);
    assert.ok(dicts.en && dicts.en.size >= 30, "the English dictionary did not parse");
  });

  it("offers exactly the languages it can actually serve", () => {
    // The settings dialog lists these. A language in the dialog with no
    // dictionary would silently fall back to English for everything.
    const frame = read("lib/sonara-page-frame.cjs");
    const select = frame.slice(frame.indexOf('data-sonara-preference="language"'));
    const offered = [...select.slice(0, select.indexOf("</select>")).matchAll(/value="([a-z-]+)"/g)].map((match) => match[1]);
    assert.ok(offered.length > 0, "the language selector was not found");
    const unserved = offered.filter((code) => !dicts[code]);
    assert.deepEqual(unserved, [], `the dialog offers languages with no dictionary: ${unserved.join(", ")}`);
  });

  it("gives every language the same keys", () => {
    const expected = dicts.en;
    for (const language of languages) {
      const missing = [...expected].filter((key) => !dicts[language].has(key));
      assert.deepEqual(missing, [], `${language} is missing ${missing.length} keys the English dictionary has: ${missing.join(", ")}`);
    }
  });

  it("translates every key the server actually renders", () => {
    const rendered = renderedKeys();
    assert.ok(rendered.size >= 20, `only ${rendered.size} rendered keys found; this check has gone blind`);
    for (const language of languages) {
      const missing = [...rendered].filter((key) => !dicts[language].has(key));
      assert.deepEqual(missing, [], `${language} has no translation for keys the server renders: ${missing.join(", ")}`);
    }
  });

  it("tells the customer what it will and will not translate", () => {
    // Not "updates the interface language", which is true in a narrow sense and
    // is not how someone choosing Español would read it.
    const help = [...source.matchAll(/languageHelp: "([^"]*)"/g)].map((match) => match[1]);
    assert.equal(help.length, languages.length, "not every language has help text for the language control");
    assert.match(help[0], /headings/i);
    assert.match(help[0], /stays in English/i);
    for (const text of help) {
      assert.ok(text.length > 30, `the help text is too short to describe the scope: "${text}"`);
      assert.doesNotMatch(text, /^Updates the core interface language\.$/, "the help text no longer describes the real scope");
    }
  });
});
