const clonePatterns = [
  "exactly like",
  "copy",
  "clone",
  "sound just like",
  "impersonate",
  "same voice as"
];

export function detectUnsafeCloneRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return clonePatterns.some((pattern) => lower.includes(pattern));
}

export function rewriteStyleRequestSafely(text: string): string {
  if (!detectUnsafeCloneRequest(text)) {
    return text;
  }
  return [
    "Use broad genre, era, instrumentation, cadence, emotional tone, and production references",
    "without cloning a specific artist identity, likeness, or voice."
  ].join(" ");
}
