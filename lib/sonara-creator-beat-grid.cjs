// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A bounded, provider-free beat/bar grid for lining up music with film frames.
// Frame counts are the source of truth. They are NOT SMPTE/drop-frame timecodes.
const FRAME_RATES = Object.freeze({
  "24": Object.freeze({ numerator: 24, denominator: 1 }),
  "25": Object.freeze({ numerator: 25, denominator: 1 }),
  "30": Object.freeze({ numerator: 30, denominator: 1 }),
  "60": Object.freeze({ numerator: 60, denominator: 1 }),
  "24000/1001": Object.freeze({ numerator: 24000, denominator: 1001 }),
  "30000/1001": Object.freeze({ numerator: 30000, denominator: 1001 }),
  "60000/1001": Object.freeze({ numerator: 60000, denominator: 1001 })
});

function integer(value, name, min, max) {
  if (!["number", "string"].includes(typeof value)) throw new TypeError(name + " must be a whole number.");
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) throw new TypeError(name + " must be a whole number.");
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new RangeError(name + " must be between " + min + " and " + max + ".");
  }
  return parsed;
}

function planBeatGrid(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Supply the beat-grid settings.");
  const bpm = integer(input.bpm ?? 120, "Tempo (BPM)", 20, 320);
  const beatsPerBar = integer(input.beatsPerBar ?? 4, "Beats per bar", 2, 12);
  const bars = integer(input.bars ?? 16, "Bars", 1, 128);
  const offsetFrames = integer(input.offsetFrames ?? 0, "Frame offset", 0, 2000000);
  const frameRate = String(input.frameRate ?? "24");
  if (!Object.hasOwn(FRAME_RATES, frameRate)) throw new TypeError("Choose a supported film frame rate.");
  const { numerator, denominator } = FRAME_RATES[frameRate];
  const framesForBeat = (beat) => Math.round((beat * 60 * numerator) / (bpm * denominator));
  // Round absolute positions, never add individually rounded bar lengths;
  // incremental rounding accumulates drift over a long cue sheet.
  const markers = Array.from({ length: bars + 1 }, (_, index) => {
    const beat = index * beatsPerBar;
    const frame = offsetFrames + framesForBeat(beat);
    return {
      bar: index === bars ? "END" : String(index + 1),
      beat,
      frame,
      seconds: Number(((frame * denominator) / numerator).toFixed(3))
    };
  });
  const durationFrames = markers[markers.length - 1].frame - offsetFrames;
  const plannedSeconds = (bars * beatsPerBar * 60) / bpm;
  return {
    bpm, beatsPerBar, bars, frameRate, offsetFrames,
    durationFrames,
    approximateDurationSeconds: Number(plannedSeconds.toFixed(3)),
    markers,
    note: "Frame positions are rounded individually from absolute beat times. Fractional frame rates are exact ratios. This is a marker grid, not an SMPTE drop-frame timecode or a rendered soundtrack."
  };
}

function beatGridCsv(result) {
  if (!result || !Array.isArray(result.markers)) throw new TypeError("Calculate a beat grid first.");
  // Export only our bounded numeric fields and fixed END marker: no user text,
  // formulas or external references can enter a spreadsheet cell.
  return "bar,beat,frame,seconds\n"
    + result.markers.map((marker) => [marker.bar, marker.beat, marker.frame, marker.seconds].join(",")).join("\n")
    + "\n";
}

module.exports = { FRAME_RATES, planBeatGrid, beatGridCsv };
