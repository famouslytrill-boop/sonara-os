"use strict";

// S3.
//
// The one service here with no action names: the HTTP method and the path are
// the operation, which is why `protocol.js` treats a bare path with no other
// signal as S3 and nothing else.
//
// ## Both addressing styles, because SDKs disagree
//
// `bucket.s3.localhost/key` is virtual-host style and what most SDKs default
// to. `s3.localhost/bucket/key` is path style, which is what the AWS CLI uses
// against a custom endpoint unless told otherwise, and what every emulator has
// to accept because `bucket.localhost` does not resolve on most machines.
// Supporting only one means half the tools that point at this get a confusing
// NoSuchBucket for a bucket that is right there.
//
// ## ETags are real MD5s
//
// It would be easier to return a random string. Real S3 returns the MD5 of the
// object, SDKs check it after an upload, and a test that verifies an ETag would
// pass against real AWS and fail here -- which makes the emulator the thing
// that is wrong, in a way that costs somebody an afternoon.

const crypto = require("node:crypto");
const { xml, errorXml } = require("../xml.js");

const NAME = "s3";

// A bucket name AWS would accept. Enforced because a test that creates
// `MyBucket` here and fails in production is worse than one that fails here.
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

function buckets(store, region) {
  return store.scope(region, NAME, "buckets");
}

function md5(bytes) {
  return crypto.createHash("md5").update(bytes).digest("hex");
}

