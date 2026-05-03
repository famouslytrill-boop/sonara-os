import type { SoundDiscoverySource } from "./soundSourceTypes";

export const soundDiscoverySources: SoundDiscoverySource[] = [
  {
    id: "freesound",
    name: "Freesound API",
    url: "https://freesound.org",
    sourceType: "freesound_api",
    commercialUseRisk: "manual_review",
    redistributionRisk: "manual_review",
    requiresApiKey: true,
    launchStatus: "metadata_only",
  },
  {
    id: "openverse",
    name: "Openverse API",
    url: "https://openverse.org",
    sourceType: "openverse_api",
    commercialUseRisk: "manual_review",
    redistributionRisk: "manual_review",
    requiresApiKey: false,
    launchStatus: "metadata_only",
  },
  {
    id: "wikimedia_commons",
    name: "Wikimedia Commons API",
    url: "https://commons.wikimedia.org",
    sourceType: "wikimedia_commons_api",
    commercialUseRisk: "manual_review",
    redistributionRisk: "manual_review",
    requiresApiKey: false,
    launchStatus: "metadata_only",
  },
  {
    id: "internet_archive",
    name: "Internet Archive metadata/search API",
    url: "https://archive.org",
    sourceType: "internet_archive_metadata",
    commercialUseRisk: "manual_review",
    redistributionRisk: "manual_review",
    requiresApiKey: false,
    launchStatus: "metadata_only",
  },
  {
    id: "user_upload",
    name: "User uploaded assets",
    url: "/vault",
    sourceType: "user_upload",
    commercialUseRisk: "medium",
    redistributionRisk: "manual_review",
    requiresApiKey: false,
    launchStatus: "manual_review",
  },
];

export function getSoundDiscoverySource(id: string) {
  return soundDiscoverySources.find((source) => source.id === id);
}
