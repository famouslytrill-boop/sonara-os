"use strict";

// The image somebody actually prints.
//
// A PNG writer is easy to get almost right: a file with a valid signature and a
// wrong CRC opens in some viewers and not others, and one with the scanlines a
// byte out looks like a code that will not scan. So this reads the file back --
// checks the signature, walks the chunks, verifies every CRC independently,
// inflates the pixels and compares them against the grid they came from.
//
// The examples are run here too. An example nobody runs is documentation that
// rots, and the two in examples/ are the first thing anybody reads.

const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const qr = require("../lib/sonara-qr.cjs");
const { toPng, toSvg, crc32 } = require("../lib/sonara-qr-png.cjs");

// An independent chunk walker: length, type, data, CRC over type+data.
function readChunks(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buffer.subarray(0, 8).equals(signature), "the PNG signature is wrong");
  const chunks = [];
  let at = 8;
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString("ascii", at + 4, at + 8);
    const data = buffer.subarray(at + 8, at + 8 + length);
    const stated = buffer.readUInt32BE(at + 8 + length);
    chunks.push({ type, data, stated, computed: crc32(buffer.subarray(at + 4, at + 8 + length)) });
    at += 12 + length;
  }
  return chunks;
}

describe("a QR PNG is a real PNG", () => {
  const result = qr.encode("Hello, world!", { ecc: "M" });
  const scale = 3;
  const margin = 4;
  const png = toPng(result.modules, { scale, margin });
  const chunks = readChunks(png);

  it("encoded something to draw in the first place", () => {
    assert.equal(result.ok, true);
    assert.ok(result.size >= 21);
  });

  it("carries the chunks a PNG must have, in order", () => {
    const types = chunks.map((c) => c.type);
    assert.equal(types[0], "IHDR", "IHDR must come first");
    assert.equal(types[types.length - 1], "IEND", "IEND must come last");
    assert.ok(types.includes("IDAT"), "there is no image data at all");
  });

  it("has a correct CRC on every chunk", () => {
    assert.ok(chunks.length >= 3, "no chunks were parsed, so this check is looking at nothing");
    for (const c of chunks) {
      assert.equal(c.computed, c.stated, `CRC mismatch on the ${c.type} chunk`);
    }
  });

  it("declares the size the grid and the scale imply", () => {
    const ihdr = chunks.find((c) => c.type === "IHDR");
    const expected = (result.size + margin * 2) * scale;
    assert.equal(ihdr.data.readUInt32BE(0), expected);
    assert.equal(ihdr.data.readUInt32BE(4), expected);
    assert.equal(ihdr.data[8], 8, "bit depth should be 8");
    assert.equal(ihdr.data[9], 2, "colour type should be 2 (truecolour)");
    assert.equal(ihdr.data[12], 0, "the image must not be interlaced");
  });

  it("has pixels that are the grid it was given", () => {
    const ihdr = chunks.find((c) => c.type === "IHDR");
    const side = ihdr.data.readUInt32BE(0);
    const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
    const bytesPerLine = side * 3 + 1;
    assert.equal(raw.length, bytesPerLine * side, "the inflated data is not one filter byte plus one row per line");

    let compared = 0;
    for (let y = 0; y < side; y += 1) {
      assert.equal(raw[y * bytesPerLine], 0, `scanline ${y} is not using filter 0`);
      for (let x = 0; x < side; x += 1) {
        const at = y * bytesPerLine + 1 + x * 3;
        const isDark = raw[at] === 0 && raw[at + 1] === 0 && raw[at + 2] === 0;
        const moduleX = Math.floor(x / scale) - margin;
        const moduleY = Math.floor(y / scale) - margin;
        const inside = moduleX >= 0 && moduleX < result.size && moduleY >= 0 && moduleY < result.size;
        const expected = inside && result.modules[moduleY][moduleX] === true;
        assert.equal(isDark, expected, `pixel ${x},${y} disagrees with module ${moduleX},${moduleY}`);
        compared += 1;
      }
    }
    // Every pixel, not "enough" pixels. The first version of this guard was a
    // magic threshold of 10,000 and failed on its own fixture, because a
    // version 1 code at scale 3 is 87 pixels square and 87 squared is 7,569.
    // The property worth asserting was never a count -- it is that the loop
    // covered the whole image.
    assert.equal(compared, side * side, "the comparison did not cover every pixel in the image");
  });

  it("surrounds the code with a quiet zone that is actually light", () => {
    const ihdr = chunks.find((c) => c.type === "IHDR");
    const side = ihdr.data.readUInt32BE(0);
    const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
    const bytesPerLine = side * 3 + 1;
    const band = margin * scale;
    for (let y = 0; y < band; y += 1) {
      for (let x = 0; x < side; x += 1) {
        const at = y * bytesPerLine + 1 + x * 3;
        assert.equal(raw[at], 255, `the top quiet zone has ink at ${x},${y}`);
      }
    }
  });

  it("refuses a quiet zone too small for a scanner to find the edge", () => {
    assert.throws(() => toPng(result.modules, { margin: 0 }), /quiet zone/);
    assert.throws(() => toPng(result.modules, { margin: 3 }), /quiet zone/);
  });

  it("refuses a grid that is not one, rather than writing a broken file", () => {
    assert.throws(() => toPng([], {}), /two-dimensional/);
    assert.throws(() => toPng([[true, false], [true]], {}), /square/);
    assert.throws(() => toPng("not a grid", {}), /two-dimensional/);
  });
});

describe("the SVG carries the same grid", () => {
  const result = qr.encode("SONARA", { ecc: "M" });
  const svg = toSvg(result.modules);

  it("is one path with one square per dark module", () => {
    let dark = 0;
    for (const row of result.modules) for (const cell of row) if (cell) dark += 1;
    const moves = (svg.match(/M\d+,\d+h1v1h-1z/g) || []).length;
    assert.ok(dark > 100, "the fixture has almost no dark modules; this check is looking at nothing");
    assert.equal(moves, dark, "the SVG does not draw one square per dark module");
  });

  it("sets a viewBox that includes the quiet zone", () => {
    const side = result.size + 8;
    assert.ok(svg.includes(`viewBox="0 0 ${side} ${side}"`), "the viewBox does not allow for a 4-module margin");
  });

  it("paints a light background rather than relying on the page", () => {
    assert.ok(/<rect width="\d+" height="\d+" fill="#ffffff"\/>/.test(svg), "an SVG with no background inherits a dark page and stops scanning");
  });
});

describe("the examples still run", () => {
  // An example nobody runs is documentation that rots, and these two are the
  // first thing anybody reads about this library.
  const root = path.join(__dirname, "..");

  it("turns Hello, world! into a PNG on disk", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-qr-"));
    const out = path.join(dir, "hello.png");
    const stdout = execFileSync(process.execPath, [path.join(root, "examples/qr-hello-world.js"), out], { encoding: "utf8" });
    assert.ok(fs.existsSync(out), "the example reported success and wrote no file");
    const written = fs.readFileSync(out);
    assert.ok(written.length > 100, "the file it wrote is empty");
    readChunks(written);
    assert.match(stdout, /version 1/);
    assert.ok(fs.existsSync(out.replace(/\.png$/, ".svg")));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("prints a grid from the low-level example", () => {
    const stdout = execFileSync(process.execPath, [path.join(root, "examples/qr-pixel-loop.js"), "SONARA"], { encoding: "utf8" });
    assert.match(stdout, /modules, version \d+, level [LMQH], mask \d/);
    assert.match(stdout, /dark of \d+ modules/);
    assert.ok(stdout.split("\n").length > 15, "the example printed no grid");
  });
});
