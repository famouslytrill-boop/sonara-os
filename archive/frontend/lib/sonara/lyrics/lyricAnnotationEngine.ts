import type { LyricAnnotation } from "./lyricAnnotationTypes";

export function annotateLyrics(rawLyrics: string): LyricAnnotation[] {
  return rawLyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line, index) => ({
      line,
      purpose: index === 0 ? "opening image or thesis" : "supporting lyric detail",
      performanceNote: line.length > 64 ? "trim or add a breath marker" : "deliver clearly",
      rightsNote: "Confirm this is user-written material and not copied lyrics.",
    }));
}
