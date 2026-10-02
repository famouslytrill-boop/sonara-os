// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Does this look like an email address, without a regular expression that can be
// made to run slowly?
//
// ## Why this exists
//
// `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` is the shape this repository has used for years
// and it is correct. It is also quadratic on some inputs, because `[^@\s]` matches
// `.` -- so `[^@\s]+\.[^@\s]+` can split a run of dots in many ways and the engine
// tries them. CodeQL raised it as a high-severity alert on
// lib/sonara-growth-events.cjs on 2 October 2026, under
// "Polynomial regular expression used on uncontrolled data", and it was right to:
// that one runs on an email typed into a public RSVP form by anybody.
//
// A long string of dots is free to send and expensive to match, which is a denial
// of service somebody can perform with a text field.
//
// ## Why this is not a better regular expression
//
// Because a better one is still a regular expression somebody has to reason about.
// This walks the string with `indexOf` and one `\s` scan, each of which is linear
// and neither of which backtracks. There is no quantifier here to be ambiguous.
//
// ## It must agree with the database
//
// Two tables check the shape themselves:
//
//   growth_event_rsvps.email  ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
//   merchant_orders.buyer_email  the same
//
// A validator looser than the constraint produces a save that fails in production
// with no explanation, which is worse than refusing at the form. So the rules below
// are the constraint's rules, restated as index arithmetic, and
// tests/an-email-check-cannot-be-made-slow.test.js asserts the two agree on a table
// of cases rather than trusting that they do.
//
// ## Where it is NOT used
//
// lib/sonara-env-value-checks.cjs keeps its own regular expression. That one reads
// environment variables set by the owner at deploy time, which is not uncontrolled
// data in the sense CodeQL means, and widening this change into it would be a
// sweep rather than a fix. Worth doing; worth doing separately.

// The longest address this accepts. RFC 5321 puts the limit at 320 characters for
// a path, and both columns are text with no length constraint, so this is the
// backstop: an input longer than any real address is refused before anything walks
// it.
const EMAIL_MAX = 320;
const EMAIL_MIN = 3;

// A single scan for whitespace. Not an ambiguous quantifier: one character class,
// no repetition, so there is nothing for an engine to backtrack over.
const WHITESPACE = /\s/;

/**
 * Does this look like an email address?
 *
 * The rules, which are the two check constraints' rules:
 *
 *   * exactly one `@`, and not in first or last position;
 *   * no whitespace anywhere;
 *   * the part after the `@` contains a `.` that is neither its first nor its last
 *     character.
 *
 * Returns a boolean, and the boolean is all it returns on purpose: a function that
 * reported *which* rule failed would invite a page to tell somebody that their
 * email "has two @ signs", which is a sentence nobody needs. The caller says "that
 * does not look like an email address".
 */
function looksLikeEmail(value) {
  const text = typeof value === "string" ? value : String(value == null ? "" : value);
  if (text.length < EMAIL_MIN || text.length > EMAIL_MAX) return false;
  if (WHITESPACE.test(text)) return false;

  const at = text.indexOf("@");
  // Not present, or first character -- there is no local part.
  if (at < 1) return false;
  // More than one. `lastIndexOf` rather than a count, which is one more linear pass
  // and not a loop with a quantifier in it.
  if (text.lastIndexOf("@") !== at) return false;

  const domain = text.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  // No dot, a leading dot, or a trailing dot. Each of the three is a domain the
  // database would refuse.
  if (dot < 1 || dot === domain.length - 1) return false;

  return true;
}

/**
 * The address as it should be stored: trimmed and lowercased.
 *
 * Separate from the check so a caller cannot accidentally store the raw input while
 * having validated a cleaned-up version of it -- which is how a trailing space ends
 * up in a unique index and one person holds two rows.
 */
function normalizeEmail(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

module.exports = { EMAIL_MAX, EMAIL_MIN, looksLikeEmail, normalizeEmail };
