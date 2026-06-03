import type { CreatorAsset, DuplicateAssetWarning } from "./contracts.ts";
export function detectDuplicateAsset(a: CreatorAsset, b: CreatorAsset): DuplicateAssetWarning {
  const duplicate =
    a.organization_id === b.organization_id &&
    a.title === b.title &&
    a.artist_name === b.artist_name;
  return { duplicate, reason: duplicate ? "title_artist_match" : "no_match" };
}
