// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * Three cheap, deterministic GET examples for an already authenticated
 * invention-systems HTML page. No standalone API, persistence, customer data,
 * mutation, wagering, trading, provider I/O or user-supplied executable logic.
 * Submitted numbers appear in the URL; do not submit private information.
 */
const { evaluateInternalSimulation } = require("./sonara-simulation-integration.cjs");
const FORM_ACTION = "/market-intelligence/invention-systems";
const MAX_QUERY_KEYS = 5;
const MAX_QUERY_BYTES = 256;
const MAX_FIELD_CHARS = 12;

const EXAMPLES = Object.freeze([
  {
    study: "layout", title: "Business Builder · Room area",
    explanation: "Calculate an illustrative rectangle area in square units. Not a construction, permit or building-safety calculation.",
    fields: [
      { key: "width", label: "Width (units)", min: "0.01", max: "100", step: "0.01", defaultValue: "4" },
      { key: "height", label: "Height (units)", min: "0.01", max: "100", step: "0.01", defaultValue: "3" }
    ]
  },
  {
    study: "chord", title: "Creator Studio · Chord notes",
    explanation: "Calculate equal-tempered MIDI note numbers for a simple chord. No recording or licensed musical asset is produced.",
    fields: [
      { key: "midi", label: "Root MIDI note", min: "0", max: "116", step: "1", defaultValue: "60" },
      { key: "quality", label: "Chord quality", options: ["major", "minor", "major7", "minor7"], defaultValue: "major" }
    ]
  },
  {
    study: "payoff", title: "Growth Studio · Strategy matrix",
    explanation: "Compare a hypothetical two-player, zero-sum payoff matrix. These numbers are not real competitor or financial data.",
    fields: [
      { key: "a", label: "A vs A", min: "-10", max: "10", step: "1", defaultValue: "1" },
      { key: "b", label: "A vs B", min: "-10", max: "10", step: "1", defaultValue: "-1" },
      { key: "c", label: "B vs A", min: "-10", max: "10", step: "1", defaultValue: "-1" },
      { key: "d", label: "B vs B", min: "-10", max: "10", step: "1", defaultValue: "1" }
    ]
  }
]);
for (const example of EXAMPLES) {
  for (const field of example.fields) {
    if (field.options) Object.freeze(field.options);
    Object.freeze(field);
  }
  Object.freeze(example.fields);
  Object.freeze(example);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function parseDecimal(value, field) {
  if (typeof value !== "string" || value.length < 1 ||
    value.length > MAX_FIELD_CHARS ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new RangeError(field.label + ": enter a number with up to two decimal places.");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < Number(field.min) || parsed > Number(field.max) ||
      (field.step === "1" && !Number.isInteger(parsed))) {
    throw new RangeError(field.label + ": enter a number from " + field.min + " to " + field.max + ".");
  }
  return parsed;
}
function parseSubmission(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return { selected: null, values: {}, result: null, error: null };
  }
  if (!Object.hasOwn(query, "study")) {
    return { selected: null, values: {}, result: null, error: null };
  }
  const studyProperty = Object.getOwnPropertyDescriptor(query, "study");
  if (!studyProperty || !Object.hasOwn(studyProperty, "value") ||
      typeof studyProperty.value !== "string") {
    return { selected: null, values: {}, result: null,
      error: "Invalid research example selection." };
  }
  const study = studyProperty.value;
  const selected = EXAMPLES.find(example => example.study === study);
  if (!selected) {
    return { selected: null, values: {}, result: null, error: "Unknown research example. Select one of the forms below." };
  }
  let allowed = new Set(["study", ...selected.fields.map(field => field.key)]);
  if (Object.keys(query).length > MAX_QUERY_KEYS ||
    Object.keys(query).some(key => !allowed.has(key))) {
    return { selected, values: {}, result: null, error: "Unexpected input. Use only the fields in the selected example." };
  }
  const values = {};
  try {
    // Size own primitive data fields only. JSON.stringify(query) would invoke
    // attacker-controlled getters or toJSON methods before schema validation.
    let queryBytes = 0;
    for (const key of Object.keys(query)) {
      const descriptor = Object.getOwnPropertyDescriptor(query, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value") ||
          typeof descriptor.value !== "string") {
        throw new TypeError("Research input fields must be plain strings.");
      }
      queryBytes += Buffer.byteLength(key, "utf8") +
        Buffer.byteLength(descriptor.value, "utf8") + 2;
      if (queryBytes > MAX_QUERY_BYTES) {
        throw new RangeError("Request is too large. Use the short numeric fields shown.");
      }
    }
    for (const field of selected.fields) {
      // A missing query field must not inherit an ambient prototype value.
      // Also reject accessor properties rather than invoking getters.
      const own = Object.getOwnPropertyDescriptor(query, field.key);
      if (!own || !Object.hasOwn(own, "value")) {
        throw new RangeError(field.label + ": supply this field in the selected example.");
      }
      const value = own.value;
      if (field.options) {
        if (typeof value !== "string" || !field.options.includes(value)) {
          throw new RangeError(field.label + ": select a listed chord quality.");
        }
        values[field.key] = value;
      } else {
        values[field.key] = parseDecimal(value, field);
      }
    }
    let output;
    if (study === "layout") {
      const { width, height } = values;
      output = evaluateInternalSimulation({
        studio: "business_builder", key: "layout_area",
        parameters: { vertices: [[0, 0], [width, 0], [width, height], [0, height]] }
      });
    } else if (study === "chord") {
      output = evaluateInternalSimulation({
        studio: "creator_studio", key: "chord_harmony",
        parameters: { rootMidi: values.midi, quality: values.quality }
      });
    } else {
      output = evaluateInternalSimulation({
        studio: "growth_studio", key: "strategy_payoffs",
        parameters: { matrix: [[values.a, values.b], [values.c, values.d]] }
      });
    }
    return { selected, values, result: output.result, error: null };
  } catch (error) {
    // Never reflect arbitrary error contents or request data into HTML.
    return { selected, values: {}, result: null,
      error: error instanceof RangeError ? error.message : "Invalid example input. Check the listed ranges." };
  }
}
function formatNumber(value) {
  return Number.isFinite(value) ? String(Math.round(value * 10000) / 10000) : "not available";
}
function resultText(study, result) {
  if (study === "layout") return "Illustrative area: " +
    formatNumber(result.absoluteArea) + " square units.";
  if (study === "chord") return "MIDI notes: " +
    result.notes.map(note => note.midi).join(", ") + ". Estimated pitches: " +
    result.notes.map(note => formatNumber(note.hertz)).join(", ") + " Hz.";
  if (result.equilibriumType === "pure") {
    const positions = result.pureEquilibria.map(item =>
      "row " + (item.row + 1) + ", column " + (item.column + 1)).join("; ");
    return "Pure-strategy equilibrium at " + positions +
      ". Hypothetical game value: " + formatNumber(result.gameValue) + ".";
  }
  return "Mixed-strategy equilibrium. Row player first-strategy probability: " +
    formatNumber(result.rowProbabilities[0]) + "; column player first-strategy probability: " +
    formatNumber(result.columnProbabilities[0]) + "; hypothetical game value: " +
    formatNumber(result.gameValue) + ".";
}
function renderResearchWorkbench(query) {
  const state = parseSubmission(query);
  const parts = [
    '<section aria-labelledby="sonara-research-workbench"><h2 id="sonara-research-workbench">Try a bounded research calculation</h2>',
    '<p>Educational calculations only. No saved results, accounts, payments, casino play or securities orders. Inputs appear in the page URL: do not enter private information.</p>'
  ];
  if (state.error) {
    parts.push('<p role="alert">' + escapeHtml(state.error) + '</p>');
  } else if (state.result) {
    parts.push('<output aria-live="polite" aria-label="Research calculation result">' +
      escapeHtml(resultText(state.selected.study, state.result)) + '</output>');
    parts.push('<p>Hypothetical result only; not a verified commercial or regulated recommendation.</p>');
  }
  for (const example of EXAMPLES) {
    parts.push('<section aria-labelledby="sonara-study-' + example.study + '"><h3 id="sonara-study-' +
      example.study + '">' + escapeHtml(example.title) + '</h3><p>' + escapeHtml(example.explanation) + '</p>');
    parts.push('<form action="' + FORM_ACTION + '" method="get"><input type="hidden" name="study" value="' +
      example.study + '">');
    for (const field of example.fields) {
      const fieldId = "sonara-" + example.study + "-" + field.key;
      parts.push('<label for="' + fieldId + '">' + escapeHtml(field.label) + '</label>');
      if (field.options) {
        parts.push('<select id="' + fieldId + '" name="' + field.key + '" required>');
        for (const option of field.options) {
          parts.push('<option value="' + option + '"' +
            (option === field.defaultValue ? ' selected' : '') + '>' + escapeHtml(option) + '</option>');
        }
        parts.push('</select>');
      } else {
        parts.push('<input id="' + fieldId + '" name="' + field.key +
          '" type="number" inputmode="decimal" min="' + field.min + '" max="' + field.max +
          '" step="' + field.step + '" value="' + field.defaultValue + '" required>');
      }
    }
    parts.push('<button type="submit">Calculate ' + escapeHtml(example.study) +
      ' example</button></form></section>');
  }
  parts.push('</section>');
  return parts.join("");
}

module.exports = { EXAMPLES, MAX_QUERY_KEYS, MAX_QUERY_BYTES,
  parseSubmission, renderResearchWorkbench };
