// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { writeMidi, writeMidiFormat1 } = require("../public/creator-project-midi.js");

function parseChunks(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at) => String.fromCharCode(...bytes.slice(at, at + 4));
  assert.equal(tag(0), "MThd");
  assert.equal(v.getUint32(4), 6);
  assert.equal(v.getUint16(8), 1);
  const total = v.getUint16(10);
  assert.equal(v.getUint16(12), 480);
  let at = 14;
  const chunks = [];
  for (let i = 0; i < total; i++) {
    assert.equal(tag(at), "MTrk");
    const size = v.getUint32(at + 4);
    const end = at + 8 + size;
    assert.ok(end <= bytes.byteLength);
    chunks.push(bytes.slice(at + 8, end));
    at = end;
  }
  assert.equal(at, bytes.byteLength);
  return chunks;
}
const hex = (bytes) => Buffer.from(bytes).toString("hex");
const piano = { name: "Piano", channel: 1, notes: "C4,0,480,100\nE4,480,480,90" };
const bass = { name: "Bass", channel: 2, notes: "C2,0,960,95" };

describe("Creator Standard MIDI File Format 1 multitrack interchange", () => {
  it("exports exactly three framed MIDI tracks, one tempo conductor and two instrument tracks", () => {
    const chunks = parseChunks(writeMidiFormat1({ bpm: 120, tracks: [piano, bass] }));
    assert.equal(chunks.length, 3);
    assert.equal(hex(chunks[0]), "00ff510307a12000ff2f00");
    assert.equal(hex(chunks[1].slice(0, 10)), "00ff03055069616e6f00");
    assert.equal(hex(chunks[2].slice(0, 9)), "00ff03044261737300");
    assert.equal(hex(chunks[1].slice(-4)), "00ff2f00");
    assert.equal(hex(chunks[2].slice(-4)), "00ff2f00");
    assert.ok(hex(chunks[1]).includes("903c64"));
    assert.ok(hex(chunks[2]).includes("91245f"));
  });
  it("reuses validated MIDI Format 0 event streams without duplicating tempo in note tracks", () => {
    const chunks = parseChunks(writeMidiFormat1({ bpm: 120, tracks: [piano] }));
    const solo = writeMidi({ bpm: 120, channel: 1, notes: piano.notes });
    assert.deepEqual(Array.from(chunks[1].slice(9, -4)), Array.from(solo.slice(29, -4)));
    assert.equal(hex(chunks[1]).split("ff5103").length, 1);
  });
  it("is byte stable for repeated tracks, and preserves the supplied instrument track order", () => {
    const a = writeMidiFormat1({ bpm: 90, tracks: [piano, bass] });
    const b = writeMidiFormat1({ bpm: 90, tracks: [piano, bass] });
    assert.deepEqual(Array.from(a), Array.from(b));
    const c = writeMidiFormat1({ bpm: 90, tracks: [bass, piano] });
    assert.notDeepEqual(Array.from(a), Array.from(c));
    assert.equal(parseChunks(c).length, 3);
  });
  it("rejects invalid identities, duplicate names/channels and ambiguous notes", () => {
    for (const tracks of [[], [piano, piano], [piano, { ...bass, name: "pIaNo" }],
      [piano, { ...bass, channel: 1 }], [{ ...piano, name: "<script>" }],
      [{ ...piano, name: "áudio" }], [{ ...piano, channel: 17 }],
      [{ ...piano, notes: "" }],
      [{ ...piano, notes: "C4,0,480,90\nC4,100,480,90" }]]) {
      assert.throws(() => writeMidiFormat1({ bpm: 120, tracks }));
    }
    assert.throws(() => writeMidiFormat1({ bpm: 120, tracks: [piano, bass, {...bass, name: "Drums", channel: 3 }, {...bass, name: "Strings", channel: 4}, {...bass, name: "Fifth", channel: 5}] }), /one to four/);
    assert.throws(() => writeMidiFormat1({ bpm: 241, tracks: [piano] }), /Tempo BPM/);
  });
  it("rejects more than 128 total note events across distinct MIDI channels", () => {
    const lines = (n, pitch) => Array.from({ length: n }, (_, i) => `${pitch},${i * 480},480,100`).join("\n");
    assert.throws(() => writeMidiFormat1({ bpm: 120, tracks: [
      { name: "Melody", channel: 1, notes: lines(65, "C4") },
      { name: "Bass", channel: 2, notes: lines(64, "C2") }
    ] }), /128 total notes/);
    assert.equal(parseChunks(writeMidiFormat1({ bpm: 120, tracks: [
      { name: "Melody", channel: 1, notes: lines(64, "C4") },
      { name: "Bass", channel: 2, notes: lines(64, "C2") }
    ] })).length, 3);
  });
});
