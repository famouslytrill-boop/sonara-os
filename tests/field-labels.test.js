"use strict";

// "Please complete: productKey, serviceName, summary, details."
//
// Nine form endpoints share sendValidationFailure, and it printed
// validation.missing -- the request-body keys -- straight into the sentence. So
// leaving a box blank produced variable names. Customers saw "consentStatus",
// "rightsNotes", "priceIdea", "serviceInterest", "offerType".
//
// The worse half is that nothing on the screen is called productKey. That field
// is labelled "Product area". So the message named something the customer could
// not find, and the more carefully they looked the more confusing it got.
//
// The fix is a label map, and a label map has one failure mode: drifting from
// the form it describes. A map that says "Product category" while the form says
// "Product area" is the same bug wearing a nicer coat. So these checks read the
// <label> text out of the renderers and compare, rather than trusting the map
// to be right on its own.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const plainLanguage = require("../lib/sonara-plain-language.cjs");

const root = path.join(__dirname, "..");

function renderers() {
  const files = [path.join(root, "server.js")];
  for (const dir of ["lib", "routes"]) {
    for (const entry of fs.readdirSync(path.join(root, dir))) {
      if (/\.(cjs|js)$/.test(entry)) files.push(path.join(root, dir, entry));
    }
  }
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

const SOURCE = renderers();

// Every field name that can reach a customer through sendValidationFailure.
function validatedFields() {
  const fields = new Set();
  for (const match of SOURCE.matchAll(/requireFields\(\s*req\.body\s*,\s*\[([^\]]*)\]/g)) {
    for (const field of match[1].matchAll(/"([a-zA-Z][a-zA-Z0-9_]*)"/g)) fields.add(field[1]);
  }
  return [...fields];
}

// field name -> the label text the markup puts next to it. A field can be
// labelled differently on different forms ("Email", "Work email", "Employee
// email"), so this collects every label a name is given.
function labelsInMarkup() {
  const labels = new Map();
  for (const match of SOURCE.matchAll(/<label>([^<{]+)<(?:input|textarea|select) name="([a-zA-Z][a-zA-Z0-9_]*)"/g)) {
    const text = match[1].trim();
    const field = match[2];
    if (!labels.has(field)) labels.set(field, new Set());
    labels.get(field).add(text);
  }
  return labels;
}

describe("what a form says is missing", () => {
  const fields = validatedFields();
  const markupLabels = labelsInMarkup();

  it("finds the fields and labels it claims to be checking", () => {
    assert.ok(fields.length >= 15, `only ${fields.length} validated fields parsed; this check has gone blind`);
    assert.ok(markupLabels.size >= 15, `only ${markupLabels.size} labelled fields parsed; this check has gone blind`);
    assert.ok(fields.includes("productKey"), "productKey -- the field in the original report -- was not found");
  });

  it("has a customer-facing name for every field that can be reported missing", () => {
    const unnamed = fields.filter((field) => !plainLanguage.FIELD_LABELS[field]);
    assert.deepEqual(unnamed, [], `these would be reported by their variable name: ${unnamed.join(", ")}`);
  });

  it("calls each field what its own form calls it", () => {
    // The check that stops the map drifting. If a form renames a label, this
    // fails until the map follows.
    const mismatches = [];
    for (const [field, label] of Object.entries(plainLanguage.FIELD_LABELS)) {
      const onScreen = markupLabels.get(field);
      if (!onScreen) continue; // Not rendered with a <label>, nothing to match.
      if (!onScreen.has(label)) {
        mismatches.push(`${field}: map says "${label}", forms say ${[...onScreen].map((text) => `"${text}"`).join(" / ")}`);
      }
    }
    assert.deepEqual(mismatches, [], `the error message would name a field differently from the screen:\n  ${mismatches.join("\n  ")}`);
  });

  it("never prints a raw variable name", () => {
    // camelCase reaching a customer is the original defect. The fallback
    // splits an unmapped key rather than printing it, so even a field nobody
    // added to the map reads as words.
    for (const field of [...fields, "somethingNobodyMapped", "another_unmapped_field"]) {
      const label = plainLanguage.fieldLabel(field);
      assert.doesNotMatch(label, /[a-z][A-Z]/, `${field} renders as camelCase: "${label}"`);
      assert.doesNotMatch(label, /[_-]/, `${field} renders with an underscore or hyphen: "${label}"`);
      assert.match(label, /^[A-Z]/, `${field} does not start with a capital: "${label}"`);
    }
  });

  it("reads as a sentence for one field and for several", () => {
    assert.equal(plainLanguage.missingFieldsSentence(["details"]), "Please fill in Details.");
    assert.equal(
      plainLanguage.missingFieldsSentence(["productKey", "serviceName", "details"]),
      "Please fill in Product area, Service name and Details."
    );
    // No trailing "and" with nothing after it, and no bare "Please fill in ."
    assert.equal(plainLanguage.missingFieldsSentence([]), "Please fill in the fields marked required.");
    assert.equal(plainLanguage.missingFieldsSentence(undefined), "Please fill in the fields marked required.");
  });

  it("keeps the raw field names in the JSON body", () => {
    // A developer reading the API response, or a client keying off it, needs
    // the real names. Only the prose is translated.
    const source = fs.readFileSync(path.join(root, "server.js"), "utf8");
    const fn = source.slice(source.indexOf("function sendValidationFailure"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    assert.match(body, /res\.status\(400\)\.json\(validation\)/, "the JSON response no longer carries the raw validation object");
  });
});
