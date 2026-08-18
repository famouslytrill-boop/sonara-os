"use strict";

// Two pages show creator_voice_consents, and they described the same row
// differently.
//
// /creator-studio/voice-permissions used voiceSubjectLabel, voiceScopeLabel and
// voiceEvidenceLabel, which live with the product's other words.
// /creator-studio/rights printed consent_scope with its underscores swapped for
// spaces, so one permission read "Voice copying" on one page and "voice clone"
// on the other -- and it headed each card with subject_name alone, falling back
// to "Consent record". subject_name is nullable; subject_type is not null. The
// page discarded the fact that is always there in favour of the one that might
// not be.
//
// Found by a sweep for columns a query selects and the file never uses again.
// That sweep is what found the consent scope going unchecked, and this is the
// same shape one page over: read, and then not used.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const plainLanguage = require("../lib/sonara-plain-language.cjs");




// The scopes and subject kinds the table will actually store, read from the
// migration rather than copied. A label map that has stopped covering the
// column silently answers "Not recorded" for a real value.
function allowedValues(column) {
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260723080000_creator_generation_control_plane.sql"), "utf8");
  const match = sql.match(new RegExp(`${column} text not null check \\(${column} in \\(([^)]*)\\)\\)`));
  assert.ok(match, `${column} no longer has a check constraint; this check is asserting about nothing`);
  const values = [...match[1].matchAll(/'([a-z_]+)'/g)].map((entry) => entry[1]);
  assert.ok(values.length >= 4, `only ${values.length} values parsed for ${column}; this check has gone blind`);
  return values;
}

describe("one consent record, one vocabulary", () => {

  // The maps have to cover the columns, or a real value renders as
  // "Not recorded" -- a permission that exists, shown as one that was not
  // written down.
  it("has a word for every value the consent table will store", () => {
    for (const [column, map] of [["subject_type", plainLanguage.VOICE_SUBJECT], ["consent_scope", plainLanguage.VOICE_SCOPE], ["evidence_type", plainLanguage.VOICE_EVIDENCE]]) {
      const missing = allowedValues(column).filter((value) => !map[value]);
      assert.deepEqual(missing, [], `${column} can be ${missing.join(", ")} and nothing here says what that means`);
    }
  });

  it("says Not recorded rather than printing a value it does not know", () => {
    for (const label of [plainLanguage.voiceSubjectLabel, plainLanguage.voiceScopeLabel, plainLanguage.voiceEvidenceLabel]) {
      assert.equal(label("something_new"), "Not recorded");
      assert.equal(label(null), "Not recorded");
      assert.equal(label(""), "Not recorded");
    }
  });

  // Both pages, checked at the source rather than through the HTTP layer.
  //
  // /creator-studio/rights is registered by a file that wires a hundred other
  // routes, and standing one up in a test to read four words back is a harness
  // that will break for reasons unrelated to what it measures. What matters is
  // whether either page turns a consent column into words itself instead of
  // asking the one place that knows.
  describe("neither page keeps its own vocabulary", () => {
    const FILES = Object.freeze({
      "/creator-studio/rights": "routes/sonara-route-registry-routes.cjs",
      "/creator-studio/voice-permissions": "routes/creator-generation-routes.cjs"
    });

    function code(file) {
      const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/gm, "$1 ");
    }

    it("reads both files, rather than passing on a path that moved", () => {
      for (const file of Object.values(FILES)) {
        assert.ok(code(file).includes("creator_voice_consents"), `${file} no longer reads the consent table; this check has gone blind`);
      }
    });

    // The exact expression that shipped: consent_scope with its underscores
    // swapped for spaces. It renders "voice clone" where the other page renders
    // "Voice copying", and it puts a database value in front of a customer.
    it("does not spell a consent column out by replacing its underscores", () => {
      const guilty = [];
      for (const [page, file] of Object.entries(FILES)) {
        const source = code(file);
        for (const column of ["consent_scope", "subject_type", "evidence_type"]) {
          const pattern = new RegExp(`row\\.${column}[^;]{0,40}replaceAll\\("_"`);
          if (pattern.test(source)) guilty.push(`${page} formats ${column} itself`);
        }
      }
      assert.deepEqual(guilty, [], "these print the database value; use the labels in lib/sonara-plain-language.cjs");
    });

    it("uses the shared labels on both", () => {
      const missing = [];
      for (const [page, file] of Object.entries(FILES)) {
        const source = code(file);
        for (const label of ["voiceSubjectLabel", "voiceScopeLabel"]) {
          if (!source.includes(label)) missing.push(`${page} does not use ${label}`);
        }
      }
      assert.deepEqual(missing, [], missing.join("\n  "));
    });

    // The heading fault. subject_name is nullable and subject_type is not, so a
    // heading that falls back to a constant has thrown away the fact that was
    // guaranteed to be there.
    it("falls back to the subject kind, not to a constant, when no name was typed", () => {
      const source = code(FILES["/creator-studio/rights"]);
      assert.doesNotMatch(source, /row\.subject_name \|\| "Consent record"/, "the heading names nobody when subject_name is blank");
      assert.match(source, /row\.subject_name \|\| plainLanguage\.voiceSubjectLabel\(row\.subject_type\)/);
    });
  });
});
