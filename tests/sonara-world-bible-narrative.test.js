// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { analyzeNarrative, renderNarrativeDot, renderFountainBeatOutline,
  renderQuestPrerequisiteJson, renderNarrativeAuditJson } = require("../lib/sonara-world-bible-narrative.cjs");
const source = () => ({ draft: {
  title: "Adventure", medium: "game",
  entities: [{ id: "hero", kind: "character", name: "Hero" },
    { id: "village", kind: "place", name: "Village" },
    { id: "lore", kind: "rule", name: "Unused lore" }],
  scenes: [
    { id: "start", title: "Start", durationSeconds: 4, entityIds: ["hero"], placeId: "village" },
    { id: "second", title: "Path 2", durationSeconds: 9, dependsOn: ["start"] },
    { id: "third", title: "Path 3", durationSeconds: 6, dependsOn: ["start"] },
    { id: "finish", title: "Finish", durationSeconds: 3, dependsOn: ["second", "third"] },
    { id: "side", title: "A separate idea", durationSeconds: 2 }
  ], resources: {} } });
describe("World Bible narrative integrity and authored story interchange", () => {
  it("counts real prerequisites, weak components, unreferenced lore and a deterministic longest chain", () => {
    const audit = analyzeNarrative(source());
    assert.equal(audit.schema, "sonara.narrative-integrity.v1");
    assert.deepEqual(audit.counts, {
      scenes: 5, entities: 3, dependencyEdges: 4,
      independentDependencyGroups: 2, roots: 2, terminalScenes: 2,
      explicitDurations: 5, estimatedSpeechDurations: 0, unknownDurations: 0
    });
    assert.deepEqual(audit.rootSceneIds, ["start", "side"]);
    assert.deepEqual(audit.terminalSceneIds, ["finish", "side"]);
    assert.deepEqual(audit.dependencyGroups, [["start", "second", "third", "finish"], ["side"]]);
    assert.deepEqual(audit.longestDependencyChainSceneIds, ["start", "second", "finish"]);
    assert.equal(audit.longestDependencyChainScenes, 3);
    assert.equal(audit.criticalPathPlannedSeconds, 16);
    assert.equal(audit.totalSequentialPlannedSeconds, 24);
    assert.deepEqual(audit.warnings, [{ severity: "info", code: "unused_world_element", entityId: "lore" }]);
    assert.equal(audit.semantics.branchChoices, "not_modelled");
    assert.equal(audit.semantics.runtimeExecution, false);
    assert.equal(audit.entityUsage.find((x) => x.id === "village").appearancesInScenes, 1);
    assert.deepEqual(analyzeNarrative(source()), audit);
  });
  it("does not claim a weighted critical path or total runtime with unknown durations", () => {
    const draft = source();
    delete draft.draft.scenes[2].durationSeconds;
    const audit = analyzeNarrative(draft);
    assert.equal(audit.criticalPathPlannedSeconds, null);
    assert.equal(audit.totalSequentialPlannedSeconds, null);
    assert.equal(audit.counts.unknownDurations, 1);
    assert.deepEqual(audit.warnings.slice(-1), [
      { severity: "info", code: "unplanned_scene_timing", sceneId: "third" }
    ]);
    assert.equal(audit.longestDependencyChainScenes, 3);
  });
  it("exports valid quoted DOT labels; hostile titles remain inside attributes", () => {
    const draft = source();
    draft.draft.scenes[0].title = 'A "quoted" beat\\n}; "attack" -> "finish"';
    const graph = renderNarrativeDot(draft);
    assert.equal(graph.extension, "dot");
    assert.match(graph.data, /^\/\/ SONARA World Bible/);
    assert.match(graph.data, /digraph SONARA_Narrative \{/);
    assert.match(graph.data, /"start" -> "second";/);
    assert.match(graph.data, /"second" -> "finish";/);
    assert.match(graph.data, /\\"quoted\\"/);
    assert.equal(graph.data.includes("\n}; \"attack\" -> \"finish\""), false);
    assert.equal(graph.data.split("digraph SONARA_Narrative {").length, 2);
    assert.deepEqual(renderNarrativeDot(draft), graph);
  });
  it("exports an editable Fountain beat outline, without inventing dialogue or narration", () => {
    const draft = source();
    draft.draft.title = "My World\nCredit: forged";
    draft.draft.scenes[0].title = "Night\nTitle: Forged";
    const output = renderFountainBeatOutline(draft);
    assert.equal(output.extension, "fountain");
    assert.match(output.data, /^Title: My World Credit: forged\nCredit: Scene beat outline/);
    assert.match(output.data, /\.SCENE 1 - NIGHT TITLE: FORGED/);
    assert.match(output.data, /Location reference: Village/);
    assert.match(output.data, /Design prerequisites: second; third/);
    assert.equal(output.data.includes("\nTitle: Forged\n"), false);
    assert.ok(!output.data.includes("\nHERO\n"));
  });
  it("encodes a non-executable quest dependency manifest, not player transitions", () => {
    const file = renderQuestPrerequisiteJson(source());
    const quest = JSON.parse(file.data);
    assert.equal(file.extension, "json");
    assert.equal(quest.schema, "sonara.game.quest-prerequisites.v1");
    assert.deepEqual(quest.nodes.find((n) => n.id === "finish").designPrerequisiteIds,
      ["second", "third"]);
    assert.equal(quest.dependencyEdges.length, 4);
    assert.deepEqual(quest.choices, []);
    assert.deepEqual(quest.gameTransitions, []);
    assert.equal(quest.executable, false);
    assert.equal(quest.externalAssetsIncluded, false);
    const audio = source(); audio.draft.medium = "podcast";
    assert.throws(() => renderQuestPrerequisiteJson(audio), /game or interactive/);
  });
  it("exports parseable advisory JSON, validates references and prevents unknown fields leaking", () => {
    const draft = source();
    draft.draft.providerApiKey = "PRIVATE_SECRET";
    draft.draft.entities[0].privateToken = "PRIVATE_SECRET";
    for (const x of [renderNarrativeDot(draft).data, renderFountainBeatOutline(draft).data,
      renderQuestPrerequisiteJson(draft).data, renderNarrativeAuditJson(draft).data]) {
      assert.equal(x.includes("PRIVATE_SECRET"), false);
    }
    assert.equal(JSON.parse(renderNarrativeAuditJson(draft).data).semantics.publishingAuthorized, false);
    assert.throws(() => analyzeNarrative({ draft: { title: "bad" } }), /validated World Bible/);
    const invalid = source();
    invalid.draft.scenes[1].dependsOn = ["missing"];
    assert.throws(() => renderNarrativeDot(invalid), /validated World Bible/);
  });
});
