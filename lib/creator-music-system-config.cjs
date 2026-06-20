"use strict";

const CREATOR_MUSIC_SYSTEM_TABLES = [
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

const CREATOR_MUSIC_REQUIRED_FIELDS = [
  "key_signature",
  "rhythmic_feel",
  "harmonic_identity",
  "drum_language",
  "vocal_mode"
];

const CREATOR_MUSIC_PUBLIC_LABELS = {
  creator_artist_systems: "Music Systems",
  creator_voice_profiles: "Voice Profiles",
  creator_influence_maps: "Sound Maps",
  creator_narrative_arcs: "Story Arcs",
  creator_song_blueprints: "Song Blueprints",
  creator_song_sections: "Song Sections",
  creator_production_notes: "Production Notes",
  creator_prompt_packs: "Prompt Packs",
  creator_release_packages: "Release Packages",
  creator_quality_checks: "Quality Checks",
  creator_export_packages: "Export Packages"
};

const CREATOR_MUSIC_ROUTES = {
  home: "/creator-studio/music-system",
  createSystem: "/creator-studio/music-system/new",
  songBlueprint: "/creator-studio/music-system/song",
  promptPacks: "/creator-studio/music-system/prompts",
  readiness: "/api/creator/music-system/readiness",
  artistSystems: "/api/creator/artist-systems",
  voiceProfiles: "/api/creator/voice-profiles",
  soundMaps: "/api/creator/influence-maps",
  storyArcs: "/api/creator/narrative-arcs",
  songBlueprints: "/api/creator/song-blueprints",
  songSections: "/api/creator/song-sections",
  productionNotes: "/api/creator/production-notes",
  promptPacksApi: "/api/creator/prompt-packs",
  releasePackages: "/api/creator/release-packages",
  qualityChecks: "/api/creator/quality-checks",
  exportPackages: "/api/creator/export-packages"
};

const CREATOR_MUSIC_SAFETY_RULES = [
  "Create original artist and project systems only.",
  "Do not seed private artist names into the product.",
  "Do not use direct artist-name imitation as the core generation method.",
  "Do not store provider secrets or API keys in browser-visible data.",
  "Do not mark exports ready until the user reviews quality and release readiness.",
  "Every generated music plan must include key, rhythm, harmony, drums, and vocal mode."
];

module.exports = {
  CREATOR_MUSIC_SYSTEM_TABLES,
  CREATOR_MUSIC_REQUIRED_FIELDS,
  CREATOR_MUSIC_PUBLIC_LABELS,
  CREATOR_MUSIC_ROUTES,
  CREATOR_MUSIC_SAFETY_RULES
};
