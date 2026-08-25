"use strict";

// The lower level: get the modules and draw them yourself.
//
//   node examples/qr-pixel-loop.js ["some text"]
//
// `result.modules` is an array of rows, each an array of booleans, and
// `modules[y][x]` is true where the module is dark. That is the entire
// interface. Everything else -- PNG, SVG, a canvas, a label printer, ink on a
// mug -- is a loop over this grid.

const qr = require("../lib/sonara-qr.cjs");

const text = process.argv[2] || "https://sonaraindustries.com/book/bright-plumbing";

// Advanced options, all optional, shown here because this is the example where
// somebody is looking for them:
//
//   ecc         "L" | "M" | "Q" | "H"      how much damage the code survives
//   minVersion  1-40                       refuse anything smaller
//   maxVersion  1-40                       refuse anything larger
//   mask        0-7                        pin the mask instead of scoring all eight
//   boostEcc    false                      keep the level exactly as asked
const result = qr.encode(text, { ecc: "Q" });
if (!result.ok) {
  console.error(`Could not encode: ${result.message}`);
  process.exit(1);
}

console.log(`${result.size} x ${result.size} modules, version ${result.version}, level ${result.ecc}, mask ${result.mask}`);
console.log();

// Two rows of modules per line of text, using half blocks, so a 25-module code
// fits a terminal without being twice as tall as it is wide.
const QUIET = 4;
const size = result.size;
const dark = (x, y) => {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  return result.modules[y][x] === true;
};

for (let y = -QUIET; y < size + QUIET; y += 2) {
  let line = "";
  for (let x = -QUIET; x < size + QUIET; x += 1) {
    const top = dark(x, y);
    const bottom = dark(x, y + 1);
    // Inverted on purpose: terminals are usually light-on-dark, and a code
    // printed the other way round does not scan off a screen.
    if (top && bottom) line += " ";
    else if (top) line += "▄";
    else if (bottom) line += "▀";
    else line += "█";
  }
  console.log(line);
}

console.log();

// The same grid, counted rather than drawn -- what a caller doing their own
// rendering usually wants to know first.
let darkCount = 0;
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) if (result.modules[y][x]) darkCount += 1;
}
console.log(`${darkCount} dark of ${size * size} modules (${((darkCount / (size * size)) * 100).toFixed(1)}%)`);
