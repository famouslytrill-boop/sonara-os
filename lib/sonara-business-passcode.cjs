// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A second thing the business owner knows, for the operations a stolen browser
// should not be enough to reach.
//
// ## The gap this closes, measured rather than imagined
//
// `requireBusinessManager` in server.js proves two things and no more: the
// request carries a valid customer session, and that user holds an active
// `owner` or `manager` row in `business_memberships`. Both are properties of
// the browser, not of the person. The session cookie lives an hour
// (`CUSTOMER_SESSION_MAX_AGE_SECONDS`) and the refresh cookie renews it for
// thirty days (`CUSTOMER_REFRESH_MAX_AGE_SECONDS`), both read from
// lib/sonara-customer-auth.cjs on 1 October 2026.
//
// So for up to a month, whoever has the browser has everything that gate
// covers: every employee record, every wage rate, every pay statement, the
// time clock and the pay run. A shared back-office terminal, a laptop left
// open, a phone handed to somebody for a minute -- in each the second factor
// at sign-in has already been passed and is not asked again.
//
// A management passcode is the thing that is *not* in the browser. It is
// entered to unlock those surfaces, the unlock expires on its own short timer
// regardless of how long the session lives, and changing the passcode revokes
// every unlock already outstanding.
//
// ## Hashed, never encrypted, and said that way on purpose
//
// Encryption is reversible by whoever holds the key, which means a passcode
// stored encrypted can be read back by this service. A passcode stored as a
// scrypt hash cannot be read back by anybody, including us, which is the
// property that matters: a database disclosure hands an attacker something
// they must still brute-force, and no amount of access to this codebase turns
// it back into what the owner typed.
//
// Two layers, because they defend against different compromises:
//
//   1. The passcode is run through scrypt, and nothing else touches it first.
//      Unlike the recovery codes in
//      lib/sonara-secret-box.cjs -- which are ninety-six bits of randomness,
//      where slow hashing buys nothing -- a passcode is chosen by a person and
//      therefore sits in a space small enough to enumerate. Slow hashing is
//      exactly the case it exists for, so here it is right where there it was
//      wrong.
//   2. That digest is then HMAC'd under a pepper derived from
//      `SONARA_TOTP_KEY`, which lives in the environment and never in the
//      database. An attacker who reads the table and nothing else cannot test a
//      guess at all -- they are missing an input.
//
// The order matters and was wrong first time: peppering before scrypt put the
// passcode into HMAC-SHA-256, a fast hash, and CodeQL raised
// `js/weak-password-hashing` on it. See the comment on `derive` below.
//
// ## This module does no input and output
//
// Everything here is a pure function of its arguments. It never reads a
// request, never touches Supabase and never decides policy about who is
// asking. The route module does that, and this is testable without either.

const crypto = require("node:crypto");
const { isPasswordLeaked, LEAKED_PASSWORD_MESSAGE } = require("./sonara-leaked-password.cjs");

// scrypt cost. 2^15 iterations at r=8 is about a tenth of a second on the
// runtime this deploys to, which is unnoticeable on an unlock -- they happen
// once per half hour at most -- and is sixteen thousand times the cost of a
// single hash to anybody enumerating.
//
// `maxmem` is stated rather than left to the default on purpose. Node's
// default ceiling is 32 MiB and this configuration needs 128 * N * r bytes,
// which is 32 MiB exactly; at the default it throws rather than hashing. A
// throw inside a verification path is the kind of thing that gets caught and
// turned into a falsy answer, so the ceiling is raised where it can be read.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 128 * SCRYPT_N * SCRYPT_R * 2;

// HKDF labels. One purpose, one key -- the rule lib/sonara-secret-box.cjs sets.
const PASSCODE_PEPPER_LABEL = "sonara.business.passcode.pepper.v1";
const UNLOCK_LABEL = "sonara.business.unlock.v1";

// Twelve characters, the same floor `NEW_PASSWORD_MIN_LENGTH` sets for a new
// account password in lib/sonara-customer-auth.cjs. A second credential that
// is easier to guess than the first one is not a second credential.
const MINIMUM_LENGTH = 12;
const MAXIMUM_LENGTH = 128;

