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

const zlib = require("node:zlib");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// 1980-01-01, the earliest a DOS timestamp can express. Chosen because it is
// the conventional "no time" value and cannot be mistaken for a real build.
const DOS_TIME = 0;
const DOS_DATE = 33; // (1980-1980)<<9 | 1<<5 | 1

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    crc32.table = table;
  }
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

/**
 * Build a ZIP from a list of { name, data, executable? } entries.
 *
 * Returns a Buffer. The same entries in the same order always give the same
 * bytes.
 */
function createZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(String(entry.name).replace(/\\/g, "/"), "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), "utf8");
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(8, 8);            // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(0x031e, 4);      // made by: unix, zip 3.0
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt16LE(DOS_TIME, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);          // extra
    header.writeUInt16LE(0, 32);          // comment
    header.writeUInt16LE(0, 34);          // disk
    header.writeUInt16LE(0, 36);          // internal attrs
    // Unix mode in the high 16 bits. Lambda will not run a handler it cannot
    // read, and a zip built without modes gives 000 on some unpackers.
    // `>>> 0` is not decoration: JavaScript's bitwise operators work on signed
    // 32-bit integers, so 0o100644 << 16 overflows to a negative number and
    // writeUInt32LE refuses it.
    header.writeUInt32LE(((entry.executable ? 0o100755 : 0o100644) << 16) >>> 0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuffer, end]);
}

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
