"use strict";

// AWS Signature Version 4, implemented from the specification.
//
// Cloudflare R2 speaks the S3 API, and the S3 API authenticates with SigV4.
// There is no way to put an object in R2 from a Vercel function without
// producing one of these signatures, so this is the piece that has to exist
// before an R2 adapter can.
//
// ## Why this is written here rather than installed
//
// This repository ships **one** production dependency, `express`. A signing
// library would be the second, and it would be a second for a reason that does
// not survive inspection: SigV4 is four hashes and a string format. The
// specification is public, complete, and unambiguous -- the same reason the
// TOTP implementation in this repository was written from RFC 4226 and RFC 6238
// rather than installed.
//
// ## How it is verified, which is the part that matters
//
// Cryptographic code that is wrong looks exactly like cryptographic code that
// is right: it produces a hex string either way. So this is not tested against
// itself. It is tested against **two complete worked examples that AWS
// publishes**, each of which prints the canonical request, the string to sign,
// and the final signature hex:
//
//   docs.aws.amazon.com/amazonglacier/latest/dev/amazon-glacier-signing-requests.html
//
//   1. Create Vault (PUT), 20120525T002453Z, signature
//      3ce5b2f2fffac9262b4da9256f8d086b4aaf42eba5f111c21681a65a127b7c2a
//   2. Upload Archive (POST) with a signed payload, 20120507T000000Z, signature
//      b092397439375d59119072764a1e9a144677c43d9906fd98a5742c57a2855de6
//
// tests/aws-signature-v4-matches-the-published-vectors.test.js asserts every
// intermediate value against those pages, not just the final signature, so a
// failure says which of the four steps drifted rather than "the hex differs".
//
// Both vectors are for `glacier` rather than `s3`, which is the point: the
// service name is an input to the derived key, so a signer that passes both is
// one that has the key-derivation chain right rather than one tuned to a single
// service. What they do NOT prove is that R2 accepts the result -- only a real
// call can, and the adapter says so where it says it.
//
// ## What this module does not do
//
// It signs. It does not fetch, and it never sees an environment variable. A
// caller passes the credentials in and gets headers back. That separation is
// what makes the vectors above usable as tests: there is no configuration to
// stand up in order to check a signature.

const crypto = require("node:crypto");

const ALGORITHM = "AWS4-HMAC-SHA256";
const TERMINATOR = "aws4_request";

// The literal S3 uses to mean "the payload is not part of the signature".
// Useful for a large upload over TLS, and the reason it is named rather than
// typed at call sites is that a typo here is a signature that fails remotely
// with a message that does not mention it.
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

/**
 * URI-encode every byte except the unreserved set, per the AWS rules.
 *
 * `encodeURIComponent` is not this function and cannot be made into it. It
 * leaves `!`, `'`, `(`, `)` and `*` alone -- all of which AWS requires encoded
 * -- and AWS's own documentation says in as many words that the platform's
 * encoder may not work and to write your own. An object key containing an
 * apostrophe would sign correctly and be rejected, which is the kind of bug
 * that gets diagnosed as "R2 is broken".
 *
 * `encodeSlash` is false for a path, because the slashes between key segments
 * are structure rather than content.
 */
