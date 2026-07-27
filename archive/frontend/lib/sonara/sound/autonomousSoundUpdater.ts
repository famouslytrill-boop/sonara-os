import { fetchSourceAssets } from "./sourceAdapters";
import { soundSourceRegistry } from "./sourceRegistry";

export async function runAutonomousSoundUpdate() {
  const assets = (await Promise.all(soundSourceRegistry.map((source) => fetchSourceAssets(source.id)))).flat();

  return {
    syncedAt: new Date().toISOString(),
    sourceCount: soundSourceRegistry.length,
    assetCount: assets.length,
    assets,
  };
}
