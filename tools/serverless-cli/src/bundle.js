"use strict";

// A deployment package, written with nothing installed.
//
// Lambda takes a ZIP. `node:zlib` has raw deflate, and the rest of the format
// is a local header per file, a central directory, and a record saying where
// that directory starts. That is the whole of it, and it is a good deal less
// code than choosing a zip dependency.
//
// ## Determinism, because it is what makes a plan mean anything
//
// A ZIP normally carries the modification time of each file. That makes the
// bytes different on every build, which makes the checksum different, which
// makes the S3 key different, which makes CloudFormation report the function as
// changed -- on every single deploy, whether or not any code changed.
//
// A plan that always says "1 function to update" is a plan nobody reads. So
// every timestamp here is a fixed constant, and the same sources produce the
// same bytes. `deploy` keys the upload on the hash of those bytes, so an
// unchanged application really does show as unchanged.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// The zip writer itself lives in the application's `lib/`, not here.
//
// It was written in this file first, and then `lib/sonara-scroll-export.cjs`
// needed a zip as well -- for exporting a scroll site as a static folder. Two
// zip writers in one repository is two chances to get the format subtly wrong
// in one of them and not notice, so there is one, and this requires it.
//
// That does couple this tool to the tree it sits in. It is a real coupling and
// worth stating rather than hiding: this is `tools/` of the SONARA repository,
// not a package published anywhere, and the alternative was a second copy of a
// binary format writer.
const { createZip, crc32 } = require("../../../lib/sonara-zip.cjs");

// What never belongs in a deployment package. `.env` is the one that matters:
// it is how a secret gets uploaded to a place a good many people can read it,
// and it is exactly the file somebody has sitting next to their handlers.
const NEVER_BUNDLE = Object.freeze([
  ".env", ".env.local", ".env.production", ".env.development",
  ".git", ".gitignore", ".DS_Store", "node_modules/.cache",
  ".aws", ".npmrc", "id_rsa", "id_ed25519", ".sonara-serverless"
]);

function isExcluded(relativePath) {
  const parts = relativePath.split("/");
  return parts.some((part) => NEVER_BUNDLE.includes(part)) || /^\.env(\..+)?$/.test(parts[parts.length - 1]);
}

/**
 * Collect a project directory into zip entries, sorted by name.
 *
 * Sorted rather than in directory order: readdir order is filesystem-dependent,
 * and two machines producing different bytes for identical sources would defeat
 * the determinism the whole module is built for.
 */
function collectFiles(root, { maxBytes = 50 * 1024 * 1024 } = {}) {
  const found = [];
  const skipped = [];

  function walk(directory, prefix) {
    const listing = fs.readdirSync(directory, { withFileTypes: true });
    for (const item of listing) {
      const relative = prefix ? `${prefix}/${item.name}` : item.name;
      if (isExcluded(relative)) { skipped.push(relative); continue; }
      const full = path.join(directory, item.name);
      if (item.isDirectory()) { walk(full, relative); continue; }
      if (!item.isFile()) continue;
      found.push({ name: relative, full, size: fs.statSync(full).size });
    }
  }
  walk(root, "");

  found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const total = found.reduce((sum, file) => sum + file.size, 0);
  if (total > maxBytes) {
    const error = new Error(
      `This project is ${(total / 1024 / 1024).toFixed(1)}MB before compression, and Lambda's limit is 250MB unzipped.`
    );
    error.hint = "Check whether node_modules is being bundled when it does not need to be.";
    throw error;
  }

  return {
    entries: found.map((file) => ({ name: file.name, data: fs.readFileSync(file.full) })),
    skipped
  };
}

// The name the package is uploaded under. Keyed on the content, so an unchanged
// application uploads to the same key and CloudFormation sees no change at all.
function keyFor(appName, zipBuffer) {
  const digest = crypto.createHash("sha256").update(zipBuffer).digest("hex").slice(0, 32);
  return `${appName}/${digest}.zip`;
}

module.exports = { createZip, collectFiles, keyFor, crc32, isExcluded, NEVER_BUNDLE };
