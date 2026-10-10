// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { readWav, render } = require("../public/creator-project-audio.js");

function sourceWav({ bits = 16, encoding = 1, rate = 8000, channels = 1, samples = [] }) {
  const bytesPerSample = bits / 8;
  const size = samples.length * bytesPerSample;
  const bytes = new ArrayBuffer(44 + size);
  const view = new DataView(bytes);
  const tag = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  tag(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); tag(8, "WAVE"); tag(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, encoding, true); view.setUint16(22, channels, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, bits, true);
  tag(36, "data"); view.setUint32(40, size, true);
  samples.forEach((sample, i) => {
    const at = 44 + i * bytesPerSample;
    if (encoding === 3) { view.setFloat32(at, sample, true); return; }
    if (bits === 16) { view.setInt16(at, sample, true); return; }
    if (bits === 32) { view.setInt32(at, sample, true); return; }
    const unsigned = sample < 0 ? sample + 0x1000000 : sample;
    for (let b = 0; b < 3; b++) view.setUint8(at + b, (unsigned >>> (8 * b)) & 255);
  });
  return bytes;
}
const graph = (clips = [{ id: "one", kind: "clip", sourceId: "rec", inMs: 0, outMs: 10, startMs: 0, muted: false }]) =>
  ({ version: 1, nodes: [{ id: "rec", kind: "source", durationMs: 10 }, ...clips] });
const repeated = (number) => Array(80).fill(number);
const firstSample = (result) => new DataView(result.bytes).getInt16(44, true);

describe("Creator DAW WAV interoperability and local meters", () => {
  for (const [bits, encoding, value] of [[16, 1, 16384], [24, 1, 4194304], [32, 1, 1073741824], [32, 3, 0.5]]) {
    it(`accepts ${bits}-bit ${encoding === 3 ? "IEEE float" : "PCM"} WAV and renders expected gain`, () => {
      const source = sourceWav({ bits, encoding, samples: repeated(value) });
      const result = render(graph(), { rec: source });
      assert.equal(firstSample(result), 16384);
      assert.equal(readWav(result.bytes).rate, 44100);
      assert.equal(result.sampleRate, 44100);
      assert.equal(result.durationMs, 10);
      assert.equal(result.clippedSamples, 0);
      assert.equal(result.analysis.waveformPeaks.length, 64);
      assert.ok(result.analysis.peakDbfs <= -5.9 && result.analysis.peakDbfs >= -6.2);
      assert.ok(result.analysis.rmsDbfs <= -5.9 && result.analysis.rmsDbfs >= -6.2);
    });
  }
  it("exports 48 kHz PCM mixdown and preserves output duration", () => {
    const result = render(graph(), { rec: sourceWav({ samples: repeated(3000) }) }, { sampleRate: 48000 });
    const meta = readWav(result.bytes);
    assert.equal(result.sampleRate, 48000);
    assert.equal(meta.rate, 48000);
    assert.equal(meta.frames, 480);
    assert.equal(meta.channels, 2);
    assert.equal(firstSample(result), 3000);
    assert.equal(result.bytes.byteLength, 44 + 480 * 4);
  });
  it("rejects unsupported rates, compressed WAV, malformed chunks and non-finite float data", () => {
    const source = sourceWav({ samples: repeated(10) });
    for (const sampleRate of [null, "48000", 96000, 0, 12345]) {
      assert.throws(() => render(graph(), { rec: source }, { sampleRate }), /sample rate/);
    }
    const compressed = sourceWav({ samples: repeated(10) });
    new DataView(compressed).setUint16(20, 6, true);
    assert.throws(() => readWav(compressed), /PCM 16\/24\/32-bit/);
    const invalid = sourceWav({ samples: repeated(10) });
    new DataView(invalid).setUint32(40, 0xffffffff, true);
    assert.throws(() => readWav(invalid), /incomplete/);
    const nonFinite = sourceWav({ bits: 32, encoding: 3, samples: repeated(NaN) });
    assert.throws(() => render(graph(), { rec: nonFinite }), /non-finite/);
  });
  it("returns a silent, bounded visualizer when all clips are muted", () => {
    const result = render(graph([{ id: "mute", kind: "clip", sourceId: "rec", inMs: 0, outMs: 10, startMs: 0, muted: true }]), {});
    assert.equal(result.analysis.peakDbfs, null);
    assert.equal(result.analysis.rmsDbfs, null);
    assert.deepEqual(result.analysis.waveformPeaks, Array(64).fill(0));
    assert.equal(result.clippedSamples, 0);
  });
  it("keeps audio ordering deterministic and reports digital clipping", () => {
    const clips = ["a", "b"].map((id) => ({ id, kind: "clip", sourceId: "rec", inMs: 0, outMs: 10, startMs: 0, muted: false }));
    const source = sourceWav({ samples: repeated(25000) });
    const first = render(graph(clips), { rec: source });
    const second = render(graph([...clips].reverse()), { rec: source });
    assert.deepEqual(Buffer.from(first.bytes), Buffer.from(second.bytes));
    assert.ok(first.clippedSamples > 0);
    assert.equal(firstSample(first), 32767);
    assert.ok(first.analysis.waveformPeaks.every((value) => value >= 0 && value <= 1));
  });
});
