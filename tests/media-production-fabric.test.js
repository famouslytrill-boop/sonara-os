"use strict";

const assert = require("node:assert/strict");
const {
  getMediaProductionSchema,
  validateMediaProject,
  planMediaProduction
} = require("../lib/sonara-media-production-fabric.cjs");

describe("Media Production Fabric", () => {
  function project(overrides = {}) {
    return {
      projectId: "project-1",
      title: "Campaign film",
      projectType: "film",
      approvalStatus: "approved",
      exportProfile: "video_hd_1080",
      assets: [
        {
          id: "video-a",
          type: "video",
          rights: "owned",
          checksumSha256: "a".repeat(64),
          storageRef: "creator-assets/video-a"
        },
        {
          id: "music-a",
          type: "music",
          rights: "licensed",
          checksumSha256: "b".repeat(64),
          storageRef: "music-stems/music-a"
        }
      ],
      tracks: [
        {
          id: "v1",
          type: "video",
          clips: [{ id: "clip-video", assetId: "video-a", startSeconds: 0, durationSeconds: 12 }]
        },
        {
          id: "a1",
          type: "audio",
          clips: [{ id: "clip-music", assetId: "music-a", startSeconds: 0, durationSeconds: 15 }]
        }
      ],
      ...overrides
    };
  }

  it("publishes a deterministic schema with no automatic publication authority", () => {
    const schema = getMediaProductionSchema();
    assert.ok(schema.projectTypes.includes("film"));
    assert.ok(schema.projectTypes.includes("image"));
    assert.ok(schema.assetTypes.includes("voice"));
    assert.ok(schema.trackTypes.includes("captions"));
    assert.ok(schema.exportProfiles.video_4k_master);
    assert.equal(schema.rules.automaticPublish, false);
    assert.equal(schema.rules.unknownRightsBlockExport, true);
  });

  it("calculates timeline duration from the project graph and keeps sources immutable", () => {
    const result = planMediaProduction(project());
    assert.equal(result.ok, true);
    assert.equal(result.project.timelineDurationSeconds, 15);
    assert.equal(result.publishable, true);
    assert.equal(result.production.sourceAssetMutationAllowed, false);
    assert.equal(result.production.automaticPublish, false);
    assert.equal(result.production.requiresApprovalBeforeExternalPublish, true);
    assert.equal(result.production.exportProfile.width, 1920);
  });

  it("blocks export when rights are unresolved even if an approval flag was supplied", () => {
    const result = validateMediaProject(project({
      assets: [{ id: "image-a", type: "image", rights: "unknown", checksumSha256: "c".repeat(64) }],
      tracks: []
    }));
    assert.equal(result.ok, true);
    assert.equal(result.publishable, false);
    assert.equal(result.blockingIssues[0].code, "unresolved_media_rights");
    assert.deepEqual(result.blockingIssues[0].assetIds, ["image-a"]);
  });

  it("does not treat draft or review state as publishable", () => {
    for (const approvalStatus of ["draft", "review"]) {
      const result = validateMediaProject(project({ approvalStatus }));
      assert.equal(result.ok, true);
      assert.equal(result.publishable, false);
      assert.equal(result.publishesAutomatically, false);
    }
  });

  it("refuses a timeline clip that references an asset outside the project", () => {
    const result = validateMediaProject(project({
      tracks: [{
        id: "v1",
        type: "video",
        clips: [{ id: "orphan", assetId: "missing", startSeconds: 0, durationSeconds: 5 }]
      }]
    }));
    assert.equal(result.ok, false);
    assert.equal(result.code, "media_clip_asset_not_found");
    assert.equal(result.assetId, "missing");
  });

  it("refuses duplicate asset track and clip identities rather than producing an ambiguous graph", () => {
    const duplicateAsset = validateMediaProject(project({
      assets: [
        { id: "same", type: "image", rights: "owned" },
        { id: "same", type: "video", rights: "owned" }
      ],
      tracks: []
    }));
    assert.equal(duplicateAsset.ok, false);
    assert.equal(duplicateAsset.code, "duplicate_media_asset_id");

    const duplicateTrack = validateMediaProject(project({
      tracks: [
        { id: "same-track", type: "video", clips: [] },
        { id: "same-track", type: "audio", clips: [] }
      ]
    }));
    assert.equal(duplicateTrack.ok, false);
    assert.equal(duplicateTrack.code, "duplicate_media_track_id");

    const duplicateClip = validateMediaProject(project({
      tracks: [
        { id: "v1", type: "video", clips: [{ id: "same-clip", assetId: "video-a", startSeconds: 0, durationSeconds: 1 }] },
        { id: "a1", type: "audio", clips: [{ id: "same-clip", assetId: "music-a", startSeconds: 0, durationSeconds: 1 }] }
      ]
    }));
    assert.equal(duplicateClip.ok, false);
    assert.equal(duplicateClip.code, "duplicate_media_clip_id");
  });

  it("refuses malformed timing and unknown export profiles", () => {
    const badDuration = validateMediaProject(project({
      tracks: [{
        id: "v1",
        type: "video",
        clips: [{ id: "bad", assetId: "video-a", startSeconds: 0, durationSeconds: 0 }]
      }]
    }));
    assert.equal(badDuration.ok, false);
    assert.equal(badDuration.code, "media_clip_duration_invalid");

    const badExport = validateMediaProject(project({ exportProfile: "eight_k_magic" }));
    assert.equal(badExport.ok, false);
    assert.equal(badExport.code, "unknown_media_export_profile");
  });

  it("warns when provenance fingerprints are missing without inventing one", () => {
    const result = validateMediaProject(project({
      assets: [{ id: "voice-a", type: "voice", rights: "permissioned" }],
      tracks: []
    }));
    assert.equal(result.ok, true);
    assert.equal(result.warnings[0].code, "media_source_checksum_missing");
    assert.deepEqual(result.warnings[0].assetIds, ["voice-a"]);
  });
});
