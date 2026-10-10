// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";

  // Standard MIDI File 1.0, Format 0, 480 ticks per quarter note.
  // User-authored note rows only. We do not infer pitches, tempo, or rights from audio.
  const PPQ = 480, MAX_NOTES = 128, MAX_TICKS = PPQ * 256;
  const SEMITONES = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

  function integer(value, name, min, max) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
      throw new TypeError(name + " must be a whole number from " + min + " to " + max + ".");
    }
    return value;
  }
  function noteNumber(value) {
    if (typeof value === "number") return integer(value, "MIDI note", 0, 127);
    if (typeof value !== "string") throw new TypeError("Use MIDI note numbers (0–127) or note names such as C4.");
    const name = value.trim();
    if (/^(?:0|[1-9][0-9]{0,2})$/.test(name)) return integer(Number(name), "MIDI note", 0, 127);
    const match = /^([A-G])([#b]?)(-1|[0-9])$/i.exec(name);
    if (!match) throw new TypeError("Use a note name such as C4, F#3, or Bb4.");
    const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
    return integer((Number(match[3]) + 1) * 12 + SEMITONES[match[1].toUpperCase()] + accidental, "MIDI note", 0, 127);
  }
  function parseNotes(text) {
    if (typeof text !== "string" || !text.trim() || text.length > 8192) {
      throw new TypeError("Enter 1–128 note rows, up to 8192 characters.");
    }
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 1 || lines.length > MAX_NOTES) throw new TypeError("Enter 1–128 note rows.");
    return lines.map((line, index) => {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length !== 4 || parts.some((part) => !part)) throw new TypeError("Row " + (index + 1) + ": use note,startTicks,durationTicks,velocity.");
      const fields = parts.slice(1);
      if (fields.some((part) => !/^(?:0|[1-9][0-9]*)$/.test(part))) throw new TypeError("Row " + (index + 1) + " has an invalid numeric field.");
      const startTick = integer(Number(fields[0]), "Start tick", 0, MAX_TICKS);
      const durationTicks = integer(Number(fields[1]), "Duration ticks", 1, MAX_TICKS);
      if (startTick + durationTicks > MAX_TICKS) throw new TypeError("A note cannot end after tick " + MAX_TICKS + ".");
      return {
        pitch: noteNumber(parts[0]),
        startTick,
        durationTicks,
        velocity: integer(Number(fields[2]), "Velocity", 1, 127)
      };
    });
  }
  function vlq(value) {
    integer(value, "MIDI delta", 0, 0x0fffffff);
    const result = [value & 0x7f];
    while ((value = Math.floor(value / 128)) > 0) result.unshift((value & 0x7f) | 0x80);
    return result;
  }
  function writeMidi(input = {}) {
    const bpm = integer(input.bpm, "Tempo BPM", 40, 240);
    const channel = integer(input.channel == null ? 1 : input.channel, "MIDI channel", 1, 16) - 1;
    const notes = typeof input.notes === "string" ? parseNotes(input.notes) : input.notes;
    if (!Array.isArray(notes) || !notes.length || notes.length > MAX_NOTES) throw new TypeError("Provide 1–128 explicit note events.");
    const events = [], activeEnds = new Map();
    for (const entry of notes) {
      if (!entry || typeof entry !== "object") throw new TypeError("Invalid note event.");
      const pitch = noteNumber(entry.pitch), start = integer(entry.startTick, "Start tick", 0, MAX_TICKS);
      const duration = integer(entry.durationTicks, "Duration ticks", 1, MAX_TICKS);
      const velocity = integer(entry.velocity, "Velocity", 1, 127);
      if (start + duration > MAX_TICKS) throw new TypeError("A note cannot end after tick " + MAX_TICKS + ".");
      const end = start + duration;
      events.push({ tick: start, order: 1, pitch, velocity, bytes: [0x90 | channel, pitch, velocity] });
      events.push({ tick: end, order: 0, pitch, velocity, bytes: [0x80 | channel, pitch, 0] });
    }
    events.sort((a, b) => a.tick - b.tick || a.order - b.order || a.pitch - b.pitch || a.velocity - b.velocity);
    for (const event of events) {
      if (event.order === 0) {
        if (!activeEnds.has(event.pitch)) throw new TypeError("Conflicting note-off event.");
        activeEnds.delete(event.pitch);
      } else {
        if (activeEnds.has(event.pitch)) throw new TypeError("Overlapping notes of the same pitch on one channel are not supported.");
        activeEnds.set(event.pitch, true);
      }
    }
    const microsecondsPerQuarter = Math.round(60000000 / bpm);
    const track = [0, 0xff, 0x51, 0x03,
      (microsecondsPerQuarter >>> 16) & 255, (microsecondsPerQuarter >>> 8) & 255, microsecondsPerQuarter & 255];
    let previousTick = 0;
    for (const event of events) {
      track.push(...vlq(event.tick - previousTick), ...event.bytes);
      previousTick = event.tick;
    }
    track.push(0, 0xff, 0x2f, 0);
    if (track.length > 65536) throw new TypeError("MIDI file exceeds the allowed output size.");
    const output = new Uint8Array(14 + 8 + track.length), v = new DataView(output.buffer);
    for (const [offset, word] of [[0, "MThd"], [14, "MTrk"]]) {
      for (let i = 0; i < word.length; i++) v.setUint8(offset + i, word.charCodeAt(i));
    }
    v.setUint32(4, 6); v.setUint16(8, 0); v.setUint16(10, 1); v.setUint16(12, PPQ);
    v.setUint32(18, track.length); output.set(track, 22);
    return output;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { PPQ, MAX_NOTES, noteNumber, parseNotes, writeMidi, vlq };
    return;
  }
  const form = typeof document !== "undefined" && document.querySelector("[data-midi-export]");
  if (!form) return;
  const status = form.querySelector("[role=status]"), link = form.querySelector("[data-midi-download]");
  let url = null;
  function clear() {
    if (url) URL.revokeObjectURL(url);
    url = null; link.removeAttribute("href"); link.hidden = true;
  }
  form.addEventListener("input", () => { clear(); status.textContent = "Notes changed. Generate a new MIDI file."; });
  form.addEventListener("submit", (event) => {
    event.preventDefault(); clear();
    try {
      const output = writeMidi({
        bpm: Number(form.elements.bpm.value),
        channel: Number(form.elements.channel.value),
        notes: form.elements.notes.value
      });
      url = URL.createObjectURL(new Blob([output], { type: "audio/midi" }));
      link.href = url;
      link.download = "sonara-note-sketch.mid";
      link.hidden = false;
      status.textContent = "Standard MIDI File Format 0 ready (" + output.byteLength + " bytes). Your notes stay on this device. Choose Download MIDI.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "MIDI export failed.";
    }
  });
  window.addEventListener("pagehide", clear);
})();
