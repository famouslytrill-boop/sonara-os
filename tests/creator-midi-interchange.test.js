// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { PPQ, noteNumber, parseNotes, writeMidi, vlq } = require("../public/creator-project-midi.js");

const bytes = (input) => Array.from(input);
const hex = (data) => Buffer.from(data).toString("hex");
const midi = (notes, bpm = 120, channel = 1) => writeMidi({ bpm, channel, notes });

describe("Creator Studio deterministic Standard MIDI File 1.0 handoff", () => {
  it("encodes a recognized format-0 header, tempo, one note, track length, and end-of-track", () => {
    const output = midi("C4,0,480,100");
    const expected = "4d546864000000060000000101e04d54726b00000014" +
      "00ff510307a12000903c648360803c0000ff2f00";
    assert.equal(hex(output), expected);
    assert.equal(PPQ, 480);
    assert.equal(new DataView(output.buffer).getUint32(18), output.byteLength - 22);
  });

  it("sorts notes deterministically and writes note-off before note-on at same tick", () => {
    const a = midi("C4,480,480,90\nC4,0,480,100\nE4,0,240,70");
    const b = midi("E4,0,240,70\nC4,0,480,100\nC4,480,480,90");
    assert.deepEqual(bytes(a), bytes(b));
    const s = hex(a);
    assert.ok(s.includes("803c0000903c5a"), "C4 must end before C4 restarts at tick 480");
    assert.equal(a[8], 0); assert.equal(a[9], 0); // Format 0, exactly one track
  });

  it("accepts note numbers, accidentals and a maximum MIDI channel", () => {
    assert.equal(noteNumber("C4"), 60);
    assert.equal(noteNumber("A4"), 69);
    assert.equal(noteNumber("Bb4"), 70);
    assert.equal(noteNumber("F#3"), 54);
    assert.equal(noteNumber("C-1"), 0);
    assert.equal(noteNumber("G9"), 127);
    assert.equal(noteNumber(127), 127);
    assert.equal(parseNotes("60,0,240,127")[0].pitch, 60);
    assert.ok(hex(midi("G9,0,240,100", 100, 16)).includes("009f7f64"), "channel 16 note-on");
  });

  it("uses bounded MIDI variable-length tick deltas and per-file track sizing", () => {
    assert.deepEqual(vlq(0), [0]);
    assert.deepEqual(vlq(127), [127]);
    assert.deepEqual(vlq(128), [0x81, 0]);
    assert.deepEqual(vlq(480), [0x83, 0x60]);
    assert.deepEqual(vlq(0x0fffffff), [0xff, 0xff, 0xff, 0x7f]);
    assert.throws(() => vlq(0x10000000), /MIDI delta/);
    const output = midi("A4,0,128,90");
    assert.equal(new DataView(output.buffer).getUint32(18), output.byteLength - 22);
  });

  it("refuses overlapping same-pitch notes but permits different simultaneous pitches", () => {
    assert.throws(() => midi("C4,0,480,100\nC4,240,480,100"), /Overlapping notes/);
    assert.ok(midi("C4,0,480,100\nE4,0,480,90").byteLength > 30);
  });

  it("refuses untrusted or malformed note rows and out-of-range values", () => {
    for (const invalid of [
      "", "<script>alert(1)</script>,0,480,100",
      "C4,0,480", "C4,-1,480,100", "C4,0,0,100",
      "C4,0,480,0", "C4,0,480,128", "B9,0,480,100",
      "C4,122880,1,100", "C4,122879,2,100",
      "C4,0.5,480,100", "C4,0,480,100,extra",
      "C4,0000,480,100", "C4,0,480,1e3"
    ]) assert.throws(() => midi(invalid));
    assert.throws(() => midi("C4,0,480,100\n".repeat(129)), /1–128|note rows/);
    assert.throws(() => midi("C4,0,480,100".repeat(1000)), /8192/);
    assert.throws(() => midi("C4,0,480,100", 0), /Tempo BPM/);
    assert.throws(() => midi("C4,0,480,100", 241), /Tempo BPM/);
    assert.throws(() => midi("C4,0,480,100", 120, 0), /MIDI channel/);
    assert.throws(() => midi("C4,0,480,100", 120, 17), /MIDI channel/);
    assert.throws(() => writeMidi({ bpm: 120, notes: [{ pitch: 60, startTick: 0, durationTicks: 480, velocity: 100 }, { pitch: 60, startTick: 100, durationTicks: 480, velocity: 100 }] }), /Overlapping notes/);
  });

  it("is bounded to 128 entered notes and never silently truncates events", () => {
    const text = Array.from({ length: 128 }, (_, i) => `C4,${i * 480},480,100`).join("\n");
    const output = midi(text);
    assert.ok(output.byteLength > 1000);
    assert.equal(output[output.length - 4], 0);
    assert.deepEqual(bytes(output.slice(-3)), [0xff, 0x2f, 0]);
    assert.throws(() => midi(text + "\nC4,61440,480,100"), /1–128/);
  });
});
