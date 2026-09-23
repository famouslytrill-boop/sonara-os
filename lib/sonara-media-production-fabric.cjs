// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic document contract for Creator Studio media production.
//
// This module intentionally does not render media, call a provider, write to a
// database, publish anything, or invent completion. It validates the durable
// project shape SONARA owns around interchangeable generators, NLEs, DAWs and
// isolated media workers.

const MEDIA_PROJECT_VERSION = "1.0.0";

const PROJECT_TYPES = Object.freeze([
  "image",
  "video",
  "film",
  "music",
  "podcast",
  "voice",
  "mixed"
]);

const ASSET_TYPES = Object.freeze([
  "image",
  "video",
  "audio",
  "music",
  "voice",
  "captions",
  "document"
]);

const TRACK_TYPES = Object.freeze([
  "video",
  "audio",
  "overlay",
  "captions"
]);

const RIGHTS_STATES = Object.freeze([
  "owned",
  "licensed",
  "permissioned",
  "public_domain",
  "unknown"
]);

const APPROVAL_STATES = Object.freeze([
  "draft",
  "review",
  "approved"
]);

const EXPORT_PROFILES = Object.freeze({
  image_web: Object.freeze({
    kind: "image",
    container: "webp",
    mimeType: "image/webp",
    width: 1920,
    height: null,
    hdr: false
  }),
  image_master: Object.freeze({
    kind: "image",
    container: "png",
    mimeType: "image/png",
    width: null,
    height: null,
    hdr: false
  }),
  social_vertical_1080: Object.freeze({
    kind: "video",
    container: "mp4",
    mimeType: "video/mp4",
    width: 1080,
    height: 1920,
    frameRate: 30,
    hdr: false
  }),
  video_hd_1080: Object.freeze({
    kind: "video",
    container: "mp4",
    mimeType: "video/mp4",
    width: 1920,
    height: 1080,
    frameRate: 30,
    hdr: false
  }),
  video_4k_master: Object.freeze({
    kind: "video",
    container: "mp4",
    mimeType: "video/mp4",
    width: 3840,
    height: 2160,
    frameRate: 30,
    hdr: false
  }),
  audio_master_wav: Object.freeze({
    kind: "audio",
    container: "wav",
    mimeType: "audio/wav",
    sampleRate: 48000,
    bitDepth: 24
  }),
  podcast_mp3: Object.freeze({
    kind: "audio",
    container: "mp3",
    mimeType: "audio/mpeg",
    sampleRate: 48000,
    bitrateKbps: 192
  })
});

const PRODUCTION_STAGES = Object.freeze([
  "ingest",
  "verify_rights",
  "edit_or_generate",
  "timeline",
  "quality_check",
  "approval",
  "render_export",
  "publish_after_approval"
]);

function clean(value, max = 240) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function finiteNonNegative(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function finitePositive(value) {
  const number = finiteNonNegative(value);
  return number !== null && number > 0 ? number : null;
}

function normalizeAsset(raw, index) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const id = clean(source.id || source.assetId || source.asset_id, 120);
  const type = clean(source.type || source.assetType || source.asset_type, 40);
  const rights = clean(source.rights || source.rightsStatus || source.rights_status || "unknown", 40);
  const sourceKind = clean(source.sourceKind || source.source_kind || "imported", 40);
  const storageRef = clean(source.storageRef || source.storage_ref, 500) || null;
  const checksumSha256 = clean(source.checksumSha256 || source.checksum_sha256, 64) || null;

  if (!id) return { ok: false, code: "media_asset_id_required", index };
  if (!ASSET_TYPES.includes(type)) return { ok: false, code: "invalid_media_asset_type", index, assetId: id, type };
  if (!RIGHTS_STATES.includes(rights)) return { ok: false, code: "invalid_media_rights_state", index, assetId: id, rights };

  return {
    ok: true,
    asset: Object.freeze({
      id,
      type,
      title: clean(source.title, 240) || null,
      rights,
      sourceKind,
      storageRef,
      checksumSha256,
      providerKey: clean(source.providerKey || source.provider_key, 100) || null,
      generationJobId: clean(source.generationJobId || source.generation_job_id, 120) || null,
      immutableSource: source.immutableSource !== false && source.immutable_source !== false
    })
  };
}

