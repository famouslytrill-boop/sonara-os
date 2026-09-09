"use strict";

// Cloudflare R2 -- object storage with no egress fee and no server to run.
//
// The owner created the bucket `sonaraindustriesr2` on 9 September 2026 and
// nothing in this repository could talk to it. That is the gap this closes:
// there was a D1 adapter and a Workers AI adapter, and the third leg of the
// serverless stack had no code at all.
//
// ## Why this one needed a signer written first
//
// The other nine adapters authenticate with a bearer token in a header. R2
// speaks the S3 API, which authenticates by signing the request itself --
// method, path, headers and payload hash all folded into an HMAC chain. So
// `lib/sonara-aws-signature-v4.cjs` had to exist before this could, and it is
// checked against signature vectors AWS publishes rather than against itself.
//
// ## What R2 is here, and what it is not
//
// It is not the system of record. `lib/sonara-d1-adapter.cjs` makes that
// argument at length for D1 and every word of it applies: Supabase holds the
// rows, the tenant boundary is `organization_id` filtering, and a second store
// holding the same data is data outside the only boundary there is.
//
// R2 holds **files**, which is a different thing from rows: a media file, an
// export, a generated document. The row that says who owns that file, which
// organization it belongs to and whether the person consented to it stays in
// Supabase. R2 holds the bytes and knows nothing about who may read them, which
// is why `objectKeyViolation` below refuses a key that could climb out of the
// prefix a caller was given.
//
// ## The four rules, same as the other ten
//
// Off by default. Never a dependency -- every caller keeps the path it had, and
// nothing here becomes required for a page to render. Never renders its
// configuration: the endpoint carries the account id and the credentials are
// non-enumerable, so a readiness object can be put on a page. And it validates
// anything that becomes part of a request, which for object storage means the
// key, because the key IS the path.
//
// ## What has not been proven
//
// No call in this module has ever reached Cloudflare. The signing is verified
// against published vectors; that the resulting request satisfies R2
// specifically is not, and cannot be from here -- it needs an R2 access key
// pair, which only the owner can create. The first real `putObject` is the
// proof, and until somebody runs one this is code that should work rather than
// code observed working. Said here rather than discovered later.

const base = require("./sonara-service-adapter.cjs");
const sigv4 = require("./sonara-aws-signature-v4.cjs");

const LABEL = "Cloudflare R2";
const PREFIX = "SONARA_R2";

const ENV_KEYS = base.envKeysFor(PREFIX, ["bucket", "access_key_id", "secret_access_key"]);

// R2 signs with a fixed region. Not configurable, because there is exactly one
// correct value and a wrong one fails as a signature error that says nothing
// about regions.
const REGION = "auto";
const SERVICE = "s3";

// A bucket name lands in the request path ahead of the key, so it is pinned to
// the shape R2 actually allows rather than merely checked for slashes.
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

// S3 and R2 cap a key at 1024 bytes. Enforced here so an over-long key is a
// refusal with a reason rather than a remote error.
const MAX_KEY_BYTES = 1024;

/**
 * Why a key is not usable, or "" if it is.
 *
 * This is rule four of docs/architecture/EXTERNAL-SERVICES.md, and object
 * storage is where it bites hardest: the key is not a parameter that ends up in
 * a path, it *is* the path. A key of `../../other-bucket/secrets` is not a key,
 * and a key beginning with `/` addresses a different object than the caller
 * named.
 *
 * Deliberately stricter than R2 is. R2 would accept a key containing `..` as a
 * literal name, and accepting it here would mean a caller that builds a key
 * from a customer-supplied filename can address somebody else's object. Over-
 * refusing costs a rename; under-refusing costs a file.
 */
