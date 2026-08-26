"use strict";

// Reading an MP4/M4A far enough to say what it is.
//
// The backend is asked for a stereo M4A. This checks that what came back
// actually is one, before it is written to disk and offered to a browser with
// `audio/mp4` on it. Serving a JSON error page as audio produces a play button
// that does nothing and gives the person no clue why.
//
// ## It says "I could not tell" rather than guessing
//
// `channels` is a number **or null**. A file whose `stsd` box this cannot find
// is not a mono file; it is a file this could not read. Reporting it as mono --
// or, worse, as stereo -- would be a fact invented to fill a field, which is
// the failure mode this codebase keeps finding. The one thing checked strictly
// is the `ftyp` box, because that is what makes it an MP4 at all.
//
// ## Layout, for the offsets below
//
// Every box is `uint32 size` then 4 ASCII bytes of type, and `moov`, `trak`,
// `mdia`, `minf`, `stbl` are containers whose payload is more boxes. `stsd` is
// a full box: 4 bytes of version+flags, then `uint32 entry_count`, then the
// sample entries. An audio sample entry (`mp4a`) is 8 bytes of header, 6
// reserved, 2 data_reference_index, then 8 reserved, then `uint16 channelcount`
// -- offset 24 from the start of the box -- `uint16 samplesize`, 4 skipped, and
// a 16.16 fixed-point sample rate whose whole part is the rate. Those offsets
// were checked by building a file byte by byte and reading it back, not by
// reasoning about the specification.

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "udta"]);
const AUDIO_ENTRIES = new Set(["mp4a", "alac", "Opus", "ec-3", "ac-3"]);

function boxes(buffer, start, end) {
  const found = [];
  let at = start;
  while (at + 8 <= end) {
    let size = buffer.readUInt32BE(at);
    const type = buffer.toString("latin1", at + 4, at + 8);
    let headerSize = 8;
    if (size === 1) {
      // 64-bit size. Rare, but a long song is not that rare.
      if (at + 16 > end) break;
      const large = buffer.readBigUInt64BE(at + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(large);
      headerSize = 16;
    } else if (size === 0) {
      // "to end of file", per the specification.
      size = end - at;
    }
    if (size < headerSize || at + size > end) break;
    found.push({ type, start: at, end: at + size, bodyStart: at + headerSize });
    at += size;
  }
  return found;
}

function findBox(buffer, type, start, end, depth = 0) {
  if (depth > 8) return null;
  for (const box of boxes(buffer, start, end)) {
    if (box.type === type) return box;
    if (CONTAINERS.has(box.type)) {
      const inner = findBox(buffer, type, box.bodyStart, box.end, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

/**
 * Describe an MP4 buffer.
 *
 * `{ ok, brand, codec, channels, sampleRate, problem }`. `ok` is only about it
 * being a readable MP4; `channels` being null is not a failure, it is an
 * unknown, and the caller decides what to do about that.
 */
function describe(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const blank = { channels: null, sampleRate: null, brand: null, codec: null };
  if (bytes.length < 16) {
    return { ok: false, problem: `Only ${bytes.length} bytes came back, which is not an audio file.`, ...blank };
  }
  if (bytes.toString("latin1", 4, 8) !== "ftyp") {
    const looksLikeText = bytes.subarray(0, 200)
      .every((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127));
    return {
      ok: false,
      ...blank,
      problem: looksLikeText
        ? `That is not an MP4 file. It begins: ${JSON.stringify(bytes.toString("utf8", 0, 120))}`
        : "That is not an MP4 file: it has no ftyp box."
    };
  }

  const brand = bytes.toString("latin1", 8, 12).trim();
  const moov = findBox(bytes, "moov", 0, bytes.length);
  if (!moov) {
    return {
      ok: false, brand, codec: null, channels: null, sampleRate: null,
      // A streamed MP4 can carry moov at the end, so this is a real possibility
      // rather than only a corrupt file -- but either way there is nothing to
      // read here.
      problem: "This MP4 has no moov box, so nothing can be said about what is in it."
    };
  }

  const stsd = findBox(bytes, "stsd", moov.bodyStart, moov.end);
  if (!stsd || stsd.bodyStart + 8 > stsd.end) {
    return { ok: true, brand, codec: null, channels: null, sampleRate: null, problem: "" };
  }

  // version+flags, then entry_count, then the entries.
  const entries = boxes(bytes, stsd.bodyStart + 8, stsd.end);
  const audio = entries.find((entry) => AUDIO_ENTRIES.has(entry.type));
  if (!audio || audio.start + 36 > audio.end) {
    return { ok: true, brand, codec: audio ? audio.type : null, channels: null, sampleRate: null, problem: "" };
  }

  return {
    ok: true,
    brand,
    codec: audio.type,
    channels: bytes.readUInt16BE(audio.start + 24),
    sampleRate: bytes.readUInt16BE(audio.start + 32),
    problem: ""
  };
}

/**
 * What to say about a file before storing it.
 *
 * Refuses anything that is not an MP4. Does **not** refuse a file whose channel
 * count could not be read, and does not refuse mono -- it reports it. The owner
 * asked for stereo, and a backend that quietly returns mono is worth saying out
 * loud on the song page; it is not worth throwing away a song somebody waited
 * three minutes for.
 */
function check(buffer) {
  const described = describe(buffer);
  if (!described.ok) return { ok: false, notes: [], ...described };
  const notes = [];
  if (described.channels === 1) notes.push("This came back mono rather than stereo.");
  if (described.channels === null) notes.push("The channel count could not be read from this file.");
  return { ok: true, ...described, notes };
}

module.exports = { describe, check, boxes, findBox };