function normalizeClip(raw, trackIndex, clipIndex, assetsById) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const id = clean(source.id || source.clipId || source.clip_id, 120);
  const assetId = clean(source.assetId || source.asset_id, 120);
  const startSeconds = finiteNonNegative(source.startSeconds ?? source.start_seconds);
  const durationSeconds = finitePositive(source.durationSeconds ?? source.duration_seconds);
  const sourceStartSeconds = finiteNonNegative(source.sourceStartSeconds ?? source.source_start_seconds) ?? 0;

  if (!id) return { ok: false, code: "media_clip_id_required", trackIndex, clipIndex };
  if (!assetId) return { ok: false, code: "media_clip_asset_required", trackIndex, clipIndex, clipId: id };
  if (!assetsById.has(assetId)) return { ok: false, code: "media_clip_asset_not_found", trackIndex, clipIndex, clipId: id, assetId };
  if (startSeconds === null) return { ok: false, code: "media_clip_start_invalid", trackIndex, clipIndex, clipId: id };
  if (durationSeconds === null) return { ok: false, code: "media_clip_duration_invalid", trackIndex, clipIndex, clipId: id };

  return {
    ok: true,
    clip: Object.freeze({
      id,
      assetId,
      startSeconds,
      durationSeconds,
      sourceStartSeconds,
      endSeconds: startSeconds + durationSeconds,
      muted: Boolean(source.muted),
      locked: Boolean(source.locked)
    })
  };
}

function normalizeTrack(raw, trackIndex, assetsById, seenClipIds) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const id = clean(source.id || source.trackId || source.track_id, 120);
  const type = clean(source.type || source.trackType || source.track_type, 40);
  const rawClips = Array.isArray(source.clips) ? source.clips : [];

  if (!id) return { ok: false, code: "media_track_id_required", trackIndex };
  if (!TRACK_TYPES.includes(type)) return { ok: false, code: "invalid_media_track_type", trackIndex, trackId: id, type };
  if (rawClips.length > 2000) return { ok: false, code: "too_many_media_clips", trackIndex, trackId: id, max: 2000 };

  const clips = [];
  for (let clipIndex = 0; clipIndex < rawClips.length; clipIndex += 1) {
    const parsed = normalizeClip(rawClips[clipIndex], trackIndex, clipIndex, assetsById);
    if (!parsed.ok) return parsed;
    if (seenClipIds.has(parsed.clip.id)) {
      return { ok: false, code: "duplicate_media_clip_id", trackIndex, clipIndex, clipId: parsed.clip.id };
    }
    seenClipIds.add(parsed.clip.id);
    clips.push(parsed.clip);
  }

  return {
    ok: true,
    track: Object.freeze({
      id,
      type,
      name: clean(source.name, 160) || null,
      locked: Boolean(source.locked),
      clips: Object.freeze(clips)
    })
  };
}

