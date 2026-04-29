import { soundSourceRegistry } from "./sourceRegistry";
import type { SoundAsset } from "./types";
import { normalizeSoundAsset } from "./licenseRules";

export async function fetchSourceAssets(sourceId: string): Promise<SoundAsset[]> {
  const source = soundSourceRegistry.find((item) => item.id === sourceId);
  if (!source || !source.enabled) return [];

  return [
    normalizeSoundAsset({
      id: `${source.id}-starter`,
      title: `${source.name} Starter Asset`,
      license: source.defaultCategory === "user_owned" ? "User owned" : "SONARA internal starter license",
      redistributionCategory: source.defaultCategory,
      commercialUseAllowed: source.defaultCategory !== "research_education_only",
      redistributionAllowed: source.defaultCategory === "redistributable" || source.defaultCategory === "user_owned",
      attributionRequired: false,
      sourceUrl: source.homepage,
      creator: "SONARA Industries™",
      exportStatus: "approved",
    }),
  ];
}
