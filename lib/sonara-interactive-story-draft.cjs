// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { createHash } = require("node:crypto");
const { normalizedDraft } = require("./sonara-world-bible-store.cjs");

const IDENTIFIER = /^[a-z][a-z0-9-]{0,39}$/;
const MAX_BYTES = 65536;
const MAX_DECISIONS = 32;
const MAX_SCENES = 64;
const MAX_STATE = 16;
const MAX_CHOICES = 8;
const MAX_DIALOGUE = 16;
const ALLOWED_PREDICATES = new Set(["eq", "gte", "lte"]);
const error = (code, detail) => ({ ok: false, code, ...(detail ? { detail } : {}) });
const integer = (v) => Number.isSafeInteger(v);
const plain = (v, max, required = false) =>
  typeof v === "string" && v.length <= max && (!required || v.trim().length > 0)
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v);
const validObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const exactly = (v, keys, required) =>
  validObject(v) && Object.keys(v).every((key) => keys.includes(key))
  && required.every((key) => Object.hasOwn(v, key));
function validateInteractiveStory(world, source) {
  const origin = normalizedDraft(world?.draft);
  if (!origin.ok) return error("invalid_world_bible");
  if (!["interactive", "game"].includes(origin.draft.medium)) return error("interactive_world_required");
  if (!exactly(source, ["version", "startSceneId", "state", "scenes"], ["version", "startSceneId", "state", "scenes"])
      || source.version !== 1) return error("invalid_story_draft");
  let size;
  try { size = Buffer.byteLength(JSON.stringify(source), "utf8"); }
  catch { return error("invalid_story_draft"); }
  if (size > MAX_BYTES) return error("story_draft_too_large");
  const worldSceneIds = new Set(origin.draft.scenes.map((s) => s.id));
  const cast = new Set(origin.draft.entities.filter((e) => e.kind === "character").map((e) => e.id));
  if (!Array.isArray(source.state) || source.state.length > MAX_STATE) return error("invalid_story_state");
  const states = [], stateIds = new Set();
  for (const variable of source.state) {
    if (!exactly(variable, ["id", "initial", "min", "max"], ["id", "initial", "min", "max"])
      || !IDENTIFIER.test(variable.id || "") || stateIds.has(variable.id)
      || !integer(variable.initial) || !integer(variable.min) || !integer(variable.max)
      || variable.min < -1000 || variable.max > 1000 || variable.min > variable.max
      || variable.initial < variable.min || variable.initial > variable.max) return error("invalid_story_state");
    states.push({ id: variable.id, initial: variable.initial, min: variable.min, max: variable.max });
    stateIds.add(variable.id);
  }
  if (!Array.isArray(source.scenes) || !source.scenes.length || source.scenes.length > MAX_SCENES
    || !worldSceneIds.has(source.startSceneId)) return error("invalid_story_scenes");
  const sceneIds = new Set(), scenes = [];
  for (const item of source.scenes) {
    if (!exactly(item, ["sceneId", "prose", "dialogue", "choices"], ["sceneId", "prose", "dialogue", "choices"])
      || !worldSceneIds.has(item.sceneId) || sceneIds.has(item.sceneId)
      || !plain(item.prose, 4000) || !Array.isArray(item.dialogue) || item.dialogue.length > MAX_DIALOGUE
      || !Array.isArray(item.choices) || item.choices.length > MAX_CHOICES) return error("invalid_story_scene", item?.sceneId);
    const dialogue = [];
    for (const line of item.dialogue) {
      if (!exactly(line, ["speakerId", "text"], ["speakerId", "text"])
        || !cast.has(line.speakerId) || !plain(line.text, 500, true)) return error("invalid_dialogue", item.sceneId);
      dialogue.push({ speakerId: line.speakerId, text: line.text });
    }
    const choices = [], choiceIds = new Set();
    for (const choice of item.choices) {
      if (!exactly(choice, ["id", "label", "targetSceneId", "condition", "effect"],
        ["id", "label", "targetSceneId"])
        || !IDENTIFIER.test(choice.id || "") || choiceIds.has(choice.id)
        || !plain(choice.label, 160, true) || !worldSceneIds.has(choice.targetSceneId)) return error("invalid_choice", item.sceneId);
      let condition, effect;
      if (Object.hasOwn(choice, "condition")) {
        const c = choice.condition;
        if (!exactly(c, ["stateId", "op", "value"], ["stateId", "op", "value"])
          || !stateIds.has(c.stateId) || !ALLOWED_PREDICATES.has(c.op)
          || !integer(c.value) || Math.abs(c.value) > 1000) return error("invalid_choice_condition", item.sceneId);
        condition = { stateId: c.stateId, op: c.op, value: c.value };
      }
      if (Object.hasOwn(choice, "effect")) {
        const e = choice.effect;
        if (!exactly(e, ["stateId", "delta"], ["stateId", "delta"])
          || !stateIds.has(e.stateId) || !integer(e.delta) || Math.abs(e.delta) > 1000)
          return error("invalid_choice_effect", item.sceneId);
        effect = { stateId: e.stateId, delta: e.delta };
      }
      choiceIds.add(choice.id);
      choices.push({ id: choice.id, label: choice.label, targetSceneId: choice.targetSceneId,
        ...(condition ? { condition } : {}), ...(effect ? { effect } : {}) });
    }
    sceneIds.add(item.sceneId);
    scenes.push({ sceneId: item.sceneId, prose: item.prose, dialogue, choices });
  }
  if (!sceneIds.has(source.startSceneId)
      || scenes.some((scene) => scene.choices.some((choice) => !sceneIds.has(choice.targetSceneId))))
    return error("choice_target_not_authored");
  const edges = new Map(scenes.map((s) => [s.sceneId, s.choices.map((c) => c.targetSceneId)]));
  const seen = new Set([source.startSceneId]), stack = [source.startSceneId];
  while (stack.length) {
    const at = stack.pop();
    for (const target of edges.get(at)) if (!seen.has(target)) { seen.add(target); stack.push(target); }
  }
  const warnings = [
    ...scenes.filter((scene) => !seen.has(scene.sceneId))
      .map((scene) => ({ code: "scene_unreachable_by_authored_choices", sceneId: scene.sceneId })),
    ...origin.draft.scenes.filter((scene) => !sceneIds.has(scene.id))
      .map((scene) => ({ code: "world_scene_without_interactive_draft", sceneId: scene.id }))
  ];
  const canonical = { schema: "sonara.interactive-story.v1", version: 1,
    worldFingerprint: origin.fingerprint, startSceneId: source.startSceneId, state: states, scenes };
  const fingerprint = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return { ok: true, story: canonical, fingerprint, warnings,
    stats: { authoredScenes: scenes.length, dialogueLines: scenes.reduce((n,s) => n+s.dialogue.length, 0),
      choices: scenes.reduce((n,s) => n+s.choices.length, 0),
      reachableScenes: seen.size, stateVariables: states.length } };
}
function simulateInteractiveStory(valid, decisions = []) {
  if (!valid?.ok || valid.story?.schema !== "sonara.interactive-story.v1")
    return error("validated_story_required");
  if (!Array.isArray(decisions) || decisions.length > MAX_DECISIONS
      || decisions.some((id) => typeof id !== "string" || !IDENTIFIER.test(id)))
    return error("invalid_decision_sequence");
  const story = valid.story;
  const byScene = new Map(story.scenes.map((scene) => [scene.sceneId, scene]));
  const defined = new Map(story.state.map((v) => [v.id, v]));
  const values = Object.fromEntries(story.state.map((v) => [v.id, v.initial]));
  const visited = [story.startSceneId], applied = [];
  let current = byScene.get(story.startSceneId);
  const available = () => current.choices.filter((choice) => {
    const c = choice.condition;
    const actual = c ? values[c.stateId] : null;
    if (c && !(c.op === "eq" && actual === c.value || c.op === "gte" && actual >= c.value ||
      c.op === "lte" && actual <= c.value)) return false;
    if (choice.effect) {
      const rule = defined.get(choice.effect.stateId);
      const next = values[rule.id] + choice.effect.delta;
      if (next < rule.min || next > rule.max) return false;
    }
    return true;
  });
  for (const id of decisions) {
    const choice = available().find((c) => c.id === id);
    if (!choice) return error("choice_unavailable_or_story_ended", current.sceneId);
    if (choice.effect) values[choice.effect.stateId] += choice.effect.delta;
    applied.push({ fromSceneId: current.sceneId, choiceId: choice.id, toSceneId: choice.targetSceneId });
    current = byScene.get(choice.targetSceneId);
    visited.push(current.sceneId);
  }
  const options = available().map((c) => ({ id: c.id, label: c.label, targetSceneId: c.targetSceneId }));
  return { ok: true, schema: "sonara.interactive-preview.v1", storyFingerprint: valid.fingerprint,
    currentSceneId: current.sceneId, prose: current.prose, dialogue: current.dialogue,
    availableChoices: options, state: values, visitedSceneIds: visited,
    decisionsApplied: applied,
    status: !current.choices.length ? "authored_end" : options.length ? "awaiting_choice" : "no_available_choices",
    hasPotentialLoop: new Set(visited).size < visited.length,
    boundary: { saved: false, userApprovedPublication: false, gameCompiled: false,
      providerExecution: false, maxDecisions: MAX_DECISIONS } };
}
module.exports = { validateInteractiveStory, simulateInteractiveStory, MAX_BYTES, MAX_DECISIONS };
