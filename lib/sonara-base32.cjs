"use strict";

// Base32, RFC 4648 section 6.
//
// Here for one reason: an authenticator app is handed its shared secret as a
// base32 string, in the `secret=` parameter of an `otpauth://` URI. Every
// authenticator expects that encoding and no other, so this is not a choice
// this project gets to make — it is part of the interoperability contract with
// software nobody here controls.
//
// Written rather than taken from a package because it is thirty lines, the
// specification is short and unambiguous, and adding a production dependency to
// this repository — which has exactly one — would be a worse trade than owning
// thirty lines with the RFC's own test vectors under them.
//
// ## What "case-insensitive" costs, and why it is here anyway
//
// RFC 4648 section 6 defines the alphabet as uppercase. People type these by
// hand off a screen, and refusing a lowercase secret would reject a correct one
// for a reason nobody can see. Decoding accepts either case; encoding only ever
// emits uppercase, so nothing this project produces is ambiguous.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Built once. The reverse map is what makes decoding a lookup rather than an
// indexOf over a 32-character string per input character.
const VALUES = new Map();
for (let index = 0; index < ALPHABET.length; index += 1) {
  VALUES.set(ALPHABET[index], index);
  VALUES.set(ALPHABET[index].toLowerCase(), index);
}

/**
 * Bytes to base32.
 *
 * Padded to a multiple of eight characters with `=`, as the RFC requires.
 * Authenticator apps almost universally accept an unpadded secret and many
 * emit one, but producing what the specification says is the only version
 * that is right for every reader rather than for the ones we have tried.
 */
function encode(bytes) {
  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  // The tail: whatever is left is shifted up into a full group and emitted.
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  while (output.length % 8 !== 0) output += "=";
  return output;
}

/**
 * Base32 to bytes.
 *
 * Returns `{ ok, bytes }` or `{ ok: false, code }` rather than throwing or
 * returning a short buffer. A secret that decoded to the wrong thing produces
 * codes that never match, and "your code is wrong" is what somebody would be
 * told for the rest of the day — so the failure has to arrive here, named.
 */
function decode(text) {
  const cleaned = String(text ?? "").replace(/=+$/, "").replace(/\s+/g, "");
  if (!cleaned) return { ok: false, code: "empty" };

  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const character of cleaned) {
    const digit = VALUES.get(character);
    // Not `if (!digit)`: `A` is 0, and a falsy check here would refuse every
    // secret containing the first letter of the alphabet.
    if (digit === undefined) return { ok: false, code: "not_base32", character };
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  // Whatever is left over must be zero padding. A non-zero remainder means the
  // string is not a valid encoding of any byte sequence, and silently dropping
  // it would accept a corrupted secret as if it were fine.
  if (bits >= 5 || (value & ((1 << bits) - 1)) !== 0) return { ok: false, code: "bad_padding" };

  return { ok: true, bytes: Buffer.from(bytes) };
}

module.exports = { ALPHABET, encode, decode };
