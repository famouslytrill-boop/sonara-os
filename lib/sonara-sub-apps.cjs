"use strict";

// A sub-app is a set of records a customer defines for themselves.
//
// Five tables for this were created on 30 May 2026 and nothing ever read them.
// lib/sonara-subsystem-registry.cjs records the reason honestly: "Designed,
// never built. Overlaps business_workspaces, which is what customers actually
// get."
//
// **What a sub-app is here, and what it is not.**
//
// It is a named collection of record types the customer designs -- "Kennels",
// "Boat slips", "Rehearsal rooms" -- with their own fields, their own pages, and
// their own rows. Every business has something the fifteen built-in record pages
// do not model, and this is the answer to that without waiting for somebody here
// to build a page for it.
//
// It is **not** a deployed application at its own address.
// business_sub_app_deployments carries a `deployment_url` column, and this
// product cannot fill it: there is no build step (`pnpm run build` is
// `node --check server.js`), no per-tenant hosting, and one serverless function
// serving every route. A sub-app lives inside SONARA, at a path under the
// customer's own workspace. Writing a URL into that column would be a promise
// this codebase cannot keep, and the column stays unused until something can.
//
// **Why the field list is short.** Seven types, and every one of them renders as
// an input, validates on the way in, and reads back as the same value. A type
// that cannot do all three is a column that looks supported and is not -- which
// is the defect this repository keeps finding. File uploads, references between
// sub-apps and computed fields are all absent on purpose; each needs storage,
// integrity or an evaluator that does not exist yet, and each would be a
// half-answer that looks whole in a dropdown.

const FIELD_TYPES = Object.freeze({
  text: Object.freeze({
    label: "Short text",
    hint: "A name, a code, a reference.",
    input: "text",
    maxLength: 300
  }),
  long_text: Object.freeze({
    label: "Long text",
    hint: "Notes, a description, anything that runs to a paragraph.",
    input: "textarea",
    maxLength: 4000
  }),
  number: Object.freeze({
    label: "Number",
    hint: "A count or a measurement. Not money -- money has its own type so it is never stored as a float.",
    input: "number"
  }),
  money: Object.freeze({
    label: "Money",
    hint: "Stored in whole cents, so it never drifts. Enter it in pounds or dollars.",
    input: "number"
  }),
  date: Object.freeze({
    label: "Date",
    hint: "A calendar day.",
    input: "date"
  }),
  yes_no: Object.freeze({
    label: "Yes or no",
    hint: "A checkbox. Absent means no, and no means no -- neither means unknown.",
    input: "checkbox"
  }),
  choice: Object.freeze({
    label: "One of a list",
    hint: "You write the options; the form offers exactly those.",
    input: "select"
  })
});

const FIELD_TYPE_KEYS = Object.freeze(Object.keys(FIELD_TYPES));

const SUB_APP_STATUSES = Object.freeze(["draft", "in_use", "retired"]);
const SCHEMA_STATUSES = Object.freeze(["draft", "in_use", "retired"]);

const MAX_FIELDS = 30;
const MAX_CHOICES = 40;

function isFieldType(value) {
  return Object.prototype.hasOwnProperty.call(FIELD_TYPES, String(value || ""));
}

// A key safe to use as an object property and to show in a URL. Returns null
// rather than a mangled fallback: a key the customer did not ask for is worse
// than being told the name will not do.
function toKey(value, max = 60) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);
  if (!key) return null;
  // Leading digits make a key that reads as a number in some contexts and a
  // string in others.
  if (/^[0-9]/.test(key)) return `f_${key}`;
  return key;
}

// Turn what a person typed into a field list, or say which entry is wrong and
// why. Never returns a partially valid list: a schema half-accepted is a form
// that renders fields the records cannot hold.
function normalizeFields(input) {
  const rows = Array.isArray(input) ? input : [];
  if (!rows.length) {
    return { ok: false, code: "no_fields", message: "A record type needs at least one field, or there is nothing to fill in." };
  }
  if (rows.length > MAX_FIELDS) {
    return { ok: false, code: "too_many_fields", message: `A record type can have at most ${MAX_FIELDS} fields.` };
  }

  const fields = [];
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    const label = String(row?.label || "").trim().slice(0, 120);
    if (!label) {
      return { ok: false, code: "field_needs_a_name", index, message: `Field ${index + 1} has no name.` };
    }
    const type = String(row?.type || "");
    if (!isFieldType(type)) {
      return { ok: false, code: "unknown_field_type", index, message: `Field "${label}" has a type this product does not have. Choose one of: ${FIELD_TYPE_KEYS.join(", ")}.` };
    }
    const key = toKey(row?.key || label);
    if (!key) {
      return { ok: false, code: "field_name_unusable", index, message: `Field "${label}" has no letters or numbers in it, so there is no name to store it under.` };
    }
    if (seen.has(key)) {
      return { ok: false, code: "duplicate_field", index, message: `Two fields would both be stored as "${key}". Rename one.` };
    }
    seen.add(key);

    const field = { key, label, type, required: row?.required === true || row?.required === "on" || row?.required === "true" };

    if (type === "choice") {
      const choices = parseChoices(row?.choices);
      if (!choices.length) {
        return { ok: false, code: "choice_needs_options", index, message: `Field "${label}" is a list and has no options, so the form would offer nothing.` };
      }
      if (choices.length > MAX_CHOICES) {
        return { ok: false, code: "too_many_choices", index, message: `Field "${label}" has more than ${MAX_CHOICES} options.` };
      }
      field.choices = choices;
    }

    fields.push(Object.freeze(field));
  }

  return { ok: true, fields };
}

