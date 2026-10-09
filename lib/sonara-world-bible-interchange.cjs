// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { normalizedDraft } = require("./sonara-world-bible-store.cjs");

const PPQ = 480;
const MIDI_BPM = 120;
const TICKS_PER_SECOND = PPQ * MIDI_BPM / 60;
const FRAME_RATES = Object.freeze([24, 25, 30, 60]);
const TIMELINE_MEDIA = new Set(["film", "vlog", "stream", "podcast", "music", "game", "interactive"]);

function checked(record) {
  const result = normalizedDraft(record?.draft);
  if (!result.ok) throw new TypeError("A validated World Bible is required for interchange.");
  return result;
}
function complete(blueprint, format) {
  if (!TIMELINE_MEDIA.has(blueprint.medium)) throw new TypeError(format + " requires a timed audiovisual or interactive production, not an untimed book outline.");
  if (blueprint.scenes.some((scene) => scene.durationSeconds === null || scene.startSeconds === null)
      || blueprint.estimates.runtimeSeconds === null) {
    throw new TypeError(format + " requires a duration for every scene; no timeline has been guessed.");
  }
}
function cueCell(value) {
  // Replace record-breaking controls; protect spreadsheet viewers against
  // interpreted formulas, including leading whitespace and BOM variations.
  let text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ");
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/gu, '""') + '"';
}
function renderWorldBibleCueCsv(record) {
  const { draft, blueprint } = checked(record);
  const heading = ["scene_index", "scene_id", "title", "place", "world_references",
    "depends_on", "start_seconds", "duration_seconds", "end_seconds", "timing_basis", "spoken_words"];
  const entities = new Map(draft.entities.map((entity) => [entity.id, entity.name]));
  const lines = [heading.join(",")];
  blueprint.scenes.forEach((scene, index) => {
    const record = [index + 1, scene.id, scene.title, entities.get(scene.placeId) || "",
      scene.entityIds.map((id) => entities.get(id) || id).join("; "),
      scene.dependsOn.join("; "), scene.startSeconds, scene.durationSeconds, scene.endSeconds,
      scene.timingBasis, scene.spokenWords];
    lines.push(record.map((value) => cueCell(value)).join(","));
  });
  return { type: "text/csv; charset=utf-8", extension: "csv",
    data: lines.join("\r\n") + "\r\n", status: "author_editable_cue_sheet", mediaRendered: false };
}
function rational(value, rate) {
  return { OTIO_SCHEMA: "RationalTime.1", value, rate };
}
function timeRange(seconds, fps) {
  return { OTIO_SCHEMA: "TimeRange.1", start_time: rational(0, fps),
    duration: rational(seconds * fps, fps) };
}
function renderWorldBibleOtio(record, fps = 24) {
  if (!FRAME_RATES.includes(fps)) throw new TypeError("Choose an integer frame rate of 24, 25, 30 or 60.");
  const { draft, blueprint, fingerprint } = checked(record);
  complete(blueprint, "OpenTimelineIO");
  const isAudio = ["music", "podcast"].includes(draft.medium);
  const children = blueprint.scenes.map((scene) => ({
    OTIO_SCHEMA: "Gap.1", name: scene.title, enabled: true,
    source_range: timeRange(scene.durationSeconds, fps), effects: [], markers: [],
    metadata: { sonara: { sceneId: scene.id, sceneOrder: blueprint.scenes.indexOf(scene) + 1,
      entityIds: scene.entityIds, dependsOn: scene.dependsOn, timingBasis: scene.timingBasis,
      mediaReferencePresent: false } }
  }));
  const track = { OTIO_SCHEMA: "Track.1", name: "SONARA story beat placeholders",
    kind: isAudio ? "Audio" : "Video", children,
    effects: [], markers: [], enabled: true, metadata: {}, source_range: null };
  const timeline = {
    OTIO_SCHEMA: "Timeline.1", name: draft.title,
    metadata: { sonara: { format: "storyboard_placeholder_v1",
      fingerprint, mediaRendered: false, publishesAutomatically: false,
      rightsCleared: false, placeholderGapsOnly: true } },
    tracks: { OTIO_SCHEMA: "Stack.1", name: "tracks", children: [track],
      effects: [], markers: [], enabled: true, metadata: {}, source_range: null }
  };
  return { type: "application/vnd.otio+json; charset=utf-8", extension: "otio",
    data: JSON.stringify(timeline, null, 2) + "\n",
    status: "timed_placeholder_gaps_only", mediaRendered: false };
}
function vlq(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0x0fffffff)
    throw new RangeError("MIDI variable-length time is out of range.");
  const bytes = [value & 0x7f];
  for (value >>= 7; value > 0; value >>= 7) bytes.unshift((value & 0x7f) | 0x80);
  return Buffer.from(bytes);
}
function midiMeta(delta, kind, bytes) {
  if (!Number.isSafeInteger(delta) || delta < 0) throw new RangeError("Invalid MIDI scene position.");
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return Buffer.concat([vlq(delta), Buffer.from([0xff, kind]), vlq(payload.length), payload]);
}
function renderWorldBibleMidi(record) {
  const { draft, blueprint } = checked(record);
  complete(blueprint, "MIDI cue markers");
  const events = [
    midiMeta(0, 0x03, Buffer.from("SONARA cue markers (no notes)", "utf8")),
    midiMeta(0, 0x51, Buffer.from([0x07, 0xa1, 0x20])), // 120 BPM
    midiMeta(0, 0x58, Buffer.from([4, 2, 24, 8])) // 4/4
  ];
  let previousTick = 0;
  for (const scene of blueprint.scenes) {
    const tick = scene.startSeconds * TICKS_PER_SECOND;
    const title = Buffer.from(scene.title, "utf8");
    events.push(midiMeta(tick - previousTick, 0x06, title));
    previousTick = tick;
  }
  const end = blueprint.estimates.runtimeSeconds * TICKS_PER_SECOND;
  events.push(midiMeta(end - previousTick, 0x2f, Buffer.alloc(0)));
  const track = Buffer.concat(events);
  const header = Buffer.alloc(14);
  header.write("MThd", 0, "ascii");
  header.writeUInt32BE(6, 4);
  header.writeUInt16BE(0, 8); // SMF format zero
  header.writeUInt16BE(1, 10);
  header.writeUInt16BE(PPQ, 12);
  const chunk = Buffer.alloc(8);
  chunk.write("MTrk", 0, "ascii");
  chunk.writeUInt32BE(track.length, 4);
  return { type: "audio/midi", extension: "mid",
    data: Buffer.concat([header, chunk, track]),
    status: "tempo_120bpm_markers_only_no_notes", mediaRendered: false };
}
module.exports = { FRAME_RATES, renderWorldBibleCueCsv, renderWorldBibleOtio, renderWorldBibleMidi };
