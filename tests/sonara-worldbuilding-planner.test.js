// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { planWorldbuilding } = require("../lib/sonara-worldbuilding-planner.cjs");
const example = () => ({ title: "The Station", medium: "podcast", entities: [
  { id: "lead", kind: "character", name: "Original protagonist" },
  { id: "set", kind: "place", name: "Original studio" }
], scenes: [
  { id: "opening", title: "Opening", entityIds: ["lead"], placeId: "set", durationSeconds: 30 },
  { id: "interview", title: "Interview", dependsOn: ["opening"], spokenWords: 300, speakingWpm: 150 }
], resources: { sampleRateHz: 48000, channels: 2, bitDepth: 16, audioBitrateKbps: 128, expectedViewers: 100 } });

describe("Worldbuilding and cross-media production planner", () => {
  it("validates original world entities, ordered scenes, explicit versus estimated timing, and SHA256 determinism", () => {
    const result = planWorldbuilding(example());
    assert.equal(result.ok, true);
    const b = result.blueprint;
    assert.equal(b.estimates.runtimeSeconds, 150);
    assert.equal(b.estimates.explicitSeconds, 30);
    assert.equal(b.estimates.speechEstimatedSeconds, 120);
    assert.deepEqual(b.scenes.map((scene) => [scene.startSeconds, scene.endSeconds]), [[0, 30], [30, 150]]);
    assert.match(b.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(planWorldbuilding(example()), result);
    assert.equal(b.rightsCleared, false);
    assert.equal(b.mediaRendered, false);
    assert.equal(b.publishesAutomatically, false);
    assert.equal(b.providerExecution, "none");
    assert.equal(b.persistence, "not_saved");
  });
  it("computes PCM and full-attendance bitrate budgets from explicit inputs, not guessed prices", () => {
    const b = planWorldbuilding(example()).blueprint;
    assert.equal(b.estimates.pcmBytes, 28800000);
    assert.equal(b.estimates.distributionBytes, 240000000);
    assert.ok(b.estimates.assumptions.some((item) => item.includes("CDN")));
  });
  it("does not fabricate a total runtime or timeline when an untimed scene appears", () => {
    const input = example();
    input.scenes.splice(1, 0, { id: "untimed", title: "Free exploration" });
    const b = planWorldbuilding(input).blueprint;
    assert.equal(b.estimates.runtimeSeconds, null);
    assert.equal(b.estimates.timingCoverage, "partial_plan");
    assert.equal(b.estimates.knownSceneSeconds, 150);
    assert.equal(b.estimates.pcmBytes, null);
    assert.equal(b.estimates.distributionBytes, null);
    assert.equal(b.scenes[2].startSeconds, null);
  });
  it("rejects cyclic, forward, cross-world, or non-place references and ambiguous speech durations", () => {
    const inputs = [
      (v) => { v.scenes[0].dependsOn = ["interview"]; },
      (v) => { v.scenes[1].dependsOn = ["interview"]; },
      (v) => { v.scenes[1].entityIds = ["other-tenant-entity"]; },
      (v) => { v.scenes[0].placeId = "lead"; },
      (v) => { delete v.scenes[1].speakingWpm; },
      (v) => { v.entities.push({ id: "lead", kind: "item", name: "Collision" }); }
    ];
    for (const mutate of inputs) {
      const input = example(); mutate(input);
      assert.equal(planWorldbuilding(input).ok, false);
    }
  });
  it("validates bounds and rejects arithmetic overflow instead of returning unsafe numbers", () => {
    assert.equal(planWorldbuilding({ ...example(), title: "" }).code, "invalid_title");
    assert.equal(planWorldbuilding({ ...example(), medium: "unknown" }).code, "invalid_medium");
    assert.equal(planWorldbuilding({ ...example(), scenes: [] }).code, "invalid_scenes");
    const negative = example(); negative.scenes[0].durationSeconds = -1;
    assert.equal(planWorldbuilding(negative).code, "invalid_scene_duration");
    const max = example(); max.resources.expectedViewers = 1000000;
    assert.equal(planWorldbuilding(max).code, "invalid_resource_settings");
    const large = example(); large.scenes = Array.from({ length: 64 }, (_, i) => ({ id: `scene-${i}`, title: "Long story", durationSeconds: 86400 }));
    large.resources = { videoBitrateKbps: 100000, expectedViewers: 10000 };
    assert.equal(planWorldbuilding(large).code, "resource_estimate_exceeds_safe_range");
  });
  it("handles book/page and game/tick projections without claiming they are production outputs", () => {
    const book = example(); book.medium = "book"; book.resources = { wordsPerPage: 250 };
    assert.equal(planWorldbuilding(book).blueprint.estimates.estimatedBookPages, 2);
    const game = example(); game.medium = "game"; game.resources = { gameTickHz: 60 };
    assert.equal(planWorldbuilding(game).blueprint.estimates.gameTicks, 9000);
    assert.equal(planWorldbuilding(game).blueprint.mediaRendered, false);
  });
});
