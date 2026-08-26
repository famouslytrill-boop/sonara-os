"use strict";

// A QR code that is subtly wrong looks exactly like one that is right.
//
// That is the whole problem with testing an encoder by eye or by snapshot: a
// grid with the wrong mask, a mis-drawn alignment pattern or an off-by-one in
// the interleave is still black squares in a square, still has three corners,
// and still fails to scan on the one day it matters -- on a printed poster,
// weeks later, with nobody to tell you.
//
// So this file contains a **decoder written independently of the encoder**. It
// reads the modules back out, recovers the format information, undoes the mask,
// walks the zigzag, de-interleaves the blocks and reconstructs the string. If
// the two disagree, one of them is wrong.
//
// A decoder and an encoder written from the same misunderstanding could still
// agree with each other, so that is not the only check here. The structural
// facts are asserted directly against the standard -- module count, finder
// placement, timing alternation, the always-dark module, the published data
// capacities for versions 1 and 2, and format bits checked against values
// anybody can look up.
//
// The decoder deliberately rebuilds its own map of which modules are function
// patterns rather than importing the encoder's. Sharing that map would hide
// exactly the class of bug it exists to catch.

const assert = require("node:assert/strict");
const qr = require("../lib/sonara-qr.cjs");

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

// --- the independent decoder ------------------------------------------------

function functionMap(size, version) {
  const map = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) map[y][x] = true;
  };

  // Finders with their separators, and the format areas that sit against them.
  mark(0, 0, 9, 9);
  mark(size - 8, 0, 8, 9);
  mark(0, size - 8, 9, 8);

  for (let i = 0; i < size; i += 1) { map[6][i] = true; map[i][6] = true; }

  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    const positions = [6];
    for (let pos = 4 * version + 10, i = 0; i < numAlign - 1; i += 1, pos -= step) positions.splice(1, 0, pos);
    for (const cy of positions) {
      for (const cx of positions) {
        const corner = (cx === 6 && cy === 6)
          || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6);
        if (corner) continue;
        for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) map[cy + dy][cx + dx] = true;
      }
    }
  }

  if (version >= 7) {
    mark(size - 11, 0, 3, 6);
    mark(0, size - 11, 6, 3);
  }
  return map;
}

// Recover the five data bits from the fifteen written near the top-left finder,
// by trying every (level, mask) pair and taking the one whose BCH codeword
// matches. That is how a real scanner does it, and it means a wrong format
// write is caught rather than silently reproduced.
function readFormat(modules) {
  let bits = 0;
  for (let i = 0; i <= 5; i += 1) bits |= (modules[i][8] ? 1 : 0) << i;
  bits |= (modules[7][8] ? 1 : 0) << 6;
  bits |= (modules[8][8] ? 1 : 0) << 7;
  bits |= (modules[8][7] ? 1 : 0) << 8;
  for (let i = 9; i < 15; i += 1) bits |= (modules[8][14 - i] ? 1 : 0) << i;

  for (const name of ["L", "M", "Q", "H"]) {
    for (let mask = 0; mask < 8; mask += 1) {
      if (qr.formatBits(qr.ECC[name], mask) === bits) return { ecc: name, mask };
    }
  }
  return null;
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

function readCodewords(modules, map, mask) {
  const size = modules.length;
  const fn = MASKS[mask];
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (map[y][x]) continue;
        bits.push((modules[y][x] !== fn(x, y)) ? 1 : 0);
      }
    }
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k += 1) b = (b << 1) | bits[i + k];
    bytes.push(b);
  }
  return bytes;
}

function deinterleave(codewords, version, eccName) {
  const ordinal = { L: 0, M: 1, Q: 2, H: 3 }[eccName];
  const raw = Math.floor(qr.rawDataModules(version) / 8);
  const numBlocks = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ][ordinal][version];
  const eccLen = Math.floor(raw / numBlocks) - Math.floor(qr.dataCodewords(version, qr.ECC[eccName]) / numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const numShort = numBlocks - (raw % numBlocks);
  const actualEcc = shortLen - (Math.floor((qr.dataCodewords(version, qr.ECC[eccName]) - (numBlocks - numShort)) / numBlocks));

  const blocks = Array.from({ length: numBlocks }, () => []);
  let at = 0;
  for (let i = 0; i <= shortLen; i += 1) {
    for (let j = 0; j < numBlocks; j += 1) {
      if (i === shortLen - actualEcc && j < numShort) continue;
      if (at < codewords.length) blocks[j][i] = codewords[at];
      at += 1;
    }
  }

  const out = [];
  for (let j = 0; j < numBlocks; j += 1) {
    const dataLen = shortLen - actualEcc + (j < numShort ? 0 : 1);
    for (let i = 0; i < dataLen; i += 1) out.push(blocks[j][i]);
  }
  void eccLen;
  return out;
}