function parseChoices(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\n,]/);
  const seen = new Set();
  const choices = [];
  for (const entry of raw) {
    const text = String(entry || "").trim().slice(0, 120);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    choices.push(text);
  }
  return choices;
}

// One submitted record against one schema.
//
// Returns the whole record or the first problem, never a partial row. A record
// stored with a field silently dropped reads back as "they left it blank",
// which is a different fact from "we could not accept what they typed".
function coerceRecord(fields, submitted = {}) {
  const list = Array.isArray(fields) ? fields : [];
  if (!list.length) {
    return { ok: false, code: "schema_has_no_fields", message: "This record type has no fields, so there is nothing to save." };
  }

  const data = {};
  for (const field of list) {
    const raw = submitted[field.key];
    const value = coerceValue(field, raw);
    if (value.ok === false) return { ok: false, code: value.code, field: field.key, message: value.message };
    if (value.value === null) {
      if (field.required) {
        return { ok: false, code: "required_field_missing", field: field.key, message: `${field.label} is needed.` };
      }
      // Stored as null rather than omitted, so a reader can tell "left blank"
      // from "this field did not exist when the record was made".
      data[field.key] = null;
      continue;
    }
    data[field.key] = value.value;
  }
  return { ok: true, data };
}

function coerceValue(field, raw) {
  const type = field.type;

  if (type === "yes_no") {
    // A checkbox that is not ticked is not submitted at all, so absent means
    // no. That is the one place in this file where absent is a value rather
    // than a gap, and it is true of every HTML form.
    const yes = raw === true || raw === "on" || raw === "true" || raw === "yes" || raw === "1";
    return { value: yes };
  }

  const text = raw === undefined || raw === null ? "" : String(raw).trim();
  if (!text) return { value: null };

  if (type === "text" || type === "long_text") {
    return { value: text.slice(0, FIELD_TYPES[type].maxLength) };
  }

  if (type === "number") {
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) {
      return { ok: false, code: "not_a_number", message: `${field.label} must be a number.` };
    }
    return { value: numeric };
  }

  if (type === "money") {
    const numeric = Number(text.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(numeric)) {
      return { ok: false, code: "not_an_amount", message: `${field.label} must be an amount.` };
    }
    if (numeric < 0) {
      return { ok: false, code: "negative_amount", message: `${field.label} cannot be negative.` };
    }
    // Whole cents. Rounding here rather than storing a float is the same rule
    // every other money column in this product follows.
    return { value: Math.round(numeric * 100) };
  }

  if (type === "date") {
    // Date only, no time. Parsed as UTC so a day does not shift by timezone --
    // "2026-08-19" must read back as the nineteenth wherever it is read.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return { ok: false, code: "not_a_date", message: `${field.label} must be a date, written as YYYY-MM-DD.` };
    }
    const parsed = Date.parse(`${text}T00:00:00Z`);
    if (!Number.isFinite(parsed)) {
      return { ok: false, code: "not_a_date", message: `${field.label} is not a real date.` };
    }
    return { value: text };
  }

  if (type === "choice") {
    const choices = Array.isArray(field.choices) ? field.choices : [];
    if (!choices.includes(text)) {
      return { ok: false, code: "not_an_option", message: `${field.label} must be one of: ${choices.join(", ")}.` };
    }
    return { value: text };
  }

  // Unreachable while normalizeFields is the only way a field is created, and
  // an error rather than a passthrough because the alternative is storing
  // whatever arrived under a type nobody validated.
  return { ok: false, code: "unknown_field_type", message: `${field.label} has a type this product does not have.` };
}

// What a stored value looks like on a page. Reads the field rather than
// guessing from the value, because a number and an amount are the same JSON.
function displayValue(field, value) {
  if (value === null || value === undefined) return "";
  if (field.type === "yes_no") return value ? "Yes" : "No";
  if (field.type === "money") {
    const cents = Number(value);
    if (!Number.isFinite(cents)) return "";
    return `$${(cents / 100).toFixed(2)}`;
  }
  return String(value);
}

module.exports = {
  FIELD_TYPES,
  FIELD_TYPE_KEYS,
  SUB_APP_STATUSES,
  SCHEMA_STATUSES,
  MAX_FIELDS,
  MAX_CHOICES,
  isFieldType,
  toKey,
  normalizeFields,
  parseChoices,
  coerceRecord,
  coerceValue,
  displayValue
};
