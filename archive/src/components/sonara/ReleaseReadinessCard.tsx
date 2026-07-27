import { calculateReleaseReadiness } from "@/lib/sonara/readiness/releaseReadinessEngine";
import type { ReleaseReadinessInput } from "@/lib/sonara/readiness/releaseReadinessTypes";
import { Card } from "./LaunchShell";

export function ReleaseReadinessCard({
  input = {
    lyricsStructure: true,
    arrangementClarity: true,
    stylePromptClarity: true,
    rightsSafety: true,
  },
}: {
  input?: ReleaseReadinessInput;
}) {
  const result = calculateReleaseReadiness(input);

  return (
    <Card title="Release Readiness Score" status={`${result.score}/100`}>
      <p>Status: {result.status.replace("_", " ")}</p>
      <p>
        Next steps:{" "}
        {result.recommendedNextSteps.length
          ? result.recommendedNextSteps.join(" ")
          : "Prepare final export and release QA."}
      </p>
    </Card>
  );
}
