"use strict";

// One place secrets are scrubbed out of text, and one place to widen when a new
// secret shape arrives.
//
// redactSensitiveText lived in server.js and was applied at four call sites, all
// of them around support requests and email failures. It was named like a
// boundary and used like a helper, which is the shape of the problem: a
// scrubbing function nothing is required to call scrubs whatever somebody
// remembered to pass it.
//
// The patterns it carried were Stripe-shaped keys, long digit runs, and
// `password: value`. That covers a customer pasting a card number into a
// support message, which is what it was written for. It does not cover the
// thing most likely to leak from this application: a provider error. A Supabase
// failure carries a URL with an apikey query parameter or an Authorization
// header echo; a service-role key is a JWT, which is not `sk_`-shaped and has no
// long digit run.
//
// So the patterns below are ordered by what this deployment actually holds:
// Supabase JWTs and service-role keys first, then Stripe, then Resend, then the
// generic shapes. redactError() exists because an Error is the usual carrier and
// `String(error)` drops the stack while `error.stack` keeps the URL that failed.
//
// tests/redaction-boundary.test.js gives every pattern a string it must redact
// and a benign string it must leave intact -- a redactor that replaces
// everything is as useless as one that replaces nothing, and only the second
// failure is obvious.

// Ordered most specific first. Each entry names what it is for, because a bare
// regex in a security path is a thing nobody dares change later.
const PATTERNS = Object.freeze([
  Object.freeze({
    name: "supabase_or_jwt_key",
    // Three base64url segments joined by dots, starting with the standard
    // {"alg" header prefix. Supabase anon and service-role keys are both JWTs,
    // and the service-role key bypasses row level security -- it is the single
    // worst thing in this deployment to print.
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replacement: "[redacted-jwt]"
  }),
  Object.freeze({
    name: "authorization_header",
    pattern: /\b(authorization|apikey|api-key|x-api-key)\s*[:=]\s*("|')?(bearer\s+)?[A-Za-z0-9._~+/=-]{8,}("|')?/gi,
    replacement: "$1: [redacted-credential]"
  }),
  Object.freeze({
    name: "url_query_credential",
    // A key handed to PostgREST or storage as a query parameter, which is how it
    // ends up inside a failed request URL in a stack trace.
    pattern: /([?&](?:apikey|api_key|access_token|token|key|signature)=)[^&\s"']+/gi,
    replacement: "$1[redacted]"
  }),
  Object.freeze({
    name: "stripe_key",
    pattern: /\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_]{8,}/g,
    replacement: "[redacted-token]"
  }),
  Object.freeze({
    name: "resend_key",
    pattern: /\bre_[A-Za-z0-9_-]{12,}/g,
    replacement: "[redacted-token]"
  }),
  Object.freeze({
    name: "postgres_connection_string",
    pattern: /\bpostgres(?:ql)?:\/\/[^\s"']*/gi,
    replacement: "postgresql://[redacted-connection-string]"
  }),
  Object.freeze({
    name: "assigned_secret",
    pattern: /\b(password|passcode|passphrase|secret|secret[_ ]?key|private[_ ]?key|service[_ ]?role|client[_ ]?secret)\s*[:=]\s*("|')?[^\s,;"']{4,}("|')?/gi,
    replacement: "$1: [redacted-secret]"
  }),
  Object.freeze({
    name: "card_like_number",
    // Kept last: it is the loosest, and a 13-19 digit run is more often an
    // identifier than a card. It stays because a customer pasting a card number
    // into a support message is the case this file was originally written for,
    // and AGENTS.md forbids storing card data.
    pattern: /\b\d{13,19}\b/g,
    replacement: "[redacted-card-like-number]"
  })
]);

function redactSensitiveText(value) {
  let text = String(value === null || value === undefined ? "" : value);
  for (const entry of PATTERNS) text = text.replace(entry.pattern, entry.replacement);
  return text;
}

// The usual carrier. `error.stack` is kept because the failing line is the
// useful part, and it is exactly the part that carries the URL a key was in.
// Passing an Error to console.error directly prints the stack unscrubbed, which
// is why this exists rather than a note asking people to remember.
function redactError(error, { includeStack = true } = {}) {
  if (error === null || error === undefined) return "";
  if (typeof error === "string") return redactSensitiveText(error);
  const stack = includeStack && error.stack ? String(error.stack) : "";
  const message = error.message ? String(error.message) : String(error);
  return redactSensitiveText(stack || message);
}

// Every output sink in this application goes through one of these two. The test
// beside this file enforces that rather than trusting it.
module.exports = {
  PATTERNS,
  redactSensitiveText,
  redactError
};
