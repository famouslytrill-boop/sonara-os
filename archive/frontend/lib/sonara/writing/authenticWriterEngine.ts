import type { AuthenticWriterGuidance, AuthenticWriterInput } from "./authenticWriterTypes";

const detailChecks = [
  { label: "concrete object", pattern: /\b(car|room|phone|jacket|receipt|door|table|street|keys|photo|cup)\b/i },
  { label: "specific place", pattern: /\b(kitchen|studio|bus|porch|club|parking lot|apartment|corner|school|church)\b/i },
  { label: "emotional contradiction", pattern: /\b(but|still|even though|while|although)\b/i },
  { label: "sensory detail", pattern: /\b(cold|warm|bright|loud|quiet|smell|taste|touch|rain|smoke)\b/i },
  { label: "imperfect admission", pattern: /\b(i lied|i miss|i failed|i was wrong|i am scared|i regret)\b/i },
  { label: "spoken line", pattern: /["“”']|she said|he said|they said|i said/i },
  { label: "target audience", pattern: /\b(audience|listener|fans|creators|artists|parents|students|workers)\b/i },
  { label: "social context", pattern: /\b(family|rent|work|neighborhood|culture|community|online|city|money)\b/i },
] as const;

export function analyzeAuthenticWriting(input: AuthenticWriterInput): AuthenticWriterGuidance {
  const text = input.text.trim();
  const found = detailChecks.filter((check) => check.pattern.test(text));
  const missing = detailChecks.filter((check) => !check.pattern.test(text)).map((check) => check.label);
  const minimal = text.split(/\s+/).filter(Boolean).length < 18;
  const authenticityScore = Math.max(20, Math.min(96, 30 + found.length * 8 + (input.audience ? 6 : 0) + (input.context ? 6 : 0) - (minimal ? 12 : 0)));

  return {
    authenticityScore,
    requiredDetails: missing,
    craftGuidance: [
      "Use one concrete object that could only belong in this scene.",
      "Let one imperfect admission remain slightly uncomfortable.",
      "Cut any line that sounds polished but unspecific.",
    ],
    reportingQuestions: minimal
      ? [
          "Where exactly did this happen?",
          "What object, sound, or sentence proves it was real?",
          "Who is the listener, and what do they already understand?",
        ]
      : [
          "What detail would a journalist verify first?",
          "What line would the person actually say out loud?",
          "What social pressure is underneath the scene?",
        ],
    vocalGuidance: [
      "Mark one line for conversational delivery.",
      "Leave breath before the admission or turn.",
      "Avoid performing every line at the same emotional intensity.",
    ],
    socialContextNotes: [
      "Avoid stereotypes and flattening a community into a vibe.",
      "Use context to clarify stakes, not to exploit pain.",
    ],
    avoidList: [
      "fake biography dumping",
      "generic trauma language",
      "celebrity imitation",
      "fake scandals",
      "over-polished perfection",
    ],
    revisionChecklist: [
      "Add one place.",
      "Add one object.",
      "Add one spoken line.",
      "Remove one vague feeling word.",
      "Confirm the detail belongs to the creator or project.",
    ],
  };
}
