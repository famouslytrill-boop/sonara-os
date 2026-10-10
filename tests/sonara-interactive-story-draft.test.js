// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { validateInteractiveStory, simulateInteractiveStory, MAX_DECISIONS } =
  require("../lib/sonara-interactive-story-draft.cjs");
const world = () => ({ draft: { title: "Branching Story", medium: "interactive",
  entities: [{ id: "hero", kind: "character", name: "The Lead" },
    { id: "companion", kind: "character", name: "Companion" },
    { id: "square", kind: "place", name: "Town Square" }],
  scenes: [{ id: "opening", title: "Start", entityIds: ["hero"], placeId: "square" },
    { id: "ending", title: "End", dependsOn: ["opening"] },
    { id: "optional", title: "Other beat" }], resources: {} } });
const source = () => ({ version: 1, startSceneId: "opening",
  state: [{ id: "trust", initial: 1, min: 0, max: 3 }],
  scenes: [
    { sceneId: "opening", prose: "Choose what happens.", dialogue: [{ speakerId: "hero", text: "Welcome." }],
      choices: [
        { id: "agree", label: "Agree", targetSceneId: "ending",
          condition: { stateId: "trust", op: "gte", value: 1 },
          effect: { stateId: "trust", delta: 1 } },
        { id: "decline", label: "Decline", targetSceneId: "ending",
          effect: { stateId: "trust", delta: -1 } },
        { id: "repeat", label: "Look around again", targetSceneId: "opening" }
      ] },
    { sceneId: "ending", prose: "The end.", dialogue: [], choices: [] }
  ]
});
describe("Interactive Story sidecar draft and bounded local preview", () => {
  it("preserves authored prose and dialogue, warns on unauthored world beats", () => {
    const input = validateInteractiveStory(world(), source());
    assert.equal(input.ok, true);
    assert.equal(input.story.schema, "sonara.interactive-story.v1");
    assert.equal(input.stats.choices, 3);
    assert.equal(input.stats.dialogueLines, 1);
    assert.equal(input.stats.reachableScenes, 2);
    assert.deepEqual(input.warnings, [{ code: "world_scene_without_interactive_draft", sceneId: "optional" }]);
    assert.equal(input.story.scenes[0].dialogue[0].text, "Welcome.");
    assert.equal(input.story.scenes[0].prose, "Choose what happens.");
    assert.deepEqual(validateInteractiveStory(world(), source()), input);
  });
  it("runs explicit choices and bounded effects with no implicit game actions", () => {
    const valid = validateInteractiveStory(world(), source());
    const initial = simulateInteractiveStory(valid);
    assert.equal(initial.status, "awaiting_choice");
    assert.equal(initial.currentSceneId, "opening");
    assert.deepEqual(initial.availableChoices.map(c => c.id), ["agree", "decline", "repeat"]);
    const result = simulateInteractiveStory(valid, ["agree"]);
    assert.equal(result.ok, true);
    assert.equal(result.status, "authored_end");
    assert.equal(result.currentSceneId, "ending");
    assert.equal(result.state.trust, 2);
    assert.deepEqual(result.visitedSceneIds, ["opening", "ending"]);
    assert.equal(result.boundary.gameCompiled, false);
    assert.equal(result.boundary.providerExecution, false);
    assert.equal(result.boundary.saved, false);
    assert.equal(simulateInteractiveStory(valid, ["agree", "decline"]).code, "choice_unavailable_or_story_ended");
  });
  it("applies conditions and hides state-overflow choices before they are chosen", () => {
    const valid = validateInteractiveStory(world(), source());
    const high = simulateInteractiveStory(valid, ["repeat", "repeat", "agree"]);
    assert.equal(high.state.trust, 2);
    const custom = source();
    custom.state[0].initial = 3;
    const input = validateInteractiveStory(world(), custom);
    const first = simulateInteractiveStory(input);
    assert.deepEqual(first.availableChoices.map(c=>c.id), ["decline", "repeat"]);
    assert.equal(simulateInteractiveStory(input, ["agree"]).code, "choice_unavailable_or_story_ended");
  });
  it("does not conflate world prerequisites with explicit interactive choices", () => {
    const custom = source();
    custom.scenes[0].choices = [{ id: "repeat", label: "Again", targetSceneId: "opening" }];
    const valid = validateInteractiveStory(world(), custom);
    assert.ok(valid.warnings.some(w=>w.code === "scene_unreachable_by_authored_choices" && w.sceneId === "ending"));
    const replay = simulateInteractiveStory(valid, ["repeat", "repeat"]);
    assert.equal(replay.ok, true);
    assert.equal(replay.hasPotentialLoop, true);
    assert.equal(replay.status, "awaiting_choice");
    assert.equal(simulateInteractiveStory(valid, Array(MAX_DECISIONS + 1).fill("repeat")).code, "invalid_decision_sequence");
  });
  it("rejects forged speakers, missing destinations, foreign state IDs and unapproved fields", () => {
    const changes = [
      d=>{d.scenes[0].dialogue[0].speakerId="square"},
      d=>{d.scenes[0].choices[0].targetSceneId="missing"},
      d=>{d.scenes[0].choices[0].condition.stateId="admin"},
      d=>{d.scenes[0].choices[1].effect.delta=10000},
      d=>{d.scenes[0].choices[0].script="fetch(secret)"},
      d=>{d.sessionToken="SECRET"},
      d=>{d.state[0].id="__proto__"},
      d=>{d.scenes[0].choices.push(...Array(9).fill({id:"x",label:"x",targetSceneId:"opening"}))},
      d=>{d.startSceneId="optional"}
    ];
    for (const change of changes) {
      const data = source(); change(data);
      assert.equal(validateInteractiveStory(world(), data).ok, false);
    }
    const audioWorld = world(); audioWorld.draft.medium="podcast";
    assert.equal(validateInteractiveStory(audioWorld, source()).code, "interactive_world_required");
  });
  it("leaves source immutable and excludes arbitrary secret fields from responses", () => {
    const draft = source(); const before = JSON.stringify(draft);
    const valid = validateInteractiveStory(world(), draft);
    assert.equal(JSON.stringify(draft), before);
    assert.equal(JSON.stringify(valid).includes("PRIVATE_SECRET"), false);
    assert.equal(simulateInteractiveStory({ok:false}, []).code, "validated_story_required");
    assert.equal(simulateInteractiveStory(valid, ["__proto__"]).code, "invalid_decision_sequence");
  });
  it("rejects ambiguous unmodelled variables, malformed state ranges and oversized inputs", () => {
    const bad = source(); bad.state[0].min=4;bad.state[0].max=3;
    assert.equal(validateInteractiveStory(world(), bad).code, "invalid_story_state");
    const big=source(); big.scenes[0].prose="z".repeat(4001);
    assert.equal(validateInteractiveStory(world(), big).code, "invalid_story_scene");
    assert.equal(validateInteractiveStory(world(), { ...source(), version: 2 }).code, "invalid_story_draft");
    assert.equal(validateInteractiveStory(world(), null).code, "invalid_story_draft");
  });
});
