"use strict";

// One-time passwords: RFC 4226 (HOTP) and RFC 6238 (TOTP).
//
// Six digits on a phone screen that change every thirty seconds. The algorithm
// is short and the two specifications publish their own test vectors, which is
// why this is written here rather than pulled in: the correctness question has
// a published answer, `tests/a-one-time-password-matches-the-rfc.test.js`
// asserts against it, and a wrong implementation cannot pass.
//
// ## RFC 4226 section 5.3, which is the whole of it
//
//   HS = HMAC(K, C)              C is the counter, eight bytes, big-endian
//   offset = HS[len-1] & 0xf     the low nibble of the last byte
//   binCode = (HS[offset] & 0x7f) << 24 | HS[offset+1] << 16
//           | HS[offset+2] << 8  | HS[offset+3]
//   HOTP = binCode mod 10^digits
//
// Two details in there are easy to get wrong and produce codes that look
// plausible and never match:
//
// **The `& 0x7f`.** It clears the top bit of the first selected byte. The RFC
// says this is to avoid any ambiguity about signed versus unsigned arithmetic
// across implementations. Omitting it gives a different number half the time.
//
// **The offset comes from the last byte of the digest, not the twentieth.**
// For SHA-1 those are the same byte and the distinction never shows up. For
// SHA-256 and SHA-512 they are not, and hard-coding 19 silently breaks both.
//
// ## RFC 6238 is RFC 4226 with a clock for a counter
//
//   T = floor((now - T0) / X)
//
// with T0 = 0 (the Unix epoch) and X = 30 seconds. That is the only difference.
//
// ## Two things the specifications require of a verifier, which are not the maths
//
// **A window, because clocks drift.** RFC 6238 section 5.2 says a validator
// should accept a transmission delay of one time step either side. Without it,
// somebody who takes four seconds to type a code that appeared at second 28
// is told they are wrong.
//
// **Never accept the same code twice.** The same section: once a code has been
// accepted, the verifier must refuse it again within its validity window.
// Otherwise a code read over somebody's shoulder — or out of a screenshot — is
// good for the rest of its thirty seconds. `verify` takes the last step it
// accepted and refuses anything at or before it, and returns the step it used
// so the caller can store it. A caller that ignores the returned step has a
// working second factor with a thirty-second replay hole in it.

const crypto = require("node:crypto");

const DEFAULT_DIGITS = 6;
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_ALGORITHM = "sha1";
// One step either side. RFC 6238 section 5.2 allows a validator to set this
// policy; it also says the window should be as small as the network delay
// allows, because every extra step is another code an attacker may use.
const DEFAULT_WINDOW = 1;

// What an authenticator app will actually do. A `algorithm=SHA256` in the URI
// is ignored by several popular apps, which then compute SHA-1 and disagree
// with the server for ever -- so the enrolment path stays on the default and
// this list exists for reading a factor somebody else provisioned.
const ALGORITHMS = Object.freeze(["sha1", "sha256", "sha512"]);

/** A counter as the eight big-endian bytes RFC 4226 specifies. */
function counterBytes(counter) {
  const buffer = Buffer.alloc(8);
  // Written as a BigInt because a JavaScript number loses integer precision
  // above 2^53, and a time-based counter is small today but the arithmetic
  // should not be the reason this stops working.
  buffer.writeBigUInt64BE(BigInt(Math.max(0, Math.trunc(Number(counter) || 0))));
  return buffer;
}

/**
 * RFC 4226 HOTP.
 *
 * `secret` is the raw shared key as bytes, not base32 -- the encoding belongs
 * to the URI that carries it, not to the algorithm.
 */
function hotp(secret, counter, { digits = DEFAULT_DIGITS, algorithm = DEFAULT_ALGORITHM } = {}) {
  const key = Buffer.isBuffer(secret) ? secret : Buffer.from(secret);
  const digest = crypto.createHmac(algorithm, key).update(counterBytes(counter)).digest();

  // The low nibble of the LAST byte, whatever the digest length is.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The step number a moment in time falls in. */
function stepAt(seconds, { step = DEFAULT_STEP_SECONDS, t0 = 0 } = {}) {
  return Math.floor((Number(seconds) - Number(t0)) / Number(step));
}

/** RFC 6238 TOTP: HOTP with the clock as the counter. */
function totp(secret, { at = Date.now() / 1000, step = DEFAULT_STEP_SECONDS, t0 = 0, digits = DEFAULT_DIGITS, algorithm = DEFAULT_ALGORITHM } = {}) {
  return hotp(secret, stepAt(at, { step, t0 }), { digits, algorithm });
}

// Compared without leaking how much of the code was right.
//
// A naive `===` on strings returns as soon as two characters differ, and the
// time that takes is a measurement of how many leading digits were correct.
// Six digits is a small enough space that handing an attacker a per-digit
// oracle is worth refusing even though the remote timing signal is faint.
function sameCode(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Verify a submitted code.
 *
 * Returns `{ ok: true, step }` -- **the caller must store that step** -- or
 * `{ ok: false, code }` with one of:
 *
 *   `malformed`  not the right number of digits
 *   `no_match`   correct shape, wrong code
 *   `reused`     right code, but at or before a step already accepted
 *
 * `reused` is deliberately its own answer rather than folded into `no_match`.
 * The two mean different things to the person: one is a typo, the other is a
 * code that has already been spent, and telling somebody their correct code is
 * wrong is how a working second factor gets reported as broken.
 */
function verify(secret, submitted, { at = Date.now() / 1000, step = DEFAULT_STEP_SECONDS, t0 = 0, digits = DEFAULT_DIGITS, algorithm = DEFAULT_ALGORITHM, window = DEFAULT_WINDOW, lastUsedStep = null } = {}) {
  const cleaned = String(submitted ?? "").replace(/[\s-]/g, "");
  // Shape first, so a wrong length never reaches the HMAC loop at all.
  if (!new RegExp(`^[0-9]{${digits}}$`).test(cleaned)) return { ok: false, code: "malformed" };

  const current = stepAt(at, { step, t0 });
  const spent = lastUsedStep === null || lastUsedStep === undefined ? null : Number(lastUsedStep);

  // Every candidate step is tried even after one matches, so the work done
  // does not depend on which step was right.
  let matched = null;
  for (let drift = -window; drift <= window; drift += 1) {
    const candidate = current + drift;
    if (candidate < 0) continue;
    if (sameCode(cleaned, hotp(secret, candidate, { digits, algorithm })) && matched === null) matched = candidate;
  }

  if (matched === null) return { ok: false, code: "no_match" };
  // At or before: a code from an earlier step inside the window is as spent as
  // the one that was actually used.
  if (spent !== null && Number.isFinite(spent) && matched <= spent) return { ok: false, code: "reused", step: matched };
  return { ok: true, step: matched };
}

/** A new shared secret. 20 bytes is what RFC 4226 section 4 R6 requires as a minimum. */
function newSecret(bytes = 20) {
  return crypto.randomBytes(Math.max(20, Number(bytes) || 20));
}

module.exports = {
  ALGORITHMS,
  DEFAULT_DIGITS,
  DEFAULT_STEP_SECONDS,
  DEFAULT_WINDOW,
  counterBytes,
  hotp,
  stepAt,
  totp,
  verify,
  newSecret
};
