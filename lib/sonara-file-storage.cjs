"use strict";

// Where an uploaded file goes.
//
// `lib/sonara-multipart.cjs` reads a file out of a request. This puts it
// somewhere, and the somewhere is a **private** Supabase Storage bucket reached
// over its REST API with the service-role key — the same position every other
// read in this application takes.
//
// The wire shape was read from `supabase/storage-js` rather than recalled:
// `POST {url}/storage/v1/object/{bucket}/{path}` with the bytes as the body,
// and `POST {url}/storage/v1/object/sign/{bucket}/{path}` with `{expiresIn}`
// to get a link back, whose `signedURL` is a **path** that has to be joined to
// the storage URL.
//
// ## The tenant boundary is in the path
//
// Every object is stored at `{organization_id}/{kind}/{uuid}-{filename}`. The
// organization comes first because the service-role key bypasses row level
// security, exactly as it does for every table here — so the `organization_id`
// filter *is* the boundary, and having it be the first path segment means a
// listing, a delete or a signed URL cannot address another tenant's file
// without the caller having written that tenant's id.
//
// The uuid is there because two people uploading `photo.jpg` on the same day
// must not overwrite each other, and `x-upsert` is never sent for the same
// reason.
//
// ## Nothing here returns a public URL
//
// These are customers' files. A public URL is a permanent, unguessable-only
// credential that survives the record being deleted. Signed URLs expire, and
// the expiry is an argument with a short default rather than something a caller
// has to remember to pass.

const crypto = require("node:crypto");
const { safeFilename } = require("./sonara-multipart.cjs");

const BUCKET_ENV = "SONARA_UPLOAD_BUCKET";
const DEFAULT_BUCKET = "sonara-uploads";

// Long enough to open a photo, short enough that a link pasted into a chat is
// not a lasting way in.
const DEFAULT_SIGNED_SECONDS = 300;

const UUID_PATH = /^[0-9a-f-]{36}$/i;

/**
 * Whether uploads are configured, and what is missing if not.
 *
 * The bucket itself has to exist and be private — that is a dashboard step, and
 * it is one this cannot do or check from here, so it is reported as an
 * assumption rather than a guarantee.
 */
function storageReadiness(config, { bucket = process.env[BUCKET_ENV] || DEFAULT_BUCKET } = {}) {
  if (!config?.url) {
    return { ok: false, status: "setup_required", detail: "SUPABASE_URL is not set, so there is nowhere to put an upload." };
  }
  if (!config?.serviceRoleKey) {
    return { ok: false, status: "setup_required", detail: "SUPABASE_SERVICE_ROLE_KEY is not set, so uploads cannot be stored." };
  }
  return {
    ok: true,
    status: "configured",
    bucket,
    // Said out loud rather than assumed: this cannot see the bucket's policy
    // from here, and a public bucket would make every signed URL pointless.
    assumes: `The bucket ${bucket} exists and is private. Nothing here can verify that; a public bucket would make signed links meaningless.`
  };
}

/**
 * The path an object is stored at.
 *
 * Refuses an organization id that is not a uuid. That value becomes the first
 * path segment, and a caller that passed something else — a name, an empty
 * string, `..` — would be addressing a place this cannot reason about.
 */
function pathFor({ organizationId, kind, filename }) {
  const organization = String(organizationId || "");
  if (!UUID_PATH.test(organization)) return null;
  const folder = String(kind || "file").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "file";
  return `${organization}/${folder}/${crypto.randomUUID()}-${safeFilename(filename)}`;
}

function storageUrl(config) {
  return `${String(config.url).replace(/\/+$/, "")}/storage/v1`;
}

function headers(config, extra = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extra
  };
}

/**
 * Store one file.
 *
 * Returns `{ ok: true, path, bucket, bytes }` or `{ ok: false, code, problem }`.
 * Never throws, and never passes a fetch error message through — it carries the
 * project URL and, on some failures, the key.
 */
