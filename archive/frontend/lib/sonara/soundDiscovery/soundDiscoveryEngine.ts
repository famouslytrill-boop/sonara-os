import { createSoundDiscoveryMetadataRecord } from "./discoveryWorkflow";
import { soundDiscoverySources } from "./sourceRegistry";
import type { SoundDiscoveryRecord } from "./soundSourceTypes";

export function getSoundDiscoveryLaunchStatus() {
  return {
    mode: "metadata_first",
    supportedSources: soundDiscoverySources,
    rules: [
      "Do not bulk-download or publish sound packs without human approval.",
      "Unknown rights are blocked.",
      "Music-use-only assets may support finished songs but not raw sample-pack export.",
      "Attribution-required assets need an attribution sheet.",
    ],
  };
}

export function demoSoundDiscoveryRecord(): SoundDiscoveryRecord {
  return createSoundDiscoveryMetadataRecord({
    id: "metadata_demo_001",
    name: "Project Alpha open texture metadata",
    sourceId: "openverse",
    license: "unknown",
    assetType: "texture",
    metadata: { demo: true },
  });
}
