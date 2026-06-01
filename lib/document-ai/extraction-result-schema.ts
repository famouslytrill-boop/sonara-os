export type ExtractionResult = {
  jobId: string;
  markdown?: string;
  chunks: string[];
  confidence: number;
  reviewStatus: "unreviewed" | "reviewed" | "blocked";
};
