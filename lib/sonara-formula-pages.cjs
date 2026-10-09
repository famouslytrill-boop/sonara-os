// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The formula library as something a person can use.
//
// /formulas listed fifty-nine formula names and nothing could be worked out
// from the page: the only way to evaluate one was to POST JSON to
// /api/formulas/evaluate. Each formula now has a page with one field per input
// it declares, the answer shown with the arithmetic that produced it, and a
// save that keeps the result in the business's records.
//
// The fields come from the definition's own requiredInputs, so the page cannot
// ask for something the evaluator ignores or omit something it needs.

const { getFormulaDefinition } = require("./sonara-formula-library.cjs");

// Inputs that are not a single number. Every other input is one.
const LIST_INPUTS = new Set(["order_total", "active_subscription_monthly_amount", "segment_confidence", "cash_flows"]);
const TEXT_INPUTS = new Set(["key", "rhythmic_feel", "harmonic_identity", "drum_language", "vocal_mode"]);
const DATETIME_INPUTS = new Set(["clock_in", "clock_out"]);
const YES_NO_INPUTS = new Set(["reduced_motion_enabled"]);
const INGREDIENT_INPUTS = new Set(["ingredients"]);

const MAX_FIELD_LENGTH = 2000;
const MAX_LIST_ITEMS = 500;

function inputKind(key) {
  if (LIST_INPUTS.has(key)) return "list";
  if (TEXT_INPUTS.has(key)) return "text";
  if (DATETIME_INPUTS.has(key)) return "datetime";
  if (YES_NO_INPUTS.has(key)) return "yes_no";
  if (INGREDIENT_INPUTS.has(key)) return "ingredients";
  return "number";
}

function words(key) {
  const text = String(key || "").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// input_<key> fields from a form, as the { key: value } object the evaluator
// takes from an API client. Only the definition's declared inputs are read, so
// a field the form did not draw -- or one a caller added -- never reaches the
// evaluator or the saved record.
function valuesFromForm(definition, body) {
  const source = body && typeof body === "object" ? body : {};
  return Object.fromEntries(definition.requiredInputs.map((key) => {
    const field = `input_${key}`;
    const raw = Object.prototype.hasOwnProperty.call(source, field) ? String(source[field] ?? "").slice(0, MAX_FIELD_LENGTH) : "";
    return [key, fromField(inputKind(key), raw)];
  }));
}

function fromField(kind, raw) {
  const text = raw.trim();
  if (kind === "list") return text ? text.split(/[\s,;]+/).filter(Boolean).slice(0, MAX_LIST_ITEMS) : [];
  if (kind === "ingredients") {
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, MAX_LIST_ITEMS).map((line) => {
      const [quantity = "", unitCost = ""] = line.split(/[\s,;]+/);
      return { quantity, unit_cost: unitCost };
    });
  }
  return text;
}

// A field's value as the form shows it again, so a refused calculation keeps
// what the person typed.
function toField(kind, value) {
  if (value === undefined || value === null) return "";
  if (kind === "list") return Array.isArray(value) ? value.join(", ") : String(value);
  if (kind === "ingredients") return Array.isArray(value) ? value.map((item) => `${item?.quantity ?? ""}, ${item?.unit_cost ?? ""}`).join("\n") : "";
  return String(value);
}

function field(key, value, escape) {
  const kind = inputKind(key);
  const name = `input_${key}`;
  const shown = escape(toField(kind, value));
  const label = escape(words(key));
  if (kind === "list") return `<label>${label}, one figure per line or separated by commas<textarea name="${name}" rows="3" required maxlength="${MAX_FIELD_LENGTH}">${shown}</textarea></label>`;
  if (kind === "ingredients") return `<label>Ingredients, one per line as quantity then unit cost (for example 0.25, 4.00)<textarea name="${name}" rows="4" required maxlength="${MAX_FIELD_LENGTH}">${shown}</textarea></label>`;
  if (kind === "datetime") return `<label>${label}<input name="${name}" type="datetime-local" required value="${shown}"></label>`;
  if (kind === "yes_no") {
    const option = (optionValue, text) => `<option value="${optionValue}"${String(value) === optionValue ? " selected" : ""}>${text}</option>`;
    return `<label>${label}<select name="${name}" required>${option("", "Choose")}${option("true", "Yes")}${option("false", "No")}</select></label>`;
  }
  if (kind === "text") return `<label>${label}<input name="${name}" maxlength="200" value="${shown}"></label>`;
  return `<label>${label}<input name="${name}" required inputmode="decimal" maxlength="40" value="${shown}"></label>`;
}

