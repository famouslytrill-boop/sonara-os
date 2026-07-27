import { calculateAuthenticityScore } from "@/lib/sonara/authenticity/authenticityScoreEngine";
import { Card } from "./LaunchShell";

export function AuthenticityScoreCard({ text = "" }: { text?: string }) {
  const result = calculateAuthenticityScore({
    text:
      text ||
      "I left my keys by the studio door, but I still came back before the rain stopped.",
  });

  return (
    <Card title="Authenticity Score" status={`${result.score}/100`}>
      <p>
        Checks concrete objects, place, sensory detail, contradiction, spoken
        lines, imperfect admission, unique phrasing, and grounded context.
      </p>
      <p>Suggested next step: {result.suggestions[0] ?? "Keep the details honest."}</p>
    </Card>
  );
}
