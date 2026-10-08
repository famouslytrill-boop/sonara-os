// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/** Original, dependency-free musical/narrative study models.
 * No music synthesis, text generation, lyric ingestion or content ownership.
 */
const { midiFrequency } = require("./sonara-creative-simulation-kernel.cjs");
const HARMONIES = Object.freeze({
  major: Object.freeze([0, 4, 7]),
  minor: Object.freeze([0, 3, 7]),
  diminished: Object.freeze([0, 3, 6]),
  augmented: Object.freeze([0, 4, 8]),
  sus2: Object.freeze([0, 2, 7]),
  sus4: Object.freeze([0, 5, 7]),
  major7: Object.freeze([0, 4, 7, 11]),
  minor7: Object.freeze([0, 3, 7, 10]),
  dominant7: Object.freeze([0, 4, 7, 10])
});
function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + " out of bounded integer range");
  }
  return value;
}
function studyChord({ rootMidi, quality = "major" }) {
  integer(rootMidi, "rootMidi", 0, 127);
  if (typeof quality !== "string" || !Object.hasOwn(HARMONIES, quality)) {
    throw new RangeError("unknown chord quality");
  }
  const intervals = HARMONIES[quality];
  if (rootMidi + Math.max(...intervals) > 127) throw new RangeError("chord exceeds MIDI range");
  return Object.freeze({
    mode: "equal_temperament_educational_only", rootMidi, quality,
    semitones: intervals, notes: Object.freeze(intervals.map(delta => Object.freeze({
      midi: rootMidi + delta, hertz: midiFrequency(rootMidi + delta)
    }))),
    audioCreated: false
  });
}

/** Scores pre-authored beats, not the text of a book or an edited media timeline. */
function assessNarrativeBeats(beats) {
  if (!Array.isArray(beats) || beats.length < 2 || beats.length > 64) {
    throw new RangeError("story beats require 2..64 metadata entries");
  }
  const seen = new Set();
  const tensions = [];
  const keys = [];
  for (const [index, beat] of beats.entries()) {
    if (!beat || typeof beat !== "object" || Array.isArray(beat)) {
      throw new TypeError("invalid story beat");
    }
    const { id, tension } = beat;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || seen.has(id)) {
      throw new TypeError("unique simple beat IDs required");
    }
    seen.add(id);
    keys.push(id);
    tensions.push(integer(tension, "tension[" + index + "]", 0, 100));
  }
  let change = 0;
  for (let i = 1; i < tensions.length; i++) change += Math.abs(tensions[i] - tensions[i - 1]);
  const peak = Math.max(...tensions);
  const peakIndex = tensions.indexOf(peak);
  const meanTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
  return Object.freeze({
    mode: "user_authored_beat_metadata_only",
    count: tensions.length, averageTension: meanTension,
    highestTension: peak, peakBeatId: keys[peakIndex], peakIndex,
    totalAbsoluteChange: change,
    endingMinusOpeningTension: tensions[tensions.length - 1] - tensions[0],
    contentGenerated: false, publicationAuthority: false
  });
}
module.exports = { HARMONIES, studyChord, assessNarrativeBeats };
