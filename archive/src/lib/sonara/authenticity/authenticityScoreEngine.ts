import type {
  AuthenticityScoreInput,
  AuthenticityScoreResult,
} from "./authenticityScoreTypes";

type AuthenticitySignalKey = Exclude<keyof AuthenticityScoreInput, "text">;

const signals: Array<[AuthenticitySignalKey, string]> = [
  ["hasConcreteObject", "concrete object"],
  ["hasSpecificPlace", "specific place"],
  ["hasSensoryDetail", "sensory detail"],
  ["hasEmotionalContradiction", "emotional contradiction"],
  ["hasSpokenLine", "spoken line"],
  ["hasImperfectAdmission", "imperfect admission"],
  ["hasUniquePhrase", "unique phrase"],
  ["hasGroundedSocialContext", "grounded social context"],
];

export function calculateAuthenticityScore(
  input: AuthenticityScoreInput
): AuthenticityScoreResult {
  const text = input.text.toLowerCase();
  const inferred = {
    hasConcreteObject:
      input.hasConcreteObject ?? /\b(keys|phone|door|car|shirt|receipt)\b/.test(text),
    hasSpecificPlace:
      input.hasSpecificPlace ?? /\b(kitchen|studio|porch|train|street|room)\b/.test(text),
    hasSensoryDetail:
      input.hasSensoryDetail ?? /\b(cold|warm|smell|taste|light|rain)\b/.test(text),
    hasEmotionalContradiction:
      input.hasEmotionalContradiction ?? /\b(but|still|even though)\b/.test(text),
    hasSpokenLine: input.hasSpokenLine ?? /["']/.test(input.text),
    hasImperfectAdmission:
      input.hasImperfectAdmission ?? /\b(i was wrong|i lied|i stayed|i left)\b/.test(text),
    hasUniquePhrase: input.hasUniquePhrase ?? input.text.length > 80,
    hasGroundedSocialContext:
      input.hasGroundedSocialContext ?? /\b(family|friends|city|work|school)\b/.test(text),
  };

  const strengths = signals
    .filter(([key]) => inferred[key])
    .map(([, label]) => label);
  const missingSignals = signals
    .filter(([key]) => !inferred[key])
    .map(([, label]) => label);

  return {
    score: Math.round((strengths.length / signals.length) * 100),
    strengths,
    missingSignals,
    suggestions: missingSignals
      .slice(0, 4)
      .map((signal) => `Add one ${signal} without inventing biography.`),
    warnings: [
      "Do not force trauma.",
      "Do not imitate living artists.",
      "Use details the creator can stand behind.",
    ],
  };
}
