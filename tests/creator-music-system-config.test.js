const assert = require("node:assert");

const {
  CREATOR_MUSIC_SYSTEM_TABLES,
  CREATOR_MUSIC_REQUIRED_FIELDS,
  CREATOR_MUSIC_PUBLIC_LABELS,
  CREATOR_MUSIC_ROUTES,
  CREATOR_MUSIC_SAFETY_RULES
} = require("../lib/creator-music-system-config.cjs");

describe("Creator Studio music system config", () => {
  it("lists all required music system tables", () => {
    const required = [
      "creator_artist_systems",
      "creator_voice_profiles",
      "creator_influence_maps",
      "creator_narrative_arcs",
      "creator_song_blueprints",
      "creator_song_sections",
      "creator_production_notes",
      "creator_prompt_packs",
      "creator_release_packages",
      "creator_quality_checks",
      "creator_export_packages"
    ];

    for (const table of required) {
      assert.ok(CREATOR_MUSIC_SYSTEM_TABLES.includes(table), `${table} missing`);
    }
  });

  it("requires specific music planning fields", () => {
    for (const field of ["key_signature", "rhythmic_feel", "harmonic_identity", "drum_language", "vocal_mode"]) {
      assert.ok(CREATOR_MUSIC_REQUIRED_FIELDS.includes(field), `${field} missing`);
    }
  });

  it("uses plain public labels", () => {
    assert.equal(CREATOR_MUSIC_PUBLIC_LABELS.creator_artist_systems, "Music Systems");
    assert.equal(CREATOR_MUSIC_PUBLIC_LABELS.creator_song_blueprints, "Song Blueprints");
    assert.equal(CREATOR_MUSIC_PUBLIC_LABELS.creator_export_packages, "Export Packages");
  });

  it("defines user-facing and api routes", () => {
    assert.equal(CREATOR_MUSIC_ROUTES.home, "/creator-studio/music-system");
    assert.equal(CREATOR_MUSIC_ROUTES.createSystem, "/creator-studio/music-system/new");
    assert.equal(CREATOR_MUSIC_ROUTES.songBlueprint, "/creator-studio/music-system/song");
    assert.equal(CREATOR_MUSIC_ROUTES.readiness, "/api/creator/music-system/readiness");
  });

  it("includes originality and safety rules", () => {
    assert.ok(CREATOR_MUSIC_SAFETY_RULES.length >= 5);
    assert.ok(CREATOR_MUSIC_SAFETY_RULES.some((rule) => rule.toLowerCase().includes("original")));
  });
});