// Five wrong answers, then a quarter of an hour.
const MAXIMUM_FAILURES = 5;
const LOCKOUT_SECONDS = 15 * 60;

// How long an unlock lasts, regardless of how long the session does.
const UNLOCK_SECONDS = 30 * 60;

const UNLOCK_COOKIE = "sonara_business_unlock";

// Is the whole value one step-by-one run -- `123456789012`, `abcdefghijkl`,
// or the same backwards?
//
// The first version of this rule held two literal strings, `"0123456789"` and
// its reverse, and asked whether the value's digits were a substring of
// either. It could never fire. The shortest acceptable passcode is twelve
// characters and the longest run in a ten-character string is ten, so the
// `digits.length >= MINIMUM_LENGTH` guard and the substring test could not
// both be true of the same value. It was a rule that read as a rule and
// measured nothing -- caught by running it, not by reading it.
//
// Asking the actual question costs the same and works at any length.
function isStepSequence(value) {
  if (value.length < 2) return false;
  const step = value.codePointAt(1) - value.codePointAt(0);
  if (step !== 1 && step !== -1) return false;
  for (let i = 2; i < value.length; i += 1) {
    if (value.codePointAt(i) - value.codePointAt(i - 1) !== step) return false;
  }
  return true;
}

function subkey(material, label) {
  return Buffer.from(crypto.hkdfSync("sha256", material, Buffer.alloc(0), Buffer.from(label, "utf8"), 32));
}

// The pepper a passcode is HMAC'd under before it is ever hashed.
function passcodePepper(key) {
  return subkey(key.material, PASSCODE_PEPPER_LABEL);
}

// The key an unlock token is signed with. Different bytes, different purpose.
function unlockKey(key) {
  return subkey(key.material, UNLOCK_LABEL);
}

// Is this acceptable as a passcode?
//
// Returns `{ ok }` or `{ ok: false, code, message }` where the message is
// shown to the owner. Every rejection says what to do instead, because a rule
// that only says "no" gets worked around by appending a `1`.
function checkPasscode(candidate) {
  const value = String(candidate ?? "");
  if (!value) return { ok: false, code: "missing", message: "Enter a management passcode." };
  if (value !== value.trim()) {
    return { ok: false, code: "padded", message: "A passcode cannot start or end with a space -- it is too easy to lose one when typing it back." };
  }
  if (value.length < MINIMUM_LENGTH) {
    return { ok: false, code: "too_short", message: `Use at least ${MINIMUM_LENGTH} characters. This is the passcode that protects your employee and payroll records.` };
  }
  if (value.length > MAXIMUM_LENGTH) {
    return { ok: false, code: "too_long", message: `Use at most ${MAXIMUM_LENGTH} characters.` };
  }
  if (new Set(value).size === 1) {
    return { ok: false, code: "one_character", message: "A passcode of one repeated character is guessed first. Use a phrase you will remember." };
  }
  if (isStepSequence(value)) {
    return { ok: false, code: "counting", message: "Counting up or down is guessed first. Use a phrase you will remember." };
  }
  return { ok: true };
}

// The shape rules, and then the breach list.
//
// Separate from `checkPasscode` because this one reaches the network.
// `isPasswordLeaked` queries the Have I Been Pwned range API, and the first
// draft of this module called it from inside the synchronous check as
// `if (isPasswordLeaked(value))`. It is an async function, so that condition
// tested a Promise -- always truthy -- and **every passcode was rejected as
// leaked**, including ones that are not. The probe that caught it rejected
// `"correct horse battery staple"` and a random phrase alike, which is what
// made it visible; reading the line did not.
//
// It returns `{ leaked, checked, ... }` rather than a boolean, and the two are
// different answers. `checked: false` means the lookup did not happen -- no
// fetch, a network failure, the service down. That is not evidence the
// passcode is safe, so it is reported as `breachCheck: "unavailable"` and the
// owner is told, rather than being shown a tick that stands for nothing.
async function checkPasscodeAgainstBreaches(candidate, options = {}) {
  const shape = checkPasscode(candidate);
  if (!shape.ok) return shape;
  const result = await isPasswordLeaked(String(candidate), options).catch(() => ({ leaked: false, checked: false }));
  if (result?.leaked) return { ok: false, code: "leaked", message: LEAKED_PASSWORD_MESSAGE };
  return { ok: true, breachCheck: result?.checked ? "clear" : "unavailable" };
}

