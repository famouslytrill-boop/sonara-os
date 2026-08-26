"use strict";

// A ZIP file, written with nothing installed.
//
// `node:zlib` has raw deflate; the rest of the format is a local header per
// file, a central directory, and a record saying where that directory starts.
// That is the whole of it, and it is a good deal less code than choosing a zip
// dependency for a project whose entire production dependency list is Express.
//
// ## One implementation, two callers
//
// This started life inside `tools/serverless-cli/`, which packages Lambda
// deployment bundles. `lib/sonara-scroll-export.cjs` then needed a zip too --
// for exporting a scroll site as a static folder somebody can host anywhere --
// and two zip writers in one repository is two chances to get the format
// subtly wrong in one of them. So the writer lives here, in `lib/`, which is
// also the only place `vercel.json` will bundle it from; the CLI requires it
// across the tree rather than keeping a copy.
//
// ## Determinism, and why it is not a nicety
//
// A ZIP normally stores each file's modification time, which makes the bytes
// differ on every build even when nothing changed. For the CLI that means
// CloudFormation reporting every function as updated on every deploy, and a
// plan that always says "1 function to update" is a plan people stop reading.
// For a site export it means a customer cannot tell whether the file they just
// downloaded differs from the one they downloaded yesterday.
//
// So every timestamp here is a fixed constant and the same input always gives
// the same bytes. `tests/a-zip-is-a-real-zip.test.js` checks that against
// `unzip` -- an implementation this project did not write -- and checks the
// determinism across two processes rather than two calls in one, because a
// constant evaluated once at module load looks deterministic from inside a
// single process and is not.

const zlib = require("node:zlib");

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

module.exports = { createZip, crc32, DOS_TIME, DOS_DATE };
