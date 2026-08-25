"use strict";

// QR Code Model 2, from text to black and white modules.
//
// A booking page, a chat widget and a shared invoice all live at a URL, and a
// URL on a van, a receipt or a shop window has to be typed by hand unless there
// is a code beside it. This turns a string into the grid; drawing it is
// somebody else's job, which is the whole point -- lib/sonara-qr-png.cjs makes a
// PNG out of the same grid, and a page could just as well make SVG, a table of
// cells, or ink on a label printer.
//
// No dependency, no network, no cost per use. Everything here is arithmetic.
//
// ## Where the numbers came from
//
// The two capacity tables -- error-correction codewords per block, and the
// number of blocks -- are the ones printed in ISO/IEC 18004 for Model 2. They
// are the part of this file nobody can derive and everybody gets wrong from
// memory, so they were read from Project Nayuki's reference implementation
// (MIT, and recorded in data/open-source-tools.ts) on 25 August 2026 rather
// than recalled. The same goes for the raw-data-module count and the alignment
// pattern spacing, both of which are closed-form expressions in the standard.
// The rest -- Reed-Solomon, masking, penalty scoring, bit placement -- is
// written here.
//
// Credit where it is owed: Project Nayuki's QR Code generator library is the
// reference this was checked against. https://www.nayuki.io/page/qr-code-generator-library
//
// ## How this is known to be right
//
// A QR encoder that is subtly wrong produces a grid that looks perfectly like a
// QR code and does not scan, and there is no way to see the difference by eye.
// So tests/a-qr-code-can-be-read-back.test.js contains an independently written
// *decoder* -- it reads the modules back out, undoes the mask, de-interleaves
// the blocks and reconstructs the string -- and round-trips every case. An
// encoder and a decoder written from the same misunderstanding could still
// agree, so the structural invariants are asserted separately: module count,
// finder positions, timing alternation, the dark module, and format bits
// checked against the values published for two (level, mask) pairs.

// ---------------------------------------------------------------------------
// Tables from the standard
// ---------------------------------------------------------------------------

// Index [eccOrdinal][version]. Index 0 of each row is padding so version 1 is
// at index 1 -- versions are 1-based and shifting them here would be one more
// place to make an off-by-one.
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];

const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];

// Ordinal is the table index; formatBits is what goes into the format
// information area, and the two are deliberately different numbers. L is
// ordinal 0 and format 1; M is ordinal 1 and format 0. Conflating them is the
// classic way to produce a code that is structurally perfect and unreadable.
const ECC = Object.freeze({
  L: { name: "L", ordinal: 0, formatBits: 1, recovers: "about 7%" },
  M: { name: "M", ordinal: 1, formatBits: 0, recovers: "about 15%" },
  Q: { name: "Q", ordinal: 2, formatBits: 3, recovers: "about 25%" },
  H: { name: "H", ordinal: 3, formatBits: 2, recovers: "about 30%" }
});

const MIN_VERSION = 1;
const MAX_VERSION = 40;

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const MODE = Object.freeze({
  numeric: { bits: 0x1, charCountBits: [10, 12, 14] },
  alphanumeric: { bits: 0x2, charCountBits: [9, 11, 13] },
  byte: { bits: 0x4, charCountBits: [8, 16, 16] }
});

// ---------------------------------------------------------------------------
// Galois field GF(256), primitive polynomial 0x11D
// ---------------------------------------------------------------------------

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

// The divisor polynomial for `degree` error correction codewords: the product
// of (x - r^i) for i in 0..degree-1, where r is 0x02. Coefficients are stored
// with the highest power first and the leading 1 left implicit.
function reedSolomonDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i += 1) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

function isNumeric(text) {
  return text.length > 0 && /^[0-9]+$/.test(text);
}

function isAlphanumeric(text) {
  return text.length > 0 && [...text].every((ch) => ALPHANUMERIC.includes(ch));
}

