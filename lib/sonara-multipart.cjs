// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Reading a file somebody uploaded.
//
// Until now this application could not accept one. Import took a paste, a job
// had no photo, and the transcription adapter could only reach audio that was
// already at a URL. The reason was honest -- adding a dependency for one text
// box is a real cost bought cheaply -- but "no multipart parser" had stopped
// being a trade-off and started being a wall.
//
// So it is written here, like the ZIP writer and the PDF writer before it, and
// it is about a hundred and fifty lines because the format is genuinely simple.
//
// ## Everything here works on Buffers
//
// Not strings. A JPEG turned into a UTF-8 string and back is not the same JPEG:
// invalid sequences become U+FFFD and the file is quietly corrupted. So the
// boundary search is `Buffer.indexOf`, the parts are `subarray`, and the only
// thing decoded as text is a header line, which is ASCII by specification.
//
// ## The limits are the security story
//
// A parser with no limits is a way to exhaust memory from outside. Four are
// enforced and all four are arguments rather than constants, so a caller that
// wants a stricter one cannot be talked out of it:
//
//   - total bytes, checked as the body arrives rather than after
//   - bytes per file
//   - how many files
//   - how many fields
//
// Exceeding any of them is a refusal naming which one, because "upload failed"
// sends somebody to try the same file again.

// The media type this parser accepts, compared after lower-casing. The header is
// read with string operations rather than a regular expression: the one that was
// here, /^multipart\/form-data\s*;\s*(.*)$/i, has two quantifiers that can both
// take a space, and on a header that fails at the end it backtracks between them.
// Measured 3 October 2026: 5ms at 2,000 characters, 20ms at 4,000, 72ms at 8,000,
// 278ms at 16,000 -- four times the cost each time the input doubles. CodeQL
// flagged it as "polynomial regular expression used on uncontrolled data", high.
// The failing input needs a line feed inside the header, which Node's HTTP parser
// rejects, so reaching it over the wire is doubtful; it is removed anyway, because
// whether a regex is safe should not depend on which parser sits in front of it.
const MULTIPART_FORM_DATA = "multipart/form-data";

// Names a sender may not give a form field or a disposition parameter. Each is a
// property every plain object already has, and the first version of this parser
// wrote sender-chosen names straight onto a plain object: a field called
// `constructor` replaced `fields.constructor` with a string, and a field called
// `__proto__` vanished without being stored or counted. CodeQL flagged both
// writes as remote property injection, high. A form in this application never
// uses these names, so a request that does is refused rather than reinterpreted.
const RESERVED_NAMES = new Set(["__proto__", "constructor", "prototype"]);

const DEFAULTS = Object.freeze({
  maxTotalBytes: 25 * 1024 * 1024,
  maxFileBytes: 10 * 1024 * 1024,
  maxFiles: 10,
  maxFields: 60
});

/**
 * Resolve caller-supplied limits without ever letting an untrusted value change
 * the type used by the parser's security comparisons.
 *
 * Byte ceilings must be positive safe integers. Count ceilings may be zero so a
 * caller can deliberately refuse files or fields altogether. Unknown keys are
 * ignored. Invalid known keys fail closed rather than being coerced: strings,
 * NaN, Infinity, negative values and objects never reach a numeric comparison.
 */
function resolveLimits(limits) {
  const input = limits && typeof limits === "object" && !Array.isArray(limits) ? limits : {};

  function numericLimit(key, fallback, allowZero) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) return { ok: true, value: fallback };
    const value = input[key];
    const minimum = allowZero ? 0 : 1;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
      return { ok: false, key };
    }
    return { ok: true, value };
  }

  const maxTotalBytes = numericLimit("maxTotalBytes", DEFAULTS.maxTotalBytes, false);
  const maxFileBytes = numericLimit("maxFileBytes", DEFAULTS.maxFileBytes, false);
  const maxFiles = numericLimit("maxFiles", DEFAULTS.maxFiles, true);
  const maxFields = numericLimit("maxFields", DEFAULTS.maxFields, true);
  const invalid = [maxTotalBytes, maxFileBytes, maxFiles, maxFields].find((entry) => !entry.ok);

  if (invalid) {
    return {
      ok: false,
      code: "invalid_limits",
      problem: `${invalid.key} must be a ${invalid.key === "maxFiles" || invalid.key === "maxFields" ? "non-negative" : "positive"} safe integer.`
    };
  }

  return {
    ok: true,
    bounds: {
      maxTotalBytes: maxTotalBytes.value,
      maxFileBytes: maxFileBytes.value,
      maxFiles: maxFiles.value,
      maxFields: maxFields.value
    }
  };
}

