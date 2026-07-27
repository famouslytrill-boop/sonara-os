import type {
  PromptDetailLevel,
  PromptLengthInput,
  PromptLengthMode,
  PromptPlatformTarget,
  PromptSituation,
} from "./promptLengthTypes";

const baseByMode: Record<PromptLengthMode, Omit<PromptDetailLevel, "notes">> = {
  short: {
    mode: "short",
    targetMinCharacters: 250,
    targetIdealCharacters: 450,
    targetMaxCharacters: 700,
    allowedSections: ["core idea", "genre", "mood", "must-have details"],
    forbiddenBehaviors: [
      "Do not overload with arrangement details.",
      "Do not include legal or metadata blocks unless required.",
    ],
  },
  standard: {
    mode: "standard",
    targetMinCharacters: 700,
    targetIdealCharacters: 1100,
    targetMaxCharacters: 1600,
    allowedSections: [
      "core idea",
      "genre",
      "rhythm",
      "harmony",
      "drums",
      "vocal mode",
      "structure",
      "mix notes",
    ],
    forbiddenBehaviors: [
      "Do not repeat the same instruction in multiple ways.",
      "Do not include unrelated platform instructions.",
    ],
  },
  long: {
    mode: "long",
    targetMinCharacters: 1600,
    targetIdealCharacters: 2600,
    targetMaxCharacters: 3800,
    allowedSections: [
      "song fingerprint",
      "genre identity",
      "runtime target",
      "rhythmic feel",
      "harmonic identity",
      "drum language",
      "vocal mode",
      "arrangement map",
      "mix direction",
      "external generator settings",
      "release goal",
      "negative constraints",
    ],
    forbiddenBehaviors: [
      "Do not ramble.",
      "Do not include private artist ecosystem names.",
      "Do not use direct artist clone language.",
      "Do not add unsupported tool settings.",
    ],
  },
  ultra: {
    mode: "ultra",
    targetMinCharacters: 3800,
    targetIdealCharacters: 5200,
    targetMaxCharacters: 7500,
    allowedSections: [
      "full project context",
      "song fingerprint",
      "runtime target",
      "structure map",
      "section-by-section direction",
      "lyric or visual timing",
      "sound design",
      "mix and master notes",
      "external generator settings",
      "platform constraints",
      "export rules",
      "rights and trademark notes",
      "negative constraints",
    ],
    forbiddenBehaviors: [
      "Do not use ultra mode for simple social clips.",
      "Do not include legal claims.",
      "Do not imply guaranteed results.",
      "Do not mention blocked private artist ecosystems.",
      "Do not use registered trademark symbols for SONARA marks.",
    ],
  },
};

const recommendedModeBySituation: Record<PromptSituation, PromptLengthMode> = {
  song_generation: "long",
  album_track: "long",
  album_sequence: "ultra",
  sound_pack: "long",
  release_plan: "long",
  streaming_metadata: "standard",
  marketplace_listing: "long",
  external_generator: "standard",
  suno_style: "long",
  udio_style: "long",
  video_prompt: "ultra",
  lyric_video: "ultra",
  visualizer: "long",
  broadcast_kit: "long",
  social_clip: "standard",
  brand_export: "long",
  artist_profile: "long",
  prompt_pack_product: "ultra",
  runtime_analysis: "standard",
  general: "standard",
};

const platformNotes: Partial<Record<PromptPlatformTarget, string[]>> = {
  suno: [
    "Use clean music-focused language.",
    "Include style, weirdness, audio influence, and auto influence only where supported.",
    "Avoid excessive section clutter if the tool performs better with concise direction.",
  ],
  udio: [
    "Use clearer section and arrangement detail.",
    "Include vocal mode and mix direction.",
  ],
  sora: [
    "Use detailed camera, lighting, subject, motion, duration, and scene continuity.",
  ],
  capcut: [
    "Use practical editing instructions, text overlays, timing, aspect ratio, and beat cuts.",
  ],
  tiktok: [
    "Prioritize hook timing, short duration, visual clarity, and first-second impact.",
  ],
  youtube: [
    "Include title, thumbnail concept, retention structure, and visual pacing.",
  ],
  marketplace: [
    "Include product value, license clarity, included files, and commercial-use notes.",
  ],
};

export function getPromptDetailLevel(input: PromptLengthInput): PromptDetailLevel {
  const recommended = recommendedModeBySituation[input.situation] ?? "standard";
  const mode = input.userRequestedMode ?? recommended;
  const base = baseByMode[mode];
  const notes: string[] = [`Recommended mode for ${input.situation}: ${recommended}.`];
  const platform = input.platformTarget ?? "generic";

  if (platformNotes[platform]) {
    notes.push(...platformNotes[platform]);
  }

  const allowedSections = [...base.allowedSections];

  if (input.needsRuntimeTarget && !allowedSections.includes("runtime target")) {
    allowedSections.push("runtime target");
  }

  if (input.needsSliderSettings && !allowedSections.includes("external generator settings")) {
    allowedSections.push("external generator settings");
  }

  if (input.needsSoundRights && !allowedSections.includes("rights and license notes")) {
    allowedSections.push("rights and license notes");
  }

  if (input.needsMetadata && !allowedSections.includes("metadata")) {
    allowedSections.push("metadata");
  }

  if (input.needsVisualDirection && !allowedSections.includes("visual direction")) {
    allowedSections.push("visual direction");
  }

  if (input.needsCommercialCopy && !allowedSections.includes("commercial copy")) {
    allowedSections.push("commercial copy");
  }

  if (input.needsLegalFooter && !allowedSections.includes("legal footer")) {
    allowedSections.push("legal footer");
  }

  if (mode === "ultra" && input.situation === "social_clip") {
    notes.push("Ultra mode is usually too heavy for social clips. Standard mode is safer unless the user is building a full campaign package.");
  }

  return {
    ...base,
    allowedSections,
    notes,
  };
}
