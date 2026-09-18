"use strict";

// The exact byte offset where a buffer stops being UTF-8, or -1.
//
// Extracted because two checks need it and because the two approximations tried
// first were both wrong in ways that mattered.
//
// 1. `buffer.toString("utf8").indexOf("�")` gives a CHARACTER index. Any
//    multi-byte character earlier in the file shifts it, so the number points
//    at the wrong place in the file it is telling you to go and look at.
//
// 2. Decoding successive prefixes with `TextDecoder({ fatal: true })` and
//    allowing three more bytes to "rescue" a split character overshoots: random
//    padding bytes at the boundary can themselves form a valid continuation, so
//    the first reported failure lands past the real one. Measured 18 September
//    2026 against a file capped at exactly 393216 bytes -- it reported 393218,
//    which was enough to miss an equality test on the known write cap and
//    suppress the diagnostic that names the bug.
//
// So this walks the encoding, which is the only way to get the answer exactly.
// Table-driven from RFC 3629: the ranges below exclude overlong encodings
// (0xC0/0xC1), surrogates (0xED 0xA0..0xBF), and anything past U+10FFFF
// (0xF5..0xFF).

export function firstInvalidUtf8Byte(bytes) {
  const length = bytes.length;
  let i = 0;

  while (i < length) {
    const byte = bytes[i];

    // 0xxxxxxx -- ASCII.
    if (byte <= 0x7f) {
      i += 1;
      continue;
    }

    // A continuation byte cannot start a sequence.
    if (byte <= 0xbf) return i;

    let needed;
    let lowerSecond = 0x80;
    let upperSecond = 0xbf;

    if (byte >= 0xc2 && byte <= 0xdf) {
      needed = 1;
    } else if (byte === 0xe0) {
      // 0xE0 0x80..0x9F would be an overlong encoding of a 2-byte character.
      needed = 2;
      lowerSecond = 0xa0;
    } else if (byte === 0xed) {
      // 0xED 0xA0..0xBF is the UTF-16 surrogate range, which is not a character.
      needed = 2;
      upperSecond = 0x9f;
    } else if (byte >= 0xe1 && byte <= 0xef) {
      needed = 2;
    } else if (byte === 0xf0) {
      // 0xF0 0x80..0x8F would be overlong.
      needed = 3;
      lowerSecond = 0x90;
    } else if (byte === 0xf4) {
      // 0xF4 0x90..0xBF is past U+10FFFF.
      needed = 3;
      upperSecond = 0x8f;
    } else if (byte >= 0xf1 && byte <= 0xf3) {
      needed = 3;
    } else {
      // 0xC0, 0xC1, 0xF5..0xFF never appear in valid UTF-8.
      return i;
    }

    // A sequence running off the end is truncation, not an invalid byte, and the
    // lead byte is where it goes wrong.
    if (i + needed >= length) return i;

    const second = bytes[i + 1];
    if (second < lowerSecond || second > upperSecond) return i;

    for (let k = 2; k <= needed; k += 1) {
      const continuation = bytes[i + k];
      if (continuation < 0x80 || continuation > 0xbf) return i;
    }

    i += needed + 1;
  }

  return -1;
}
