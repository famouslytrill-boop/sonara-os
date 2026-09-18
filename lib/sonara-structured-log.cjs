// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// One line per event, as fields rather than prose.
//
// Item 1 of docs/PRODUCTION_RELIABILITY_AND_OBSERVABILITY_PLAN.md, and it is
// first in that plan for a reason that is not taste: an SLO over prose is a
// number somebody maintains by hand, and an error budget is arithmetic over
// outcomes. Neither can be built on lines like
//
//   [campaign-dispatch] batch_fell_back: campaign 33.. batch of 40 did not ...
//
// which is true, useful to a human reading one incident, and impossible to
// count.
//
// ## What this is not
//
// It is not a logging framework and it adds no dependency. This application has
// one production dependency and
// docs/architecture/EXTERNAL-SERVICES.md sets the rules before a second arrives.
//
// It is also not a migration. There are eight console calls in the whole
// runtime tree, every one already routed through lib/sonara-redaction.cjs, and
// they stay. This is an additional, structured line for the events worth
// counting -- the ones an SLO would be written against.
//
// ## Redaction happens per field, BEFORE serialisation, and that is forced
//
// The obvious shape is `console.log(redactSensitiveText(JSON.stringify(record)))`.
// **It corrupts the JSON.** Two patterns in lib/sonara-redaction.cjs match an
// optional closing quote and do not put it back:
//
//   authorization_header  /\b(authorization|apikey|...)\s*[:=]\s*("|')?(bearer\s+)?[...]("|')?/gi
//                         -> "$1: [redacted-credential]"
//   assigned_secret       /\b(password|secret|service[_ ]?role|...)\s*[:=]\s*("|')?[...]("|')?/gi
//                         -> "$1: [redacted-secret]"
//
// Run over `{"authorization":"Bearer abc..."}` the replacement consumes the
// quotes and writes a second colon, and the line stops being parseable. So every
// string is redacted first and `JSON.stringify` escapes whatever the redactor
// produced. The output is always valid JSON, which is the entire point of
// emitting JSON.
//
// tests/redaction-boundary.test.js asserts this module redacts every secret
// shape that file already tests for. That is a stronger guarantee than the
// console-call scan it is listed as exempt from, because it reads the emitted
// record rather than the spelling of the call.

const { redactSensitiveText } = require("./sonara-redaction.cjs");

// The outcomes an event may report, and nothing else.
//
// Closed on purpose. This is the field an SLO counts, and a free-text outcome
// cannot be counted -- "failed", "failure", "error" and "Failed." are four
// values naming one thing, and a rate computed over them is wrong in a way
// nobody sees. Adding a member here is a deliberate act with a migration
// attached; inventing one at a call site is refused.
//
//   ok        the thing was done
//   partial   some of it was done, and the record says which -- a campaign
//             where 459 of 460 landed is not a failure
//   refused   a gate said no. NOT a failure: a consent refusal or an
//             unapproved action working correctly must not spend error budget
//   degraded  it was done without a guarantee that normally holds, and said so
//             -- a send that ran unscreened because the suppression list could
//             not be read
//   failed    it was not done
const OUTCOMES = Object.freeze(["ok", "partial", "refused", "degraded", "failed"]);

// Who the event belongs to.
//
// Required, and it exists so that a FORGOTTEN tenant cannot look like an
// absent one. `organization` demands an id; `process` declares that the event
// has no tenant by nature -- start-up, a scheduled sweep, a configuration
// check. Without this the field would be `organization_id: null` in both cases,
// and shape 4 from .claude/skills/checks-that-cannot-lie says absent and
// deliberately-none are different facts with the same shape.
const SCOPES = Object.freeze(["organization", "process"]);

const MAX_DETAIL_KEYS = 24;
const MAX_STRING = 2000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Every string that leaves here has been through the boundary.
//
// Numbers and booleans pass as themselves: they cannot carry a key, and
// stringifying them would make every count a string and defeat the aggregation
// this exists for. `null` is preserved, because "the field was not known" is a
// fact and is not the same as the field being absent.
function scrub(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return redactSensitiveText(value).slice(0, MAX_STRING);
  if (value instanceof Date) return value.toISOString();
  // Bounded rather than recursive without limit: a detail object that carries a
  // request body would otherwise put the whole thing in the log line, and the
  // request body is where a credential lives.
  if (depth >= 2) return redactSensitiveText(String(value)).slice(0, MAX_STRING);
  if (Array.isArray(value)) return value.slice(0, MAX_DETAIL_KEYS).map((item) => scrub(item, depth + 1));
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).slice(0, MAX_DETAIL_KEYS)) {
      out[redactSensitiveText(key).slice(0, 80)] = scrub(value[key], depth + 1);
    }
    return out;
  }
  return redactSensitiveText(String(value)).slice(0, MAX_STRING);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Build the record without writing it. Pure, so the shape can be asserted
