export type ReleaseReadinessStatus = "blocked" | "needs_work" | "ready" | "strong";

export type ReleaseReadinessInput = {
  lyricsStructure?: boolean;
  arrangementClarity?: boolean;
  stylePromptClarity?: boolean;
  metadataCompleteness?: boolean;
  rightsSafety?: boolean;
  exportCompleteness?: boolean;
  brandConsistency?: boolean;
  releaseStrategy?: boolean;
  authenticitySignals?: boolean;
};

export type ReleaseReadinessResult = {
  score: number;
  status: ReleaseReadinessStatus;
  strengths: string[];
  missingItems: string[];
  recommendedNextSteps: string[];
};
