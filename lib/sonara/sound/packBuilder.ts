import { canRedistributeRawSample } from "./licenseRules";
import type { SoundAsset } from "./types";

export function buildSoundPack(assets: SoundAsset[]) {
  const approved = assets.filter(canRedistributeRawSample);
  const blocked = assets.filter((asset) => !canRedistributeRawSample(asset));

  return {
    approved,
    blocked,
    attributionSheet: approved
      .filter((asset) => asset.attributionRequired)
      .map((asset) => `${asset.title} by ${asset.creator} (${asset.sourceUrl}) - redistributionCategory: ${asset.redistributionCategory}`),
  };
}