async function put(config, { organizationId, kind, filename, contentType, bytes }, options = {}) {
  const readiness = options.readiness || storageReadiness(config, options);
  if (!readiness.ok) return { ok: false, code: readiness.status, problem: readiness.detail };

  const path = pathFor({ organizationId, kind, filename });
  if (!path) {
    return { ok: false, code: "bad_scope", problem: "An upload has to belong to a workspace, and this one did not name a real one." };
  }
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (!payload.length) return { ok: false, code: "empty", problem: "That file has nothing in it." };

  const fetchImpl = options.fetchImpl || fetch;
  let response;
  try {
    response = await fetchImpl(`${storageUrl(config)}/object/${readiness.bucket}/${path}`, {
      method: "POST",
      headers: headers(config, {
        "content-type": contentType || "application/octet-stream",
        "cache-control": "max-age=3600",
        // Never true. Two people uploading photo.jpg must not overwrite each
        // other, and the uuid in the path makes a collision impossible anyway.
        "x-upsert": "false"
      }),
      body: payload
    });
  } catch {
    return { ok: false, code: "unreachable", problem: "The file store could not be reached." };
  }

  if (!response.ok) {
    // The status, never the body: a storage error can echo the path and the
    // headers back, and the headers carry the service-role key.
    return { ok: false, code: "rejected", problem: `The file store refused that upload (${response.status}).` };
  }
  return { ok: true, path, bucket: readiness.bucket, bytes: payload.length };
}

/**
 * A link to one stored file, good for a few minutes.
 *
 * The caller passes the organization it believes owns the file, and this
 * refuses a path that does not begin with it. That check is cheap and it is the
 * one that stops a stored path from a different row being handed to the wrong
 * workspace by a route that forgot to filter.
 */
async function signedUrl(config, { organizationId, path, seconds = DEFAULT_SIGNED_SECONDS }, options = {}) {
  const readiness = options.readiness || storageReadiness(config, options);
  if (!readiness.ok) return { ok: false, code: readiness.status, problem: readiness.detail };

  const organization = String(organizationId || "");
  if (!UUID_PATH.test(organization) || !String(path || "").startsWith(`${organization}/`)) {
    return { ok: false, code: "not_yours", problem: "That file does not belong to this workspace." };
  }

  const fetchImpl = options.fetchImpl || fetch;
  let response;
  try {
    response = await fetchImpl(`${storageUrl(config)}/object/sign/${readiness.bucket}/${path}`, {
      method: "POST",
      headers: headers(config, { "content-type": "application/json" }),
      body: JSON.stringify({ expiresIn: Math.max(30, Math.min(3600, Number(seconds) || DEFAULT_SIGNED_SECONDS)) })
    });
  } catch {
    return { ok: false, code: "unreachable", problem: "The file store could not be reached." };
  }
  if (!response.ok) return { ok: false, code: "rejected", problem: `The file store would not sign that link (${response.status}).` };

  const answer = await response.json().catch(() => null);
  const signed = answer && answer.signedURL;
  if (!signed) {
    // A 200 with no link is a failure. Returning `{ ok: true, url: undefined }`
    // would put an empty href on a page and call it a working download.
    return { ok: false, code: "no_link", problem: "The file store answered without a link." };
  }
  return { ok: true, url: `${storageUrl(config)}${signed}` };
}

/** Remove one stored file. Scoped the same way as signing. */
async function remove(config, { organizationId, path }, options = {}) {
  const readiness = options.readiness || storageReadiness(config, options);
  if (!readiness.ok) return { ok: false, code: readiness.status, problem: readiness.detail };

  const organization = String(organizationId || "");
  if (!UUID_PATH.test(organization) || !String(path || "").startsWith(`${organization}/`)) {
    return { ok: false, code: "not_yours", problem: "That file does not belong to this workspace." };
  }

  const fetchImpl = options.fetchImpl || fetch;
  try {
    const response = await fetchImpl(`${storageUrl(config)}/object/${readiness.bucket}/${path}`, {
      method: "DELETE",
      headers: headers(config)
    });
    if (!response.ok) return { ok: false, code: "rejected", problem: `The file store would not delete that (${response.status}).` };
  } catch {
    return { ok: false, code: "unreachable", problem: "The file store could not be reached." };
  }
  return { ok: true };
}

module.exports = {
  storageReadiness, pathFor, put, signedUrl, remove,
  BUCKET_ENV, DEFAULT_BUCKET, DEFAULT_SIGNED_SECONDS, storageUrl
};
