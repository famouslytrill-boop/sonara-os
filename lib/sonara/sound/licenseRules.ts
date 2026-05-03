import type { SoundAsset } from "./types";
import { getExportStatus } from "./redistributionRules";

export function canUseInCommercialPack(asset: SoundAsset) {
  return asset.commercialUseAllowed && getExportStatus(asset) === "approved";
}

export function canUseInFinishedSong(asset: SoundAsset) {
  return asset.redistributionCategory === "music_use_only" || canUseInCommercialPack(asset);
}

export function canRedistributeRawSample(asset: SoundAsset) {
  if (asset.redistributionCategory === "music_use_only") return false;
  return asset.redistributionAllowed && ["approved", "requires_attribution"].includes(getExportStatus(asset));
}

export function normalizeSoundAsset(asset: SoundAsset): SoundAsset {
  const exportStatus = getExportStatus(asset);
  return {
    ...asset,
    exportStatus,
    redistributionAllowed: exportStatus === "approved" || exportStatus === "requires_attribution",
    commercialUseAllowed:
      asset.redistributionCategory !== "non_commercial_only" &&
      asset.redistributionCategory !== "research_education_only" &&
      asset.redistributionCategory !== "unknown_blocked",
  };
}