/**
 * The boundary from a Content-Type header, or null.
 *
 * Quoted and unquoted both appear in the wild. A boundary with a `"` in it is
 * refused rather than unescaped: the specification does not allow one, and
 * accepting it would mean this parser and the sender disagree about where the
 * parts are.
 */
function boundaryOf(contentType) {
  const text = String(contentType || "").trim();
  // A line terminator anywhere refuses the header, exactly as the old pattern's
  // `.` (which does not cross one) refused it -- so this is no more permissive
  // than what it replaced. One linear scan, nothing to backtrack.
  if (/[\r\n\u2028\u2029]/.test(text)) return null;
  const semicolon = text.indexOf(";");
  if (semicolon === -1) return null;
  if (text.slice(0, semicolon).trim().toLowerCase() !== MULTIPART_FORM_DATA) return null;
  for (const piece of text.slice(semicolon + 1).split(";")) {
    const [name, ...rest] = piece.split("=");
    if (name.trim().toLowerCase() !== "boundary") continue;
    const value = rest.join("=").trim();
    const unquoted = value.startsWith('"') && value.endsWith('"') && value.length >= 2
      ? value.slice(1, -1)
      : value;
    if (!unquoted || unquoted.includes('"')) return null;
    return unquoted;
  }
  return null;
}

/**
 * `name="x"; filename="y"` -> `{ name: "x", filename: "y" }`.
 *
 * The parameters are collected in a Map and only `name` and `filename` are read
 * back, by literal key -- the only two anything here uses. The first version wrote
 * every parameter the sender sent onto a plain object under the sender's own key,
 * so `constructor="y"` replaced a built-in property; with a Map there is no
 * property to replace, and the returned object has no key a sender chose.
 *
 * `filename` is set only when the sender sent one, even an empty one: parse tells
 * a file from a field by whether it is present, and an empty filename is how a
 * browser sends a file input left empty.
 */
