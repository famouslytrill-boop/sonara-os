import type { WordSourceNote } from "../wordIntelligenceTypes";

export type WikimediaWordLookup = {
  status: "not_configured" | "ready";
  query: string;
  notes: WordSourceNote[];
};

export function createWikimediaLookupPlaceholder(
  query: string
): WikimediaWordLookup {
  return {
    status: "not_configured",
    query,
    notes: [
      {
        sourceTitle: "Wikimedia/Wiktionary lookup",
        licenseNote:
          "Optional future lookup. Verify page license and attribution before using source material.",
        retrievedAt: new Date().toISOString(),
        manualReviewRequired: true,
      },
    ],
  };
}
