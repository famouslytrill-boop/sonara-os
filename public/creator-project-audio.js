// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  const DEFAULT_RATE = 44100, SUPPORTED_RATES = Object.freeze([44100, 48000]);
  const MAX_SECONDS = 180, MAX_BYTES = 64 * 1024 * 1024;
  const MAX_STEMS = 4, MAX_STEM_OUTPUT_BYTES = 96 * 1024 * 1024;
  function readWav(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 44 || buffer.byteLength > 20 * 1024 * 1024) throw new Error("Use a PCM 16-bit WAV up to 20 MB.");
    const view = new DataView(buffer);
    const tag = (at) => String.fromCharCode(...new Uint8Array(buffer, at, 4));
    if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || view.getUint32(4, true) + 8 !== buffer.byteLength) throw new Error("This file is not a complete WAV recording.");
    let format, audio;
    for (let at = 12; at + 8 <= buffer.byteLength;) {
      const size = view.getUint32(at + 4, true), start = at + 8;
      const paddedEnd = start + size + (size % 2);
      if (paddedEnd > buffer.byteLength) throw new Error("The WAV recording is incomplete.");
      if (tag(at) === "fmt ") {
        if (format || size < 16) throw new Error("Invalid WAV format.");
        format = { encoding: view.getUint16(start, true), channels: view.getUint16(start + 2, true), rate: view.getUint32(start + 4, true), bytesPerSecond: view.getUint32(start + 8, true), alignment: view.getUint16(start + 12, true), bits: view.getUint16(start + 14, true) };
      }
      if (tag(at) === "data") {
        if (audio) throw new Error("Use a WAV with one audio data section.");
        audio = { start, size };
      }
      at = paddedEnd;
    }
    if (!format || !audio || ![1, 2].includes(format.channels) || format.rate < 8000 || format.rate > 96000 ||
      !((format.encoding === 1 && [16, 24, 32].includes(format.bits)) || (format.encoding === 3 && format.bits === 32)) ||
      format.alignment !== format.channels * (format.bits / 8) ||
      format.bytesPerSecond !== format.rate * format.alignment || !audio.size || audio.size % format.alignment) {
      throw new Error("Use a PCM 16-bit WAV, PCM 24/32-bit WAV, or IEEE float 32-bit WAV (mono/stereo, 8–96 kHz).");
    }
    const frames = audio.size / format.alignment;
    if (frames / format.rate > MAX_SECONDS) throw new Error("Use source recordings up to three minutes.");
    return { ...format, frames, view, start: audio.start };
  }
  function readSample(audio, frame, channel) {
    const at = audio.start + (frame * audio.channels + channel) * (audio.bits / 8);
    if (audio.encoding === 3) {
      const value = audio.view.getFloat32(at, true);
      if (!Number.isFinite(value)) throw new Error("WAV contains non-finite float samples.");
      return value * 32768;
    }
    if (audio.bits === 16) return audio.view.getInt16(at, true);
    if (audio.bits === 32) return audio.view.getInt32(at, true) / 65536;
    const unsigned = audio.view.getUint8(at) | (audio.view.getUint8(at + 1) << 8) | (audio.view.getUint8(at + 2) << 16);
    return (unsigned >= 0x800000 ? unsigned - 0x1000000 : unsigned) / 256;
  }
  function render(graph, files, options = {}) {
    const rate = options && options.sampleRate !== undefined ? options.sampleRate : DEFAULT_RATE;
    if (!SUPPORTED_RATES.includes(rate)) throw new Error("Export sample rate must be 44100 or 48000 Hz.");
    if (!graph || graph.version !== 1 || !Array.isArray(graph.nodes) || graph.nodes.length > 500 || !files || typeof files !== "object") throw new Error("Reload the project before rendering.");
    const sources = new Map(graph.nodes.filter((node) => node.kind === "source").map((node) => [node.id, node]));
    const clips = graph.nodes.filter((node) => node.kind === "clip").sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (!clips.length) throw new Error("Add an audio clip to the project first.");
    let end = 0, totalBytes = 0, workMs = 0;
    const decoded = new Map();
    for (const clip of clips) {
      const source = sources.get(clip.sourceId);
      if (!source || ![clip.inMs, clip.outMs, clip.startMs, source.durationMs].every(Number.isSafeInteger) || clip.inMs < 0 || clip.outMs <= clip.inMs || clip.outMs > source.durationMs || clip.startMs < 0 || clip.startMs + clip.outMs - clip.inMs > MAX_SECONDS * 1000 || typeof clip.muted !== "boolean") throw new Error("Use valid audio clips with a timeline up to three minutes.");
      end = Math.max(end, clip.startMs + clip.outMs - clip.inMs);
      if (!clip.muted) workMs += clip.outMs - clip.inMs;
      if (workMs > 600000) throw new Error("Use up to ten minutes of total unmuted clip time per render.");
      if (clip.muted || decoded.has(clip.sourceId)) continue;
      const bytes = files[clip.sourceId];
      if (!(bytes instanceof ArrayBuffer)) throw new Error("Choose a local WAV for each source with sound on.");
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_BYTES) throw new Error("Use up to 64 MB of source recordings per render.");
      decoded.set(clip.sourceId, readWav(bytes));
    }
    const durationMs = options && options.targetDurationMs !== undefined ? options.targetDurationMs : end;
    if (!Number.isSafeInteger(durationMs) || durationMs < end || durationMs > MAX_SECONDS * 1000) {
      throw new Error("Export duration must cover the timeline and stay within three minutes.");
    }
    const count = Math.ceil(durationMs * rate / 1000), mix = new Float64Array(count * 2);
    for (const clip of clips) {
      if (clip.muted) continue;
      const audio = decoded.get(clip.sourceId);
      if (clip.outMs * audio.rate / 1000 > audio.frames + 0.001) throw new Error("A clip extends past its selected recording. Correct its source out time.");
      const start = Math.round(clip.startMs * rate / 1000), length = Math.round((clip.outMs - clip.inMs) * rate / 1000);
      for (let frame = 0; frame < length && start + frame < count; frame++) {
        const position = clip.inMs * audio.rate / 1000 + frame * audio.rate / rate;
        const before = Math.floor(position), after = Math.min(before + 1, audio.frames - 1), weight = position - before;
        for (let channel = 0; channel < 2; channel++) {
          const c = Math.min(channel, audio.channels - 1);
          const a = readSample(audio, before, c);
          const b = readSample(audio, after, c);
          mix[(start + frame) * 2 + channel] += a + (b - a) * weight;
        }
      }
    }
    const output = new ArrayBuffer(44 + count * 4), view = new DataView(output);
    const write = (at, str) => { for (let i = 0; i < str.length; i++) view.setUint8(at + i, str.charCodeAt(i)); };
    write(0, "RIFF"); view.setUint32(4, output.byteLength - 8, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, count * 4, true);
    let clipped = 0, maxAmplitude = 0, sumSquares = 0;
    const waveformPeaks = Array(64).fill(0);
    for (let i = 0; i < mix.length; i++) {
      if (mix[i] < -32768 || mix[i] > 32767) clipped++;
      const sample = Math.max(-32768, Math.min(32767, Math.round(mix[i])));
      view.setInt16(44 + i * 2, sample, true);
      const amplitude = Math.abs(sample / 32768);
      maxAmplitude = Math.max(maxAmplitude, amplitude);
      sumSquares += (sample / 32768) ** 2;
      const bucket = Math.min(63, Math.floor(Math.floor(i / 2) * 64 / count));
      waveformPeaks[bucket] = Math.max(waveformPeaks[bucket], amplitude);
    }
    const decibels = (amplitude) => amplitude > 0 ? Math.round(200 * Math.log10(amplitude)) / 10 : null;
    return {
      bytes: output, clippedSamples: clipped, durationMs, sampleRate: rate,
      analysis: {
        peakDbfs: decibels(maxAmplitude),
        rmsDbfs: decibels(mix.length ? Math.sqrt(sumSquares / mix.length) : 0),
        waveformPeaks
      }
    };
  }
  function renderSourceStems(graph, files, options = {}) {
    const rate = options && options.sampleRate !== undefined ? options.sampleRate : DEFAULT_RATE;
    if (!SUPPORTED_RATES.includes(rate)) throw new Error("Export sample rate must be 44100 or 48000 Hz.");
    if (!graph || graph.version !== 1 || !Array.isArray(graph.nodes) || graph.nodes.length > 500 ||
      !files || typeof files !== "object") throw new Error("Reload the project before exporting source stems.");
    const sources = new Map(graph.nodes.filter((node) => node.kind === "source").map((node) => [node.id, node]));
    const clips = graph.nodes.filter((node) => node.kind === "clip");
    if (!clips.length) throw new Error("Add an audio clip before exporting source stems.");
    const active = new Set();
    let durationMs = 0, workMs = 0;
    for (const clip of clips) {
      const source = sources.get(clip.sourceId);
      if (!source || ![clip.inMs, clip.outMs, clip.startMs, source.durationMs].every(Number.isSafeInteger) ||
        clip.inMs < 0 || clip.outMs <= clip.inMs || clip.outMs > source.durationMs || clip.startMs < 0 ||
        clip.startMs + clip.outMs - clip.inMs > MAX_SECONDS * 1000 || typeof clip.muted !== "boolean") {
        throw new Error("Use valid audio clips with a timeline up to three minutes.");
      }
      durationMs = Math.max(durationMs, clip.startMs + clip.outMs - clip.inMs);
      if (!clip.muted) {
        active.add(clip.sourceId);
        workMs += clip.outMs - clip.inMs;
      }
      if (workMs > 600000) throw new Error("Use up to ten minutes of total unmuted clip time per export.");
    }
    if (!active.size) throw new Error("At least one unmuted audio clip is needed for source stems.");
    if (active.size > MAX_STEMS) throw new Error("Export at most four active audio sources at once.");
    const sourceIds = [...active].sort();
    const outputBytes = (44 + Math.ceil(durationMs * rate / 1000) * 4) * sourceIds.length;
    if (outputBytes > MAX_STEM_OUTPUT_BYTES) throw new Error("The aligned source stems exceed the 96 MB local export budget. Shorten the timeline or export fewer sources.");
    const stems = sourceIds.map((sourceId, index) => {
      const nodes = graph.nodes.filter((node) => node.kind === "source" ||
        (node.kind === "clip" && node.sourceId === sourceId));
      const result = render({ version: 1, nodes }, files, { sampleRate: rate, targetDurationMs: durationMs });
      return { sourceId, filename: `source-stem-${String(index + 1).padStart(2, "0")}.wav`,
        bytes: result.bytes, clippedSamples: result.clippedSamples, analysis: result.analysis };
    });
    return { stems, durationMs, sampleRate: rate, alignedAtMs: 0, grouping: "source" };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { readWav, render, renderSourceStems }; return; }
  if (typeof document === "undefined") {
    self.onmessage = (event) => {
      // Dedicated-worker messages have an empty origin; reject window-style messages.
      if (event.origin !== "") return;
      try {
        if (event.data.mode === "stems") {
          const result = renderSourceStems(event.data.graph, event.data.files, event.data.options);
          self.postMessage(result, result.stems.map((stem) => stem.bytes));
        } else if (!event.data.mode || event.data.mode === "mix") {
          const result = render(event.data.graph, event.data.files, event.data.options);
          self.postMessage(result, [result.bytes]);
        } else throw new Error("Unsupported audio export mode.");
      }
      catch (error) { self.postMessage({ error: error.message }); }
    };
    return;
  }
  const form = document.querySelector("[data-project-audio]");
  if (!form) return;
  const status = form.querySelector("[role=status]"), link = form.querySelector("a[data-audio-download]"), preview = form.querySelector("audio");
  const meter = form.querySelector("[data-waveform]");
  const stemLinks = form.querySelector("[data-stem-downloads]");
  const actions = form.querySelectorAll('button[type="submit"]');
  let worker = null, url = null, stemUrls = [], revision = 0;
  function drawWaveform(peaks) {
    if (!meter) return;
    const ctx = meter.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, meter.width, meter.height);
    if (!Array.isArray(peaks) || peaks.length !== 64) return;
    ctx.fillStyle = window.getComputedStyle(meter).color;
    peaks.forEach((value, i) => {
      const height = Math.round(Math.max(0, Math.min(1, value)) * (meter.height - 8));
      ctx.fillRect(Math.round(i * meter.width / 64), Math.floor((meter.height - height) / 2), Math.max(1, Math.floor(meter.width / 64) - 2), Math.max(1, height));
    });
  }
  function clear() {
    revision++;
    drawWaveform(null);
    if (worker) worker.terminate(); worker = null;
    preview.pause(); preview.removeAttribute("src"); preview.load(); preview.hidden = true;
    if (url) URL.revokeObjectURL(url); url = null;
    stemUrls.forEach((stemUrl) => URL.revokeObjectURL(stemUrl)); stemUrls = [];
    if (stemLinks) stemLinks.replaceChildren();
    link.hidden = true; link.removeAttribute("href"); actions.forEach((button) => { button.disabled = false; });
  }
  form.addEventListener("change", () => { clear(); status.textContent = "Recordings changed. Render again for a new download."; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); clear(); const current = revision;
    const mode = event.submitter?.value === "stems" ? "stems" : "mix";
    actions.forEach((button) => { button.disabled = true; });
    status.textContent = "Rendering on this device…";
    try {
      const files = {}; let totalBytes = 0;
      for (const input of form.querySelectorAll("input[data-source-id]")) {
        const file = input.files[0];
        if (!file || file.size > 20 * 1024 * 1024) throw new Error("Choose a local WAV up to 20 MB for each source with sound on.");
        totalBytes += file.size;
        if (totalBytes > MAX_BYTES) throw new Error("Use up to 64 MB of source recordings per render.");
        files[input.dataset.sourceId] = await file.arrayBuffer();
        if (current !== revision) return;
      }
      worker = new window.Worker("/creator-project-audio.js");
      worker.onmessage = (message) => {
        if (message.origin !== "") return;
        if (current !== revision) return;
        worker.terminate(); worker = null; actions.forEach((button) => { button.disabled = false; });
        if (message.data.error) { status.textContent = message.data.error; return; }
        if (message.data.grouping === "source") {
          if (!stemLinks) { status.textContent = "Source-stem download controls are unavailable."; return; }
          for (const [index, stem] of message.data.stems.entries()) {
            const stemUrl = URL.createObjectURL(new Blob([stem.bytes], { type: "audio/wav" }));
            stemUrls.push(stemUrl);
            const anchor = document.createElement("a");
            anchor.href = stemUrl;
            anchor.download = stem.filename;
            anchor.textContent = `Download source ${index + 1} stem — ${stem.sourceId}`;
            const item = document.createElement("p"); item.append(anchor); stemLinks.append(item);
          }
          status.textContent = `${message.data.stems.length} aligned source-group WAVs at ${message.data.sampleRate / 1000} kHz. Every file starts at 0 and lasts ${message.data.durationMs / 1000} seconds. Download each stem separately. Nothing uploaded.`;
          return;
        }
        url = URL.createObjectURL(new Blob([message.data.bytes], { type: "audio/wav" }));
        preview.src = url; preview.hidden = false;
        link.href = url; link.download = `project-${form.dataset.projectId}.wav`; link.hidden = false;
        drawWaveform(message.data.analysis?.waveformPeaks);
        const peak = message.data.analysis?.peakDbfs;
        const rms = message.data.analysis?.rmsDbfs;
        status.textContent = `Rendered ${message.data.durationMs / 1000} seconds at ${message.data.sampleRate / 1000} kHz. Peak ${peak === null ? "silence" : peak + " dBFS"}, RMS ${rms === null ? "silence" : rms + " dBFS"}. ${message.data.clippedSamples} clipped samples. Your recordings stayed on this device.`;
      };
      worker.onerror = () => { clear(); status.textContent = "This browser could not render the recording. Try smaller WAV files."; };
      worker.postMessage({ graph: JSON.parse(form.dataset.audioGraph), files, mode, options: { sampleRate: Number(form.elements.sampleRate.value) } }, Object.values(files));
    } catch (error) { if (current === revision) { clear(); status.textContent = error.message; } }
  });
  window.addEventListener("pagehide", clear);
})();