// without capturing stdout.
//
// A rejected input returns `{ ok: false, code, record: null }` rather than
// throwing. A logger that throws takes down the operation it was describing,
// which is a worse outcome than a missing line -- but it must not be SILENT
// either, so the caller gets a code and `emitEvent` writes a diagnostic line of
// its own.
function buildEvent(input = {}, { now = () => new Date() } = {}) {
  if (!isPlainObject(input)) {
    return { ok: false, code: "event_not_an_object", record: null };
  }
  if (!nonEmptyString(input.event)) {
    return { ok: false, code: "event_name_required", record: null };
  }
  if (!SCOPES.includes(input.scope)) {
    return {
      ok: false,
      code: "scope_required",
      record: null,
      detail: `scope must be one of ${SCOPES.join(", ")}: "organization" needs an organizationId, "process" declares the event has no tenant. `
        + "Defaulting it would make a forgotten tenant look like an absent one."
    };
  }
  if (input.scope === "organization" && !nonEmptyString(input.organizationId)) {
    return {
      ok: false,
      code: "organization_id_required",
      record: null,
      detail: "An organization-scoped event has to name the organization. An event nobody can attribute is one every tenant's query misses."
    };
  }
  if (!OUTCOMES.includes(input.outcome)) {
    return {
      ok: false,
      code: "outcome_not_recognised",
      record: null,
      detail: `outcome must be one of ${OUTCOMES.join(", ")}; a free-text outcome cannot be counted, and counting is what this is for.`
    };
  }

  const record = {
    ts: now().toISOString(),
    event: redactSensitiveText(String(input.event)).slice(0, 120),
    scope: input.scope,
    // Present as a value or as null, never absent, so a consumer reading
    // `organization` does not have to distinguish a missing key from a
    // process-scoped event.
    organization: input.scope === "organization" ? String(input.organizationId) : null,
    capability: nonEmptyString(input.capability) ? redactSensitiveText(input.capability).slice(0, 80) : null,
    outcome: input.outcome,
    // What ties several lines to one request or one job. Null rather than
    // invented: a correlation id this module made up would correlate nothing.
    correlation: nonEmptyString(input.correlationId) ? redactSensitiveText(input.correlationId).slice(0, 120) : null,
    // The named reason, for the outcomes where there is one. Same closed-ish
    // discipline as the outcome but not enumerable in advance, so it is a
    // string -- and it is the string an aggregate groups by, which is why it is
    // separate from `detail`.
    reason: nonEmptyString(input.reason) ? redactSensitiveText(input.reason).slice(0, 200) : null,
    detail: isPlainObject(input.detail) ? scrub(input.detail) : null
  };

  return { ok: true, code: "built", record };
}

// One line, to stderr.
//
// stderr rather than stdout because Vercel captures both and stdout is where a
// script's own output goes; a release-chain command printing JSON into its own
// report would be a different kind of mess.
//
// `write` is injectable so tests read the line instead of capturing a global,
// and so a future sink -- a collector, a table -- replaces one argument rather
// than this function.
function emitEvent(input = {}, { write, now } = {}) {
  const sink = typeof write === "function" ? write : (line) => process.stderr.write(`${line}\n`);

  let built;
  try {
    built = buildEvent(input, now ? { now } : undefined);
  } catch (error) {
    built = { ok: false, code: "build_threw", record: null, detail: redactSensitiveText(String(error && error.message)) };
  }

  if (!built.ok) {
    // Loud about its own refusal, and still structured, so a malformed call
    // shows up in the same stream as everything else rather than vanishing.
    // This line is the one case where `scope` is process by definition: the
    // event that failed to build is this module's, not a tenant's.
    const complaint = {
      ts: (now ? now() : new Date()).toISOString(),
      event: "log.event_rejected",
      scope: "process",
      organization: null,
      capability: "structured_log",
      outcome: "failed",
      correlation: null,
      reason: built.code,
      detail: {
        // The offending event NAME only. Echoing the whole input here is how a
        // rejected call becomes the leak -- the input is exactly the thing that
        // has not been through the field-wise scrub yet.
        attempted_event: nonEmptyString(input && input.event)
          ? redactSensitiveText(String(input.event)).slice(0, 120)
          : null,
        detail: built.detail ? redactSensitiveText(String(built.detail)).slice(0, 400) : null
      }
    };
    try {
      sink(JSON.stringify(complaint));
    } catch {
      // Nothing left to do. A logger that throws while reporting that it could
      // not log is the failure mode this catch exists for.
    }
    return built;
  }

  try {
    sink(JSON.stringify(built.record));
  } catch (error) {
    // JSON.stringify throws on a circular reference and on BigInt. The record
    // is already scrubbed and depth-bounded, so this is close to unreachable --
    // which is exactly why it is handled rather than assumed away.
    try {
      sink(JSON.stringify({
        ts: built.record.ts,
        event: "log.serialisation_failed",
        scope: "process",
        organization: null,
        capability: "structured_log",
        outcome: "failed",
        correlation: null,
        reason: redactSensitiveText(String(error && error.message)).slice(0, 200),
        detail: { attempted_event: built.record.event }
      }));
    } catch {
      // As above.
    }
    return { ok: false, code: "serialisation_failed", record: built.record };
  }

  return built;
}

module.exports = {
  OUTCOMES,
  SCOPES,
  MAX_DETAIL_KEYS,
  MAX_STRING,
  buildEvent,
  emitEvent
};