function utf8Bytes(text) {
  return Array.from(Buffer.from(String(text), "utf8"));
}

// A segment is one run of characters in one mode. Callers who know their data
// can hand these in directly; makeSegments picks a single mode for the whole
// string, which is what almost every caller wants and is never wrong, only
// sometimes one version larger than an expert split would be.
function makeNumericSegment(text) {
  if (!isNumeric(text)) throw new TypeError("makeNumericSegment needs digits only");
  const bits = [];
  for (let i = 0; i < text.length; i += 3) {
    const chunk = text.slice(i, i + 3);
    appendBits(bits, Number(chunk), chunk.length * 3 + 1);
  }
  return { mode: "numeric", charCount: text.length, bits };
}

function makeAlphanumericSegment(text) {
  if (!isAlphanumeric(text)) throw new TypeError("makeAlphanumericSegment needs the 45-character set");
  const bits = [];
  let i = 0;
  for (; i + 2 <= text.length; i += 2) {
    appendBits(bits, ALPHANUMERIC.indexOf(text[i]) * 45 + ALPHANUMERIC.indexOf(text[i + 1]), 11);
  }
  if (i < text.length) appendBits(bits, ALPHANUMERIC.indexOf(text[i]), 6);
  return { mode: "alphanumeric", charCount: text.length, bits };
}

function makeByteSegment(data) {
  const bytes = typeof data === "string" ? utf8Bytes(data) : Array.from(data);
  const bits = [];
  for (const byte of bytes) appendBits(bits, byte, 8);
  // charCount is BYTES, not characters. An emoji is one character and four
  // bytes, and counting characters here overflows the data region by three.
  return { mode: "byte", charCount: bytes.length, bits };
}

// The narrowest mode that covers the whole string. Numeric fits in alphanumeric
// and alphanumeric fits in byte, so this is a strict ladder rather than a guess.
function makeSegments(data) {
  if (typeof data !== "string") return [makeByteSegment(data)];
  if (data === "") return [];
  if (isNumeric(data)) return [makeNumericSegment(data)];
  if (isAlphanumeric(data)) return [makeAlphanumericSegment(data)];
  return [makeByteSegment(data)];
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function charCountBits(mode, version) {
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return MODE[mode].charCountBits[group];
}

function segmentBitLength(segments, version) {
  let total = 0;
  for (const segment of segments) {
    const countBits = charCountBits(segment.mode, version);
    // A count that will not fit its field makes this version impossible rather
    // than merely tight, and returning Infinity lets the version search skip it
    // without a special case.
    if (segment.charCount >= (1 << countBits)) return Infinity;
    total += 4 + countBits + segment.bits.length;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version, ecc) {
  return Math.floor(rawDataModules(version) / 8)
    - ECC_CODEWORDS_PER_BLOCK[ecc.ordinal][version] * NUM_ERROR_CORRECTION_BLOCKS[ecc.ordinal][version];
}

// ---------------------------------------------------------------------------
// Codewords
// ---------------------------------------------------------------------------

function buildDataCodewords(segments, version, ecc) {
  const capacityBits = dataCodewords(version, ecc) * 8;
  const bits = [];
  for (const segment of segments) {
    appendBits(bits, MODE[segment.mode].bits, 4);
    appendBits(bits, segment.charCount, charCountBits(segment.mode, version));
    for (const bit of segment.bits) bits.push(bit);
  }
  if (bits.length > capacityBits) throw new RangeError("segments do not fit this version");

  // Terminator, then pad to a byte boundary, then alternate pad bytes. The
  // terminator is up to four zero bits and shorter if there is not room, which
  // is a case a naive implementation gets wrong only on a completely full code.
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);

  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bits.length; i += 1) bytes[i >>> 3] |= bits[i] << (7 - (i & 7));
  return bytes;
}

