// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A deliberately small runtime request-schema boundary.
//
// This is not a second application model layer. It exists at HTTP trust
// boundaries, before route code coerces attacker-controlled values with
// String(), Number(), slices, or defaults. Coercion before validation turns
// arrays, objects, duplicate form keys and unexpected fields into values that
// look ordinary enough to pass later business checks.
//
// Schemas are explicit allowlists. Unknown fields fail closed by default.
// Callers may opt out only for a route whose protocol genuinely permits an
// extension bag, and that exception stays visible at the call site.

const DEFAULT_MAX_KEYS = 32;
const VALID_TYPES = new Set(["string", "boolean", "number", "integer"]);

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function fieldError(field, code) {
  return Object.freeze({ field, code });
}

function normalizeString(raw, spec) {
  const value = spec.trim === false ? raw : raw.trim();
  if (spec.minLength !== undefined && value.length < spec.minLength) return { error: "too_short" };
  if (spec.maxLength !== undefined && value.length > spec.maxLength) return { error: "too_long" };
  if (spec.enum && !spec.enum.includes(value)) return { error: "not_allowed" };
  if (spec.pattern && !spec.pattern.test(value)) return { error: "invalid_format" };
  return { value };
}

function normalizeNumber(raw, spec, integer) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return { error: "invalid_type" };
  if (integer && !Number.isInteger(raw)) return { error: "invalid_type" };
  if (spec.min !== undefined && raw < spec.min) return { error: "too_small" };
  if (spec.max !== undefined && raw > spec.max) return { error: "too_large" };
  return { value: raw };
}

function validateRequestBody(body, schema, options = {}) {
  if (!isPlainRecord(schema)) throw new TypeError("request schema must be a plain object");

  if (!isPlainRecord(body)) {
    return { ok: false, code: "invalid_request_body", errors: [fieldError("$body", "invalid_type")] };
  }

  const keys = Object.keys(body);
  const maxKeys = Number.isInteger(options.maxKeys) && options.maxKeys > 0 ? options.maxKeys : DEFAULT_MAX_KEYS;
  if (keys.length > maxKeys) {
    return { ok: false, code: "invalid_request_body", errors: [fieldError("$body", "too_many_fields")] };
  }

  const allowed = new Set(Object.keys(schema));
  if (options.allowUnknown !== true) {
    const unknown = keys.filter((key) => !allowed.has(key));
    if (unknown.length) {
      return {
        ok: false,
        code: "invalid_request_body",
        errors: unknown.slice(0, 8).map((field) => fieldError(field, "unknown_field"))
      };
    }
  }

  const value = {};
  const errors = [];

  for (const [field, rawSpec] of Object.entries(schema)) {
    const spec = rawSpec || {};
    const type = spec.type || "string";
    if (!VALID_TYPES.has(type)) throw new TypeError(`unsupported request schema type for ${field}: ${type}`);

    const present = Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined && body[field] !== null;
    if (!present) {
      if (spec.required === true) errors.push(fieldError(field, "required"));
      else if (Object.prototype.hasOwnProperty.call(spec, "default")) value[field] = spec.default;
      continue;
    }

    const raw = body[field];

    // Duplicate form fields arrive as arrays in common parsers. Objects may
    // arrive from JSON. Neither is silently stringified into a scalar.
    if (Array.isArray(raw) || isPlainRecord(raw)) {
      errors.push(fieldError(field, "invalid_type"));
      continue;
    }

    if (type === "string") {
      if (typeof raw !== "string") {
        errors.push(fieldError(field, "invalid_type"));
        continue;
      }
      const normalized = normalizeString(raw, spec);
      if (normalized.error) errors.push(fieldError(field, normalized.error));
      else value[field] = normalized.value;
      continue;
    }

    if (type === "boolean") {
      if (typeof raw !== "boolean") errors.push(fieldError(field, "invalid_type"));
      else value[field] = raw;
      continue;
    }

    const normalized = normalizeNumber(raw, spec, type === "integer");
    if (normalized.error) errors.push(fieldError(field, normalized.error));
    else value[field] = normalized.value;
  }

  if (errors.length) return { ok: false, code: "invalid_request_body", errors };
  return { ok: true, code: "valid", value };
}

module.exports = {
  DEFAULT_MAX_KEYS,
  isPlainRecord,
  validateRequestBody,
};