function uriEncode(value, encodeSlash = true) {
  let out = "";
  for (const byte of Buffer.from(String(value), "utf8")) {
    const character = String.fromCharCode(byte);
    if ((byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a) || (byte >= 0x30 && byte <= 0x39)) {
      out += character;
    } else if (character === "-" || character === "." || character === "_" || character === "~") {
      out += character;
    } else if (character === "/" && !encodeSlash) {
      out += character;
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return out;
}

/**
 * The canonical URI: the path, each segment encoded, the slashes kept.
 *
 * Deliberately not normalised. S3 and R2 sign the path as sent, so collapsing
 * `a//b` or resolving `..` here would produce a signature for a different
 * request than the one on the wire.
 */
function canonicalUri(path) {
  const raw = String(path || "/");
  if (!raw.startsWith("/")) return `/${uriEncode(raw, false)}`;
  return uriEncode(raw, false);
}

/**
 * The canonical query string: each name and value encoded, then sorted.
 *
 * Sorted after encoding, not before, which is what the specification says and
 * is observable whenever a character's encoded form sorts differently from its
 * literal one.
 */
function canonicalQueryString(query = {}) {
  const pairs = [];
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    pairs.push([uriEncode(name), uriEncode(value)]);
  }
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  return pairs.map(([name, value]) => `${name}=${value}`).join("&");
}

// Header values are trimmed and their internal runs of whitespace collapsed to
// one space. Both halves are required by the specification and both are easy to
// leave out, because almost every header in practice has neither.
function canonicalHeaderValue(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function canonicalHeaders(headers) {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), canonicalHeaderValue(value)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return {
    canonical: entries.map(([name, value]) => `${name}:${value}`).join("\n"),
    signed: entries.map(([name]) => name).join(";")
  };
}

/**
 * Build the canonical request exactly as AWS documents it.
 *
 * Note the blank line between the header block and the signed-header list: the
 * header block's own trailing newline plus the separator. Written as an array
 * join rather than string concatenation so that line is visible as an entry
 * instead of an easily-lost `\n\n`.
 */
function buildCanonicalRequest({ method, path, query = {}, headers, payloadHash }) {
  const { canonical, signed } = canonicalHeaders(headers);
  return {
    canonicalRequest: [
      String(method).toUpperCase(),
      canonicalUri(path),
      canonicalQueryString(query),
      canonical,
      "",
      signed,
      payloadHash
    ].join("\n"),
    signedHeaders: signed
  };
}

function credentialScope(date, region, service) {
  return `${date}/${region}/${service}/${TERMINATOR}`;
}

function buildStringToSign({ amzDate, region, service, canonicalRequest }) {
  return [ALGORITHM, amzDate, credentialScope(amzDate.slice(0, 8), region, service), sha256Hex(canonicalRequest)].join("\n");
}

/**
 * The derived signing key: four chained HMACs, secret first, `aws4_request`
 * last. Each result is the key for the next call, never the data.
 */
function signingKey({ secretAccessKey, date, region, service }) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, service);
  return hmac(dateRegionServiceKey, TERMINATOR);
}

/**
 * Format a Date as the two stamps SigV4 wants: `20120525T002453Z` and
 * `20120525`. Derived from one instant rather than taken as two arguments,
 * because a request signed across midnight with a mismatched pair fails with a
 * signature error that says nothing about the clock.
 */
function amzDateStamps(when = new Date()) {
  const amzDate = when.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate, date: amzDate.slice(0, 8) };
}

/**
 * Sign a request and return the headers to send with it.
 *
 * Returns `{ headers, canonicalRequest, stringToSign, signature }`. The middle
 * two are returned because they are what a signature mismatch is debugged
 * with -- S3-compatible services reply with the canonical request they
 * computed, and comparing the two strings is the whole diagnosis.
 *
 * The caller supplies `host` rather than this deriving it from a URL, so the
 * signature is over the host actually sent.
 */
function signRequest({
  method,
  path,
  query = {},
  headers = {},
  payload = "",
  payloadHash,
  accessKeyId,
  secretAccessKey,
  region,
  service,
  when = new Date(),
  includeContentSha256 = true
}) {
  const { amzDate, date } = amzDateStamps(when);
  const hashed = payloadHash || sha256Hex(payload);

  // x-amz-content-sha256 is required by S3 and carried by R2, so it defaults on
  // and is set here rather than left to the caller: it is part of the
  // signature, and a caller who forgets it signs a request it did not send.
  //
  // It is an option rather than a constant because adding it unconditionally is
  // wrong, and the vectors said so. AWS's Create Vault example signs
  // `host;x-amz-date;x-amz-glacier-version` and no content hash; the first
  // version of this function produced a valid signature over four headers where
  // the documented one covers three. Every other assertion still passed --
  // canonical request, string to sign, key derivation -- which is exactly how a
  // signer ships wrong: correct in every part that was checked against
  // something, wrong in the one part that was assumed.
  const allHeaders = { ...headers, "x-amz-date": amzDate };
  if (includeContentSha256) allHeaders["x-amz-content-sha256"] = hashed;

  const { canonicalRequest, signedHeaders } = buildCanonicalRequest({
    method,
    path,
    query,
    headers: allHeaders,
    payloadHash: hashed
  });

  const stringToSign = buildStringToSign({ amzDate, region, service, canonicalRequest });
  const key = signingKey({ secretAccessKey, date, region, service });
  const signature = crypto.createHmac("sha256", key).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `${ALGORITHM} Credential=${accessKeyId}/${credentialScope(date, region, service)}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: { ...allHeaders, authorization },
    canonicalRequest,
    stringToSign,
    signature,
    signedHeaders
  };
}

module.exports = {
  ALGORITHM,
  TERMINATOR,
  UNSIGNED_PAYLOAD,
  sha256Hex,
  uriEncode,
  canonicalUri,
  canonicalQueryString,
  canonicalHeaders,
  buildCanonicalRequest,
  buildStringToSign,
  credentialScope,
  signingKey,
  amzDateStamps,
  signRequest
};
