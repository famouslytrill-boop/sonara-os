import type {
  ReleaseReadinessInput,
  ReleaseReadinessResult,
  ReleaseReadinessStatus,
} from "./releaseReadinessTypes";

const checks: Array<[keyof ReleaseReadinessInput, string]> = [
  ["lyricsStructure", "Lyrics structure"],
  ["arrangementClarity", "Arrangement clarity"],
  ["stylePromptClarity", "Style / Production Prompt clarity"],
  ["metadataCompleteness", "Metadata completeness"],
  ["rightsSafety", "Rights safety"],
  ["exportCompleteness", "Export completeness"],
  ["brandConsistency", "Brand consistency"],
  ["releaseStrategy", "Release strategy"],
  ["authenticitySignals", "Authenticity signals"],
];

function statusFromScore(score: number): ReleaseReadinessStatus {
  if (score < 35) return "blocked";
  if (score < 70) return "needs_work";
  if (score < 90) return "ready";
  return "strong";
}

export function calculateReleaseReadiness(
  input: ReleaseReadinessInput
): ReleaseReadinessResult {
  const strengths = checks
    .filter(([key]) => input[key])
    .map(([, label]) => label);
  const missingItems = checks
    .filter(([key]) => !input[key])
    .map(([, label]) => label);
  const score = Math.round((strengths.length / checks.length) * 100);

  return {
    score,
    status: statusFromScore(score),
    strengths,
    missingItems,
    recommendedNextSteps: missingItems.slice(0, 4).map((item) => `Improve ${item}.`),
  };
}
