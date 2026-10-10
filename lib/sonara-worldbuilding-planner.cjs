// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createHash } = require("node:crypto");
const MEDIA = new Set(["game", "interactive", "film", "book", "podcast", "vlog", "stream", "music"]);
const ENTITY_TYPES = new Set(["character", "place", "faction", "item", "rule"]);
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const MAX_ENTITIES = 128;
const MAX_SCENES = 64;
const MAX_SECONDS = 86400;

function fail(code, detail) { return { ok: false, code, ...(detail ? { detail } : {}) }; }
function whole(value, min, max) { return Number.isSafeInteger(value) && value >= min && value <= max; }
function text(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
}
function checkedBytes(n) {
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("resource_estimate_exceeds_safe_range");
  return Number(n);
}
function ceilDivide(n, d) { return (n + d - 1n) / d; }
function validateEntities(entities) {
  if (!Array.isArray(entities) || entities.length > MAX_ENTITIES) return fail("invalid_entities");
  const out = [];
  const known = new Map();
  for (const entity of entities) {
    if (!entity || typeof entity !== "object" || Array.isArray(entity)
        || !ID.test(entity.id || "") || !ENTITY_TYPES.has(entity.kind)
        || !text(entity.name, 100) || (entity.description !== undefined && !text(entity.description, 500))
        || known.has(entity.id)) return fail("invalid_entity", entity?.id);
    known.set(entity.id, entity.kind);
    out.push({ id: entity.id, kind: entity.kind, name: entity.name.trim(), ...(entity.description === undefined ? {} : { description: entity.description.trim() }) });
  }
  return { ok: true, entities: out, known };
}
function validateScenes(scenes, known) {
  if (!Array.isArray(scenes) || scenes.length === 0 || scenes.length > MAX_SCENES) return fail("invalid_scenes");
  const earlier = new Set();
  const allIds = new Set();
  const out = [];
  for (const scene of scenes) {
    if (!scene || typeof scene !== "object" || Array.isArray(scene) || !ID.test(scene.id || "")
        || !text(scene.title, 160) || allIds.has(scene.id)) return fail("invalid_scene");
    if (scene.durationSeconds !== undefined && !whole(scene.durationSeconds, 1, MAX_SECONDS)) return fail("invalid_scene_duration", scene.id);
    if (scene.spokenWords !== undefined && !whole(scene.spokenWords, 0, 100000)) return fail("invalid_scene_words", scene.id);
    if (scene.speakingWpm !== undefined && !whole(scene.speakingWpm, 60, 240)) return fail("invalid_speaking_rate", scene.id);
    if (scene.speakingWpm !== undefined && scene.spokenWords === undefined) return fail("speaking_rate_requires_words", scene.id);
    if (scene.spokenWords > 0 && scene.durationSeconds === undefined && scene.speakingWpm === undefined) return fail("speech_duration_requires_rate", scene.id);
    const entityIds = scene.entityIds === undefined ? [] : scene.entityIds;
    const dependsOn = scene.dependsOn === undefined ? [] : scene.dependsOn;
    if (!Array.isArray(entityIds) || entityIds.length > 16 || new Set(entityIds).size !== entityIds.length
        || entityIds.some((id) => !known.has(id))) return fail("invalid_entity_reference", scene.id);
    if (!Array.isArray(dependsOn) || dependsOn.length > 16 || new Set(dependsOn).size !== dependsOn.length
        || dependsOn.some((id) => !earlier.has(id))) return fail("invalid_scene_dependency", scene.id);
    if (scene.placeId !== undefined && known.get(scene.placeId) !== "place") return fail("invalid_scene_place", scene.id);
    const estimatedFromSpeech = scene.durationSeconds === undefined && scene.spokenWords !== undefined && scene.speakingWpm !== undefined;
    const seconds = scene.durationSeconds ?? (estimatedFromSpeech ? Math.ceil(scene.spokenWords * 60 / scene.speakingWpm) : null);
    allIds.add(scene.id);
    earlier.add(scene.id);
    out.push({ id: scene.id, title: scene.title.trim(), entityIds: [...entityIds], dependsOn: [...dependsOn],
      ...(scene.placeId === undefined ? {} : { placeId: scene.placeId }),
      spokenWords: scene.spokenWords ?? null, durationSeconds: seconds,
      timingBasis: scene.durationSeconds !== undefined ? "explicit" : estimatedFromSpeech ? "estimated_speech" : "unknown" });
  }
  return { ok: true, scenes: out };
}
function resourceEstimates(scenes, settings = {}, medium) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return fail("invalid_resource_settings");
  const valid = (key, min, max) => settings[key] === undefined || whole(settings[key], min, max);
  if (!valid("sampleRateHz", 8000, 192000) || !valid("channels", 1, 8)
      || ![undefined, 16, 24, 32].includes(settings.bitDepth)
      || !valid("audioBitrateKbps", 16, 1536) || !valid("videoBitrateKbps", 1, 100000)
      || !valid("expectedViewers", 1, 10000) || !valid("wordsPerPage", 100, 1000)
      || !valid("gameTickHz", 1, 240)) return fail("invalid_resource_settings");
  const runtimeKnown = scenes.every((s) => s.durationSeconds !== null);
  const plannedSeconds = runtimeKnown ? scenes.reduce((sum, s) => sum + s.durationSeconds, 0) : null;
  const secondsKnown = scenes.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  const explicitSeconds = scenes.reduce((sum, s) => sum + (s.timingBasis === "explicit" ? s.durationSeconds : 0), 0);
  const spokenWords = scenes.reduce((sum, s) => sum + (s.spokenWords ?? 0), 0);
  const hasPcm = ["sampleRateHz", "channels", "bitDepth"].every((key) => settings[key] !== undefined);
  const hasStream = settings.expectedViewers !== undefined
    && (settings.videoBitrateKbps !== undefined || settings.audioBitrateKbps !== undefined);
  try {
    const pcmBytes = runtimeKnown && hasPcm
      ? checkedBytes(BigInt(plannedSeconds) * BigInt(settings.sampleRateHz) * BigInt(settings.channels) * BigInt(settings.bitDepth / 8)) : null;
    const distributionBytes = runtimeKnown && hasStream
      ? checkedBytes(ceilDivide(BigInt(plannedSeconds) * BigInt(settings.expectedViewers)
          * BigInt((settings.videoBitrateKbps ?? 0) + (settings.audioBitrateKbps ?? 0)) * 1000n, 8n)) : null;
    const gameTicks = medium === "game" && runtimeKnown && settings.gameTickHz !== undefined
      ? plannedSeconds * settings.gameTickHz : null;
    return { ok: true, estimates: {
      runtimeSeconds: plannedSeconds, knownSceneSeconds: secondsKnown, explicitSeconds,
      speechEstimatedSeconds: secondsKnown - explicitSeconds, spokenWords,
      timingCoverage: runtimeKnown ? "complete_plan" : "partial_plan",
      pcmBytes, distributionBytes, gameTicks,
      estimatedBookPages: settings.wordsPerPage !== undefined ? Math.ceil(spokenWords / settings.wordsPerPage) : null,
      assumptions: [
        "Spoken duration uses provided words and speaking rate; estimates are not measured recordings.",
        "Game scene durations are planned beats, not gameplay-time predictions.",
        "PCM size excludes headers, metadata and file system overhead.",
        "Distribution bytes assume constant selected bitrates and every viewer watches the entire planned runtime; CDN, adaptive variants and protocol overhead are excluded.",
        "Pages use the author's words-per-page input, not a publishing guarantee."
      ]
    } };
  } catch (error) {
    if (error instanceof RangeError) return fail("resource_estimate_exceeds_safe_range");
    throw error;
  }
}
function planWorldbuilding(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("invalid_blueprint");
  if (!text(input.title, 160)) return fail("invalid_title");
  if (!MEDIA.has(input.medium)) return fail("invalid_medium");
  const entities = validateEntities(input.entities || []);
  if (!entities.ok) return entities;
  const scenes = validateScenes(input.scenes, entities.known);
  if (!scenes.ok) return scenes;
  const resources = resourceEstimates(scenes.scenes, input.resources || {}, input.medium);
  if (!resources.ok) return resources;
  let cursor = 0;
  let timelineKnown = true;
  const orderedScenes = scenes.scenes.map((scene) => {
    const atSeconds = timelineKnown ? cursor : null;
    if (scene.durationSeconds === null) timelineKnown = false;
    else cursor += scene.durationSeconds;
    return { ...scene, startSeconds: atSeconds, endSeconds: timelineKnown ? cursor : null };
  });
  const content = { schema: "sonara.worldbuilding.blueprint.v1", title: input.title.trim(), medium: input.medium,
    entities: entities.entities, scenes: orderedScenes, estimates: resources.estimates,
    rightsCleared: false, mediaRendered: false, publishesAutomatically: false,
    providerExecution: "none", persistence: "not_saved" };
  const sha256 = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return { ok: true, blueprint: { ...content, sha256 } };
}
module.exports = { planWorldbuilding, resourceEstimates, MAX_ENTITIES, MAX_SCENES };
