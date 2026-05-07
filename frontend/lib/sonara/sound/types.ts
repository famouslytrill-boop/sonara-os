export type RedistributionCategory =
  | "redistributable"
  | "music_use_only"
  | "attribution_required"
  | "non_commercial_only"
  | "research_education_only"
  | "user_owned"
  | "commercial_license_required"
  | "unknown_blocked";

export type SoundExportStatus = "approved" | "blocked" | "requires_attribution" | "requires_license_proof";

export interface SoundAsset {
  id: string;
  title: string;
  license: string;
  redistributionCategory: RedistributionCategory;
  commercialUseAllowed: boolean;
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  sourceUrl: string;
  creator: string;
  exportStatus: SoundExportStatus;
  proofUrl?: string;
}

export interface SoundSource {
  id: string;
  name: string;
  homepage: string;
  defaultCategory: RedistributionCategory;
  enabled: boolean;
}
