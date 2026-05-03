import type { RedistributionCategory } from "../sound/types";

export type SoundAssetType =
  | "loop"
  | "one_shot"
  | "drum_hit"
  | "drum_loop"
  | "midi"
  | "wav"
  | "mp3"
  | "foley"
  | "field_recording"
  | "ambience"
  | "texture"
  | "preset"
  | "sample_pack"
  | "full_song_reference_blocked";

export type SoundSourceType =
  | "freesound_api"
  | "openverse_api"
  | "wikimedia_commons_api"
  | "internet_archive_metadata"
  | "user_upload"
  | "manual_collection";

export type SoundDiscoverySource = {
  id: string;
  name: string;
  url: string;
  sourceType: SoundSourceType;
  commercialUseRisk: "low" | "medium" | "high" | "manual_review";
  redistributionRisk: "low" | "medium" | "high" | "manual_review";
  requiresApiKey: boolean;
  launchStatus: "metadata_only" | "manual_review" | "disabled";
};

export type LicenseClassification = {
  redistributionCategory: RedistributionCategory;
  commercialUseAllowed: boolean;
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  exportStatus:
    | "approved"
    | "requires_attribution"
    | "music_use_only_no_repack"
    | "non_commercial_only"
    | "research_only"
    | "commercial_license_required"
    | "blocked";
  warnings: string[];
};

export type SoundDiscoveryRecord = {
  id: string;
  name: string;
  assetType: SoundAssetType;
  sourceId: string;
  sourceName: string;
  sourceUrl?: string;
  creator?: string;
  license: string;
  licenseUrl?: string;
  attributionText?: string;
  classification: LicenseClassification;
  fileDownloaded: false;
  metadata: Record<string, unknown>;
};
