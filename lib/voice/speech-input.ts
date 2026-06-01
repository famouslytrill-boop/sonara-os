export function normalizeSpeechInput(input: string) {
  return input.trim().replace(/\s+/g, " ");
}
