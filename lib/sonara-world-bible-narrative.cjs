// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { normalizedDraft } = require("./sonara-world-bible-store.cjs");

const schema = "sonara.narrative-integrity.v1";
function validated(record) {
  const checked = normalizedDraft(record?.draft);
  if (!checked.ok) throw new TypeError("A validated World Bible source is required.");
  return checked;
}
function analyzeNarrative(record) {
  const { draft, blueprint, fingerprint } = validated(record);
  const scenes = blueprint.scenes, entities = draft.entities;
  const index = new Map(scenes.map((scene, i) => [scene.id, i]));
  const referenced = new Set();
  const appearance = new Map(entities.map((e) => [e.id, 0]));
  const reverse = new Map(scenes.map((scene) => [scene.id, []]));
  const depth = new Map(), predecessor = new Map(), durations = new Map();
  let edges = 0, explicit = 0, estimated = 0, unknown = 0;
  for (const scene of scenes) {
    for (const id of new Set([...scene.entityIds, ...(scene.placeId ? [scene.placeId] : [])])) {
      referenced.add(id);
      appearance.set(id, (appearance.get(id) || 0) + 1);
    }
    for (const dependency of scene.dependsOn) reverse.get(dependency).push(scene.id);
    edges += scene.dependsOn.length;
    const earlier = scene.dependsOn.map((id) => ({
      id, depth: depth.get(id), duration: durations.get(id)
    }));
    // The upstream validator guarantees each predecessor appeared earlier.
    let longest = null;
    for (const candidate of earlier) {
      if (!longest || candidate.depth > longest.depth) longest = candidate;
    }
    depth.set(scene.id, 1 + (longest?.depth || 0));
    predecessor.set(scene.id, longest?.id || null);
    if (scene.durationSeconds === null) unknown++;
    if (scene.timingBasis === "explicit") explicit++;
    if (scene.timingBasis === "estimated_speech") estimated++;
    durations.set(scene.id, scene.durationSeconds === null
      ? null : scene.durationSeconds + (earlier.length ? Math.max(...earlier.map((x) => x.duration ?? 0)) : 0));
  }
  const roots = scenes.filter((scene) => scene.dependsOn.length === 0).map((scene) => scene.id);
  const terminals = scenes.filter((scene) => reverse.get(scene.id).length === 0).map((scene) => scene.id);
  const top = scenes.reduce((best, scene) => depth.get(scene.id) > (best ? depth.get(best.id) : 0) ? scene : best, null);
  const longestChain = [];
  let cursor = top?.id || null;
  while (cursor !== null) { longestChain.unshift(cursor); cursor = predecessor.get(cursor) || null; }
  // Design prerequisites are not narrative choices or playable branching.
  // Count undirected dependency components only, never infer reachability in a game.
  const seen = new Set(), groups = [];
  for (const scene of scenes) {
    if (seen.has(scene.id)) continue;
    const stack = [scene.id], group = [];
    seen.add(scene.id);
    while (stack.length) {
      const id = stack.pop();
      group.push(id);
      const links = [...scenes[index.get(id)].dependsOn, ...reverse.get(id)];
      for (const link of links) if (!seen.has(link)) { seen.add(link); stack.push(link); }
    }
    groups.push(group.sort((a, b) => index.get(a) - index.get(b)));
  }
  const warnings = [
    ...entities.filter((e) => !referenced.has(e.id)).map((e) =>
      ({ severity: "info", code: "unused_world_element", entityId: e.id })),
    ...scenes.filter((s) => s.durationSeconds === null).map((s) =>
      ({ severity: "info", code: "unplanned_scene_timing", sceneId: s.id }))
  ];
  return {
    schema, sourceFingerprint: fingerprint, medium: draft.medium, projectTitle: draft.title,
    counts: { scenes: scenes.length, entities: entities.length, dependencyEdges: edges,
      independentDependencyGroups: groups.length, roots: roots.length, terminalScenes: terminals.length,
      explicitDurations: explicit, estimatedSpeechDurations: estimated, unknownDurations: unknown },
    rootSceneIds: roots, terminalSceneIds: terminals, dependencyGroups: groups,
    longestDependencyChainSceneIds: longestChain, longestDependencyChainScenes: longestChain.length,
    // Critical-path duration is intentionally absent if any scene timing is unknown,
    // including scenes outside the longest-count chain. This is NOT staff time,
    // production cost, project ETA or player completion time.
    criticalPathPlannedSeconds: unknown ? null
      : Math.max(...scenes.map((scene) => durations.get(scene.id))),
    totalSequentialPlannedSeconds: blueprint.estimates.runtimeSeconds,
    entityUsage: entities.map((entity) => ({
      id: entity.id, kind: entity.kind, appearancesInScenes: appearance.get(entity.id)
    })),
    warnings,
    semantics: {
      edges: "author_declared_scene_prerequisites",
      branchChoices: "not_modelled",
      characterContinuity: "not_verified",
      runtimeExecution: false, mediaRendered: false,
      publishingAuthorized: false, sourceRightsCleared: false,
      analysisIsAdvisory: true
    }
  };
}
function dotString(s) {
  return '"' + String(s).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')
    .replace(/\r/gu, "\\r").replace(/\n/gu, "\\n").replace(/\t/gu, "\\t") + '"';
}
function renderNarrativeDot(record) {
  const { draft, blueprint } = validated(record);
  const output = ["// SONARA World Bible: authored scene prerequisites only. Not gameplay transitions.",
    "digraph SONARA_Narrative {", "  rankdir=LR;",
    "  graph [label=" + dotString(draft.title) + ", labelloc=t];",
    "  node [shape=box];"];
  blueprint.scenes.forEach((s, i) =>
    output.push("  " + dotString(s.id) + " [label=" + dotString((i + 1) + ". " + s.title) + "];"));
  for (const scene of blueprint.scenes) {
    for (const dep of scene.dependsOn) output.push("  " + dotString(dep) + " -> " + dotString(scene.id) + ";");
  }
  output.push("}");
  return { extension: "dot", type: "text/vnd.graphviz; charset=utf-8",
    data: output.join("\n") + "\n", status: "authored_prerequisite_graph_not_gameplay" };
}
function oneLine(value) {
  return String(value ?? "").replace(/[\r\n\t\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ").trim();
}
function renderFountainBeatOutline(record) {
  const { draft, blueprint } = validated(record);
  const name = new Map(draft.entities.map((e) => [e.id, e.name]));
  const lines = [
    "Title: " + oneLine(draft.title),
    "Credit: Scene beat outline (not a completed screenplay)",
    "",
    "This is a planning outline. No dialogue, filmed scenes, publishing permission or rights clearance has been generated.",
    ""
  ];
  for (let i = 0; i < blueprint.scenes.length; i++) {
    const s = blueprint.scenes[i];
    lines.push(".SCENE " + (i + 1) + " - " + oneLine(s.title).toUpperCase(), "",
      "Scene ID: " + s.id,
      "Planning beat only. Write your own action, narration, dialogue and transitions.",
      "Location reference: " + (s.placeId ? oneLine(name.get(s.placeId)) : "not specified"),
      "World references: " + (s.entityIds.length ? s.entityIds.map((id) => oneLine(name.get(id))).join("; ") : "none specified"),
      "Design prerequisites: " + (s.dependsOn.length ? s.dependsOn.join("; ") : "none"),
      "Planned duration: " + (s.durationSeconds === null ? "not specified"
        : s.durationSeconds + " seconds (" + s.timingBasis + ")"), "");
  }
  return { extension: "fountain", type: "text/plain; charset=utf-8",
    data: lines.join("\n") + "\n", status: "author_editable_beat_outline_only" };
}
function renderQuestPrerequisiteJson(record) {
  const { draft, blueprint, fingerprint } = validated(record);
  if (!["game", "interactive"].includes(draft.medium))
    throw new TypeError("Quest prerequisite manifest requires a game or interactive World Bible.");
  const data = {
    schema: "sonara.game.quest-prerequisites.v1", title: draft.title,
    sourceFingerprint: fingerprint,
    nodes: blueprint.scenes.map((s) => ({
      id: s.id, label: s.title, placeId: s.placeId || null,
      entityIds: s.entityIds, designPrerequisiteIds: s.dependsOn,
      plannedDurationSeconds: s.durationSeconds
    })),
    dependencyEdges: blueprint.scenes.flatMap((s) =>
      s.dependsOn.map((prereq) => ({ from: prereq, to: s.id, type: "design_prerequisite" }))),
    choices: [], gameTransitions: [],
    authoredPlayerChoices: false, executable: false,
    engineCompiled: false, externalAssetsIncluded: false,
    rightsCleared: false, publishesAutomatically: false
  };
  return { extension: "json", type: "application/json; charset=utf-8",
    data: JSON.stringify(data, null, 2) + "\n",
    status: "design_prerequisites_only_no_playable_branching" };
}
function renderNarrativeAuditJson(record) {
  return { extension: "json", type: "application/json; charset=utf-8",
    data: JSON.stringify(analyzeNarrative(record), null, 2) + "\n",
    status: "narrative_structure_advisory_only" };
}
module.exports = { analyzeNarrative, renderNarrativeDot, renderFountainBeatOutline,
  renderQuestPrerequisiteJson, renderNarrativeAuditJson };
