// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
"use strict";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_NODES = 500;
const MAX_MS = 24 * 60 * 60 * 1000;
const fail = (message) => { throw new TypeError(message); };
const text = (value, max, label) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${label} is required (maximum ${max} characters).`);
  return value.trim();
};
function milliseconds(value, label, min = 0) {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !/^\d+$/.test(value))) fail(`${label} must be a whole number.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > MAX_MS) fail(`${label} must be whole milliseconds from ${min} to ${MAX_MS}.`);
  return number;
}
function validateGraph(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.nodes) || input.nodes.length > MAX_NODES) fail("Invalid project graph or too many entries.");
  const seen = new Set();
  const sources = new Set();
  const nodes = input.nodes.map((node) => {
    if (!node || !UUID.test(node.id) || seen.has(node.id)) fail("Each entry needs a unique ID.");
    seen.add(node.id);
    if (node.kind === "source") {
      const origin = node.origin || "library";
      if (!["library", "generation"].includes(origin)) fail("Choose a supported asset library.");
      const key = `${origin}:${node.assetId}`;
      if (!UUID.test(node.assetId) || sources.has(key)) fail("Choose a unique asset from your workspace.");
      sources.add(key);
      return { id: node.id, kind: "source", assetId: node.assetId, ...(origin === "generation" ? { origin } : {}), durationMs: milliseconds(node.durationMs, "Source duration", 1) };
    }
    if (node.kind === "caption") {
      const startMs = milliseconds(node.startMs, "Caption start");
      const endMs = milliseconds(node.endMs, "Caption end", 1);
      if (endMs <= startMs) fail("A caption must end after it starts.");
      return { id: node.id, kind: "caption", startMs, endMs, text: text(node.text, 2000, "Caption text") };
    }
    if (node.kind === "clip") {
      if (!UUID.test(node.sourceId)) fail("Choose a source in this project.");
      const inMs = milliseconds(node.inMs, "Source in");
      const outMs = milliseconds(node.outMs, "Source out", 1);
      const startMs = milliseconds(node.startMs, "Timeline start");
      if (outMs <= inMs || startMs + outMs - inMs > MAX_MS) fail("Invalid clip duration.");
      return { id: node.id, kind: "clip", sourceId: node.sourceId, inMs, outMs, startMs, muted: node.muted === true || node.muted === "true" };
    }
    return fail("Unsupported project entry.");
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes.filter((entry) => entry.kind === "clip")) {
    const source = byId.get(node.sourceId);
    if (source?.kind !== "source" || node.outMs > source.durationMs) fail("Clip points to a missing source or exceeds its declared duration.");
  }
  // Edges are derived, never accepted from clients. This graph is acyclic by
  // construction: sources -> clips; captions annotate the project timeline.
  return { version: 1, nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
    edges: nodes.filter((node) => node.kind === "clip").map((node) => ({ from: node.sourceId, to: node.id, relation: "used_by" })).sort((a, b) => a.to.localeCompare(b.to)) };
}
function applyCommand(graph, command, id) {
  const current = validateGraph(graph);
  if (!command || typeof command !== "object") fail("Choose a project action.");
  if (command.action === "split_clip") {
    const clip = current.nodes.find((node) => node.id === command.nodeId && node.kind === "clip");
    if (!clip) fail("Choose a clip in this project.");
    const atMs = milliseconds(command.atMs, "Split position");
    const offset = atMs - clip.startMs;
    if (offset <= 0 || offset >= clip.outMs - clip.inMs) fail("Split inside the clip's timeline, not at its edges.");
    return validateGraph({ version: 1, nodes: [
      ...current.nodes.map((node) => node.id === clip.id ? { ...clip, outMs: clip.inMs + offset } : node),
      { ...clip, id, inMs: clip.inMs + offset, startMs: atMs }
    ] });
  }
  if (command.action === "shift_captions") {
    const value = command.offsetMs;
    if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !/^-?\d+$/.test(value))) fail("Caption shift must be signed whole milliseconds.");
    const offset = Number(value);
    if (!Number.isSafeInteger(offset) || !offset || Math.abs(offset) > MAX_MS) fail("Choose a nonzero caption shift within 24 hours.");
    if (!current.nodes.some((node) => node.kind === "caption")) fail("Add captions before shifting them.");
    // Validate the complete result before returning it: one invalid cue prevents
    // the entire operation, preserving both server and device draft snapshots.
    return validateGraph({ version: 1, nodes: current.nodes.map((node) => node.kind === "caption"
      ? { ...node, startMs: node.startMs + offset, endMs: node.endMs + offset } : node) });
  }
  const updates = { update_source: ["durationMs"], update_clip: ["inMs", "outMs", "startMs", "muted"], update_caption: ["startMs", "endMs", "text"] };
  if (Object.hasOwn(updates, command.action)) {
    const kind = command.action.slice(7);
    const node = current.nodes.find((entry) => entry.id === command.nodeId && entry.kind === kind);
    if (!node) fail("That entry is not in this project.");
    const patch = {};
    for (const key of updates[command.action]) if (Object.hasOwn(command, key)) patch[key] = command[key];
    if (!Object.keys(patch).length) fail("Choose a change to save.");
    return validateGraph({ version: 1, nodes: current.nodes.map((entry) => entry.id === node.id ? { ...entry, ...patch } : entry) });
  }
  if (command.action === "remove") {
    if (!UUID.test(command.nodeId) || !current.nodes.some((node) => node.id === command.nodeId)) fail("That entry is not in this project.");
    if (current.nodes.some((node) => node.sourceId === command.nodeId)) fail("Remove the clips using this source first.");
    return validateGraph({ version: 1, nodes: current.nodes.filter((node) => node.id !== command.nodeId) });
  }
  const kinds = { add_source: "source", add_clip: "clip", add_caption: "caption" };
  const kind = kinds[command.action];
  if (!kind) fail("Unsupported project action.");
  let source = command;
  if (kind === "source" && command.assetRef !== undefined) {
    const match = typeof command.assetRef === "string" && command.assetRef.match(/^(library|generation):([0-9a-f-]+)$/);
    if (!match) fail("Choose an asset from your workspace.");
    source = { ...command, origin: match[1], assetId: match[2] };
  }
  return validateGraph({ version: 1, nodes: [...current.nodes, { ...source, kind, id }] });
}
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
function validateSnapshot(input, projectId) {
  if (!input || input.version !== 1 || !UUID.test(input.projectId) || (projectId && input.projectId !== projectId)) fail("Choose a JSON draft for this project.");
  if (!Number.isSafeInteger(input.revision) || input.revision < 1 || !["audio", "video", "image", "mixed"].includes(input.medium)) fail("This draft has an invalid revision or project kind.");
  const snapshot = { version: 1, projectId: input.projectId, title: text(input.title, 180, "Project title"), medium: input.medium, revision: input.revision, graph: validateGraph(input.graph) };
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_SNAPSHOT_BYTES) fail("Use a project draft up to 2 MB.");
  return snapshot;
}
function summarizeTimeline(input) {
  const graph = validateGraph(input);
  const clips = graph.nodes.filter((node) => node.kind === "clip");
  const captions = graph.nodes.filter((node) => node.kind === "caption");
  const sources = graph.nodes.filter((node) => node.kind === "source");
  const used = new Set(clips.map((node) => node.sourceId));
  const durationMs = Math.max(0, ...clips.map((node) => node.startMs + node.outMs - node.inMs), ...captions.map((node) => node.endMs));
  const events = new Map([[0, 0], [durationMs, 0]]);
  for (const clip of clips) {
    const end = clip.startMs + clip.outMs - clip.inMs;
    events.set(clip.startMs, (events.get(clip.startMs) || 0) + 1);
    events.set(end, (events.get(end) || 0) - 1);
  }
  let previous = 0, active = 0, gapMs = 0, overlapMs = 0;
  for (const [at, delta] of [...events].sort((a, b) => a[0] - b[0])) {
    if (active === 0) gapMs += at - previous;
    if (active > 1) overlapMs += at - previous;
    active += delta; previous = at;
  }
  return { durationMs, clipCount: clips.length, captionCount: captions.length, sourceCount: sources.length,
    unusedSourceCount: sources.filter((node) => !used.has(node.id)).length,
    mutedClipCount: clips.filter((node) => node.muted).length, gapMs, overlapMs };
}
const core = { UUID, MAX_NODES, MAX_SNAPSHOT_BYTES, validateGraph, applyCommand, validateSnapshot, summarizeTimeline };
if (typeof module !== "undefined" && module.exports) module.exports = core;
else globalThis.SonaraCreatorGraph = core;
})();