// Path style or virtual host style, resolved to the same two values.
function locate(request) {
  const path = decodeURIComponent(String(request.path || "/"));
  if (request.bucket) {
    return { bucket: request.bucket, key: path.replace(/^\//, "") };
  }
  const trimmed = path.replace(/^\//, "");
  const slash = trimmed.indexOf("/");
  if (slash === -1) return { bucket: trimmed, key: "" };
  return { bucket: trimmed.slice(0, slash), key: trimmed.slice(slash + 1) };
}

function notFound(code, message, extra = {}) {
  return {
    status: code === "NoSuchBucket" || code === "NoSuchKey" ? 404 : 400,
    headers: { "content-type": "application/xml" },
    body: errorXml(code, message, extra)
  };
}

function handle(request, { store }) {
  const region = request.region;
  const method = String(request.method || "GET").toUpperCase();
  const { bucket, key } = locate(request);
  const all = buckets(store, region);

  // ListBuckets: a GET at the root with no bucket in the path.
  if (!bucket) {
    if (method !== "GET") return notFound("MethodNotAllowed", `S3 does not answer ${method} at the root.`);
    const entries = [...all.keys()].sort().map((name) =>
      `<Bucket><Name>${xml(name)}</Name><CreationDate>${all.get(name).created}</CreationDate></Bucket>`).join("");
    return {
      status: 200,
      headers: { "content-type": "application/xml" },
      body: `<?xml version="1.0" encoding="UTF-8"?><ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Owner><ID>${store.account}</ID><DisplayName>emulator</DisplayName></Owner><Buckets>${entries}</Buckets></ListAllMyBucketsResult>`
    };
  }

  // --- bucket operations ------------------------------------------------

  if (!key) {
    if (method === "PUT") {
      if (!BUCKET.test(bucket)) {
        return notFound("InvalidBucketName", `"${bucket}" is not a bucket name AWS would accept: 3-63 characters, lower case, digits, dots and hyphens.`);
      }
      if (all.has(bucket)) {
        // Real S3 answers this way for a bucket you already own, and the
        // serverless CLI relies on it: racing two deploys must not fail either.
        return { status: 200, headers: {}, body: "" };
      }
      all.set(bucket, { created: new Date().toISOString(), objects: new Map() });
      store.save?.();
      return { status: 200, headers: { location: `/${bucket}` }, body: "" };
    }

    const found = all.get(bucket);
    if (!found) return notFound("NoSuchBucket", `There is no bucket called "${bucket}".`, { BucketName: bucket });

    if (method === "HEAD") return { status: 200, headers: {}, body: "" };

    if (method === "DELETE") {
      // Refused when it still holds objects, exactly as S3 does. An emulator
      // that deletes a full bucket lets somebody write a teardown that works
      // locally and fails against AWS.
      if (found.objects.size > 0) {
        return notFound("BucketNotEmpty", `"${bucket}" still has ${found.objects.size} object(s) in it.`, { BucketName: bucket });
      }
      all.delete(bucket);
      store.save?.();
      return { status: 204, headers: {}, body: "" };
    }

    if (method === "GET") {
      const prefix = request.query?.get("prefix") || "";
      const maxKeys = Math.min(1000, Number(request.query?.get("max-keys")) || 1000);
      const names = [...found.objects.keys()].filter((name) => name.startsWith(prefix)).sort();
      const shown = names.slice(0, maxKeys);
      const contents = shown.map((name) => {
        const object = found.objects.get(name);
        return `<Contents><Key>${xml(name)}</Key><LastModified>${object.modified}</LastModified><ETag>&quot;${object.etag}&quot;</ETag><Size>${object.body.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`;
      }).join("");
      // ListObjectsV2 and the original differ in their result element, and SDKs
      // parse for the one they asked for.
      const v2 = request.query?.get("list-type") === "2";
      const root = v2 ? "ListBucketResult" : "ListBucketResult";
      const countTag = v2 ? `<KeyCount>${shown.length}</KeyCount>` : "";
      return {
        status: 200,
        headers: { "content-type": "application/xml" },
        body: `<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${xml(bucket)}</Name><Prefix>${xml(prefix)}</Prefix><MaxKeys>${maxKeys}</MaxKeys>${countTag}<IsTruncated>${names.length > shown.length}</IsTruncated>${contents}</${root}>`
      };
    }

    return notFound("MethodNotAllowed", `S3 does not answer ${method} on a bucket here.`);
  }

  // --- object operations ------------------------------------------------

  const found = all.get(bucket);
  if (!found) return notFound("NoSuchBucket", `There is no bucket called "${bucket}".`, { BucketName: bucket });

  if (method === "PUT") {
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from(String(request.body || ""), "utf8");
    const etag = md5(body);
    found.objects.set(key, {
      body,
      etag,
      modified: new Date().toISOString(),
      contentType: request.headers["content-type"] || "binary/octet-stream",
      // Only the x-amz-meta-* headers, which is what S3 keeps. Copying every
      // header would store the Authorization header alongside the object.
      metadata: Object.fromEntries(Object.entries(request.headers)
        .filter(([name]) => name.toLowerCase().startsWith("x-amz-meta-"))
        .map(([name, value]) => [name.toLowerCase().slice("x-amz-meta-".length), value]))
    });
    store.save?.();
    return { status: 200, headers: { etag: `"${etag}"` }, body: "" };
  }

  const object = found.objects.get(key);

  if (method === "GET" || method === "HEAD") {
    if (!object) return notFound("NoSuchKey", `There is no object called "${key}" in "${bucket}".`, { Key: key, BucketName: bucket });
    const headers = {
      "content-type": object.contentType,
      "content-length": String(object.body.length),
      etag: `"${object.etag}"`,
      "last-modified": new Date(object.modified).toUTCString()
    };
    for (const [name, value] of Object.entries(object.metadata || {})) headers[`x-amz-meta-${name}`] = value;
    return { status: 200, headers, body: method === "HEAD" ? "" : object.body };
  }

  if (method === "DELETE") {
    // 204 whether or not it was there. S3 does the same: a delete is a
    // statement about the end state, and an emulator that 404s here breaks
    // every idempotent teardown script written against the real thing.
    found.objects.delete(key);
    store.save?.();
    return { status: 204, headers: {}, body: "" };
  }

  return notFound("MethodNotAllowed", `S3 does not answer ${method} on an object here.`);
}

module.exports = { NAME, handle, locate, BUCKET };
