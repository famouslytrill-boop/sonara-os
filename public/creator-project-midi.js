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

  // SMF Format 1: conductor tempo track plus distinct channel/note tracks.
  // Composes MIDI note-event streams using the already tested Format 0 encoder.
  function writeMidiFormat1(input = {}) {
    const bpm = integer(input.bpm, "Tempo BPM", 40, 240);
    const tracks = input.tracks;
    if (!Array.isArray(tracks) || !tracks.length || tracks.length > 4) {
      throw new TypeError("Choose one to four named MIDI tracks.");
    }
    let totalNotes = 0;
    const channels = new Set(), names = new Set();
    const tempoSource = writeMidi({ bpm, channel: 1, notes: "C4,0,1,1" });
    const endMarker = [0, 0xff, 0x2f, 0];
    const conductor = [...tempoSource.slice(22, 29), ...endMarker];
    const chunks = [conductor];
    for (const track of tracks) {
      if (!track || typeof track !== "object" || typeof track.name !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,31}$/.test(track.name)) {
        throw new TypeError("Track names must be 1–32 ASCII letters, digits, spaces, underscores or hyphens.");
      }
      if (names.has(track.name.toLowerCase())) throw new TypeError("Use unique MIDI track names.");
      names.add(track.name.toLowerCase());
      const channel = integer(track.channel, "MIDI channel", 1, 16);
      if (channels.has(channel)) throw new TypeError("Use distinct MIDI channels for independent tracks.");
      channels.add(channel);
      const notes = typeof track.notes === "string" ? parseNotes(track.notes) : track.notes;
      if (!Array.isArray(notes)) throw new TypeError("Each MIDI track needs explicit note rows.");
      totalNotes += notes.length;
      if (!notes.length || totalNotes > MAX_NOTES) throw new TypeError("Provide at most 128 total notes across all tracks.");
      const framed = writeMidi({ bpm, channel, notes });
      // The Format 0 stream starts with seven tempo bytes and ends with four
      // End-of-Track bytes; omit only those framing events, never note deltas.
      const nameBytes = [...track.name].map((c) => c.charCodeAt(0));
      chunks.push([0, 0xff, 0x03, nameBytes.length, ...nameBytes,
        ...framed.slice(29, framed.length - 4), ...endMarker]);
    }
    const size = 14 + chunks.reduce((n, chunk) => n + 8 + chunk.length, 0);
    if (size > 65536) throw new TypeError("Multitrack MIDI file exceeds the output budget.");
    const output = new Uint8Array(size), view = new DataView(output.buffer);
    const tag = (offset, word) => {
      for (let i = 0; i < word.length; i++) output[offset + i] = word.charCodeAt(i);
    };
    tag(0, "MThd"); view.setUint32(4, 6); view.setUint16(8, 1);
    view.setUint16(10, chunks.length); view.setUint16(12, PPQ);
    let at = 14;
    for (const chunk of chunks) {
      tag(at, "MTrk"); view.setUint32(at + 4, chunk.length);
      output.set(chunk, at + 8);
      at += 8 + chunk.length;
    }
    return output;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { PPQ, MAX_NOTES, noteNumber, parseNotes, writeMidi, writeMidiFormat1, vlq };
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
  const multi = document.querySelector("[data-midi-multitrack]");
  if (multi) {
    const multiStatus = multi.querySelector("[role=status]");
    const multiLink = multi.querySelector("[data-midi-multitrack-download]");
    let multiUrl = null;
    function clearMulti() {
      if (multiUrl) URL.revokeObjectURL(multiUrl);
      multiUrl = null;
      multiLink.hidden = true;
      multiLink.removeAttribute("href");
    }
    multi.addEventListener("input", () => {
      clearMulti();
      multiStatus.textContent = "Tracks changed. Create a new multitrack MIDI file.";
    });
    multi.addEventListener("submit", (event) => {
      event.preventDefault();
      clearMulti();
      try {
        const tracks = [];
        for (const index of [1, 2]) {
          const notes = multi.elements["notes" + index].value.trim();
          if (notes) {
            tracks.push({ name: multi.elements["trackName" + index].value,
              channel: Number(multi.elements["channel" + index].value), notes });
          }
        }
        const output = writeMidiFormat1({ bpm: Number(multi.elements.bpm.value), tracks });
        multiUrl = URL.createObjectURL(new Blob([output], { type: "audio/midi" }));
        multiLink.href = multiUrl;
        multiLink.download = "sonara-multitrack.mid";
        multiLink.hidden = false;
        multiStatus.textContent = "Standard MIDI File Format 1 ready with " + tracks.length +
          " named note tracks and a separate tempo track. Download to import into your DAW. No files uploaded.";
      } catch (error) {
        multiStatus.textContent = error instanceof Error ? error.message : "Multitrack MIDI export failed.";
      }
    });
    window.addEventListener("pagehide", clearMulti);
  }
})();
