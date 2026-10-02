// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  const RATE = 44100, MAX_SECONDS = 180, MAX_BYTES = 64 * 1024 * 1024;
  function readWav(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 44 || buffer.byteLength > 20 * 1024 * 1024) throw new Error("Use a PCM 16-bit WAV up to 20 MB.");
    const view = new DataView(buffer);
    const tag = (at) => String.fromCharCode(...new Uint8Array(buffer, at, 4));
    if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || view.getUint32(4, true) + 8 !== buffer.byteLength) throw new Error("This file is not a complete WAV recording.");
    let format, audio;
    for (let at = 12; at + 8 <= buffer.byteLength;) {
      const size = view.getUint32(at + 4, true), start = at + 8;
      if (start + size > buffer.byteLength) throw new Error("The WAV recording is incomplete.");
      if (tag(at) === "fmt ") {
        if (format || size < 16) throw new Error("Invalid WAV format.");
        format = { encoding: view.getUint16(start, true), channels: view.getUint16(start + 2, true), rate: view.getUint32(start + 4, true), bytesPerSecond: view.getUint32(start + 8, true), alignment: view.getUint16(start + 12, true), bits: view.getUint16(start + 14, true) };
      }
      if (tag(at) === "data") {
        if (audio) throw new Error("Use a WAV with one audio data section.");
        audio = { start, size };
      }
      at = start + size + (size % 2);
    }
    if (!format || !audio || format.encoding !== 1 || format.bits !== 16 || ![1, 2].includes(format.channels) || format.rate < 8000 || format.rate > 96000 || format.alignment !== format.channels * 2 || format.bytesPerSecond !== format.rate * format.alignment || !audio.size || audio.size % format.alignment) throw new Error("Use a PCM 16-bit mono or stereo WAV (8–96 kHz).");
    const frames = audio.size / format.alignment;
    if (frames / format.rate > MAX_SECONDS) throw new Error("Use source recordings up to three minutes.");
    return { ...format, frames, view, start: audio.start };
  }
  function render(graph, files) {
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
    const count = Math.ceil(end * RATE / 1000), mix = new Float64Array(count * 2);
    for (const clip of clips) {
      if (clip.muted) continue;
      const audio = decoded.get(clip.sourceId);
      if (clip.outMs * audio.rate / 1000 > audio.frames + 0.001) throw new Error("A clip extends past its selected recording. Correct its source out time.");
      const start = Math.round(clip.startMs * RATE / 1000), length = Math.round((clip.outMs - clip.inMs) * RATE / 1000);
      for (let frame = 0; frame < length && start + frame < count; frame++) {
        const position = clip.inMs * audio.rate / 1000 + frame * audio.rate / RATE;
        const before = Math.floor(position), after = Math.min(before + 1, audio.frames - 1), weight = position - before;
        for (let channel = 0; channel < 2; channel++) {
          const c = Math.min(channel, audio.channels - 1);
          const a = audio.view.getInt16(audio.start + (before * audio.channels + c) * 2, true);
          const b = audio.view.getInt16(audio.start + (after * audio.channels + c) * 2, true);
          mix[(start + frame) * 2 + channel] += a + (b - a) * weight;
        }
      }
    }
    const output = new ArrayBuffer(44 + count * 4), view = new DataView(output);
    const write = (at, str) => { for (let i = 0; i < str.length; i++) view.setUint8(at + i, str.charCodeAt(i)); };
    write(0, "RIFF"); view.setUint32(4, output.byteLength - 8, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, RATE, true); view.setUint32(28, RATE * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, count * 4, true);
    let clipped = 0;
    for (let i = 0; i < mix.length; i++) {
      if (mix[i] < -32768 || mix[i] > 32767) clipped++;
      view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(mix[i]))), true);
    }
    return { bytes: output, clippedSamples: clipped, durationMs: end };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { readWav, render }; return; }
  if (typeof document === "undefined") {
    self.onmessage = (event) => {
      try { const result = render(event.data.graph, event.data.files); self.postMessage(result, [result.bytes]); }
      catch (error) { self.postMessage({ error: error.message }); }
    };
    return;
  }
  const form = document.querySelector("[data-project-audio]");
  if (!form) return;
  const status = form.querySelector("[role=status]"), link = form.querySelector("a[data-audio-download]"), preview = form.querySelector("audio"), run = form.querySelector("button");
  let worker = null, url = null, revision = 0;
  function clear() {
    revision++;
    if (worker) worker.terminate(); worker = null;
    preview.pause(); preview.removeAttribute("src"); preview.load(); preview.hidden = true;
    if (url) URL.revokeObjectURL(url); url = null;
    link.hidden = true; link.removeAttribute("href"); run.disabled = false;
  }
  form.addEventListener("change", () => { clear(); status.textContent = "Recordings changed. Render again for a new download."; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); clear(); const current = revision; run.disabled = true;
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
        if (current !== revision) return;
        worker.terminate(); worker = null; run.disabled = false;
        if (message.data.error) { status.textContent = message.data.error; return; }
        url = URL.createObjectURL(new Blob([message.data.bytes], { type: "audio/wav" }));
        preview.src = url; preview.hidden = false;
        link.href = url; link.download = `project-${form.dataset.projectId}.wav`; link.hidden = false;
        status.textContent = `Rendered ${message.data.durationMs / 1000} seconds on CPU. ${message.data.clippedSamples} clipped samples. Your recordings stayed on this device.`;
      };
      worker.onerror = () => { clear(); status.textContent = "This browser could not render the recording. Try smaller WAV files."; };
      worker.postMessage({ graph: JSON.parse(form.dataset.audioGraph), files }, Object.values(files));
    } catch (error) { if (current === revision) { clear(); status.textContent = error.message; } }
  });
  window.addEventListener("pagehide", clear);
})();