function validateMediaProject(input = {}) {
  const title = clean(input.title || input.name, 240);
  const projectType = clean(input.projectType || input.project_type, 40);
  const approvalStatus = clean(input.approvalStatus || input.approval_status || "draft", 40);
  const rawAssets = Array.isArray(input.assets) ? input.assets : [];
  const rawTracks = Array.isArray(input.tracks) ? input.tracks : [];
  const exportProfile = clean(input.exportProfile || input.export_profile, 80) || null;

  if (!title) return { ok: false, code: "media_project_title_required" };
  if (!PROJECT_TYPES.includes(projectType)) return { ok: false, code: "invalid_media_project_type", projectType };
  if (!APPROVAL_STATES.includes(approvalStatus)) return { ok: false, code: "invalid_media_approval_state", approvalStatus };
  if (rawAssets.length > 500) return { ok: false, code: "too_many_media_assets", max: 500 };
  if (rawTracks.length > 100) return { ok: false, code: "too_many_media_tracks", max: 100 };
  if (exportProfile && !EXPORT_PROFILES[exportProfile]) return { ok: false, code: "unknown_media_export_profile", exportProfile };

  const assets = [];
  const assetsById = new Map();
  for (let index = 0; index < rawAssets.length; index += 1) {
    const parsed = normalizeAsset(rawAssets[index], index);
    if (!parsed.ok) return parsed;
    if (assetsById.has(parsed.asset.id)) return { ok: false, code: "duplicate_media_asset_id", index, assetId: parsed.asset.id };
    assetsById.set(parsed.asset.id, parsed.asset);
    assets.push(parsed.asset);
  }

  const tracks = [];
  const seenTrackIds = new Set();
  const seenClipIds = new Set();
  for (let trackIndex = 0; trackIndex < rawTracks.length; trackIndex += 1) {
    const parsed = normalizeTrack(rawTracks[trackIndex], trackIndex, assetsById, seenClipIds);
    if (!parsed.ok) return parsed;
    if (seenTrackIds.has(parsed.track.id)) return { ok: false, code: "duplicate_media_track_id", trackIndex, trackId: parsed.track.id };
    seenTrackIds.add(parsed.track.id);
    tracks.push(parsed.track);
  }

  const blockingIssues = [];
  const warnings = [];
  const unresolvedRights = assets.filter((asset) => asset.rights === "unknown").map((asset) => asset.id);
  if (unresolvedRights.length) {
    blockingIssues.push(Object.freeze({
      code: "unresolved_media_rights",
      assetIds: Object.freeze(unresolvedRights),
      message: "Resolve ownership, licence, permission, or public-domain status before export or publication."
    }));
  }

  const missingChecksums = assets.filter((asset) => !asset.checksumSha256).map((asset) => asset.id);
  if (missingChecksums.length) {
    warnings.push(Object.freeze({
      code: "media_source_checksum_missing",
      assetIds: Object.freeze(missingChecksums),
      message: "Add SHA-256 fingerprints for durable provenance before final delivery."
    }));
  }

  const timelineDurationSeconds = tracks.reduce(
    (maximum, track) => Math.max(maximum, ...track.clips.map((clip) => clip.endSeconds), 0),
    0
  );

  const approved = approvalStatus === "approved";
  const publishable = approved && blockingIssues.length === 0;

  return {
    ok: true,
    project: Object.freeze({
      contractVersion: MEDIA_PROJECT_VERSION,
      projectId: clean(input.projectId || input.project_id, 120) || null,
      title,
      projectType,
      approvalStatus,
      assets: Object.freeze(assets),
      tracks: Object.freeze(tracks),
      timelineDurationSeconds,
      exportProfile,
      notes: clean(input.notes, 4000) || null
    }),
    blockingIssues: Object.freeze(blockingIssues),
    warnings: Object.freeze(warnings),
    publishable,
    publishesAutomatically: false
  };
}

function planMediaProduction(input = {}) {
  const validated = validateMediaProject(input);
  if (!validated.ok) return validated;

  const profile = validated.project.exportProfile
    ? Object.freeze({ key: validated.project.exportProfile, ...EXPORT_PROFILES[validated.project.exportProfile] })
    : null;

  return {
    ...validated,
    production: Object.freeze({
      stages: PRODUCTION_STAGES,
      renderRequired: Boolean(profile),
      exportProfile: profile,
      requiresApprovalBeforeExternalPublish: true,
      automaticPublish: false,
      sourceAssetMutationAllowed: false,
      specialistInterchange: Object.freeze([
        "OpenTimelineIO",
        "MIDI/audio stems",
        "image sequences",
        "GLB/glTF",
        "rendered media",
        "project manifest"
      ])
    })
  };
}

function getMediaProductionSchema() {
  return {
    contractVersion: MEDIA_PROJECT_VERSION,
    projectTypes: [...PROJECT_TYPES],
    assetTypes: [...ASSET_TYPES],
    trackTypes: [...TRACK_TYPES],
    rightsStates: [...RIGHTS_STATES],
    approvalStates: [...APPROVAL_STATES],
    exportProfiles: Object.fromEntries(Object.entries(EXPORT_PROFILES).map(([key, value]) => [key, { ...value }])),
    productionStages: [...PRODUCTION_STAGES],
    limits: { assets: 500, tracks: 100, clipsPerTrack: 2000 },
    rules: {
      sourceAssetsImmutableByDefault: true,
      automaticPublish: false,
      approvalRequiredBeforeExternalPublish: true,
      unknownRightsBlockExport: true
    }
  };
}

module.exports = {
  MEDIA_PROJECT_VERSION,
  PROJECT_TYPES,
  ASSET_TYPES,
  TRACK_TYPES,
  RIGHTS_STATES,
  APPROVAL_STATES,
  EXPORT_PROFILES,
  PRODUCTION_STAGES,
  getMediaProductionSchema,
  validateMediaProject,
  planMediaProduction
};
