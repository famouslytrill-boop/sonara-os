export type LyricExplicitnessMode = "clean" | "radio_safe" | "mature" | "explicit";

export const defaultExplicitnessMode: LyricExplicitnessMode = "radio_safe";

const profanityPatterns = [/\bfuck(?:ing|ed)?\b/i, /\bshit\b/i, /\bbitch(?:es)?\b/i, /\basshole\b/i, /\bdamn\b/i];

export function containsProfanity(text: string) {
  return profanityPatterns.some((pattern) => pattern.test(text));
}

export function explicitnessAllowsProfanity(mode: LyricExplicitnessMode) {
  return mode === "mature" || mode === "explicit";
}

export function getExplicitLanguageWarnings(text: string, mode: LyricExplicitnessMode = defaultExplicitnessMode) {
  const warnings: string[] = [];
  if (containsProfanity(text) && !explicitnessAllowsProfanity(mode)) {
    warnings.push("Clean or radio-safe mode selected; replace profanity with softer phrasing before export.");
  }
  if (mode === "explicit") {
    warnings.push("Explicit mode allows stronger language but still blocks hateful slurs, illegal instructions, targeted harassment, and exploitative content.");
  }
  return warnings;
}

export function suggestCleanAlternatives(text: string) {
  return text
    .replace(/\bfuck(?:ing)?\b/gi, "mess")
    .replace(/\bfucked\b/gi, "broken")
    .replace(/\bshit\b/gi, "mess")
    .replace(/\bbitch(?:es)?\b/gi, "person")
    .replace(/\basshole\b/gi, "fool")
    .replace(/\bdamn\b/gi, "real");
}
