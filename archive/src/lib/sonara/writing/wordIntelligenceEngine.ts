import type {
  ExplicitnessMode,
  WordIntelligenceInput,
  WordIntelligenceResult,
} from "./wordIntelligenceTypes";
import { createWikimediaLookupPlaceholder } from "./sources/wikimediaWordClient";
import { getUrbanDictionaryPolicyAdapter } from "./sources/urbanDictionaryPolicyAdapter";

const genericWords = ["good", "bad", "nice", "sad", "happy", "thing"];
const hatefulSlurPattern = /\b(slur|dehumanize|hate speech)\b/i;

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values)).slice(0, 8);
}

function explicitAlternatives(mode: ExplicitnessMode) {
  if (mode === "explicit") {
    return ["raw confession", "hard truth", "unfiltered hook"];
  }

  if (mode === "mature") {
    return ["grown-up admission", "sharp memory", "late-night truth"];
  }

  return [];
}

export function generateWordIntelligence(
  input: WordIntelligenceInput
): WordIntelligenceResult {
  const explicitnessMode = input.explicitnessMode ?? "radio_safe";
  const words = tokenize(input.seedText);
  const hasMinimalInput = words.length < 8;
  const sourcePlaceholder = createWikimediaLookupPlaceholder(
    words[0] ?? "song language"
  );
  const urbanPolicy = getUrbanDictionaryPolicyAdapter();

  const concreteWords = words.filter(
    (word) => word.length > 4 && !genericWords.includes(word)
  );

  const strongerWords = hasMinimalInput
    ? ["specific place", "concrete object", "spoken line"]
    : unique(concreteWords.map((word) => `${word} detail`));

  const avoidList = [
    "generic pain without detail",
    "fake biography",
    "direct artist imitation",
    "copied definitions",
  ];

  if (hatefulSlurPattern.test(input.seedText)) {
    avoidList.push("hateful or dehumanizing language");
  }

  return {
    strongerWords,
    hookLanguage: unique([
      "say it like a title",
      "make the first line repeatable",
      `${input.mood ?? "clear"} promise`,
      `${input.genre ?? "genre-flexible"} phrase`,
    ]),
    rhymeAdjacentWords: unique([
      "motion",
      "open",
      "broken",
      "focus",
      "golden",
      ...concreteWords.slice(0, 3),
    ]),
    cleanAlternatives: [
      "forget that",
      "walk away",
      "late night",
      "pressure",
      "line I will not cross",
    ],
    explicitAlternatives: explicitAlternatives(explicitnessMode),
    metaphorSeeds: unique([
      "receipt in a coat pocket",
      "stage light on an empty room",
      "voice memo at midnight",
      "rain on the studio window",
    ]),
    regionalPhrasingNotes: [
      "Keep slang optional and verify meaning by region.",
      "Avoid culturally specific phrasing unless the creator supplies context.",
    ],
    genreAwareVocabulary: unique([
      input.genre ? `${input.genre} texture` : "genre texture",
      "hook phrase",
      "bridge turn",
      "call-and-response",
    ]),
    avoidList,
    revisionPrompts: [
      "What object proves the feeling happened?",
      "Where is the scene taking place?",
      "What line would the singer say in conversation?",
      "What word can be simpler but sharper?",
    ],
    sourceNotes: sourcePlaceholder.notes,
    attributionNotes: [
      "Local suggestions do not require attribution.",
      "External language lookups require source review before commercial output.",
    ],
    manualReviewWarnings: [urbanPolicy.warning],
  };
}