// Hash a passcode for storage.
//
// The stored string carries its own parameters, so raising the cost later
// leaves every existing row verifiable rather than locking its owner out.
// `v1` is first and is checked on the way back: a format change is a readable
// failure rather than a silent misreading of old rows.
function hashPasscode(passcode, key) {
  const salt = crypto.randomBytes(16);
  return ["v1", "scrypt", String(SCRYPT_N), String(SCRYPT_R), String(SCRYPT_P), salt.toString("base64url"), derive(passcode, salt, key).toString("base64url")].join(".");
}

// scrypt first, pepper second, and the order is the correction.
//
// The first version peppered first: `scrypt(HMAC(pepper, passcode), salt)`. The
// security property is the same either way -- without the pepper a guess cannot
// be tested -- but the passcode's first stop was HMAC-SHA-256, a deliberately
// fast hash. CodeQL read that dataflow exactly as written and raised
// `js/weak-password-hashing` as high severity on both call sites, and it was
// right to: "the slow part is further down" is a property of this file rather
// than of the line, and the next person to move the scrypt call would take the
// protection with it without the compiler or the scanner noticing.
//
// This way the passcode goes straight into scrypt and nowhere else, and the
// pepper is HMAC'd over the digest -- which is the construction OWASP describes
// for a pepper held outside the database, and the one that cannot be read as
// hashing a password with SHA-256 because it does not.
function derive(passcode, salt, key, parameters = {}) {
  const n = parameters.n || SCRYPT_N;
  const r = parameters.r || SCRYPT_R;
  const p = parameters.p || SCRYPT_P;
  const stretched = crypto.scryptSync(String(passcode ?? ""), salt, SCRYPT_KEY_LENGTH, { N: n, r, p, maxmem: SCRYPT_MAX_MEMORY });
  return crypto.createHmac("sha256", passcodePepper(key)).update(stretched).digest();
}

// Does this passcode match that stored hash?
//
// Returns `{ ok: true, matches }` when the comparison happened, and
// `{ ok: false, code }` when it could not -- an unparseable or absent stored
// value is **not** reported as "does not match". The caller has to be able to
// tell "wrong passcode" from "this row is damaged", because counting the
// second as the first burns an owner's attempts against a problem no passcode
// fixes.
function verifyPasscode(passcode, stored, key) {
  const parts = String(stored || "").split(".");
  if (parts.length !== 7 || parts[0] !== "v1" || parts[1] !== "scrypt") return { ok: false, code: "unreadable_hash" };
  const n = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || n < 2 || r < 1 || p < 1) {
    return { ok: false, code: "unreadable_hash" };
  }
  // A row claiming a cost nobody would have written is a row somebody is using
  // to make this process spend a gigabyte. Refuse it rather than honour it.
  if (n > SCRYPT_N || r > SCRYPT_R || p > SCRYPT_P) return { ok: false, code: "unreadable_hash" };
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[5], "base64url");
    expected = Buffer.from(parts[6], "base64url");
  } catch {
    return { ok: false, code: "unreadable_hash" };
  }
  // The stored digest is an HMAC-SHA-256 output, so its length is fixed at 32
  // whatever the row claims. A row of a different length is not a row this
  // construction wrote.
  if (salt.length < 8 || expected.length !== SCRYPT_KEY_LENGTH) return { ok: false, code: "unreadable_hash" };

  let derived;
  try {
    derived = derive(passcode, salt, key, { n, r, p });
  } catch {
    return { ok: false, code: "unreadable_hash" };
  }
  return { ok: true, matches: crypto.timingSafeEqual(derived, expected) };
}

// Where a credential stands after a wrong answer.
//
// Pure accounting: given the failures already recorded and the moment of this
// one, say what the row should now hold. The route writes it; nothing here
// knows a database exists.
function failureState(previousFailures, nowMs) {
  const failures = Number.isFinite(previousFailures) && previousFailures > 0 ? Math.floor(previousFailures) + 1 : 1;
  if (failures < MAXIMUM_FAILURES) return { failures, lockedUntilMs: null, remaining: MAXIMUM_FAILURES - failures };
  return { failures, lockedUntilMs: nowMs + LOCKOUT_SECONDS * 1000, remaining: 0 };
}