// Split into blocks, compute each block's remainder, then interleave. The
// interleave is what makes a smudge survivable: consecutive bytes on the
// printed page come from different blocks, so damage is spread across all of
// them instead of destroying one.
function addEccAndInterleave(data, version, ecc) {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc.ordinal][version];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[ecc.ordinal][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const divisor = reedSolomonDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const dataLen = shortBlockLen - eccLen + (i < numShortBlocks ? 0 : 1);
    const chunk = data.subarray(k, k + dataLen);
    k += dataLen;
    const block = new Uint8Array(shortBlockLen + 1);
    block.set(chunk, 0);
    block.set(reedSolomonRemainder(chunk, divisor), chunk.length + (i < numShortBlocks ? 1 : 0));
    blocks.push({ block, dataLen });
  }

  const result = new Uint8Array(rawCodewords);
  let at = 0;
  for (let i = 0; i <= shortBlockLen; i += 1) {
    for (let j = 0; j < blocks.length; j += 1) {
      // The short blocks have no byte at the last data position, so that one
      // column is skipped for them and only for them.
      if (i === shortBlockLen - eccLen && j < numShortBlocks) continue;
      result[at] = blocks[j].block[i];
      at += 1;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

function alignmentPatternPositions(version) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = 4 * version + 10, i = 0; i < numAlign - 1; i += 1, pos -= step) result.splice(1, 0, pos);
  return result;
}

function createGrid(size, value) {
  return Array.from({ length: size }, () => new Array(size).fill(value));
}

function drawFunctionPatterns(modules, isFunction, version, ecc) {
  const size = modules.length;

  // Timing patterns, before the finders, so the finders overwrite the corners.
  for (let i = 0; i < size; i += 1) {
    setFunctionModule(modules, isFunction, 6, i, i % 2 === 0);
    setFunctionModule(modules, isFunction, i, 6, i % 2 === 0);
  }

  drawFinder(modules, isFunction, 3, 3);
  drawFinder(modules, isFunction, size - 4, 3);
  drawFinder(modules, isFunction, 3, size - 4);

  const positions = alignmentPatternPositions(version);
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = 0; j < positions.length; j += 1) {
      // The three corners already carry finders.
      const corner = (i === 0 && j === 0)
        || (i === 0 && j === positions.length - 1)
        || (i === positions.length - 1 && j === 0);
      if (!corner) drawAlignment(modules, isFunction, positions[i], positions[j]);
    }
  }

  drawFormatBits(modules, isFunction, ecc, 0);
  drawVersionBits(modules, isFunction, version);
}

function setFunctionModule(modules, isFunction, x, y, dark) {
  modules[y][x] = dark;
  isFunction[y][x] = true;
}

function drawFinder(modules, isFunction, centreX, centreY) {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      const x = centreX + dx;
      const y = centreY + dy;
      if (x >= 0 && x < modules.length && y >= 0 && y < modules.length) {
        setFunctionModule(modules, isFunction, x, y, distance !== 2 && distance !== 4);
      }
    }
  }
}

