"use strict";

// "Hello, world!" as a PNG, which is the whole of the simple case.
//
//   node examples/qr-hello-world.js [outputPath]
//
// Nothing is installed to run this. The encoder and the PNG writer are both in
// lib/ and neither has a dependency.

const fs = require("node:fs");
const path = require("node:path");

const qr = require("../lib/sonara-qr.cjs");
const { toPng, toSvg } = require("../lib/sonara-qr-png.cjs");

const text = "Hello, world!";
const output = process.argv[2] || path.join(__dirname, "hello-world.png");

// Everything below the first argument is optional. This is what a caller who
// wants a code and no opinions writes.
const result = qr.encode(text);

// encode() refuses rather than throwing, because "too long for a QR code" is an
// ordinary answer a page shows somebody rather than a crash.
if (!result.ok) {
  console.error(`Could not encode: ${result.message}`);
  process.exit(1);
}

fs.writeFileSync(output, toPng(result.modules, { scale: 8 }));
fs.writeFileSync(output.replace(/\.png$/, ".svg"), toSvg(result.modules));

console.log(`${JSON.stringify(text)}`);
console.log(`  version ${result.version} (${result.size} x ${result.size} modules)`);
console.log(`  error correction ${result.ecc}, mask ${result.mask}`);
console.log(`  wrote ${output}`);
console.log(`  wrote ${output.replace(/\.png$/, ".svg")}`);
