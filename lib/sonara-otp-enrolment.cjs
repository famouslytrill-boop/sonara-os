"use strict";

// Getting a second factor onto somebody's phone, and off it again if the phone
// is lost.
//
// Two things live here because they are the same job -- setting a factor up --
// and neither is the algorithm. `lib/sonara-otp.cjs` is the algorithm and has
// the RFCs' test vectors under it; this is the part that has to interoperate
// with software nobody here wrote, and with a person copying characters off a
// screen.

const crypto = require("node:crypto");
const base32 = require("./sonara-base32.cjs");
const otp = require("./sonara-otp.cjs");

const ISSUER = "SONARA One";

// Ten codes. Enough that losing a phone is recoverable without printing a
// booklet, few enough that the list on screen is readable in one go.
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_CHARACTERS = 20;

// The alphabet recovery codes are drawn from, which is NOT base32.
//
// The first draft used the base32 alphabet with a comment saying the confusable
// characters were "not in the set at all". That was wrong, and checking took
// one line: base32 is A-Z plus 2-7, so it has no 0, 1, 8 or 9 -- but **O, I and
// L are all in it**. Somebody reading a code off a screen and typing 0 for O
// gets a failure indistinguishable, to them, from a code already used.
//
// So I, L, O and U come out. The first three are the confusable ones; U goes
// because dropping it is what keeps an accidental English obscenity out of a
// code somebody has to read aloud to support. That leaves 28 characters and
// 20 of them is a little over 96 bits, which is the number that matters here:
// these are never rotated, nobody remembers them, and their whole security is
// their length.
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ234567";

/**
 * The `otpauth://` URI an authenticator app scans.
 *
 * Key URI format, as published by Google and implemented by every app that
 * reads these. It is not an RFC, which is worth saying plainly: the algorithm
 * below it is standardised and this container is a de facto convention.
 *
 * ## The label, and the colon that breaks it
 *
 * The path is `Issuer:account`, and a colon is the separator. An account name
 * containing one -- which an email address does not, but a display name might
 * -- would split the label in the wrong place and the entry would show up in
 * the app under a name that is not the person's. Both halves are percent
 * encoded, and the issuer appears twice: once in the label for apps that read
 * the path, once as a parameter for apps that read the query. The
 * specification asks for both.
 *
 * ## Why no `algorithm`, `digits` or `period` parameter
 *
 * They would all be the defaults, and several widely used authenticators
 * ignore them -- computing SHA-1 six-digit thirty-second codes whatever the
 * URI says. An app that ignored a non-default value would disagree with this
 * server for ever, with nothing on either side reporting a problem. Sending
 * only what every app agrees on is the interoperable choice, and this stays
 * on those defaults for that reason rather than by omission.
 */
function provisioningUri({ secret, account, issuer = ISSUER }) {
  const encoded = typeof secret === "string" ? secret : base32.encode(secret);
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(String(account || "account"))}`;
  return `otpauth://totp/${label}?secret=${encoded.replace(/=+$/, "")}&issuer=${encodeURIComponent(issuer)}`;
}

/**
 * The secret as a person has to type it when a camera is not an option.
 *
 * Grouped in fours. Reading twenty unbroken characters off a screen and typing
 * them into a phone is where this goes wrong, and the groups are the difference
 * between that being annoying and being unreliable. `decode` already strips
 * whitespace, so what comes back is accepted verbatim.
 */
function readableSecret(secret) {
  const encoded = (typeof secret === "string" ? secret : base32.encode(secret)).replace(/=+$/, "");
  return (encoded.match(/.{1,4}/g) || []).join(" ");
}

/** Ten new recovery codes, in the form they are shown and typed. */
function newRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const wanted = Math.max(1, Number(count) || RECOVERY_CODE_COUNT);
  const codes = [];
  for (let index = 0; index < wanted; index += 1) {
    let code = "";
    while (code.length < RECOVERY_CODE_CHARACTERS) {
      const byte = crypto.randomBytes(1)[0];
      // Rejection sampling, and it genuinely rejects: 256 is not a multiple of
      // 28, so taking `byte % 28` over the whole range would make the first
      // four letters of the alphabet slightly likelier than the rest. A biased
      // recovery code is still unguessable and the bias would never be noticed,
      // which is exactly why it is worth four characters of code to remove.
      if (byte >= 256 - (256 % RECOVERY_ALPHABET.length)) continue;
      code += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
    }
    codes.push((code.match(/.{1,5}/g) || []).join("-"));
  }
  return codes;
}

/**
 * How a code is stored: never in the form it was shown.
 *
 * HMAC-SHA-256 under a pepper the caller supplies from
 * `lib/sonara-secret-box.cjs`, with a per-code salt. The pepper is required --
 * hashing these without one is refused rather than done quietly, because the
 * whole reason this is not a bare digest is that the pepper lives outside the
 * database.
 *
 * The first draft used scrypt and was wrong twice over. It cost 500ms per
 * verification attempt, measured -- ten codes hashed one after another to keep
 * the timing flat -- and it bought nothing: a code here is 96 bits of
 * randomness, and nobody enumerates 2^96 however slow the hash is. Slow hashing
 * is for secrets people choose. Nobody chooses these.
 */
function hashRecoveryCode(code, { salt, pepper } = {}) {
  if (!pepper || !pepper.length) return { ok: false, code: "no_pepper" };
  const normalized = normalizeRecoveryCode(code);
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHmac("sha256", pepper).update(`${useSalt}:${normalized}`).digest("hex");
  return { ok: true, salt: useSalt, hash };
}

/** Typed how they like it; compared how it was stored. */
function normalizeRecoveryCode(code) {
  return String(code ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Which stored code a submission matches, if any.
 *
 * Returns `{ ok: true, index }` or `{ ok: false, code }`. Every stored row is
 * hashed even after one matches, so the time taken does not say how far down
 * the list the match was.
 */
function matchRecoveryCode(submitted, stored, pepper) {
  const normalized = normalizeRecoveryCode(submitted);
  if (!normalized) return { ok: false, code: "empty" };
  if (!pepper || !pepper.length) return { ok: false, code: "no_pepper" };
  const rows = Array.isArray(stored) ? stored : [];
  if (!rows.length) return { ok: false, code: "none_left" };

  let found = -1;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || typeof row.salt !== "string" || typeof row.hash !== "string") continue;
    const { hash } = hashRecoveryCode(normalized, { salt: row.salt, pepper });
    const left = Buffer.from(hash, "hex");
    const right = Buffer.from(row.hash, "hex");
    if (left.length === right.length && crypto.timingSafeEqual(left, right) && found === -1) found = index;
  }

  if (found === -1) return { ok: false, code: "no_match" };
  // Already spent. A different answer from "wrong", for the same reason
  // `reused` is its own answer in lib/sonara-otp.cjs: telling somebody their
  // correct code is wrong sends them looking for the wrong problem.
  if (rows[found].usedAt) return { ok: false, code: "already_used", index: found };
  return { ok: true, index: found };
}

/** A fresh factor, ready to be shown once and then stored. */
function newEnrolment({ account, issuer = ISSUER } = {}) {
  const secret = otp.newSecret();
  return {
    secret,
    encodedSecret: base32.encode(secret).replace(/=+$/, ""),
    readableSecret: readableSecret(secret),
    uri: provisioningUri({ secret, account, issuer }),
    recoveryCodes: newRecoveryCodes()
  };
}

module.exports = {
  ISSUER,
  RECOVERY_ALPHABET,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_CHARACTERS,
  provisioningUri,
  readableSecret,
  newRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  matchRecoveryCode,
  newEnrolment
};
