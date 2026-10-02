// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { render, readWav } = require("../public/creator-project-audio.js");
function wav(samples, rate = 8000, channels = 1) {
  const bytes = new ArrayBuffer(44 + samples.length * 2), v = new DataView(bytes);
  const tag = (at, text) => { [...text].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0))); };
  tag(0, "RIFF"); v.setUint32(4, bytes.byteLength - 8, true); tag(8, "WAVE"); tag(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, channels, true); v.setUint32(24, rate, true); v.setUint32(28, rate * channels * 2, true); v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true);
  tag(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => v.setInt16(44 + i * 2, sample, true));
  return bytes;
}
const graph = (clips) => ({ version: 1, nodes: [{ id: "source", kind: "source", durationMs: 10 }, ...clips] });
const clip = (patch = {}) => ({ id: "clip", kind: "clip", sourceId: "source", inMs: 1, outMs: 3, startMs: 10, muted: false, ...patch });
describe("local Creator project audio rendering", () => {
  it("renders trim, silence, stereo, resampling and exact PCM into a playable WAV", () => {
    const samples = Array.from({ length: 80 }, (_, i) => [i < 8 ? -4000 : 12000, i < 8 ? 4000 : -12000]).flat();
    const result = render(graph([clip()]), { source: wav(samples, 8000, 2) });
    const decoded = readWav(result.bytes);
    assert.equal(decoded.rate, 44100); assert.equal(decoded.channels, 2); assert.equal(result.durationMs, 12);
    assert.equal(decoded.view.getInt16(decoded.start, true), 0);
    assert.equal(decoded.view.getInt16(decoded.start + 441 * 4, true), 12000);
    assert.equal(decoded.view.getInt16(decoded.start + 441 * 4 + 2, true), -12000);
    assert.equal(result.clippedSamples, 0);
  });
  it("mixes overlaps in stable order, reports clipping and duplicates mono into stereo", () => {
    const nodes = [clip({ id: "a", inMs: 0, outMs: 5, startMs: 0 }), clip({ id: "b", inMs: 0, outMs: 5, startMs: 0 })];
    const source = wav(Array(80).fill(25000));
    const result = render(graph(nodes), { source });
    assert.ok(result.clippedSamples > 0);
    const v = new DataView(result.bytes); assert.equal(v.getInt16(44, true), 32767); assert.equal(v.getInt16(46, true), 32767);
    assert.deepEqual(new Uint8Array(result.bytes), new Uint8Array(render(graph([...nodes].reverse()), { source }).bytes));
  });
  it("preserves muted timeline duration without reading a file or playing sound", () => {
    const result = render(graph([clip({ muted: true })]), {});
    assert.equal(result.durationMs, 12);
    assert.ok([...new Uint8Array(result.bytes).slice(44)].every((byte) => byte === 0));
  });
  it("refuses missing files, truncated or encoded WAVs, and out-of-bounds clips", () => {
    assert.throws(() => render(graph([clip()]), {}), /Choose a local WAV/);
    const truncated = wav(Array(80).fill(100));
    assert.throws(() => readWav(truncated.slice(0, 50)), /complete/);
    const encoded = wav(Array(80).fill(100)); new DataView(encoded).setUint16(20, 3, true);
    assert.throws(() => readWav(encoded), /PCM 16-bit/);
    assert.throws(() => render(graph([clip()]), { source: wav(Array(8).fill(100)) }), /extends past/);
    assert.throws(() => render(graph([clip({ startMs: 180000 })]), { source: truncated }), /three minutes/);
    assert.throws(() => render(graph([clip({ outMs: 2.2 })]), { source: truncated }), /valid audio/);
  });
});
module.exports = { wav };
