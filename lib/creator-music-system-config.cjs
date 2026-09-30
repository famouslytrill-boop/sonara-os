// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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

// Every route here is registered. That is the whole point of the list.
//
// It used to carry eleven more: artistSystems, voiceProfiles, soundMaps,
// storyArcs, songBlueprints, songSections, productionNotes, promptPacksApi,
// releasePackages, qualityChecks and exportPackages, one per table in
// CREATOR_MUSIC_SYSTEM_TABLES above. Nothing registered any of them. The eleven
// tables are real -- migration 020 creates them with row-level security and
// CREATOR_MUSIC_SYSTEM_TABLES is checked against the database contract -- but no
// route and no library reads or writes one, so the paths named a save endpoint
// that did not exist, and public/creator-music-system.js called all eleven.
//
// A declared path nothing serves is the third instance of one shape in this
// repository, after the fourteen Creator Studio row controls and the three
// unreachable media rules. scripts/report-declared-api-paths-nothing-serves.mjs
// is the gate that now fails on a fourth.
//
// Removing them is not a decision that the eleven record areas will never be
// built. It is the removal of a claim that they already are.
const CREATOR_MUSIC_ROUTES = {
  home: "/creator-studio/music-system",
  createSystem: "/creator-studio/music-system/new",
  songBlueprint: "/creator-studio/music-system/song",
  promptPacks: "/creator-studio/music-system/prompts",
  readiness: "/api/creator/music-system/readiness"
};

const CREATOR_MUSIC_SAFETY_RULES = [
  "Create original artist and project systems only.",
  "Do not seed private artist names into the product.",
  "Do not use direct artist-name imitation as the core generation method.",
  "Do not store provider secrets or API keys in browser-visible data.",
  "Do not mark exports ready until the user has checked the quality and confirmed it is ready to release.",
  "Every generated music plan must include key, rhythm, harmony, drums, and vocal mode."
];

module.exports = {
  CREATOR_MUSIC_SYSTEM_TABLES,
  CREATOR_MUSIC_REQUIRED_FIELDS,
  CREATOR_MUSIC_PUBLIC_LABELS,
  CREATOR_MUSIC_ROUTES,
  CREATOR_MUSIC_SAFETY_RULES
};
