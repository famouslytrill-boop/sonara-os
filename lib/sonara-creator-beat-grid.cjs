// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A bounded, provider-free beat/bar grid for lining up music and film frames.
// Frame indices are the source of truth. These are NOT SMPTE timecodes.
const FRAME_RATES = Object.freeze({
  "24": Object.freeze({ numerator: 24, denominator: 1 }),
  "25": Object.freeze({ numerator: 25, denominator: 1 }),
  "30": Object.freeze({ numerator: 30, denominator: 1 }),
  "60": Object.freeze({ numerator: 60, denominator: 1 }),
  "24000/1001": Object.freeze({ numerator: 24000, denominator: 1001 }),
  "30000/1001": Object.freeze({ numerator: 30000, denominator: 1001 }),
  "60000/1001": Object.freeze({ numerator: 60000, denominator: 1001 })
});
const MAX_TEMPO_CHANGES = 16;

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

// "5:90,9:140" means bar 5 starts at 90 BPM and bar 9 starts at 140 BPM.
// Events are strictly increasing and must start after the first bar.
function parseTempoChanges(value, bars) {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value !== "string" || value.length > 160) throw new TypeError("Tempo changes must be a short list such as 5:90,9:140.");
  if (!value.trim()) return [];
  const entries = value.split(",");
  if (entries.length > MAX_TEMPO_CHANGES) throw new RangeError("Use at most 16 tempo changes.");
  let previous = 1;
  return entries.map((entry) => {
    const match = /^\s*(\d+):(\d+)\s*$/.exec(entry);
    if (!match) throw new TypeError("Enter tempo changes as bar:BPM, for example 5:90,9:140.");
    const bar = integer(match[1], "Change bar", 2, bars);
    const bpm = integer(match[2], "Change tempo (BPM)", 20, 320);
    if (bar <= previous) throw new TypeError("Tempo changes must use distinct bars in ascending order.");
    previous = bar;
    return { bar, bpm };
  });
}

function gcd(a, b) {
  while (b) { const remainder = a % b; a = b; b = remainder; }
  return a;
}
function roundedRatio(numerator, denominator) {
  // Exact, positive half-up rounding matches Number Math.round at positive times.
  return Number((numerator * 2n + denominator) / (2n * denominator));
}
function frameMilliseconds(frame, rate) {
  return roundedRatio(BigInt(frame) * 1000n * BigInt(rate.denominator), BigInt(rate.numerator));
}
function vttTimestamp(totalMs) {
  const pad = (value, width) => String(value).padStart(width, "0");
  return pad(Math.floor(totalMs / 3600000), 2) + ":"
    + pad(Math.floor(totalMs / 60000) % 60, 2) + ":"
    + pad(Math.floor(totalMs / 1000) % 60, 2) + "."
    + pad(totalMs % 1000, 3);
}

function planBeatGrid(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Supply the beat-grid settings.");
  const bpm = integer(input.bpm ?? 120, "Tempo (BPM)", 20, 320);
  const beatsPerBar = integer(input.beatsPerBar ?? 4, "Tempo pulses per bar", 2, 12);
  const bars = integer(input.bars ?? 16, "Bars", 1, 128);
  const offsetFrames = integer(input.offsetFrames ?? 0, "Frame offset", 0, 2000000);
  if (typeof input.frameRate !== "undefined" && typeof input.frameRate !== "string" && typeof input.frameRate !== "number") {
    throw new TypeError("Choose a supported film frame rate.");
  }
  const frameRate = String(input.frameRate ?? "24");
  if (!Object.hasOwn(FRAME_RATES, frameRate)) throw new TypeError("Choose a supported film frame rate.");
  const rate = FRAME_RATES[frameRate];
  const tempoChanges = parseTempoChanges(input.tempoChanges, bars);

  let secondsN = 0n, secondsD = 1n, activeBpm = bpm, nextChange = 0;
  const markers = [];
  for (let index = 0; index <= bars; index += 1) {
    const bar = index + 1;
    if (index < bars && nextChange < tempoChanges.length && tempoChanges[nextChange].bar === bar) {
      activeBpm = tempoChanges[nextChange].bpm;
      nextChange += 1;
    }
    const frameDelta = roundedRatio(secondsN * BigInt(rate.numerator), secondsD * BigInt(rate.denominator));
    const frame = offsetFrames + frameDelta;
    markers.push({ bar: index === bars ? "END" : String(bar), beat: index * beatsPerBar, frame,
      seconds: Number((frame * rate.denominator / rate.numerator).toFixed(3)) });
    if (index === bars) break;
    // Exact fraction: each whole measure adds beatsPerBar*60/BPM seconds.
    const b = BigInt(activeBpm);
    const n = secondsN * b + BigInt(beatsPerBar * 60) * secondsD;
    const d = secondsD * b;
    const divisor = gcd(n, d);
    secondsN = n / divisor;
    secondsD = d / divisor;
  }
  const durationFrames = markers.at(-1).frame - offsetFrames;
  const approximateDurationSeconds = Number((Number(secondsN) / Number(secondsD)).toFixed(3));
  return { bpm, beatsPerBar, bars, frameRate, offsetFrames, tempoChanges,
    durationFrames, approximateDurationSeconds, markers,
    note: "Each marker uses absolute beat time and exact rational film-frame timing. Chapter exports represent bar boundaries, not subtitles. This is not SMPTE timecode, a rendered soundtrack, or a verified recording sync." };
}

function beatGridCsv(result) {
  if (!result || !Array.isArray(result.markers)) throw new TypeError("Calculate a beat grid first.");
  // Only bounded numeric fields and fixed END marker enter cells: no formula injection.
  return "bar,beat,frame,seconds\n"
    + result.markers.map((marker) => [marker.bar, marker.beat, marker.frame, marker.seconds].join(",")).join("\n")
    + "\n";
}

function beatGridChaptersVtt(result) {
  if (!result || !Array.isArray(result.markers) || result.markers.length !== result.bars + 1
    || !Object.hasOwn(FRAME_RATES, result.frameRate)) throw new TypeError("Calculate a beat grid first.");
  const rate = FRAME_RATES[result.frameRate];
  const cues = [];
  for (let i = 0; i < result.bars; i += 1) {
    const start = frameMilliseconds(result.markers[i].frame, rate);
    const end = frameMilliseconds(result.markers[i + 1].frame, rate);
    if (end <= start) throw new RangeError("The chapter boundaries cannot overlap or have zero duration.");
    cues.push("bar-" + (i + 1) + "\n" + vttTimestamp(start) + " --> " + vttTimestamp(end)
      + "\nBar " + (i + 1) + "\n");
  }
  return "WEBVTT\n\n" + cues.join("\n");
}

function beatGridManifest(result) {
  if (!result || !Array.isArray(result.markers) || !Object.hasOwn(FRAME_RATES, result.frameRate)) {
    throw new TypeError("Calculate a beat grid first.");
  }
  return JSON.stringify({ version: 1, type: "sonara_music_picture_markers",
    timebase: FRAME_RATES[result.frameRate], bpm: result.bpm,
    beatsPerBar: result.beatsPerBar, bars: result.bars,
    offsetFrames: result.offsetFrames, tempoChanges: result.tempoChanges,
    markers: result.markers, rightsCleared: false, renderedMedia: false }, null, 2) + "\n";
}

module.exports = { FRAME_RATES, MAX_TEMPO_CHANGES, parseTempoChanges, planBeatGrid, beatGridCsv, beatGridChaptersVtt, beatGridManifest };
