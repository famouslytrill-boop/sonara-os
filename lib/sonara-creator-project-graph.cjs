// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash } = require("node:crypto");
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
      if (!UUID.test(node.assetId) || sources.has(node.assetId)) fail("Choose a unique asset from your workspace.");
      sources.add(node.assetId);
      return { id: node.id, kind: "source", assetId: node.assetId, durationMs: milliseconds(node.durationMs, "Source duration", 1) };
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
  if (command.action === "remove") {
    if (!UUID.test(command.nodeId) || !current.nodes.some((node) => node.id === command.nodeId)) fail("That entry is not in this project.");
    if (current.nodes.some((node) => node.sourceId === command.nodeId)) fail("Remove the clips using this source first.");
    return validateGraph({ version: 1, nodes: current.nodes.filter((node) => node.id !== command.nodeId) });
  }
  const kinds = { add_source: "source", add_clip: "clip", add_caption: "caption" };
  const kind = kinds[command.action];
  if (!kind) fail("Unsupported project action.");
  return validateGraph({ version: 1, nodes: [...current.nodes, { ...command, kind, id }] });
}
const time = (ms) => `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
function exportProject(project, format) {
  const graph = validateGraph(project.graph);
  if (format === "vtt") {
    const captions = graph.nodes.filter((node) => node.kind === "caption").sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
    const escape = (value) => value.replace(/[\r\n]+/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return { type: "text/vtt", extension: "vtt", data: `WEBVTT\n\n${captions.map((node) => `${node.id}\n${time(node.startMs)} --> ${time(node.endMs)}\n${escape(node.text)}\n`).join("\n")}` };
  }
  if (format === "csv") {
    const clips = graph.nodes.filter((node) => node.kind === "clip").sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
    return { type: "text/csv", extension: "csv", data: "clip_id,source_id,in_ms,out_ms,timeline_start_ms,muted\n" + clips.map((node) => [node.id, node.sourceId, node.inMs, node.outMs, node.startMs, node.muted].join(",")).join("\n") + "\n" };
  }
  if (format !== "json") fail("Choose JSON, VTT, or CSV.");
  const content = { version: 1, projectId: project.id, title: project.title, medium: project.medium, revision: project.revision, graph,
    mediaRendered: false, publishesAutomatically: false, rightsCleared: false };
  const sha256 = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return { type: "application/json", extension: "json", data: JSON.stringify({ ...content, sha256 }, null, 2) + "\n" };
}
module.exports = { UUID, MAX_NODES, validateGraph, applyCommand, exportProject };