function hiddenInputs(definition, values, escape) {
  return definition.requiredInputs.map((key) => `<input type="hidden" name="input_${key}" value="${escape(toField(inputKind(key), values[key]))}">`).join("");
}

function calculatorCard(definition, values, escape) {
  const fields = definition.requiredInputs.map((key) => field(key, values[key], escape)).join("");
  return `<article class="card"><h2>Work it out</h2><p class="fine">${escape(definition.publicLabel)} is ${escape(definition.expressionText)}.</p><form method="post" action="/api/formulas/evaluate"><input type="hidden" name="formulaKey" value="${escape(definition.formulaKey)}">${fields}<button class="action" type="submit">Work it out</button></form></article>`;
}

function formatResult(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (unit === "percent") return `${number.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  if (/^money/.test(unit)) {
    const amount = number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (unit === "money_per_hour") return `${amount} per hour`;
    if (unit === "money_per_month") return `${amount} per month`;
    return amount;
  }
  // Scientific quantities can be far smaller than 0.0001; never display
  // a non-zero result as "0" merely because of UI formatting.
  const plain = number !== 0 && Math.abs(number) < 0.0001
    ? number.toExponential(6)
    : number.toLocaleString("en-US", { maximumFractionDigits: 8 });
  return unit && unit !== "score" && unit !== "ratio" ? `${plain} ${words(unit).toLowerCase()}` : plain;
}

// The answer, and a save that sends the same figures again. The save posts the
// inputs rather than the answer: the server works the result out again, so a
// saved figure is always one the evaluator produced, never one a form carried.
function resultCard(definition, evaluated, escape) {
  const shown = formatResult(evaluated.resultValue, evaluated.resultUnit);
  const money = /^money/.test(evaluated.resultUnit) ? `<p class="fine">In the same currency as the figures you entered.</p>` : "";
  return `<article class="card"><h2>${escape(definition.publicLabel)}: ${escape(shown)}</h2>${money}<p class="fine">Worked out as ${escape(definition.expressionText)}.</p><form method="post" action="/api/formulas/results"><input type="hidden" name="formulaKey" value="${escape(definition.formulaKey)}">${hiddenInputs(definition, evaluated.inputValues || {}, escape)}<button type="submit">Save to my records</button></form><p class="fine">Saving needs you to be signed in; it keeps these figures and the answer with your business.</p></article>`;
}

const REFUSALS = {
  missing_inputs: (result) => `Fill in ${(result.missing || []).map(words).join(", ")}.`,
  invalid_input: () => "One of the figures is not a number in the range this formula takes. Check each one and try again.",
  not_computable: (result) => result.message || "This cannot be worked out from these figures.",
  formula_not_enabled: () => "This formula is listed but cannot be worked out yet.",
  unknown_formula: () => "There is no formula by that name."
};

function refusalCard(result, escape) {
  const explain = REFUSALS[result?.code] || (() => "This could not be worked out.");
  return `<article class="card"><h2>Not worked out</h2><p>${escape(explain(result))}</p></article>`;
}

function savedResultsCard(definition, outcome, escape) {
  if (!outcome.ok) return `<article class="card"><h2>Saved results</h2><p>Saved results could not be read just now, so none are shown. This is not the same as having none.</p></article>`;
  if (!outcome.rows.length) return `<article class="card"><h2>Saved results</h2><p>Nothing has been saved for ${escape(definition.publicLabel.toLowerCase())} yet.</p></article>`;
  const rows = outcome.rows.map((row) => {
    const when = row.created_at ? new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ") : "";
    const inputs = definition.requiredInputs.map((key) => `${words(key)} ${toField(inputKind(key), row.input_values?.[key])}`).join("; ");
    return `<tr><td>${escape(when)}</td><td>${escape(formatResult(row.result_value, row.result_unit))}</td><td>${escape(inputs)}</td></tr>`;
  }).join("");
  const more = outcome.truncated ? `<p class="fine">Showing the latest ${outcome.rows.length}.</p>` : "";
  return `<article class="card"><h2>Saved results</h2><div class="table-scroll"><table><thead><tr><th>Saved (UTC)</th><th>Answer</th><th>Figures</th></tr></thead><tbody>${rows}</tbody></table></div>${more}</article>`;
}

function definitionFor(formulaKey) {
  return getFormulaDefinition(formulaKey) || null;
}

module.exports = {
  calculatorCard,
  definitionFor,
  formatResult,
  inputKind,
  refusalCard,
  resultCard,
  savedResultsCard,
  valuesFromForm,
  words
};
