import type { RedistributionCategory, SoundAsset, SoundExportStatus } from "./types";

export const redistributionCategories: RedistributionCategory[] = [
  "redistributable",
  "music_use_only",
  "attribution_required",
  "non_commercial_only",
  "research_education_only",
  "user_owned",
  "commercial_license_required",
  "unknown_blocked",
];

export function getExportStatus(asset: Pick<SoundAsset, "redistributionCategory" | "attributionRequired" | "proofUrl">): SoundExportStatus {
  switch (asset.redistributionCategory) {
    case "redistributable":
    case "user_owned":
      return "approved";
    case "attribution_required":
      return asset.attributionRequired ? "requires_attribution" : "approved";
    case "commercial_license_required":
      return asset.proofUrl ? "approved" : "requires_license_proof";
    case "music_use_only":
    case "non_commercial_only":
    case "research_education_only":
    case "unknown_blocked":
      return "blocked";
  }
}
