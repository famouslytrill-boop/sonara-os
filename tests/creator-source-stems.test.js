// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { render, readWav, renderSourceStems } = require("../public/creator-project-audio.js");

function wav(value, durationMs = 10) {
  const frames = Math.round(durationMs * 8);
  const buffer = new ArrayBuffer(44 + frames * 2);
  const v = new DataView(buffer);
  const tag = (i, s) => [...s].forEach((char, j) => v.setUint8(i + j, char.charCodeAt(0)));
  tag(0, "RIFF"); v.setUint32(4, buffer.byteLength - 8, true);
  tag(8, "WAVE"); tag(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  tag(36, "data"); v.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) v.setInt16(44 + i * 2, value, true);
  return buffer;
}
const source = (id, durationMs = 10) => ({ id, kind: "source", durationMs });
const clip = (id, sourceId, startMs = 0, inMs = 0, outMs = 5, muted = false) =>
  ({ id, kind: "clip", sourceId, startMs, inMs, outMs, muted });
const graph = (nodes) => ({ version: 1, nodes });
const sample = (bytes, frame, channel = 0) => new DataView(bytes).getInt16(44 + frame * 4 + channel * 2, true);

describe("Creator Studio synchronized source stem handoff", () => {
  it("exports 48k zero-aligned source-group WAVs with matching duration and silent gaps", () => {
    const nodes = [source("sA"), source("sB"),
      clip("a1", "sA", 0, 0, 5), clip("a2", "sA", 15, 0, 5),
      clip("b1", "sB", 5, 0, 5)];
    const result = renderSourceStems(graph(nodes), { sA: wav(1000), sB: wav(2000) }, { sampleRate: 48000 });
    assert.equal(result.grouping, "source");
    assert.equal(result.durationMs, 20);
    assert.equal(result.alignedAtMs, 0);
    assert.equal(result.stems.length, 2);
    assert.deepEqual(result.stems.map((s) => [s.sourceId, s.filename]),
      [["sA", "source-stem-01.wav"], ["sB", "source-stem-02.wav"]]);
    for (const stem of result.stems) {
      const decoded = readWav(stem.bytes);
      assert.equal(decoded.rate, 48000);
      assert.equal(decoded.channels, 2);
      assert.equal(decoded.frames, 960);
      assert.equal(stem.bytes.byteLength, 44 + 960 * 4);
    }
    assert.equal(sample(result.stems[0].bytes, 0), 1000);
    assert.equal(sample(result.stems[0].bytes, 480), 0);
    assert.equal(sample(result.stems[0].bytes, 720), 1000);
    assert.equal(sample(result.stems[1].bytes, 0), 0);
    assert.equal(sample(result.stems[1].bytes, 240), 2000);
    assert.equal(sample(result.stems[1].bytes, 480), 0);
  });

  it("is stable under clip/source node reordering, with source-group labels preserved", () => {
    const nodes = [source("z"), source("a"), clip("a2", "a", 3), clip("z1", "z", 0)];
    const files = { a: wav(1000), z: wav(2000) };
    const one = renderSourceStems(graph(nodes), files);
    const two = renderSourceStems(graph([...nodes].reverse()), files);
    assert.deepEqual(one.stems.map((s) => s.sourceId), ["a", "z"]);
    for (let i = 0; i < one.stems.length; i++) {
      assert.deepEqual(Buffer.from(one.stems[i].bytes), Buffer.from(two.stems[i].bytes));
      assert.equal(one.stems[i].analysis.waveformPeaks.length, 64);
    }
    assert.equal(one.durationMs, 8);
  });

  it("keeps late muted clips in the shared sync duration but excludes mute-only sources", () => {
    const nodes = [source("audio"), source("muted"), clip("on", "audio", 0, 0, 3),
      clip("silence", "muted", 90, 0, 5, true)];
    const out = renderSourceStems(graph(nodes), { audio: wav(1500) });
    assert.equal(out.stems.length, 1);
    assert.equal(out.durationMs, 95);
    assert.equal(readWav(out.stems[0].bytes).frames, Math.ceil(95 * 44.1));
    assert.equal(sample(out.stems[0].bytes, 0), 1500);
    assert.equal(sample(out.stems[0].bytes, 100), 0);
  });

  it("rejects missing files, out-of-bounds clips, muted-only graphs, and unknown sample rates", () => {
    const nodes = [source("s"), clip("c", "s")];
    assert.throws(() => renderSourceStems(graph(nodes), {}), /Choose a local WAV/);
    assert.throws(() => renderSourceStems(graph(nodes), { s: wav(1) }, { sampleRate: 96000 }), /sample rate/);
    assert.throws(() => renderSourceStems(graph([source("s"), clip("c", "s", 0, 0, 11)]), { s: wav(1) }), /valid audio clips/);
    assert.throws(() => renderSourceStems(graph([source("s"), clip("c", "s", 0, 0, 5, true)]), {}), /unmuted/);
  });

  it("rejects more than four live sources before allocating or reading any files", () => {
    const nodes = [];
    for (let i = 0; i < 5; i++) {
      nodes.push(source("src" + i), clip("clip" + i, "src" + i));
    }
    assert.throws(() => renderSourceStems(graph(nodes), {}), /at most four/);
  });

  it("rejects a 48k three-stem export exceeding 96 MB before allocating output", () => {
    const nodes = [source("a", 180000), source("b", 180000), source("c", 180000),
      clip("one", "a", 0, 0, 180000), clip("two", "b", 0, 0, 180000),
      clip("three", "c", 0, 0, 180000)];
    assert.throws(() => renderSourceStems(graph(nodes), {}, { sampleRate: 48000 }), /96 MB/);
  });

  it("retains the original mix output and refuses invalid target duration overrides", () => {
    const nodes = [source("s"), clip("one", "s", 5, 0, 5)];
    const input = { s: wav(3200) };
    const original = render(graph(nodes), input);
    assert.equal(original.durationMs, 10);
    const padded = render(graph(nodes), input, { targetDurationMs: 20 });
    assert.equal(padded.durationMs, 20);
    assert.equal(readWav(padded.bytes).frames, 882);
    assert.equal(sample(padded.bytes, 0), 0);
    assert.equal(sample(padded.bytes, 221), 3200);
    assert.equal(sample(padded.bytes, 600), 0);
    for (const targetDurationMs of [0, 5, 180001, 20.5, "20", null]) {
      assert.throws(() => render(graph(nodes), input, { targetDurationMs }), /Export duration/);
    }
  });
});
