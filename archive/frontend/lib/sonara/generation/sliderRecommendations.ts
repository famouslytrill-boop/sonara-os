export type SliderProfile = {
  weirdness: number;
  styleInfluence: number;
  audioInfluence: number | null;
  autoInfluence: "off" | "light" | "balanced" | "strong";
  notes: string[];
};

export type SliderUseCase =
  | "stable_single"
  | "radio_hook"
  | "experimental"
  | "genre_blend"
  | "album_consistency"
  | "bridge_variation"
  | "vocal_upload"
  | "audio_texture"
  | "sound_design"
  | "demo_safe";

export type SliderGenreFamily =
  | "hip_hop"
  | "rnb"
  | "pop"
  | "country"
  | "rock"
  | "electronic"
  | "latin"
  | "afrobeats"
  | "gospel"
  | "cinematic"
  | "ambient"
  | "experimental"
  | "general";

export function getSliderRecommendation(input: {
  genreFamily?: SliderGenreFamily;
  useCase?: SliderUseCase;
  hasAudioUpload?: boolean;
  wantsConsistency?: boolean;
  wantsNovelty?: boolean;
}): SliderProfile {
  const genre = input.genreFamily ?? "general";
  const useCase = input.useCase ?? "stable_single";

  const baseByGenre: Record<SliderGenreFamily, SliderProfile> = {
    hip_hop: {
      weirdness: 42,
      styleInfluence: 68,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Keep drums and vocal pocket stable.", "Raise Weirdness only for ad-libs, bridge moments, or alternate takes."],
    },
    rnb: {
      weirdness: 38,
      styleInfluence: 72,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Prioritize vocal tone, harmony stack, and smooth phrasing.", "Avoid high Weirdness on hooks."],
    },
    pop: {
      weirdness: 35,
      styleInfluence: 75,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Keep chorus stable and memorable.", "Use moderate Style Influence for structure and hook clarity."],
    },
    country: {
      weirdness: 30,
      styleInfluence: 78,
      audioInfluence: null,
      autoInfluence: "light",
      notes: ["Keep arrangement grounded and lyric-forward.", "Use lower Weirdness to avoid genre drift."],
    },
    rock: {
      weirdness: 45,
      styleInfluence: 68,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Allow some performance variation.", "Keep guitar/drum identity consistent."],
    },
    electronic: {
      weirdness: 55,
      styleInfluence: 62,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Allow more sound-design movement.", "Keep groove and arrangement targets clear."],
    },
    latin: {
      weirdness: 36,
      styleInfluence: 76,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Protect rhythmic authenticity.", "Keep percussion language specific."],
    },
    afrobeats: {
      weirdness: 40,
      styleInfluence: 74,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Protect groove, percussion, and bounce.", "Avoid excessive Weirdness that breaks pocket."],
    },
    gospel: {
      weirdness: 28,
      styleInfluence: 82,
      audioInfluence: null,
      autoInfluence: "light",
      notes: ["Prioritize vocal arrangement and emotional lift.", "Keep harmonic identity clear."],
    },
    cinematic: {
      weirdness: 62,
      styleInfluence: 55,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Allow more texture, contrast, and movement.", "Use Style Influence to keep the cue emotionally focused."],
    },
    ambient: {
      weirdness: 72,
      styleInfluence: 48,
      audioInfluence: null,
      autoInfluence: "strong",
      notes: ["Higher Weirdness can support evolving textures.", "Keep prompt focused on mood, space, and texture."],
    },
    experimental: {
      weirdness: 82,
      styleInfluence: 42,
      audioInfluence: null,
      autoInfluence: "strong",
      notes: ["Use high Weirdness for unusual forms and textures.", "Expect less predictable structure."],
    },
    general: {
      weirdness: 50,
      styleInfluence: 60,
      audioInfluence: null,
      autoInfluence: "balanced",
      notes: ["Balanced default.", "Adjust one slider at a time."],
    },
  };

  const profile = { ...baseByGenre[genre], notes: [...baseByGenre[genre].notes] };

  if (useCase === "radio_hook") {
    profile.weirdness = Math.max(25, profile.weirdness - 10);
    profile.styleInfluence = Math.min(85, profile.styleInfluence + 8);
    profile.autoInfluence = "balanced";
    profile.notes.push("Hook mode: lower Weirdness and higher Style Influence for memorability.");
  }

  if (useCase === "experimental") {
    profile.weirdness = Math.min(88, profile.weirdness + 20);
    profile.styleInfluence = Math.max(35, profile.styleInfluence - 10);
    profile.autoInfluence = "strong";
    profile.notes.push("Experimental mode: allow more deviation while keeping a clear identity block.");
  }

  if (useCase === "genre_blend") {
    profile.weirdness = Math.min(72, profile.weirdness + 12);
    profile.styleInfluence = Math.max(55, profile.styleInfluence - 5);
    profile.autoInfluence = "balanced";
    profile.notes.push("Genre blend mode: keep the primary genre dominant and use the secondary genre as color.");
  }

  if (useCase === "album_consistency") {
    profile.weirdness = Math.max(28, profile.weirdness - 8);
    profile.styleInfluence = Math.min(82, profile.styleInfluence + 6);
    profile.autoInfluence = "light";
    profile.notes.push("Album mode: preserve sonic family while SONARA handles track differentiation.");
  }

  if (useCase === "bridge_variation") {
    profile.weirdness = Math.min(78, profile.weirdness + 15);
    profile.styleInfluence = Math.max(50, profile.styleInfluence - 5);
    profile.notes.push("Bridge mode: raise Weirdness slightly for contrast, not chaos.");
  }

  if (useCase === "demo_safe") {
    profile.weirdness = 35;
    profile.styleInfluence = 70;
    profile.autoInfluence = "light";
    profile.notes.push("Demo-safe mode: stable results for previews, pitches, and app examples.");
  }

  if (input.hasAudioUpload) {
    if (useCase === "vocal_upload") {
      profile.audioInfluence = 65;
      profile.notes.push("Audio upload mode: use stronger Audio Influence when the upload should guide vocal timing or melody.");
    } else if (useCase === "audio_texture") {
      profile.audioInfluence = 30;
      profile.notes.push("Texture mode: use lower Audio Influence when the upload should act as atmosphere, not the main structure.");
    } else {
      profile.audioInfluence = 45;
      profile.notes.push("Audio upload detected: use medium Audio Influence unless the upload must lead the track.");
    }
  }

  if (input.wantsConsistency) {
    profile.weirdness = Math.max(25, profile.weirdness - 8);
    profile.styleInfluence = Math.min(85, profile.styleInfluence + 5);
    profile.notes.push("Consistency preference: tightened sliders for stable identity.");
  }

  if (input.wantsNovelty) {
    profile.weirdness = Math.min(88, profile.weirdness + 10);
    profile.styleInfluence = Math.max(35, profile.styleInfluence - 3);
    profile.notes.push("Novelty preference: increased Weirdness while keeping prompt identity intact.");
  }

  return profile;
}
