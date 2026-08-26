"use strict";

// Filling a free tool in again with the numbers from last time.
//
// Pure. Given a tool's fields and a payload saved from an earlier run, it works
// out what can be filled in, what cannot, and what has been left behind.
//
// ## There is no new table, because the inputs were already being saved
//
// `module_outputs` has carried `input_payload` beside `output_payload` since it
// was created. Every saved result already holds the numbers that produced it,
// and nothing has ever read them back -- the saved-results list selects
// `id, module_key, created_at, output_payload` and stops. So "saved presets"
// is not a feature to store; it is a column to read.
//
// ## Why a partial fill has to say so
//
// A tool's fields change. A payload saved in July can carry a field that has
// since been renamed, and can be missing one added since. Filling in what
// matches and staying quiet is the dangerous version: somebody recognises the
// form, sees their old numbers, presses the button, and gets an answer computed
// partly from a blank they never noticed.
//
// So the result names both sides. `missing` is fields the tool needs that the
// payload cannot fill. `ignored` is what the payload carried that the tool no
// longer has -- reported rather than dropped, because it is how somebody finds
// out the tool changed rather than that they mistyped.
//
// ## What it will not do
//
// **It will not invent a value.** A field with no match is left empty and named,
// never defaulted to zero. `Number(null)` is 0 and a break-even computed from a
// silent zero is a confident wrong answer.
//
// **It will not fill a value the field cannot hold.** A select is only filled
// from one of its own options, because a select whose value is not in its list
// renders as the first option -- so a stale value would silently become a
// different, plausible answer.

// A value that can be put into a form field. Zero and false are real answers
// and must survive; null, undefined and the empty string are not.
function usable(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  // Arrays and objects are not form values. A payload carrying one is from a
  // tool that takes structured input, and guessing a rendering for it would put
  // "[object Object]" into a box somebody then submits.
  return false;
}

function asText(value) {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/**
 * What a saved payload can fill in on a tool as it stands today.
 *
 * Returns `{ ok, values, filled, missing, ignored, complete }`.
 *
 * `values` is keyed by field name and contains only what can actually be put in
 * the form. `complete` is true only when every required field is filled -- it
 * is the single thing the page needs to decide whether to say "these are your
 * numbers from last time" or "some of these you will have to type again".
 */
function applyPreset({ fields = [], payload = null } = {}) {
  const empty = { ok: false, values: {}, filled: [], missing: [], ignored: [], complete: false };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ...empty, reason: "There is nothing saved on that result to fill this in with." };
  }

  const values = {};
  const filled = [];
  const missing = [];
  const known = new Set();

  for (const field of Array.isArray(fields) ? fields : []) {
    const name = String(field?.name || "");
    if (!name) continue;
    known.add(name);

    const raw = Object.prototype.hasOwnProperty.call(payload, name) ? payload[name] : undefined;
    if (!usable(raw)) {
      if (field?.required) missing.push({ name, label: String(field?.label || name) });
      continue;
    }

    const text = asText(raw);

    // A select can only hold one of its own options. Anything else renders as
    // the first option, which silently turns a stale answer into a different
    // plausible one.
    if (field?.type === "select") {
      const options = Array.isArray(field.options) ? field.options.map((option) => String(option?.value)) : [];
      if (!options.includes(text)) {
        if (field.required) missing.push({ name, label: String(field.label || name) });
        continue;
      }
    }

    values[name] = text;
    filled.push(name);
  }

  const ignored = Object.keys(payload)
    .filter((key) => !known.has(key) && usable(payload[key]))
    .sort();

  return {
    ok: true,
    reason: null,
    values,
    filled,
    missing,
    ignored,
    complete: missing.length === 0 && filled.length > 0
  };
}

// What the page says above a prefilled form. Written for somebody who is about
// to press a button, so the partial case leads with what they have to do.
function describe(preset) {
  if (!preset?.ok) return preset?.reason || "That could not be filled in.";
  if (!preset.filled.length) return "Nothing on that saved result fits this tool, so none of it has been filled in.";
  if (preset.missing.length) {
    const names = preset.missing.map((field) => field.label).join(", ");
    return `Filled in from your saved result. ${preset.missing.length === 1 ? "This one is" : "These are"} not on it and still ${preset.missing.length === 1 ? "needs" : "need"} typing: ${names}.`;
  }
  return "Filled in from your saved result. Change anything you want and work it out again.";
}

module.exports = { usable, asText, applyPreset, describe };