function drawAlignment(modules, isFunction, centreX, centreY) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunctionModule(modules, isFunction, centreX + dx, centreY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

// Fifteen bits: five of data (two ECC, three mask) and ten of BCH(15,5), the
// whole thing XORed with 0x5412 so an all-zero format is not all-light.
function formatBits(ecc, mask) {
  const data = (ecc.formatBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormatBits(modules, isFunction, ecc, mask) {
  const bits = formatBits(ecc, mask);
  const size = modules.length;

  for (let i = 0; i <= 5; i += 1) setFunctionModule(modules, isFunction, 8, i, ((bits >>> i) & 1) !== 0);
  setFunctionModule(modules, isFunction, 8, 7, ((bits >>> 6) & 1) !== 0);
  setFunctionModule(modules, isFunction, 8, 8, ((bits >>> 7) & 1) !== 0);
  setFunctionModule(modules, isFunction, 7, 8, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i += 1) setFunctionModule(modules, isFunction, 14 - i, 8, ((bits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i += 1) setFunctionModule(modules, isFunction, size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i += 1) setFunctionModule(modules, isFunction, 8, size - 15 + i, ((bits >>> i) & 1) !== 0);

  // Always dark, always at this one place. Its absence is a common symptom of
  // an encoder that drew the format areas and forgot this.
  setFunctionModule(modules, isFunction, 8, size - 8, true);
}

function drawVersionBits(modules, isFunction, version) {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i += 1) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = modules.length - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunctionModule(modules, isFunction, a, b, dark);
    setFunctionModule(modules, isFunction, b, a, dark);
  }
}

// Two columns at a time, right to left, alternating up and down, skipping the
// vertical timing column entirely.
function drawCodewords(modules, isFunction, data) {
  const size = modules.length;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && i < data.length * 8) {
          modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i += 1;
        }
        // Remaining positions past the data are left light, which is what the
        // standard's remainder bits are.
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

function applyMask(modules, isFunction, mask) {
  const fn = MASKS[mask];
  for (let y = 0; y < modules.length; y += 1) {
    for (let x = 0; x < modules.length; x += 1) {
      if (!isFunction[y][x] && fn(x, y)) modules[y][x] = !modules[y][x];
    }
  }
}

// The four penalty rules from the standard. Lower is better, and the point is
// to avoid grids a scanner finds ambiguous -- long runs, solid blocks, and
// anything that looks like a finder pattern where there is not one.
function penaltyScore(modules) {
  const size = modules.length;
  let score = 0;

  const runScore = (run) => (run >= 5 ? 3 + (run - 5) : 0);

  for (let y = 0; y < size; y += 1) {
    let run = 0;
    let colour = false;
    for (let x = 0; x < size; x += 1) {
      if (x > 0 && modules[y][x] === colour) run += 1;
      else { score += runScore(run); run = 1; colour = modules[y][x]; }
    }
    score += runScore(run);
  }
  for (let x = 0; x < size; x += 1) {
    let run = 0;
    let colour = false;
    for (let y = 0; y < size; y += 1) {
      if (y > 0 && modules[y][x] === colour) run += 1;
      else { score += runScore(run); run = 1; colour = modules[y][x]; }
    }
    score += runScore(run);
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
  }

  // 1011101 with four light modules on one side, in either orientation.
  const FINDER = [true, false, true, true, true, false, true];
  const matchesAt = (get, at, size2) => {
    for (let i = 0; i < 7; i += 1) if (get(at + i) !== FINDER[i]) return false;
    let clearBefore = true;
    let clearAfter = true;
    for (let i = 1; i <= 4; i += 1) {
      if (at - i < 0 || get(at - i)) clearBefore = false;
      if (at + 6 + i >= size2 || get(at + 6 + i)) clearAfter = false;
    }
    return clearBefore || clearAfter;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x + 7 <= size; x += 1) {
      if (matchesAt((i) => modules[y][i], x, size)) score += 40;
    }
  }
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y + 7 <= size; y += 1) {
      if (matchesAt((i) => modules[i][x], y, size)) score += 40;
    }
  }

  let dark = 0;
  for (const row of modules) for (const cell of row) if (cell) dark += 1;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;

  return score;
}

// ---------------------------------------------------------------------------
// The one entry point
// ---------------------------------------------------------------------------

function normaliseEcc(value) {
  if (!value) return ECC.M;
  if (typeof value === "object" && value.name && ECC[value.name]) return ECC[value.name];
  const key = String(value).toUpperCase();
  return ECC[key] || null;
}

