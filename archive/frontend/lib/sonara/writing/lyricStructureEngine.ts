import { defaultExplicitnessMode, getExplicitLanguageWarnings, suggestCleanAlternatives } from "./explicitLanguagePolicy";
import type { LyricStructureInput, LyricStructureResult, StructuredLyricSection } from "./lyricStructureTypes";

function splitLines(rawLyrics: string) {
  return rawLyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function analyzeLyricStructure(input: LyricStructureInput): LyricStructureResult {
  const explicitnessMode = input.explicitnessMode ?? defaultExplicitnessMode;
  const lines = splitLines(input.rawLyrics);
  const warnings = getExplicitLanguageWarnings(input.rawLyrics, explicitnessMode);
  const missingPieces: string[] = [];

  if (lines.length < 4) missingPieces.push("Add more lyric lines before full section mapping.");
  if (!/\b(hook|chorus)\b/i.test(input.rawLyrics) && lines.length < 8) missingPieces.push("Mark or write a hook section.");
  if (!/\b(verse)\b/i.test(input.rawLyrics) && lines.length < 10) missingPieces.push("Add a verse section with story detail.");

  const hookCandidates = extractHookCandidates(lines);
  const sectionPlan = buildSectionPlan(lines, hookCandidates);
  const cleanAlternative = warnings.length ? suggestCleanAlternatives(input.rawLyrics) : "";

  return {
    suggestedTitle: hookCandidates[0]?.replace(/[^\w\s']/g, "").slice(0, 48),
    explicitnessMode,
    suggestedStructure: input.desiredStructure ?? (lines.length > 12 ? "Intro / Verse / Pre-Hook / Hook / Verse / Bridge / Final Hook / Outro" : "Verse / Hook / Verse / Hook"),
    structureReason: lines.length < 4 ? "The lyric is short, so SONARA recommends a simple structure without inventing fake verses." : "The structure keeps the strongest repeated line near the hook and preserves user-written material.",
    hookCandidates,
    sectionPlan,
    missingPieces,
    repetitionMap: buildRepetitionMap(lines),
    rhymeNotes: ["Check last-word echoes across adjacent lines.", "Near-rhyme is acceptable when it supports spoken delivery."],
    cadenceNotes: [input.bpm ? `At ${input.bpm} BPM, mark breaths before dense lines.` : "Choose BPM before final breath mapping.", "Read the hook out loud before adding more syllables."],
    breathMarkers: lines.slice(0, 5).map((line) => `${line} / breathe after the main image`),
    emotionalArc: ["Set the scene.", "Name the pressure.", "Turn the contradiction into the hook.", "Resolve with a final image or decision."],
    revisionChecklist: [
      "Keep user-written details intact.",
      "Move the clearest repeated line into the hook.",
      "Add section labels before export.",
      cleanAlternative ? `Clean-mode alternative draft: ${cleanAlternative.slice(0, 120)}` : "Confirm explicitness label before release metadata.",
    ],
    warnings,
  };
}

function extractHookCandidates(lines: string[]) {
  const repeated = buildRepetitionMap(lines).map((item) => item.split(" x")[0]);
  const shortStrong = lines.filter((line) => line.length >= 8 && line.length <= 70).slice(0, 4);
  return [...new Set([...repeated, ...shortStrong])].slice(0, 5);
}

function buildSectionPlan(lines: string[], hookCandidates: string[]): StructuredLyricSection[] {
  if (!lines.length) {
    return [
      {
        sectionType: "verse",
        label: "Verse draft",
        lines: [],
        purpose: "Paste user-written lyrics before SONARA maps sections.",
        energyLevel: "low",
        breathNotes: ["No breath map yet."],
        performanceNotes: ["Do not invent lyrics for the user."],
      },
    ];
  }

  const midpoint = Math.max(1, Math.floor(lines.length / 2));
  return [
    {
      sectionType: "verse",
      label: "Verse candidate",
      lines: lines.slice(0, midpoint),
      purpose: "Establish scene, speaker, and pressure.",
      energyLevel: "medium",
      breathNotes: ["Leave breath after long image lines."],
      performanceNotes: ["Keep delivery conversational."],
    },
    {
      sectionType: "hook",
      label: "Hook candidate",
      lines: hookCandidates.slice(0, 2),
      purpose: "Anchor the repeatable emotional idea.",
      energyLevel: "peak",
      breathNotes: ["Use a breath before the title phrase."],
      performanceNotes: ["Repeat only the line that can survive outside the song."],
    },
    {
      sectionType: "verse",
      label: "Second section candidate",
      lines: lines.slice(midpoint),
      purpose: "Add contrast or a sharper angle.",
      energyLevel: "high",
      breathNotes: ["Trim extra syllables before recording."],
      performanceNotes: ["Change cadence from the first section."],
    },
  ];
}

function buildRepetitionMap(lines: string[]) {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[^\w\s']/g, "").trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([line, count]) => `${line} x${count}`);
}
