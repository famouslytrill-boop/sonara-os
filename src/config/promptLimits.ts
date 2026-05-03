export const promptLimits = {
  lyricSection: {
    label: "Lyric Section",
    maxCharacters: 5000,
    recommendedCharacters: 5000,
    description:
      "The lyric section supports up to 5,000 characters for full song lyrics, structured sections, performance notes, and revision-ready writing output.",
  },

  mainStyleProductionPrompt: {
    label: "Main Style / Production Prompt",
    maxCharacters: 1000,
    recommendedCharacters: 1000,
    description:
      "The main style and production prompt supports up to 1,000 characters for genre, arrangement, sound design, vocal direction, mix/mastering, runtime, and external generator guidance.",
  },
} as const;

export type PromptLimitKey = keyof typeof promptLimits;

export function getPromptLimit(key: PromptLimitKey) {
  return promptLimits[key];
}

export function countCharacters(value: string) {
  return value.length;
}

export function isWithinPromptLimit(key: PromptLimitKey, value: string) {
  return countCharacters(value) <= promptLimits[key].maxCharacters;
}

export function trimToPromptLimit(key: PromptLimitKey, value: string) {
  return value.slice(0, promptLimits[key].maxCharacters);
}
