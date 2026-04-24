export const AllowedMusicStyles = Object.freeze([
  "ambient",
  "cinematic",
  "classical",
  "country",
  "electronic",
  "folk",
  "funk",
  "hip-hop",
  "jazz",
  "latin",
  "pop",
  "r-and-b",
  "rock",
  "soul",
  "world"
]);

export type MusicStyle =
  | "ambient"
  | "cinematic"
  | "classical"
  | "country"
  | "electronic"
  | "folk"
  | "funk"
  | "hip-hop"
  | "jazz"
  | "latin"
  | "pop"
  | "r-and-b"
  | "rock"
  | "soul"
  | "world";

export type MusicStyleRequest = {
  prompt?: string;
  musicStyle?: string;
};

export type MusicStyleSafetyResult = Readonly<{
  allowed: boolean;
  musicStyle: string | undefined;
  safePrompt: string;
  reasons: readonly string[];
}>;

const disallowedStylePatterns = Object.freeze([
  /\bin the style of\b/i,
  /\bsounds like\b/i,
  /\bcopy\b.+\bvoice\b/i,
  /\bclone\b.+\bartist\b/i,
  /\bexactly like\b/i
]);

export function enforceMusicStyleSafety(request: MusicStyleRequest): MusicStyleSafetyResult {
  const musicStyle = request?.musicStyle;
  const prompt = String(request?.prompt ?? "");
  const reasons: string[] = [];

  if (typeof musicStyle !== "string" || !AllowedMusicStyles.includes(musicStyle)) {
    reasons.push(`Unsupported music style: ${musicStyle ?? "missing"}`);
  }

  for (const pattern of disallowedStylePatterns) {
    if (pattern.test(prompt)) {
      reasons.push("Prompt asks for artist imitation or direct style copying.");
      break;
    }
  }

  const safePrompt = prompt
    .replace(/\bin the style of\b/gi, "inspired by broad traits from")
    .replace(/\bsounds like\b/gi, "uses broad production traits from")
    .trim();

  return Object.freeze({
    allowed: reasons.length === 0,
    musicStyle,
    safePrompt,
    reasons: Object.freeze(reasons)
  });
}