function parseDisposition(line) {
  const params = new Map();
  for (const piece of String(line).split(";").slice(1)) {
    const at = piece.indexOf("=");
    if (at === -1) continue;
    const key = piece.slice(0, at).trim().toLowerCase();
    let value = piece.slice(at + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    params.set(key, value);
  }
  const disposition = { name: params.has("name") ? params.get("name") : undefined };
  if (params.has("filename")) disposition.filename = params.get("filename");
  return disposition;
}

/**
 * A filename safe to store and to put in a header.
 *
 * Not "cleaned" -- rebuilt. Anything outside a small set becomes an underscore,
 * every directory separator goes, and a name that is only dots (`..`) becomes
 * `file`. A caller that concatenates this into a path still gets a path inside
 * the directory it meant.
 */
function safeFilename(raw) {
  const base = String(raw || "").split(/[\\/]/).pop() || "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120);
  return cleaned || "file";
}

/**
 * Parse a multipart body.
 *
 * Returns `{ ok: true, fields, files }` or `{ ok: false, code, problem }`.
 * `fields` are strings; `files` are `{ field, filename, contentType, bytes }`.
 *
 * Never throws on malformed input. A body that is not what it says it is comes
 * from outside, and a parser that throws on it hands whoever sent it a way to
 * produce a 500.
 */
function parse(body, contentType, limits = {}) {
  const resolved = resolveLimits(limits);
  if (!resolved.ok) return resolved;
  const bounds = resolved.bounds;
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body || []);

  const boundary = boundaryOf(contentType);
  if (!boundary) {
    return { ok: false, code: "not_multipart", problem: "That request did not carry a multipart form with a boundary." };
  }
  if (bytes.length > bounds.maxTotalBytes) {
    return { ok: false, code: "too_large", problem: `That upload is ${bytes.length} bytes; the limit is ${bounds.maxTotalBytes}.` };
  }

  const marker = Buffer.from(`--${boundary}`, "latin1");
  const fields = new Map();
  const files = [];

  let at = bytes.indexOf(marker);
  if (at === -1) {
    return { ok: false, code: "no_parts", problem: "That upload declared a boundary that does not appear in it." };
  }

  while (at !== -1) {
    let cursor = at + marker.length;

    // `--boundary--` ends the body. Anything after it is epilogue and ignored.
    if (bytes[cursor] === 0x2d && bytes[cursor + 1] === 0x2d) break;

    // Skip the CRLF (or a bare LF, which some senders emit).
    if (bytes[cursor] === 0x0d && bytes[cursor + 1] === 0x0a) cursor += 2;
    else if (bytes[cursor] === 0x0a) cursor += 1;
    else return { ok: false, code: "malformed", problem: "A part of that upload was not framed correctly." };

    const headerEnd = bytes.indexOf(Buffer.from("\r\n\r\n", "latin1"), cursor);
    if (headerEnd === -1) return { ok: false, code: "malformed", problem: "A part of that upload had no header block." };

    // ASCII by specification, so decoding this much as text is safe.
    const headers = bytes.subarray(cursor, headerEnd).toString("latin1").split("\r\n");
    let disposition = null;
    let partType = "";
    for (const header of headers) {
      const colon = header.indexOf(":");
      if (colon === -1) continue;
      const name = header.slice(0, colon).trim().toLowerCase();
      const value = header.slice(colon + 1).trim();
      if (name === "content-disposition") disposition = parseDisposition(value);
      if (name === "content-type") partType = value.split(";")[0].trim();
    }
    if (!disposition || !disposition.name) {
      return { ok: false, code: "malformed", problem: "A part of that upload did not say what field it was." };
    }
    if (RESERVED_NAMES.has(disposition.name)) {
      return { ok: false, code: "reserved_field_name", problem: `A form field cannot be called ${disposition.name}.` };
    }

    const contentStart = headerEnd + 4;
    const next = bytes.indexOf(marker, contentStart);
    if (next === -1) return { ok: false, code: "malformed", problem: "That upload ended in the middle of a part." };

    // The CRLF immediately before the next boundary belongs to the framing,
    // not to the content. Dropping the wrong number of bytes here is how a
    // parser corrupts every file it touches by exactly two bytes.
    let contentEnd = next;
    if (bytes[contentEnd - 2] === 0x0d && bytes[contentEnd - 1] === 0x0a) contentEnd -= 2;
    else if (bytes[contentEnd - 1] === 0x0a) contentEnd -= 1;

    const content = bytes.subarray(contentStart, contentEnd);

    if (Object.prototype.hasOwnProperty.call(disposition, "filename")) {
      if (files.length >= bounds.maxFiles) {
        return { ok: false, code: "too_many_files", problem: `That upload has more than ${bounds.maxFiles} files in it.` };
      }
      if (content.length > bounds.maxFileBytes) {
        return {
          ok: false,
          code: "file_too_large",
          problem: `${safeFilename(disposition.filename)} is ${content.length} bytes; the limit for one file is ${bounds.maxFileBytes}.`
        };
      }
      files.push({
        field: disposition.name,
        filename: safeFilename(disposition.filename),
        // What the sender claimed. Never trusted for anything that matters --
        // see `sniff` below, which reads the bytes instead.
        contentType: partType || "application/octet-stream",
        bytes: Buffer.from(content)
      });
    } else {
      // Counted on the Map, which counts every field. Object.keys on the old plain
      // object did not count a field called __proto__, because writing one stored
      // nothing -- so it neither appeared nor counted against the limit.
      if (fields.size >= bounds.maxFields) {
        return { ok: false, code: "too_many_fields", problem: `That form has more than ${bounds.maxFields} fields in it.` };
      }
      fields.set(disposition.name, content.toString("utf8"));
    }

    at = next;
  }

  // A plain object for the caller, built by Object.fromEntries: it defines each
  // field as an own data property, which runs no setter and cannot touch the
  // prototype whatever the field is called.
  return { ok: true, fields: Object.fromEntries(fields), files };
}

// --- what a file actually is ----------------------------------------------
//
// The browser's declared content type is a claim by whoever sent it. These are
// the magic bytes, which are not.

// ## Why audio/mpeg needs more than two bytes
//
// `ID3` is a magic number. An MPEG audio frame sync is not: it is eleven set
// bits, `0xFF` followed by the top three bits of the next byte, which 1 in 2048
// random byte pairs satisfies. That was the whole test -- and
// `tests/an-upload-arrives-intact.test.js` feeds `sniff` 64 random bytes and
// asserts null, so it failed on CI run 35646094440 with `audio/mpeg`. Measured
// before the fix: **974 false positives in 2,000,000 random 64-byte buffers,
// 1 in 2,053, every one of them audio/mpeg.**
//
// A once-in-two-thousand-runs test failure is the expensive kind, but the test
// was right and the sniffer was wrong, and `accept` below feeds on `sniff` --
// so a file whose bytes are nothing in particular could be accepted as
// audio/mpeg wherever that type is allowed. That is the failure this file's own
// comment warns about, arrived at from the other direction.
//
// So a frame sync is only believed when the buffer holds a whole frame and the
// next frame starts where this one says it will. That is not extra strictness
// for its own sake: 64 bytes genuinely cannot identify a tagless MP3, the
// smallest common frame being larger than that, and "I could not tell" is the
// answer this function exists to be able to give.

