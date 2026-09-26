// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const SAMPLE_RATE = 24000;
const MAX_DURATION_MS = 10000;
const NOTE_SEMITONES = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

function finiteRange(value, label, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}`);
  }
  return value;
}

function makeMelodyScore({ notes, bpm } = {}) {
  if (typeof notes !== "string") throw new TypeError("Enter notes separated by spaces, such as C4 E4 G4 C5.");
  if (notes.length > 80) throw new RangeError("Enter 1 to 16 short note names.");
  const sequence = notes.trim().split(/\s+/);
  if (sequence.length < 1 || sequence.length > 16) throw new RangeError("Enter 1 to 16 notes.");
  const tempo = Number(bpm);
  finiteRange(tempo, "Tempo", 60, 180);
  const stepMs = 30000 / tempo; // eighth notes
  const events = sequence.map((note, index) => {
    if (note === "-") return null; // an explicit rest
    const parts = /^([A-G])([#b]?)([3-5])$/i.exec(note);
    if (!parts) throw new TypeError(`Invalid note at position ${index + 1}. Use C3 through B5 or - for a rest.`);
    const midi = (Number(parts[3]) + 1) * 12 + NOTE_SEMITONES[parts[1].toUpperCase()]
      + (parts[2] === "#" ? 1 : parts[2] === "b" ? -1 : 0);
    if (midi < 48 || midi > 83) throw new RangeError(`Note ${index + 1} is outside C3 through B5.`);
    return { startMs: index * stepMs, durationMs: stepMs * 0.85,
      frequencyHz: 440 * (2 ** ((midi - 69) / 12)), gain: 0.25 };
  }).filter(Boolean);
  return { durationMs: sequence.length * stepMs, sampleRate: SAMPLE_RATE, events };
}

function renderScoreWav({ durationMs, sampleRate = SAMPLE_RATE, events } = {}) {
  finiteRange(durationMs, "Duration", 1, MAX_DURATION_MS);
  if (sampleRate !== SAMPLE_RATE) throw new TypeError("Only the pinned 24000 Hz renderer is available.");
  if (!Array.isArray(events) || events.length > 16) throw new RangeError("The score must contain at most 16 events.");
  const count = Math.ceil(durationMs * sampleRate / 1000);
  const pcm = new Float64Array(count);
  // Fixed ordering prevents caller order from changing floating-point addition.
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs || a.frequencyHz - b.frequencyHz);
  for (const event of sorted) {
    if (!event || typeof event !== "object") throw new TypeError("Invalid score event.");
    finiteRange(event.startMs, "Start", 0, durationMs);
    finiteRange(event.durationMs, "Event duration", 0.001, durationMs);
    finiteRange(event.frequencyHz, "Frequency", 20, sampleRate / 2);
    finiteRange(event.gain, "Gain", 0, 1);
    if (event.startMs + event.durationMs > durationMs + 0.00001) throw new RangeError("An event exceeds the score duration.");
    const start = Math.floor(event.startMs * sampleRate / 1000);
    const end = Math.min(count, Math.floor((event.startMs + event.durationMs) * sampleRate / 1000));
    const fade = Math.max(1, Math.floor(Math.min(5, event.durationMs / 4) * sampleRate / 1000));
    for (let i = start; i < end; i += 1) {
      const envelope = Math.min(1, (i - start) / fade, (end - i) / fade);
      pcm[i] += event.gain * envelope * Math.sin(2 * Math.PI * event.frequencyHz * (i - start) / sampleRate);
    }
  }
  const wav = Buffer.alloc(44 + count * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + count * 2, 4); wav.write("WAVE", 8);
  wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i += 1) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2);
  return wav;
}

function vttTime(milliseconds) {
  const ms = Math.floor(milliseconds);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

function renderTranscriptVtt({ text, durationSeconds } = {}) {
  if (typeof text !== "string" || !text.trim() || text.length > 500) throw new RangeError("Enter a transcript of 1 to 500 characters.");
  const seconds = Number(durationSeconds);
  finiteRange(seconds, "Caption duration", 1, 60);
  // Encode WebVTT markup so a transcript remains plain caption text.
  const caption = text.trim().replace(/\r\n?|\n/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `WEBVTT\n\n00:00:00.000 --> ${vttTime(seconds * 1000)}\n${caption}\n`;
}

module.exports = { makeMelodyScore, renderScoreWav, renderTranscriptVtt };
