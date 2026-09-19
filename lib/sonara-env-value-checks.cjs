// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Is this environment value real, or is it the word somebody typed to get past
// a form?
//
// These four functions were private to `server.js`, which meant
// `lib/sonara-readiness.cjs` could reach them only because `server.js` passes
// them in as dependencies -- and nothing outside the running application could
// reach them at all.
//
// That mattered on 18 September 2026. `scripts/verify-email-env.mjs` was
// rewritten to check the email provider's configuration, and it applied its
// own rule: non-empty, and not one of four exact sentinel words. Meanwhile
// `getResendApiKeyStatus` in the readiness module rejects a key shorter than 12
// characters or matching the much broader placeholder test below, and
// `getEmailValueStatus` requires an address to be email-like. So
// `RESEND_API_KEY=replace-me` and `RESEND_FROM_EMAIL=fake` made the new check
// exit 0 and report email ready, while the application itself treated delivery
// as unconfigured. Codex found it on PR #299.
//
// The point of moving them here is that there is now one implementation rather
// than two rules that agree until somebody edits one. `server.js` requires
// them, `createReadiness` receives them from there as before, and the script
// requires them directly.
//
// Nothing here reads `process.env` or touches the network: each takes a value
// and answers a question about it, which is what makes it testable and what
// makes it safe to call from a release-chain script.

function isPlaceholderValue(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("...")) return true;
  if (["changeme", "change-me", "replace-me", "todo"].includes(normalized)) return true;
  return /(^|[_\-\s])(placeholder|dummy|fake|xxx|your|sample|example|must[_-]?not[_-]?render)([_\-\s]|$)/i.test(normalized)
    || /^price_(test|xxx|placeholder|example|your)/i.test(normalized)
    || /^sk_(test|live)_(test|xxx|placeholder|example|your)/i.test(normalized)
    || /^whsec_(test|xxx|placeholder|example|your)/i.test(normalized);
}

function extractEmailAddress(value) {
  const raw = String(value || "").trim();
  const friendlyNameMatch = raw.match(/^[^<>]*<([^<>]+)>$/);
  return String(friendlyNameMatch?.[1] || raw).trim();
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractEmailAddress(value));
}

function isPlaceholderEmail(value) {
  const email = extractEmailAddress(value).toLowerCase();
  return isPlaceholderValue(email) || ["your-email@example.com", "you@example.com"].includes(email);
}

// The minimum length `getResendApiKeyStatus` and `getSecretValueStatus` in
// lib/sonara-readiness.cjs both apply to a secret. Exported so a caller cannot
// apply a different number and believe it is applying the same rule.
const MINIMUM_SECRET_LENGTH = 12;

function isConfiguredSecret(value) {
  const raw = String(value || "").trim();
  return raw.length >= MINIMUM_SECRET_LENGTH && !isPlaceholderValue(raw);
}

function isConfiguredEmail(value) {
  const raw = String(value || "").trim();
  return raw.length > 0 && isEmailLike(raw) && !isPlaceholderEmail(raw);
}

module.exports = {
  isPlaceholderValue,
  extractEmailAddress,
  isEmailLike,
  isPlaceholderEmail,
  isConfiguredSecret,
  isConfiguredEmail,
  MINIMUM_SECRET_LENGTH
};