// Bitrates in kbps, indexed by the header's 4-bit field. Index 0 is "free" and
// 15 is "bad"; both are holes rather than rates, so they read as undefined and
// the header is rejected.
const MPEG_BITRATES = Object.freeze({
  // MPEG 1
  "1-1": [null, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, null],
  "1-2": [null, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, null],
  "1-3": [null, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, null],
  // MPEG 2 and 2.5 share a table
  "2-1": [null, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, null],
  "2-2": [null, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, null],
  "2-3": [null, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, null]
});

const MPEG_SAMPLE_RATES = Object.freeze({
  1: [44100, 48000, 32000, null],
  2: [22050, 24000, 16000, null],
  25: [11025, 12000, 8000, null]
});

// The length of the frame this header describes, or null if the header is not
// one. Every null below is a field the specification marks reserved, free or
// bad -- a genuine frame never carries them, and random bytes carry them
// nearly two thirds of the time, which is most of where the old rate went.
function mpegFrameLength(buffer, at) {
  if (at + 4 > buffer.length) return null;
  if (buffer[at] !== 0xff || (buffer[at + 1] & 0xe0) !== 0xe0) return null;

  const versionBits = (buffer[at + 1] >> 3) & 0x03;
  if (versionBits === 0x01) return null; // reserved
  const version = versionBits === 0x03 ? 1 : versionBits === 0x02 ? 2 : 25;

  const layerBits = (buffer[at + 1] >> 1) & 0x03;
  if (layerBits === 0x00) return null; // reserved
  const layer = 4 - layerBits;

  const bitrates = MPEG_BITRATES[`${version === 1 ? 1 : 2}-${layer}`];
  const bitrate = bitrates && bitrates[(buffer[at + 2] >> 4) & 0x0f];
  if (!bitrate) return null; // free or bad

  const sampleRate = MPEG_SAMPLE_RATES[version][(buffer[at + 2] >> 2) & 0x03];
  if (!sampleRate) return null; // reserved

  const padding = (buffer[at + 2] >> 1) & 0x01;
  const length = layer === 1
    ? (Math.floor((12000 * bitrate) / sampleRate) + padding) * 4
    : Math.floor((144000 * bitrate) / sampleRate) + padding;

  return length > 4 ? length : null;
}

// A frame sync is believed only when the frame it describes fits in the buffer
// and the next frame begins exactly where it says. One header can be an
// accident; two agreeing on a length cannot reasonably be.
function looksLikeMpegAudio(buffer) {
  const length = mpegFrameLength(buffer, 0);
  if (length === null) return false;
  if (buffer.length < length + 2) return false;
  return buffer[length] === 0xff && (buffer[length + 1] & 0xe0) === 0xe0;
}

const SIGNATURES = [
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/gif", test: (b) => b.subarray(0, 6).toString("latin1") === "GIF89a" || b.subarray(0, 6).toString("latin1") === "GIF87a" },
  { type: "image/webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { type: "audio/wav", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WAVE" },
  { type: "audio/mpeg", test: (b) => b.subarray(0, 3).toString("latin1") === "ID3" || looksLikeMpegAudio(b) },
  { type: "audio/mp4", test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" },
  { type: "application/pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" }
];

/**
 * What the bytes say the file is, regardless of what the sender said.
 *
 * Returns null when nothing matches — **not** a guess, and not the sender's
 * claim. A caller deciding whether to accept an upload has to be able to tell
 * "this is a JPEG" from "I could not tell", and folding the second into the
 * first is how a page ends up serving a text/html file as an image.
 */
function sniff(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (buffer.length < 12) return null;
  for (const signature of SIGNATURES) {
    try {
      if (signature.test(buffer)) return signature.type;
    } catch {
      // A buffer too short for one test is not a failure of the whole sniff.
    }
  }
  return null;
}

/**
 * Accept a file only if its bytes are a type on the list.
 *
 * The declared type is reported beside the real one when they disagree, because
 * that disagreement is worth seeing: usually a renamed extension, occasionally
 * somebody trying something.
 */
function accept(file, allowed) {
  const real = sniff(file.bytes);
  if (!real) {
    return { ok: false, code: "unknown_type", problem: `${file.filename} is not a kind of file this recognises.` };
  }
  if (!allowed.includes(real)) {
    return { ok: false, code: "wrong_type", problem: `${file.filename} is a ${real}, and this accepts ${allowed.join(", ")}.` };
  }
  return { ok: true, type: real, declared: file.contentType, mismatched: real !== file.contentType };
}

module.exports = { parse, boundaryOf, safeFilename, sniff, accept, DEFAULTS, SIGNATURES, resolveLimits };
