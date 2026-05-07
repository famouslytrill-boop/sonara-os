import type { MetadataReadinessInput, MetadataReadinessResult } from "./metadataReadinessTypes";

export function evaluateMetadataReadiness(input: MetadataReadinessInput): MetadataReadinessResult {
  const missing = [
    input.title ? "" : "title",
    input.creator ? "" : "creator",
    input.explicitnessMode ? "" : "explicitness label",
    input.credits?.length ? "" : "credits",
    input.rightsNotes?.length ? "" : "rights notes",
  ].filter(Boolean);
  return {
    score: Math.max(0, 100 - missing.length * 18),
    missing,
    warnings: ["SONARA does not guarantee distributor approval.", "User remains responsible for rights clearance."],
  };
}
