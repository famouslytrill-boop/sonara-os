"use strict";
const assert = require("node:assert/strict");
const { HARMONIES, studyChord, assessNarrativeBeats } =
  require("../lib/sonara-creative-theory-models.cjs");

describe("SONARA creative theory research models", () => {
  it("keeps named chord intervals immutable", () => {
    assert.deepEqual(HARMONIES.major, [0, 4, 7]);
    assert.deepEqual(HARMONIES.minor, [0, 3, 7]);
    assert.ok(Object.isFrozen(HARMONIES));
    assert.ok(Object.isFrozen(HARMONIES.major));
  });
  it("derives C major pitches without generating a recording", () => {
    const chord = studyChord({ rootMidi: 60, quality: "major" });
    assert.deepEqual(chord.notes.map(x => x.midi), [60, 64, 67]);
    assert.equal(chord.audioCreated, false);
    assert.equal(chord.mode, "equal_temperament_educational_only");
  });
  it("derives a minor seventh chord and preserves input", () => {
    const input = { rootMidi: 60, quality: "minor7" };
    const result = studyChord(input);
    assert.deepEqual(result.notes.map(x => x.midi), [60, 63, 67, 70]);
    assert.deepEqual(input, { rootMidi: 60, quality: "minor7" });
  });
  it("rejects invalid and over-range chord configurations", () => {
    assert.throws(() => studyChord({ rootMidi: 125, quality: "major" }), RangeError);
    assert.throws(() => studyChord({ rootMidi: -1 }), RangeError);
    assert.throws(() => studyChord({ rootMidi: 60, quality: "__proto__" }), RangeError);
    assert.throws(() => studyChord({ rootMidi: 60.5 }), RangeError);
  });
  it("reports a tension climax using metadata without ingesting manuscript text", () => {
    const plan = assessNarrativeBeats([
      { id: "setup", tension: 20 }, { id: "conflict", tension: 60 },
      { id: "climax", tension: 90 }, { id: "finale", tension: 10 }
    ]);
    assert.equal(plan.count, 4);
    assert.equal(plan.averageTension, 45);
    assert.equal(plan.highestTension, 90);
    assert.equal(plan.peakBeatId, "climax");
    assert.equal(plan.peakIndex, 2);
    assert.equal(plan.totalAbsoluteChange, 150);
    assert.equal(plan.endingMinusOpeningTension, -10);
    assert.equal(plan.contentGenerated, false);
    assert.equal(plan.publicationAuthority, false);
  });
  it("replays the same tension inputs identically", () => {
    const beats = [{ id: "a", tension: 0 }, { id: "b", tension: 100 }];
    assert.deepEqual(assessNarrativeBeats(beats), assessNarrativeBeats(beats));
  });
  it("rejects duplicate IDs, forged identifiers and absent beats", () => {
    assert.throws(() => assessNarrativeBeats([{ id: "same", tension: 10 }, { id: "same", tension: 20 }]), TypeError);
    assert.throws(() => assessNarrativeBeats([{ id: "../x", tension: 10 }, { id: "ok", tension: 20 }]), TypeError);
    assert.throws(() => assessNarrativeBeats([]), RangeError);
  });
  it("rejects invalid or unbounded tension and extremely long sequences", () => {
    assert.throws(() => assessNarrativeBeats([{ id: "a", tension: -1 }, { id: "b", tension: 50 }]), RangeError);
    assert.throws(() => assessNarrativeBeats([{ id: "a", tension: NaN }, { id: "b", tension: 50 }]), RangeError);
    assert.throws(() => assessNarrativeBeats(Array.from({ length: 65 }, (_, i) => ({ id: "a"+i, tension: 2 }))), RangeError);
  });
});
