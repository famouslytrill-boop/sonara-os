// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash } = require("node:crypto");
const { UUID, MAX_NODES, validateGraph, applyCommand, validateSnapshot } = require("../public/creator-project-graph-core.js");
const time = (ms) => `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
function exportProject(project, format) {
  const graph = validateGraph(project.graph);
  if (format === "vtt" || format === "srt") {
    const captions = graph.nodes.filter((node) => node.kind === "caption").sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
    const escape = (value) => value.replace(/[\r\n]+/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (format === "srt") return { type: "application/x-subrip", extension: "srt", data: captions.map((node, index) => `${index + 1}\n${time(node.startMs).replace(".", ",")} --> ${time(node.endMs).replace(".", ",")}\n${escape(node.text)}\n`).join("\n") };
    return { type: "text/vtt", extension: "vtt", data: `WEBVTT\n\n${captions.map((node) => `${node.id}\n${time(node.startMs)} --> ${time(node.endMs)}\n${escape(node.text)}\n`).join("\n")}` };
  }
  if (format === "csv") {
    const clips = graph.nodes.filter((node) => node.kind === "clip").sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
    return { type: "text/csv", extension: "csv", data: "clip_id,source_id,in_ms,out_ms,timeline_start_ms,muted\n" + clips.map((node) => [node.id, node.sourceId, node.inMs, node.outMs, node.startMs, node.muted].join(",")).join("\n") + "\n" };
  }
  if (format !== "json") throw new TypeError("Choose JSON, VTT, SRT, or CSV.");
  const content = { version: 1, projectId: project.id, title: project.title, medium: project.medium, revision: project.revision, graph,
    mediaRendered: false, publishesAutomatically: false, rightsCleared: false };
  const sha256 = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return { type: "application/json", extension: "json", data: JSON.stringify({ ...content, sha256 }, null, 2) + "\n" };
}
module.exports = { UUID, MAX_NODES, validateGraph, applyCommand, validateSnapshot, exportProject };
