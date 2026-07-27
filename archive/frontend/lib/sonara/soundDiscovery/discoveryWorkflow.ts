import { classifySoundLicense } from "./licenseClassifier";
import { getSoundDiscoverySource } from "./sourceRegistry";
import type { SoundAssetType, SoundDiscoveryRecord } from "./soundSourceTypes";

export function createSoundDiscoveryMetadataRecord(input: {
  id: string;
  name: string;
  assetType?: SoundAssetType;
  sourceId: string;
  sourceUrl?: string;
  creator?: string;
  license?: string;
  licenseUrl?: string;
  attributionText?: string;
  metadata?: Record<string, unknown>;
}): SoundDiscoveryRecord {
  const source = getSoundDiscoverySource(input.sourceId);
  const license = input.license ?? "unknown";
  return {
    id: input.id,
    name: input.name,
    assetType: input.assetType ?? "loop",
    sourceId: input.sourceId,
    sourceName: source?.name ?? "Manual source",
    sourceUrl: input.sourceUrl,
    creator: input.creator,
    license,
    licenseUrl: input.licenseUrl,
    attributionText: input.attributionText,
    classification: classifySoundLicense(license),
    fileDownloaded: false,
    metadata: {
      ...(input.metadata ?? {}),
      workflow: "metadata_first_manual_review",
      note: "SONARA discovers and classifies metadata first; file download or publication requires human approval.",
    },
  };
}
