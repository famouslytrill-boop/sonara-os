"use strict";

// A grid of modules, as a PNG file.
//
// Separate from lib/sonara-qr.cjs on purpose. The encoder's job ends at "which
// squares are dark"; this is one of several things somebody might do with that
// answer, and a page that wants SVG, a table of cells or a label printer should
// not have to go through an image encoder to get there.
//
// No dependency. PNG is a signature, a few length-tagged chunks and a CRC, and
// the compression is node:zlib, which ships with the runtime.
//
// ## The quiet zone is not decoration
//
// The standard requires four modules of light margin on every side. Scanners
// use it to find the edge of the symbol, and a code cropped flush to the finder
// patterns is one that reads on a screen -- where there is white page around it
// -- and fails on a dark poster. It defaults to 4 and is refused below that.

const zlib = require("node:zlib");

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Table-free CRC-32, computed per call. A QR PNG has four chunks, so the table
// would be a cache for four uses.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

// toPng(modules, options) -> Buffer
//
//   scale   pixels per module, default 8
//   margin  quiet zone in modules, default 4, refused below 4
//   dark    [r,g,b] for a dark module, default black
//   light   [r,g,b] for a light module, default white
//
// Throws on a bad grid rather than returning a broken file: a caller writing a
// zero-byte PNG to disk and reporting success is the failure this avoids.
function toPng(modules, options = {}) {
  if (!Array.isArray(modules) || modules.length === 0 || !Array.isArray(modules[0])) {
    throw new TypeError("toPng needs a non-empty two-dimensional array of booleans");
  }
  const size = modules.length;
  if (modules.some((row) => row.length !== size)) throw new TypeError("toPng needs a square grid");

  const scale = Math.max(1, Math.floor(Number(options.scale ?? 8)));
  const margin = Math.floor(Number(options.margin ?? 4));
  if (!Number.isFinite(margin) || margin < 4) {
    throw new RangeError("the quiet zone must be at least 4 modules; scanners use it to find the symbol");
  }
  const dark = options.dark || [0, 0, 0];
  const light = options.light || [255, 255, 255];

  const side = (size + margin * 2) * scale;

  // Colour type 2 (truecolour), 8 bits per channel. Each scanline is prefixed
  // with filter byte 0 -- no filtering, because the image is two colours in
  // large blocks and zlib handles that better than any predictor would.
  const bytesPerLine = side * 3 + 1;
  const raw = Buffer.alloc(bytesPerLine * side);

  for (let y = 0; y < side; y += 1) {
    const lineStart = y * bytesPerLine;
    raw[lineStart] = 0;
    const moduleY = Math.floor(y / scale) - margin;
    for (let x = 0; x < side; x += 1) {
      const moduleX = Math.floor(x / scale) - margin;
      const inside = moduleY >= 0 && moduleY < size && moduleX >= 0 && moduleX < size;
      const colour = inside && modules[moduleY][moduleX] ? dark : light;
      const at = lineStart + 1 + x * 3;
      raw[at] = colour[0];
      raw[at + 1] = colour[1];
      raw[at + 2] = colour[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// The same grid as an SVG string. Every dark module becomes one rect; a page
// that wants a code inline needs no image encoder and no file at all.
function toSvg(modules, options = {}) {
  if (!Array.isArray(modules) || modules.length === 0) throw new TypeError("toSvg needs a grid");
  const size = modules.length;
  const margin = Math.max(4, Math.floor(Number(options.margin ?? 4)));
  const side = size + margin * 2;
  const dark = String(options.dark || "#000000");
  const light = String(options.light || "#ffffff");

  const rects = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) rects.push(`M${x + margin},${y + margin}h1v1h-1z`);
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges" role="img">`,
    `<rect width="${side}" height="${side}" fill="${light}"/>`,
    `<path d="${rects.join("")}" fill="${dark}"/>`,
    `</svg>`
  ].join("");
}

module.exports = { toPng, toSvg, crc32 };
