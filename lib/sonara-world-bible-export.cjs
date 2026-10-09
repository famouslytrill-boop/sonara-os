// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { normalizedDraft } = require("./sonara-world-bible-store.cjs");

// Markdown is an outline interchange only: never a generated book, screenplay,
// production-ready game or a copyright clearance / publishing receipt.
function plain(value) {
  return String(value ?? "").replace(/[\r\n]+/gu, " ").replace(/\\/gu, "\\\\")
    .replace(/[&<>*`_\[\]#|]/gu, (char) => "\\" + char).trim();
}
function renderWorldBibleMarkdown(record) {
  const validated = normalizedDraft(record?.draft);
  if (!validated.ok) throw new TypeError("A validated World Bible draft is required.");
  const { draft, blueprint } = validated;
  const lines = [
    `# ${plain(draft.title)}`, "",
    `Format: ${plain(draft.medium)}`, "",
    "This is an author-editable planning outline, not rendered media, a released book, verified copyright ownership or an approved publication.", "",
    "## World elements", ""
  ];
  for (const entity of draft.entities) {
    lines.push(`### ${plain(entity.kind)}: ${plain(entity.name)}`, `Reference: ${plain(entity.id)}`);
    if (entity.description) lines.push(`Notes: ${plain(entity.description)}`);
    lines.push("");
  }
  lines.push("## Ordered story beats", "");
  const names = new Map(draft.entities.map((entry) => [entry.id, entry.name]));
  for (let i = 0; i < draft.scenes.length; i += 1) {
    const scene = draft.scenes[i];
    const timed = blueprint.scenes[i];
    lines.push(`### ${i + 1}. ${plain(scene.title)}`, `Scene ID: ${plain(scene.id)}`,
      `Timing: ${timed.durationSeconds === null ? "not specified" : `${timed.durationSeconds} planned seconds (${timed.timingBasis})`}`);
    if (scene.placeId) lines.push(`Location: ${plain(names.get(scene.placeId))}`);
    if (scene.entityIds?.length) lines.push(`Characters / world references: ${scene.entityIds.map((id) => plain(names.get(id))).join("; ")}`);
    if (scene.dependsOn?.length) lines.push(`Follows scenes: ${scene.dependsOn.map(plain).join("; ")}`);
    if (scene.spokenWords !== undefined) lines.push(`Spoken words planned: ${scene.spokenWords}`);
    lines.push("");
  }
  lines.push("## Planning integrity", "", `Preview fingerprint: ${validated.fingerprint}`,
    "Publishing: not authorized. Source rights: not cleared. Recorded/rendered output: none.", "");
  return { type: "text/markdown; charset=utf-8", extension: "md", data: lines.join("\n") };
}
module.exports = { renderWorldBibleMarkdown };