// encode(data, options)
//
//   data      string, or an array of bytes, or an array of segments
//   ecc       "L" | "M" | "Q" | "H"   (default "M")
//   minVersion, maxVersion            (default 1 and 40)
//   mask      0-7, or null to pick the lowest-penalty mask (the default)
//   boostEcc  true by default: if a stronger level fits at the chosen version
//             for free, take it. It never changes the size and never costs
//             anything, so the only reason to switch it off is to prove that a
//             specific level is what came out.
//
// Returns { ok: true, size, version, ecc, mask, modules } where modules[y][x]
// is true for a dark module, or { ok: false, code, message }. It refuses rather
// than throwing, because "this string is too long for a QR code" is an ordinary
// answer a page has to show somebody, not an exceptional one.
function encode(data, options = {}) {
  const ecc = normaliseEcc(options.ecc);
  if (!ecc) return { ok: false, code: "bad_ecc", message: "Error correction must be L, M, Q or H." };

  const minVersion = options.minVersion === undefined ? MIN_VERSION : Number(options.minVersion);
  const maxVersion = options.maxVersion === undefined ? MAX_VERSION : Number(options.maxVersion);
  if (!Number.isInteger(minVersion) || !Number.isInteger(maxVersion)
    || minVersion < MIN_VERSION || maxVersion > MAX_VERSION || minVersion > maxVersion) {
    return { ok: false, code: "bad_version_range", message: "Version range must be within 1 to 40, smallest first." };
  }

  const wantedMask = options.mask === undefined || options.mask === null ? null : Number(options.mask);
  if (wantedMask !== null && (!Number.isInteger(wantedMask) || wantedMask < 0 || wantedMask > 7)) {
    return { ok: false, code: "bad_mask", message: "Mask must be 0 to 7, or left unset to choose the best one." };
  }

  let segments;
  try {
    segments = Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === "object" && "mode" in data[0]
      ? data
      : makeSegments(data);
  } catch (error) {
    return { ok: false, code: "bad_segment", message: error.message };
  }

  let version = null;
  for (let candidate = minVersion; candidate <= maxVersion; candidate += 1) {
    if (segmentBitLength(segments, candidate) <= dataCodewords(candidate, ecc) * 8) {
      version = candidate;
      break;
    }
  }
  if (version === null) {
    return {
      ok: false,
      code: "too_long",
      message: `That is too long for a version ${maxVersion} code at error correction ${ecc.name}.`
    };
  }

  // Free upgrade: same version, stronger recovery. Checked in ascending order
  // so the strongest that still fits wins.
  let chosenEcc = ecc;
  if (options.boostEcc !== false) {
    const bits = segmentBitLength(segments, version);
    for (const level of [ECC.M, ECC.Q, ECC.H]) {
      if (level.ordinal > chosenEcc.ordinal && bits <= dataCodewords(version, level) * 8) chosenEcc = level;
    }
  }

  const codewords = addEccAndInterleave(buildDataCodewords(segments, version, chosenEcc), version, chosenEcc);

  const size = version * 4 + 17;
  const modules = createGrid(size, false);
  const isFunction = createGrid(size, false);
  drawFunctionPatterns(modules, isFunction, version, chosenEcc);
  drawCodewords(modules, isFunction, codewords);

  let mask = wantedMask;
  if (mask === null) {
    let best = Infinity;
    for (let candidate = 0; candidate < 8; candidate += 1) {
      applyMask(modules, isFunction, candidate);
      drawFormatBits(modules, isFunction, chosenEcc, candidate);
      const score = penaltyScore(modules);
      if (score < best) { best = score; mask = candidate; }
      applyMask(modules, isFunction, candidate);
    }
  }
  applyMask(modules, isFunction, mask);
  drawFormatBits(modules, isFunction, chosenEcc, mask);

  return { ok: true, size, version, ecc: chosenEcc.name, mask, modules };
}

module.exports = {
  encode,
  ECC,
  MIN_VERSION,
  MAX_VERSION,
  ALPHANUMERIC,
  makeSegments,
  makeNumericSegment,
  makeAlphanumericSegment,
  makeByteSegment,
  dataCodewords,
  rawDataModules,
  alignmentPatternPositions,
  formatBits,
  penaltyScore,
  reedSolomonDivisor,
  reedSolomonRemainder,
  gfMultiply
};