function objectKeyViolation(key) {
  if (typeof key !== "string" || !key) return "An object key is required.";
  if (Buffer.byteLength(key, "utf8") > MAX_KEY_BYTES) return `An object key may not exceed ${MAX_KEY_BYTES} bytes.`;
  if (key.startsWith("/")) return "An object key may not start with a slash, which would address a different path.";
  if (key.endsWith("/")) return "An object key may not end with a slash.";
  if (key.includes("//")) return "An object key may not contain an empty segment.";
  // Checked per segment rather than as a substring, so a legitimate name like
  // `report..final.pdf` is allowed and a traversal segment is not.
  for (const segment of key.split("/")) {
    if (segment === "." || segment === "..") return "An object key may not contain a path traversal segment.";
  }
  // Character codes rather than a regex. A regex holding literal control
  // characters is one nobody can read in a diff, and the escape form trips
  // the lint rule that exists to notice exactly that.
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return "An object key may not contain control characters.";
  }
  if (/[?#]/.test(key)) return "An object key may not contain ? or #, which end a path.";
  return "";
}

function getR2Readiness(options = {}) {
  const readiness = base.readinessFor({
    label: LABEL,
    prefix: PREFIX,
    required: ["bucket"],
    // Both halves of the credential are secrets. The access key id is not a
    // password, but it is half of one and nothing on any page needs it -- and
    // the cost of hiding a value nobody needed is nothing.
    secrets: ["access_key_id", "secret_access_key"],
    ...options
  });

  if (readiness.status !== "configured") return readiness;

  if (!BUCKET_PATTERN.test(readiness.bucket)) {
    return {
      ok: false,
      enabled: true,
      status: "setup_required",
      keys: ENV_KEYS,
      host: readiness.host,
      detail: `${ENV_KEYS.bucket} is not an R2 bucket name (lowercase letters, digits and hyphens, 3 to 63 characters).`
    };
  }

  return readiness;
}

/**
 * Sign and send one S3-style request to R2.
 *
 * Returns { ok: true, status, headers, body } or { ok: false, code, detail }
 * and never throws. The three failure codes are the same three the shared
 * adapter base uses, for the same reason: `timed_out`, `unreachable` and
 * `failed` send somebody to three different places.
 *
 * The response body is returned as a Buffer, because this moves files. A
 * caller that wants text decodes it; a caller that wants an image does not.
 */
async function send(readiness, { method, key = "", query = {}, body = null, headers = {}, fetchImpl = fetch }) {
  if (readiness.status !== "configured") {
    return { ok: false, code: "setup_required", detail: readiness.detail || `${LABEL} is not configured.` };
  }

  const payload = body === null || body === undefined ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  const path = `/${readiness.bucket}${key ? `/${key}` : ""}`;

  const signed = sigv4.signRequest({
    method,
    path,
    query,
    headers: { ...headers, host: readiness.host },
    payload,
    accessKeyId: readiness.access_key_id,
    secretAccessKey: readiness.secret_access_key,
    region: REGION,
    service: SERVICE
  });

  const search = sigv4.canonicalQueryString(query);
  const url = `${readiness.baseUrl}${sigv4.canonicalUri(path)}${search ? `?${search}` : ""}`;

  // Bounded with an AbortController and a timer rather than AbortSignal.timeout,
  // which is what the shared adapter base does. Same guarantee, and one idiom
  // for a timeout across eleven adapters is worth more than a shorter line here.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), readiness.timeoutMs || 10000);

  try {
    const response = await fetchImpl(url, {
      method,
      headers: signed.headers,
      body: method === "GET" || method === "HEAD" ? undefined : payload,
      signal: controller.signal
    });

    // Read inside the try, so the timeout covers the download and not merely
    // the response headers. It was outside for one commit: the abort fired,
    // the timer was already cleared, and a stalled body would have hung the
    // caller with every bound in place and none of them reaching it. A file
    // store is exactly where that matters -- the headers arrive quickly and the
    // bytes are the slow part.
    const buffer = Buffer.from(await response.arrayBuffer());

    if (!response.ok) {
      // R2 answers with an S3 error document. The <Code> is worth passing on --
      // NoSuchKey and AccessDenied send somebody to different places -- and the
      // rest of the document is not, because it echoes the request.
      const code = /<Code>([^<]{1,64})<\/Code>/.exec(buffer.toString("utf8"))?.[1];
      return {
        ok: false,
        code: response.status === 404 ? "not_found" : "unreachable",
        status: response.status,
        detail: code ? `${LABEL} refused the request: ${code}.` : `${LABEL} answered ${response.status}.`
      };
    }

    return { ok: true, status: response.status, headers: response.headers, body: buffer };
  } catch (error) {
    // The URL carries the account id, so it never reaches a caller. The error's
    // own message can carry it too, which is why the name is read and the
    // message is not.
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return { ok: false, code: "timed_out", detail: `${LABEL} did not answer within ${readiness.timeoutMs}ms.` };
    }
    return { ok: false, code: "failed", detail: `The request to ${LABEL} could not be made.` };
  } finally {
    clearTimeout(timer);
  }
}


/** Store one object. `body` may be a Buffer or a string. */
async function putObject(key, body, { readiness = getR2Readiness(), contentType = "application/octet-stream", fetchImpl = fetch } = {}) {
  const violation = objectKeyViolation(key);
  if (violation) return { ok: false, code: "invalid_key", detail: violation };
  if (body === null || body === undefined) return { ok: false, code: "invalid_body", detail: "Storing an object needs a body." };

  const sent = await send(readiness, { method: "PUT", key, body, headers: { "content-type": contentType }, fetchImpl });
  if (!sent.ok) return sent;
  return { ok: true, key, etag: sent.headers?.get?.("etag") || null };
}

/** Read one object back. Returns its bytes. */
async function getObject(key, { readiness = getR2Readiness(), fetchImpl = fetch } = {}) {
  const violation = objectKeyViolation(key);
  if (violation) return { ok: false, code: "invalid_key", detail: violation };

  const sent = await send(readiness, { method: "GET", key, fetchImpl });
  if (!sent.ok) return sent;
  return { ok: true, key, body: sent.body, contentType: sent.headers?.get?.("content-type") || null };
}

/** Whether an object is there, and how big, without downloading it. */
async function headObject(key, { readiness = getR2Readiness(), fetchImpl = fetch } = {}) {
  const violation = objectKeyViolation(key);
  if (violation) return { ok: false, code: "invalid_key", detail: violation };

  const sent = await send(readiness, { method: "HEAD", key, fetchImpl });
  if (!sent.ok) return sent;
  const length = Number(sent.headers?.get?.("content-length"));
  return { ok: true, key, bytes: Number.isFinite(length) ? length : null };
}

/**
 * Remove one object.
 *
 * Destructive, and AGENTS.md puts destructive data changes behind owner
 * approval. That rule is enforced by `lib/sonara-agent-authority.cjs` at the
 * action layer, not here: this is the mechanism, and a mechanism that also
 * decided policy would be a second place for the policy to drift from. Any
 * agent-initiated deletion goes through the runner, which asks the gate.
 */
async function deleteObject(key, { readiness = getR2Readiness(), fetchImpl = fetch } = {}) {
  const violation = objectKeyViolation(key);
  if (violation) return { ok: false, code: "invalid_key", detail: violation };

  const sent = await send(readiness, { method: "DELETE", key, fetchImpl });
  if (!sent.ok) return sent;
  return { ok: true, key };
}

module.exports = {
  ENV_KEYS,
  REGION,
  SERVICE,
  BUCKET_PATTERN,
  MAX_KEY_BYTES,
  objectKeyViolation,
  getR2Readiness,
  putObject,
  getObject,
  headObject,
  deleteObject
};