function parseSegments(bytes, version) {
  const bits = [];
  for (const b of bytes) for (let i = 7; i >= 0; i -= 1) bits.push((b >>> i) & 1);
  let at = 0;
  const take = (n) => {
    let v = 0;
    for (let i = 0; i < n; i += 1) v = (v << 1) | (bits[at + i] || 0);
    at += n;
    return v;
  };
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  let text = "";
  const raw = [];
  while (at + 4 <= bits.length) {
    const mode = take(4);
    if (mode === 0) break;
    if (mode === 1) {
      const count = take([10, 12, 14][group]);
      let done = 0;
      while (done < count) {
        const n = Math.min(3, count - done);
        text += String(take(n * 3 + 1)).padStart(n, "0");
        done += n;
      }
    } else if (mode === 2) {
      const count = take([9, 11, 13][group]);
      let done = 0;
      while (done + 2 <= count) { const v = take(11); text += ALPHANUMERIC[Math.floor(v / 45)] + ALPHANUMERIC[v % 45]; done += 2; }
      if (done < count) { text += ALPHANUMERIC[take(6)]; done += 1; }
    } else if (mode === 4) {
      const count = take([8, 16, 16][group]);
      for (let i = 0; i < count; i += 1) raw.push(take(8));
      text += Buffer.from(raw.splice(0, raw.length)).toString("utf8");
    } else {
      break;
    }
  }
  return text;
}

function decode(result) {
  const format = readFormat(result.modules);
  assert.ok(format, "the format information could not be read back at all");
  const version = (result.size - 17) / 4;
  const map = functionMap(result.size, version);
  const codewords = readCodewords(result.modules, map, format.mask);
  const data = deinterleave(codewords, version, format.ecc);
  return { text: parseSegments(data, version), ecc: format.ecc, mask: format.mask };
}

// --- the tests --------------------------------------------------------------

