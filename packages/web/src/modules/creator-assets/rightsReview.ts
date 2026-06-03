import type { CreatorAsset } from "./contracts.ts";
export function updateRightsReview(
  asset: CreatorAsset,
  rights_review_status: CreatorAsset["rights_review_status"]
) {
  return { asset: { ...asset, rights_review_status }, auditRequired: true };
}
export function isLyricScrapingBlocked(source: string) {
  return /lyrics?|streaming platform|bypass/i.test(source);
}
