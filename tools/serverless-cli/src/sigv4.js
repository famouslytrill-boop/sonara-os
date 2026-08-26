"use strict";

// Signature Version 4, from node:crypto and nothing else.
//
// Every AWS call this tool makes is signed here. There is no AWS SDK in this
// project on purpose: the JavaScript SDK v3 pulls in a three-figure number of
// packages for what is, underneath, four HMACs and a SHA-256.
//
// ## Why this file is testable and most crypto glue is not
//
// A signer is the classic place for a signal that reports success without being
// true. It has no output a human can eyeball -- a signature is 64 hex
// characters and every wrong one looks exactly like every right one -- and the
// only feedback is a 403 from AWS much later, which also looks like expired
// credentials, a clock skew, a missing permission and four other things.
//
// So this is checked against a **published known-answer vector** rather than
// against itself. `tests/sigv4.test.js` signs the request from the AWS SDK for
// PHP's own signing test suite and asserts the exact canonical request, string
// to sign and Authorization header, byte for byte. If a refactor changes what
// this produces, the vector fails immediately rather than in somebody's
// deployment.
//
// The rules that are easiest to get subtly wrong, all of which the vector
// covers: header names lower-cased and sorted, values whitespace-collapsed,
// the path URI-encoded but with `/` left alone, query parameters sorted by
// encoded name, and `x-amz-content-sha256` carrying the payload hash.

const crypto = require("node:crypto");

const ALGORITHM = "AWS4-HMAC-SHA256";

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

// RFC 3986. encodeURIComponent leaves ! ' ( ) * alone and AWS does not, and a
// bucket key containing an apostrophe is how that gets discovered.
function uriEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

// The path, encoded segment by segment so the separators survive.
//
// **S3 and everything else disagree here, and it is not a detail.** AWS's rule
// is that each path segment is URI-encoded *twice* for every service except S3,
// which encodes once. So a request for `/%20/foo` signs `/%2520/foo` at, say,
// CloudFormation, and `/%20/foo` at S3.
//
// This was got wrong on the first attempt -- the code decoded and re-encoded,
// which is the S3 rule applied everywhere -- and the published vector for a
// path containing a space is what caught it. Both readings produce a
// syntactically perfect signature, and the only symptom of the wrong one is a
// 403 that looks like five other problems.
function canonicalPath(path, { doubleEncode = true } = {}) {
  if (!path || path === "/") return "/";
  return path
    .split("/")
    .map((segment) => (doubleEncode ? uriEncode(segment) : uriEncode(decodeURIComponent(segment))))
    .join("/");
}

// Sorted by encoded name, then encoded value. A query string that differs from
// the one signed by so much as an ordering is a 403.
function canonicalQuery(query) {
  const pairs = [];
  for (const [name, value] of Object.entries(query || {})) {
    if (value === undefined || value === null) continue;
    pairs.push([uriEncode(name), uriEncode(String(value))]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return pairs.map(([name, value]) => `${name}=${value}`).join("&");
}

// AWS's own format: 20260825T140000Z. Derived from the Date rather than from
// string slicing of toISOString, so a locale can never reach it.
function amzDate(date) {
  const pad = (n, width = 2) => String(n).padStart(width, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
    + `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/**
 * Sign a request.
 *
 *   method, host, path, query, headers, body   the request
 *   region, service                            the scope
 *   credentials { accessKeyId, secretAccessKey, sessionToken? }
 *   date                                       injectable, so a test can pin it
 *
 * Returns { headers, canonicalRequest, stringToSign, signature } -- the last
 * three so a test can assert the intermediate steps rather than only the final
 * answer. A signer that gets the right signature via the wrong canonical
 * request is a signer that will break on the next request shape.
 */
function sign({
  method = "GET",
  host,
  path = "/",
  query = {},
  headers = {},
  body = "",
  region,
  service,
  credentials,
  date = new Date(),
  signContentSha256 = true
}) {
  if (!host) throw new TypeError("sign() needs a host");
  if (!region) throw new TypeError("sign() needs a region");
  if (!service) throw new TypeError("sign() needs a service");
  if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
    throw new TypeError("sign() needs credentials with an accessKeyId and a secretAccessKey");
  }

  // S3 is the exception to the path rule above, and it is keyed off the
  // service rather than passed in, so a caller cannot get it wrong.
  const isS3 = service === "s3";
  const timestamp = amzDate(date);
  const day = timestamp.slice(0, 8);
  const payload = body === null || body === undefined ? "" : body;
  const payloadHash = sha256Hex(payload);

  const signedHeaderSet = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    signedHeaderSet[name.toLowerCase()] = String(value).trim().replace(/\s+/g, " ");
  }
  signedHeaderSet.host = host;
  signedHeaderSet["x-amz-date"] = timestamp;
  // S3 requires this header; every other service accepts it as long as it is
  // signed, so it is always sent. The option exists because AWS's published
  // vectors sign without it, and comparing against those bytes is the only real
  // check this file has -- see tests/sigv4.test.js.
  if (signContentSha256) signedHeaderSet["x-amz-content-sha256"] = payloadHash;
  // A session token is part of the signature, not an extra header bolted on
  // afterwards. Signing without it and sending it produces a 403 that reads
  // exactly like a wrong secret key.
  if (credentials.sessionToken) signedHeaderSet["x-amz-security-token"] = credentials.sessionToken;

  const names = Object.keys(signedHeaderSet).sort();
  const canonicalHeaders = names.map((name) => `${name}:${signedHeaderSet[name]}\n`).join("");
  const signedHeaders = names.join(";");

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalPath(path, { doubleEncode: !isS3 }),
    canonicalQuery(query),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = [ALGORITHM, timestamp, scope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${credentials.secretAccessKey}`, day);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return {
    headers: {
      ...signedHeaderSet,
      authorization: `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    canonicalRequest,
    stringToSign,
    signature
  };
}

module.exports = { sign, uriEncode, canonicalPath, canonicalQuery, amzDate, sha256Hex };
