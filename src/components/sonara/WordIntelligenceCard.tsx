import { generateWordIntelligence } from "@/lib/sonara/writing/wordIntelligenceEngine";
import type { WordIntelligenceResult } from "@/lib/sonara/writing/wordIntelligenceTypes";
import { Card } from "./LaunchShell";

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function WordIntelligenceCard({
  result = generateWordIntelligence({
    seedText: "song idea hook place memory",
    mood: "focused",
    genre: "all-genre",
  }),
}: {
  result?: WordIntelligenceResult;
}) {
  return (
    <Card title="Word Intelligence" status="Local rules">
      <p>
        Stronger words, hook language, metaphor seeds, clean alternatives, and
        source-aware revision prompts without requiring OpenAI or live lookups.
      </p>
      <strong>Hook language</strong>
      <List items={result.hookLanguage.slice(0, 4)} />
      <strong>Metaphor seeds</strong>
      <List items={result.metaphorSeeds.slice(0, 3)} />
      <strong>Manual review</strong>
      <List items={result.manualReviewWarnings.slice(0, 1)} />
    </Card>
  );
}
