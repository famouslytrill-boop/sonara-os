"use strict";

// The one server-only key the second factor rests on, and the two things it is
// used for.
//
// A TOTP shared secret is a credential of exactly the same weight as a
// password: whoever holds it can produce valid codes for ever. Storing one in a
// column the service role key can read means a database disclosure hands an
// attacker every second factor on the system in a form they can use
// immediately.
//
// So secrets are sealed before they are written, with a key that lives in the
// environment and never in the database. An attacker who reads the table gets
// ciphertext; getting anything from it also requires the deployment's
// environment, which is a second, different compromise.
//
// ## Two uses, two derived keys, never the same bytes
//
// `SONARA_TOTP_KEY` is the input. Nothing uses it directly. Two subkeys are
// derived from it with HKDF under distinct labels: one seals TOTP secrets, one
// peppers recovery-code hashes. Using one key for two purposes is the classic
// way a weakness in one construction becomes a weakness in the other, and the
// cost of separating them is one line.
//
// ## Why recovery codes are peppered rather than slow-hashed
//
// The first draft used scrypt, and it was wrong on both counts. It cost 500ms
// per verification attempt -- ten codes, hashed one after another to keep the
// timing flat -- and it bought nothing, because a recovery code here is ninety
// six bits of randomness. An attacker holding the hashes cannot enumerate
// 2^96 whatever the hash costs; slow hashing exists for secrets people choose,
// and nobody chooses these.
//
// What does help against the realistic threat -- somebody reads the database
// and nothing else -- is a pepper held outside it. So the hash is HMAC-SHA-256
// under the derived pepper, with a per-code salt. Microseconds, and useless
// without the environment.

const crypto = require("node:crypto");

const KEY_VARIABLE = "SONARA_TOTP_KEY";
// Long enough that a key typed in by hand is not what somebody reaches for.
// 32 bytes hex is 64 characters, which is what `openssl rand -hex 32` prints.
const MINIMUM_KEY_LENGTH = 32;
const SEAL_LABEL = "sonara.totp.seal.v1";
const PEPPER_LABEL = "sonara.recovery.pepper.v1";

/**
 * The configured key, or a reason there is none.
 *
 * Returns `{ ok: false, code: "setup_required" }` rather than falling back to a
 * default or to no encryption. A second factor that silently stores its secrets
 * in the clear because a variable was missing is worse than one that refuses to
 * turn on: the first tells everybody they are protected.
 */
function keyFrom(getEnv) {
  const raw = typeof getEnv === "function" ? getEnv([KEY_VARIABLE]) : process.env[KEY_VARIABLE];
  const value = String(raw || "").trim();
  if (!value) return { ok: false, code: "setup_required", variable: KEY_VARIABLE };
  if (value.length < MINIMUM_KEY_LENGTH) return { ok: false, code: "key_too_short", variable: KEY_VARIABLE, minimum: MINIMUM_KEY_LENGTH };
  return { ok: true, material: Buffer.from(value, "utf8") };
}

/** One purpose, one key. HKDF with the purpose as the info string. */
function subkey(material, label) {
  return Buffer.from(crypto.hkdfSync("sha256", material, Buffer.alloc(0), Buffer.from(label, "utf8"), 32));
}

/**
 * Seal bytes for storage.
 *
 * AES-256-GCM, so the stored value is authenticated as well as hidden: a row
 * somebody edited in the database does not decrypt to a different working
 * secret, it fails to decrypt at all.
 *
 * The format is `v1.<iv>.<tag>.<ciphertext>`, all base64url. The version is
 * first and is checked on the way back, so a future change of construction is
 * a readable failure rather than a silent misinterpretation of old rows.
 */
function seal(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", subkey(key.material, SEAL_LABEL), iv);
  const body = Buffer.concat([cipher.update(Buffer.isBuffer(plain) ? plain : Buffer.from(plain)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

/** Open a sealed value. `{ ok, bytes }`, never a throw and never a partial read. */
function open(sealed, key) {
  const parts = String(sealed || "").split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return { ok: false, code: "not_sealed" };
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      subkey(key.material, SEAL_LABEL),
      Buffer.from(parts[1], "base64url")
    );
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    const bytes = Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]);
    return { ok: true, bytes };
  } catch {
    // A wrong key and a tampered row both land here, and they are the same
    // answer to the caller: this value cannot be used.
    return { ok: false, code: "cannot_open" };
  }
}

/** The pepper recovery-code hashes are taken under. */
function pepper(key) {
  return subkey(key.material, PEPPER_LABEL);
}

module.exports = { KEY_VARIABLE, MINIMUM_KEY_LENGTH, SEAL_LABEL, PEPPER_LABEL, keyFrom, seal, open, pepper };
