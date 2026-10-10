// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure versioned canonicalization for already finalized publishing copy.
// This does not authenticate provenance, rights, tenant, asset ownership, or
// provider permissions. The trusted server must read and hash real source
// records, compare their versions and refuse stale approval snapshots.

const { createHash } = require("node:crypto");
const SHA256 = /^[0-9a-f]{64}$/;
const ACCOUNT = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/;
const PROVIDERS = new Set(["linkedin_marketing", "tiktok_content", "meta_marketing", "youtube_data"]);
const BAD_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const ROOT_KEYS = Object.freeze([
  "title", "caption", "altText", "hashtags", "thumbnailHash",
  "rightsEvidenceHash", "destinationCopy"
]);
const DESTINATION_KEYS = Object.freeze([
  "providerKey", "accountId", "title", "caption", "altText", "hashtags"
]);
function exactKeys(object, allowed) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return false;
  const keys = Object.keys(object);
  return keys.length === allowed.length && allowed.every(key => Object.hasOwn(object, key));
}
function prose(value, max, required = false) {
  return typeof value === "string" && value.length <= max &&
    (!required || value.trim().length > 0) &&
    value === value.normalize("NFC") && !BAD_CONTROLS.test(value);
}
function validatedTags(tags) {
  if (!Array.isArray(tags) || tags.length > 30) return null;
  const seen = new Set();
  const output = [];
  for (const tag of tags) {
    if (!prose(tag, 64, true) || tag !== tag.trim() || /\s/u.test(tag)) return null;
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) return null;
    seen.add(normalized);
    output.push(tag);
  }
  return output;
}
function copyFields(input) {
  if (!prose(input.title, 300) || !prose(input.caption, 10000, true) ||
      !prose(input.altText, 2000)) return null;
  const hashtags = validatedTags(input.hashtags);
  if (!hashtags) return null;
  return { title: input.title, caption: input.caption, altText: input.altText, hashtags };
}
function canonicalPublishingManifest(input) {
  if (!exactKeys(input, ROOT_KEYS) ||
      !(input.thumbnailHash === null || SHA256.test(input.thumbnailHash || "")) ||
      !SHA256.test(input.rightsEvidenceHash || "")) return null;
  const rootCopy = copyFields(input);
  if (!rootCopy || !Array.isArray(input.destinationCopy) ||
      input.destinationCopy.length > 12) return null;
  const destinations = [];
  const seen = new Set();
  for (const item of input.destinationCopy) {
    if (!exactKeys(item, DESTINATION_KEYS) ||
        !PROVIDERS.has(item.providerKey) || !ACCOUNT.test(item.accountId || "")) return null;
    const copy = copyFields(item);
    if (!copy) return null;
    const key = item.providerKey + ":" + item.accountId;
    if (seen.has(key)) return null;
    seen.add(key);
    destinations.push({ providerKey: item.providerKey, accountId: item.accountId, ...copy });
  }
  return Object.freeze({
    version: 1, ...rootCopy,
    thumbnailHash: input.thumbnailHash,
    rightsEvidenceHash: input.rightsEvidenceHash,
    destinationCopy: destinations
  });
}
function publishingManifestHash(input) {
  const manifest = canonicalPublishingManifest(input);
  if (!manifest) return null;
  return createHash("sha256").update(JSON.stringify(manifest), "utf8").digest("hex");
}

module.exports = { canonicalPublishingManifest, publishingManifestHash };
