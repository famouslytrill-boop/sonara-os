// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { renderWorldBibleCueCsv, renderWorldBibleOtio, renderWorldBibleMidi } = require("../lib/sonara-world-bible-interchange.cjs");
const source = () => ({ draft: { title: "Original Project", medium: "podcast",
  entities: [{ id: "host", kind: "character", name: "Presenter" }, { id: "studio", kind: "place", name: "Booth" }],
  scenes: [{ id: "opening", title: "Introduction", entityIds: ["host"], placeId: "studio", durationSeconds: 7 },
    { id: "segment", title: "Interview", entityIds: ["host"], dependsOn: ["opening"], durationSeconds: 11 }],
  resources: {} } });
function vlq(data, at) {
  let value = 0, count = 0, byte;
  do {
    byte = data[at++];
    assert.notEqual(byte, undefined);
    value = value * 128 + (byte & 0x7f);
    assert.ok(++count <= 4, "MIDI variable length uses at most four bytes");
  } while (byte & 0x80);
  return { value, at };
}
function midiEvents(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "MThd");
  assert.equal(buffer.readUInt32BE(4), 6);
  assert.equal(buffer.readUInt16BE(8), 0);
  assert.equal(buffer.readUInt16BE(10), 1);
  assert.equal(buffer.readUInt16BE(12), 480);
  assert.equal(buffer.toString("ascii", 14, 18), "MTrk");
  assert.equal(buffer.readUInt32BE(18), buffer.length - 22);
  let at = 22, tick = 0;
  const events = [];
  while (at < buffer.length) {
    const delta = vlq(buffer, at); at = delta.at; tick += delta.value;
    assert.equal(buffer[at++], 0xff, "only MIDI metadata, no musical notes or instruments");
    const kind = buffer[at++];
    const len = vlq(buffer, at); at = len.at;
    const data = buffer.subarray(at, at + len.value); at += len.value;
    events.push({ tick, kind, data });
  }
  assert.equal(at, buffer.length);
  return events;
}
describe("World Bible deterministic production interchange", () => {
  it("exports stable RFC-4180-style CSV with preserved ordering and known timing", () => {
    const row = renderWorldBibleCueCsv(source());
    assert.equal(row.extension, "csv");
    assert.equal(row.mediaRendered, false);
    assert.match(row.data, /^scene_index,scene_id,title,/);
    assert.match(row.data, /"opening","Introduction","Booth","Presenter","","0","7","7"/);
    assert.match(row.data, /"segment","Interview","","Presenter","opening","7","11","18"/);
    assert.deepEqual(renderWorldBibleCueCsv(source()), row);
  });
  it("escapes spreadsheet formulas, quotes and control characters; does not invent missing durations", () => {
    const q = source();
    q.draft.scenes[0].title = "=HYPERLINK(\"https://evil.invalid\",\"bad\")";
    q.draft.entities[0].name = "@SUM(1,1)";
    delete q.draft.scenes[1].durationSeconds;
    const row = renderWorldBibleCueCsv(q);
    assert.match(row.data, /"'=HYPERLINK\(""https:\/\/evil.invalid""/);
    assert.match(row.data, /"'@SUM\(1,1\)"/);
    assert.match(row.data, /"segment","Interview","","'@SUM\(1,1\)","opening","7","",""/);
    assert.doesNotMatch(row.data, /\n=HYPERLINK/);
  });
  it("creates parseable OTIO Gap.1 storyboard placeholders at a requested integer frame rate", () => {
    const file = renderWorldBibleOtio(source(), 30);
    assert.equal(file.extension, "otio");
    const timeline = JSON.parse(file.data);
    assert.equal(timeline.OTIO_SCHEMA, "Timeline.1");
    assert.equal(timeline.tracks.OTIO_SCHEMA, "Stack.1");
    assert.equal(timeline.metadata.sonara.rightsCleared, false);
    const track = timeline.tracks.children[0];
    assert.equal(track.kind, "Audio");
    assert.deepEqual(track.children.map((entry) => entry.OTIO_SCHEMA), ["Gap.1", "Gap.1"]);
    assert.deepEqual(track.children.map((entry) => entry.source_range.duration.value), [210, 330]);
    assert.ok(track.children.every((entry) => entry.source_range.duration.rate === 30));
    assert.ok(track.children.every((entry) => entry.metadata.sonara.mediaReferencePresent === false));
    assert.ok(!file.data.includes("file://") && !file.data.includes("https://"));
    assert.deepEqual(renderWorldBibleOtio(source(), 30), file);
  });
  it("makes a real marker-only MIDI type 0 with exact 120 BPM second-to-tick mapping", () => {
    const result = renderWorldBibleMidi(source());
    assert.equal(result.extension, "mid");
    assert.ok(Buffer.isBuffer(result.data));
    const events = midiEvents(result.data);
    assert.deepEqual(events.filter((e) => e.kind === 0x06).map((e) => [e.tick, e.data.toString("utf8")]),
      [[0, "Introduction"], [6720, "Interview"]]);
    assert.equal(events.find((e) => e.kind === 0x51).data.toString("hex"), "07a120");
    assert.equal(events.at(-1).kind, 0x2f);
    assert.equal(events.at(-1).tick, 17280);
    assert.equal(events.some((e) => e.kind === 0x90), false);
    assert.deepEqual(renderWorldBibleMidi(source()).data, result.data);
  });
  it("rejects unplanned timing and unsupported frame rates rather than fabricating media or cut points", () => {
    const unknown = source();
    delete unknown.draft.scenes[1].durationSeconds;
    assert.throws(() => renderWorldBibleOtio(unknown), /requires a duration/);
    assert.throws(() => renderWorldBibleMidi(unknown), /requires a duration/);
    assert.throws(() => renderWorldBibleOtio(source(), 29.97), /integer frame rate/);
    const book = source(); book.draft.medium = "book";
    assert.throws(() => renderWorldBibleOtio(book), /not an untimed book outline/);
    assert.throws(() => renderWorldBibleMidi(book), /not an untimed book outline/);
  });
  it("does not leak injected provider credentials or arbitrary client controls through export", () => {
    const f = source();
    f.draft.serviceRole = "PRIVATE_KEY";
    f.draft.entities[0].privateField = "PRIVATE_KEY";
    for(const output of [renderWorldBibleCueCsv(f).data, renderWorldBibleOtio(f).data,
      renderWorldBibleMidi(f).data.toString("utf8")]) {
      assert.equal(output.includes("PRIVATE_KEY"), false);
    }
    assert.throws(() => renderWorldBibleCueCsv({ draft: { title: "bad" } }), /validated World Bible/);
  });
});