// Is this credential locked right now?
//
// An unparseable `locked_until` counts as locked, not as open. A timestamp
// nobody can read is a reason to stop, and the alternative -- treating a value
// we failed to understand as "no lock" -- is the way a lockout is defeated by
// writing rubbish into the column.
function lockState(lockedUntil, nowMs) {
  if (lockedUntil === null || lockedUntil === undefined || lockedUntil === "") return { locked: false };
  const until = typeof lockedUntil === "number" ? lockedUntil : Date.parse(String(lockedUntil));
  if (!Number.isFinite(until)) return { locked: true, code: "unreadable_lock", secondsRemaining: LOCKOUT_SECONDS };
  if (until <= nowMs) return { locked: false };
  return { locked: true, code: "locked_out", secondsRemaining: Math.ceil((until - nowMs) / 1000) };
}

// Mint an unlock token.
//
// Bound to four things, each for a reason:
//
//   organizationId    -- an unlock for one business is not an unlock for another
//   userId            -- and not for a different person on the same browser
//   expiresAtMs       -- so it stops on its own, however long the session runs
//   credentialVersion -- the credential's `updated_at`. Changing the passcode
//                        moves it, and every token already issued stops
//                        verifying. That is what makes changing the passcode a
//                        way to throw somebody out rather than a note for next
//                        time.
function issueUnlock({ organizationId, userId, credentialVersion, nowMs, key, lifetimeSeconds = UNLOCK_SECONDS }) {
  const expiresAtMs = nowMs + lifetimeSeconds * 1000;
  const signature = signUnlock({ organizationId, userId, credentialVersion, expiresAtMs, key });
  return { token: ["v1", String(expiresAtMs), signature].join("."), expiresAtMs };
}

function signUnlock({ organizationId, userId, credentialVersion, expiresAtMs, key }) {
  // Newline-separated and never concatenated: without a separator no field can
  // read, `org "a" + user "bc"` and `org "ab" + user "c"` sign identically.
  const message = [
    String(organizationId ?? ""),
    String(userId ?? ""),
    String(credentialVersion ?? ""),
    String(expiresAtMs)
  ].join("\n");
  return crypto.createHmac("sha256", unlockKey(key)).update(message, "utf8").digest("base64url");
}

// Does this token unlock this business, for this person, right now?
//
// `{ ok: true }` or `{ ok: false, code }`. Every failure is a refusal; there
// is no path through here that returns ok on a value it could not verify.
function verifyUnlock(token, { organizationId, userId, credentialVersion, nowMs, key }) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return { ok: false, code: "no_unlock" };
  const expiresAtMs = Number(parts[1]);
  if (!Number.isFinite(expiresAtMs)) return { ok: false, code: "no_unlock" };
  if (expiresAtMs <= nowMs) return { ok: false, code: "unlock_expired" };

  const expected = Buffer.from(signUnlock({ organizationId, userId, credentialVersion, expiresAtMs, key }), "utf8");
  const supplied = Buffer.from(parts[2], "utf8");
  if (expected.length !== supplied.length) return { ok: false, code: "unlock_invalid" };
  if (!crypto.timingSafeEqual(expected, supplied)) return { ok: false, code: "unlock_invalid" };
  return { ok: true, expiresAtMs };
}

module.exports = {
  MINIMUM_LENGTH,
  MAXIMUM_LENGTH,
  MAXIMUM_FAILURES,
  LOCKOUT_SECONDS,
  UNLOCK_SECONDS,
  UNLOCK_COOKIE,
  PASSCODE_PEPPER_LABEL,
  UNLOCK_LABEL,
  passcodePepper,
  unlockKey,
  checkPasscode,
  checkPasscodeAgainstBreaches,
  isStepSequence,
  hashPasscode,
  verifyPasscode,
  failureState,
  lockState,
  issueUnlock,
  verifyUnlock
};