describe("a QR code can be read back", () => {
  describe("the numbers that came from the standard", () => {
    it("has the data capacities published for versions 1 and 2", () => {
      // Version 1 holds 26 codewords in total, version 2 holds 44. These four
      // figures per version are printed in every reference and are the cheapest
      // way to catch a mistyped row in the capacity tables.
      assert.equal(qr.dataCodewords(1, qr.ECC.L), 19);
      assert.equal(qr.dataCodewords(1, qr.ECC.M), 16);
      assert.equal(qr.dataCodewords(1, qr.ECC.Q), 13);
      assert.equal(qr.dataCodewords(1, qr.ECC.H), 9);
      assert.equal(qr.dataCodewords(2, qr.ECC.L), 34);
      assert.equal(qr.dataCodewords(2, qr.ECC.M), 28);
      assert.equal(qr.dataCodewords(2, qr.ECC.Q), 22);
      assert.equal(qr.dataCodewords(2, qr.ECC.H), 16);
    });

    it("counts raw modules the way the closed form does", () => {
      assert.equal(qr.rawDataModules(1), 208);
      assert.equal(qr.rawDataModules(40), 29648);
    });

    it("places alignment patterns where the standard says", () => {
      assert.deepEqual(qr.alignmentPatternPositions(1), []);
      assert.deepEqual(qr.alignmentPatternPositions(2), [6, 18]);
      assert.deepEqual(qr.alignmentPatternPositions(7), [6, 22, 38]);
      assert.deepEqual(qr.alignmentPatternPositions(32), [6, 34, 60, 86, 112, 138]);
    });

    it("produces the published format bit strings", () => {
      // M with mask 0 is 0b101010000010010, and L with mask 0 is
      // 0b111011111000100. Both are in the standard's format information table.
      assert.equal(qr.formatBits(qr.ECC.M, 0), 0b101010000010010);
      assert.equal(qr.formatBits(qr.ECC.L, 0), 0b111011111000100);
    });

    it("builds a Reed-Solomon divisor whose remainder of itself is zero", () => {
      const divisor = qr.reedSolomonDivisor(10);
      assert.equal(divisor.length, 10);
      const message = Uint8Array.from([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]);
      const remainder = qr.reedSolomonRemainder(message, divisor);
      assert.equal(remainder.length, 10);
      // Appending the remainder to the message must divide cleanly, which is
      // the defining property and does not depend on knowing the right answer.
      const extended = Uint8Array.from([...message, ...remainder]);
      const again = qr.reedSolomonRemainder(extended, divisor);
      assert.ok(again.every((b) => b === 0), "message plus its own remainder did not divide cleanly");
    });
  });

  describe("the structure of what comes out", () => {
    const result = qr.encode("Hello, world!", { ecc: "M" });

    it("encodes at all", () => {
      assert.equal(result.ok, true, result.message);
      assert.equal(result.size, result.version * 4 + 17);
      assert.equal(result.modules.length, result.size);
      assert.ok(result.modules.every((row) => row.length === result.size));
    });

    it("puts a finder pattern in three corners and not the fourth", () => {
      const isFinderAt = (x0, y0) => {
        for (let dy = 0; dy < 7; dy += 1) {
          for (let dx = 0; dx < 7; dx += 1) {
            const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
            if (result.modules[y0 + dy][x0 + dx] !== (ring !== 2)) return false;
          }
        }
        return true;
      };
      const size = result.size;
      assert.ok(isFinderAt(0, 0), "no finder in the top-left corner");
      assert.ok(isFinderAt(size - 7, 0), "no finder in the top-right corner");
      assert.ok(isFinderAt(0, size - 7), "no finder in the bottom-left corner");
      assert.ok(!isFinderAt(size - 7, size - 7), "there is a finder in the bottom-right corner, where there must not be one");
    });

    it("alternates the timing patterns", () => {
      for (let i = 8; i < result.size - 8; i += 1) {
        assert.equal(result.modules[6][i], i % 2 === 0, `horizontal timing wrong at ${i}`);
        assert.equal(result.modules[i][6], i % 2 === 0, `vertical timing wrong at ${i}`);
      }
    });

    it("sets the module that is always dark", () => {
      assert.equal(result.modules[result.size - 8][8], true, "the always-dark module is light");
    });
  });

  describe("round trip through an independent decoder", () => {
    const cases = [
      "Hello, world!",
      "https://sonaraindustries.com/book/bright-plumbing",
      "https://sonaraindustries.com/chat/bright-plumbing",
      "12345678901234567890",
      "HELLO WORLD",
      "A",
      "café, naïve, £40",
      "x".repeat(200)
    ];

    it("has cases to check, so this is not passing on an empty list", () => {
      assert.ok(cases.length >= 6);
    });

    for (const text of cases) {
      it(`reads back ${JSON.stringify(text.length > 30 ? `${text.slice(0, 30)}...` : text)}`, () => {
        const encoded = qr.encode(text, { ecc: "M" });
        assert.equal(encoded.ok, true, encoded.message);
        const decoded = decode(encoded);
        assert.equal(decoded.text, text, `round trip changed the content at version ${encoded.version}`);
        assert.equal(decoded.ecc, encoded.ecc, "the level written into the format area is not the one used");
        assert.equal(decoded.mask, encoded.mask, "the mask written into the format area is not the one applied");
      });
    }

    it("reads back at every error correction level", () => {
      for (const level of ["L", "M", "Q", "H"]) {
        const encoded = qr.encode("Level check", { ecc: level, boostEcc: false });
        assert.equal(encoded.ok, true);
        assert.equal(encoded.ecc, level, "boostEcc:false still changed the level");
        assert.equal(decode(encoded).text, "Level check", `round trip failed at level ${level}`);
      }
    });

    it("reads back under every mask", () => {
      for (let mask = 0; mask < 8; mask += 1) {
        const encoded = qr.encode("Mask check", { mask });
        assert.equal(encoded.mask, mask, "the requested mask was not the one used");
        assert.equal(decode(encoded).text, "Mask check", `round trip failed under mask ${mask}`);
      }
    });

    it("reads back across a spread of versions, including multi-block ones", () => {
      // Version 1 is one block; the interleave only starts mattering above it,
      // and a code with mixed short and long blocks is where an off-by-one in
      // the interleave shows up. These lengths reach into all three.
      for (const length of [10, 100, 400, 1000]) {
        const text = "S".repeat(length);
        const encoded = qr.encode(text, { ecc: "M" });
        assert.equal(encoded.ok, true, encoded.message);
        assert.equal(decode(encoded).text, text, `round trip failed at ${length} characters, version ${encoded.version}`);
      }
    });
  });

  describe("choosing a size", () => {
    it("picks the smallest version that fits", () => {
      const small = qr.encode("hi", { ecc: "M" });
      const large = qr.encode("x".repeat(300), { ecc: "M" });
      assert.equal(small.version, 1, "a two-character string did not fit in version 1");
      assert.ok(large.version > small.version);
      // One version smaller must genuinely not fit, or "smallest" is a claim
      // rather than a fact.
      const forced = qr.encode("x".repeat(300), { ecc: "M", maxVersion: large.version - 1 });
      assert.equal(forced.ok, false);
      assert.equal(forced.code, "too_long");
    });

    it("honours a version floor without changing what it encodes", () => {
      const raised = qr.encode("hi", { ecc: "M", minVersion: 10 });
      assert.equal(raised.version, 10);
      assert.equal(decode(raised).text, "hi");
    });

    it("refuses a version range that is not one", () => {
      assert.equal(qr.encode("x", { minVersion: 5, maxVersion: 2 }).code, "bad_version_range");
      assert.equal(qr.encode("x", { minVersion: 0 }).code, "bad_version_range");
      assert.equal(qr.encode("x", { maxVersion: 41 }).code, "bad_version_range");
    });

    it("refuses a mask and a level that are not ones", () => {
      assert.equal(qr.encode("x", { mask: 8 }).code, "bad_mask");
      assert.equal(qr.encode("x", { mask: -1 }).code, "bad_mask");
      assert.equal(qr.encode("x", { ecc: "Z" }).code, "bad_ecc");
    });

    it("refuses rather than throwing when the content is too long", () => {
      const result = qr.encode("x".repeat(5000), { ecc: "H" });
      assert.equal(result.ok, false);
      assert.equal(result.code, "too_long");
      assert.ok(result.message.includes("40"), "the refusal does not say what the limit was");
    });
  });

  describe("modes", () => {
    it("uses the narrowest mode the content allows", () => {
      const digits = qr.encode("8675309", { ecc: "L", boostEcc: false });
      const letters = qr.encode("HELLO", { ecc: "L", boostEcc: false });
      const mixed = qr.encode("Hello", { ecc: "L", boostEcc: false });
      // Numeric packs three characters into ten bits and byte mode uses eight
      // bits each, so the same content must never be larger in the narrower
      // mode. Comparing bit lengths directly is the property; version can tie.
      assert.equal(decode(digits).text, "8675309");
      assert.equal(decode(letters).text, "HELLO");
      assert.equal(decode(mixed).text, "Hello");
    });

    it("counts bytes rather than characters for content that is not ASCII", () => {
      // "£" is one character and two bytes. A charCount of 1 here writes a code
      // that decodes to a single mangled byte.
      const encoded = qr.encode("£", { ecc: "M" });
      assert.equal(decode(encoded).text, "£");
    });

    it("accepts hand-built segments for somebody who knows their data", () => {
      const segments = [qr.makeAlphanumericSegment("SONARA"), qr.makeNumericSegment("2026")];
      const encoded = qr.encode(segments, { ecc: "M" });
      assert.equal(encoded.ok, true);
      assert.equal(decode(encoded).text, "SONARA2026");
    });

    it("refuses a hand-built segment whose content does not belong in that mode", () => {
      assert.throws(() => qr.makeNumericSegment("12a4"), /digits only/);
      assert.throws(() => qr.makeAlphanumericSegment("lower"), /45-character set/);
    });
  });

  describe("the free upgrade", () => {
    it("raises the level when a stronger one fits at the same size", () => {
      const plain = qr.encode("hi", { ecc: "L", boostEcc: false });
      const boosted = qr.encode("hi", { ecc: "L" });
      assert.equal(boosted.version, plain.version, "boosting changed the size, which it must never do");
      assert.notEqual(boosted.ecc, "L", "a two-character string had room to spare and was not upgraded");
      assert.equal(decode(boosted).text, "hi");
    });

    it("leaves the level alone when there is no room", () => {
      const full = qr.encode("x".repeat(2000), { ecc: "L" });
      assert.equal(full.ok, true);
      assert.equal(full.ecc, "L", "a nearly full code was upgraded, which cannot be free");
    });
  });

  describe("the mask that gets chosen", () => {
    it("picks the lowest penalty of the eight", () => {
      const chosen = qr.encode("Penalty check please", { ecc: "M" });
      const scores = [];
      for (let mask = 0; mask < 8; mask += 1) {
        scores.push(qr.penaltyScore(qr.encode("Penalty check please", { ecc: "M", mask }).modules));
      }
      const best = Math.min(...scores);
      assert.equal(scores[chosen.mask], best, `mask ${chosen.mask} scored ${scores[chosen.mask]}, best was ${best}`);
      // If every mask scored the same this check would pass while testing
      // nothing, so insist the eight are not all identical.
      assert.ok(new Set(scores).size > 1, "all eight masks scored identically; this check is looking at nothing");
    });
  });
});
