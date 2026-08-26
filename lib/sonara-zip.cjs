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

// The container layout lives in `public/sonara-zip-core.js`, not here.
//
// The browser builds one of these too -- when somebody brings their own video,
// the frames are pulled out and zipped on their own machine rather than
// uploaded -- and it cannot use `node:zlib`. What it can share is every byte of
// the container: the local headers, the central directory, the end record and
// the offsets between them. Two copies of that is two chances to get a binary
// format wrong in one of them, and the symptom is an archive that looks
// perfectly fine and will not open.
//
// So this file is the Node *compressor* and nothing else. `public/**` is
// bundled by vercel.json alongside `lib/**`, so requiring across is as safe in
// production as it is here.
const zlib = require("node:zlib");
const core = require("../public/sonara-zip-core.js");

/**
 * Build a ZIP from a list of { name, data, executable? } entries.
 *
 * Returns a Buffer. The same entries in the same order always give the same
 * bytes -- see the note above about why that matters.
 */
function createZip(entries) {
  return Buffer.from(core.assemble((entries || []).map((entry) => {
    // `Buffer` rather than `TextEncoder` here: this side is Node, a Buffer is
    // already a Uint8Array so the container accepts it, and it keeps the
    // browser-only globals out of a lib module.
    const raw = entry.data instanceof Uint8Array
      ? entry.data
      : Buffer.from(String(entry.data), "utf8");
    return {
      name: entry.name,
      raw,
      // Level 9: an export is built once and downloaded once, and the few
      // milliseconds buy a smaller file on somebody's connection.
      deflated: new Uint8Array(zlib.deflateRawSync(raw, { level: 9 })),
      executable: entry.executable
    };
  })));
}

module.exports = { createZip, crc32: core.crc32, DOS_TIME: core.DOS_TIME, DOS_DATE: core.DOS_DATE };
