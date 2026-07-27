import type {
  RuntimeCommercialLane,
  RuntimeComplexity,
  RuntimeGenreFamily,
  RuntimePlatformGoal,
  RuntimeProjectType,
  RuntimeThreshold,
  RuntimeThresholdInput,
} from "./runtimeTypes";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const baseByProjectType: Record<
  RuntimeProjectType,
  Pick<
    RuntimeThreshold,
    "minSeconds" | "idealSeconds" | "maxSeconds" | "warningSeconds" | "hardLimitSeconds"
  >
> = {
  single: {
    minSeconds: 135,
    idealSeconds: 165,
    maxSeconds: 210,
    warningSeconds: 225,
    hardLimitSeconds: 270,
  },
  album_track: {
    minSeconds: 150,
    idealSeconds: 205,
    maxSeconds: 285,
    warningSeconds: 315,
    hardLimitSeconds: 360,
  },
  album_intro: {
    minSeconds: 35,
    idealSeconds: 70,
    maxSeconds: 110,
    warningSeconds: 130,
    hardLimitSeconds: 160,
  },
  album_outro: {
    minSeconds: 55,
    idealSeconds: 120,
    maxSeconds: 210,
    warningSeconds: 240,
    hardLimitSeconds: 300,
  },
  interlude: {
    minSeconds: 25,
    idealSeconds: 55,
    maxSeconds: 95,
    warningSeconds: 115,
    hardLimitSeconds: 150,
  },
  hook_demo: {
    minSeconds: 20,
    idealSeconds: 35,
    maxSeconds: 60,
    warningSeconds: 75,
    hardLimitSeconds: 90,
  },
  loop: {
    minSeconds: 4,
    idealSeconds: 8,
    maxSeconds: 16,
    warningSeconds: 24,
    hardLimitSeconds: 32,
  },
  sample_pack_loop: {
    minSeconds: 4,
    idealSeconds: 8,
    maxSeconds: 16,
    warningSeconds: 24,
    hardLimitSeconds: 32,
  },
  sound_pack_preview: {
    minSeconds: 8,
    idealSeconds: 15,
    maxSeconds: 30,
    warningSeconds: 45,
    hardLimitSeconds: 60,
  },
  social_clip: {
    minSeconds: 6,
    idealSeconds: 15,
    maxSeconds: 30,
    warningSeconds: 45,
    hardLimitSeconds: 60,
  },
  visualizer: {
    minSeconds: 15,
    idealSeconds: 30,
    maxSeconds: 60,
    warningSeconds: 90,
    hardLimitSeconds: 120,
  },
  lyric_video: {
    minSeconds: 120,
    idealSeconds: 180,
    maxSeconds: 300,
    warningSeconds: 330,
    hardLimitSeconds: 420,
  },
  broadcast_segment: {
    minSeconds: 60,
    idealSeconds: 180,
    maxSeconds: 600,
    warningSeconds: 900,
    hardLimitSeconds: 1200,
  },
  podcast_intro: {
    minSeconds: 8,
    idealSeconds: 18,
    maxSeconds: 35,
    warningSeconds: 45,
    hardLimitSeconds: 60,
  },
  ad_spot: {
    minSeconds: 6,
    idealSeconds: 15,
    maxSeconds: 30,
    warningSeconds: 45,
    hardLimitSeconds: 60,
  },
  full_performance: {
    minSeconds: 150,
    idealSeconds: 240,
    maxSeconds: 420,
    warningSeconds: 540,
    hardLimitSeconds: 720,
  },
};

const genreAdjustments: Record<RuntimeGenreFamily, number> = {
  hip_hop: -10,
  rnb: 10,
  pop: -15,
  country: 0,
  rock: 10,
  electronic: 20,
  latin: -5,
  afrobeats: -5,
  gospel: 20,
  cinematic: 45,
  ambient: 60,
  experimental: 45,
  spoken: 30,
  general: 0,
};

const platformAdjustments: Record<RuntimePlatformGoal, number> = {
  streaming: 0,
  playlist: -20,
  radio: -25,
  album: 25,
  sync: -10,
  social_short: -120,
  youtube: 20,
  broadcast: 90,
  marketplace: -60,
  demo: -80,
  live: 60,
};

const commercialLaneAdjustments: Record<RuntimeCommercialLane, number> = {
  mainstream: -15,
  underground: 15,
  cinematic: 45,
  experimental: 45,
  creator_asset: -80,
  label_release: 0,
  sync_ready: -10,
  social_first: -120,
  performance_first: 45,
};

const complexityAdjustments: Record<RuntimeComplexity, number> = {
  minimal: -35,
  standard: 0,
  expanded: 30,
  cinematic: 55,
  extended: 90,
};

const shortFormatProjectTypes = new Set<RuntimeProjectType>([
  "hook_demo",
  "loop",
  "sample_pack_loop",
  "sound_pack_preview",
  "social_clip",
  "podcast_intro",
  "ad_spot",
]);

function secondsToLabel(seconds: number): RuntimeThreshold["label"] {
  if (seconds < 45) return "very_short";
  if (seconds < 135) return "short";
  if (seconds < 270) return "standard";
  if (seconds < 420) return "extended";
  if (seconds < 720) return "long_form";
  return "too_long";
}

export function calculateRuntimeThreshold(
  input: RuntimeThresholdInput,
): RuntimeThreshold {
  const base = baseByProjectType[input.projectType];
  const genre = input.genreFamily ?? "general";
  const complexity = input.complexity ?? "standard";

  let adjustment = 0;
  adjustment += genreAdjustments[genre];
  adjustment += platformAdjustments[input.platformGoal];
  adjustment += commercialLaneAdjustments[input.commercialLane];
  adjustment += complexityAdjustments[complexity];

  if (input.hasIntro) adjustment += 8;
  if (input.hasOutro) adjustment += 8;
  if (input.hasBridge) adjustment += 18;
  if (input.verseCount && input.verseCount > 2) {
    adjustment += (input.verseCount - 2) * 20;
  }
  if (input.hookCount && input.hookCount > 3) {
    adjustment += (input.hookCount - 3) * 10;
  }

  if (input.bpm) {
    if (input.bpm >= 150) adjustment -= 10;
    if (input.bpm <= 75) adjustment += 15;
  }

  if (shortFormatProjectTypes.has(input.projectType) && adjustment < 0) {
    adjustment = 0;
  }

  const minSeconds = clamp(
    base.minSeconds + Math.round(adjustment * 0.35),
    4,
    900,
  );
  const idealSeconds = clamp(base.idealSeconds + adjustment, minSeconds, 1200);
  const maxSeconds = clamp(
    base.maxSeconds + Math.round(adjustment * 1.1),
    idealSeconds,
    1500,
  );
  const warningSeconds = clamp(
    base.warningSeconds + Math.round(adjustment * 1.15),
    maxSeconds,
    1800,
  );
  const hardLimitSeconds = clamp(
    base.hardLimitSeconds + Math.round(adjustment * 1.25),
    warningSeconds,
    2400,
  );

  const notes: string[] = [];
  const arrangementGuidance: string[] = [];
  const platformGuidance: string[] = [];
  const commercialGuidance: string[] = [];

  if (input.projectType === "single") {
    notes.push("Single mode favors a focused runtime with fast identity and low filler.");
    arrangementGuidance.push("Open with the strongest identity element within the first 10-20 seconds.");
  }

  if (input.platformGoal === "social_short") {
    platformGuidance.push("Social-first assets should reach the hook, phrase, or sonic identity immediately.");
    arrangementGuidance.push("Avoid long intros for short-form clips.");
  }

  if (input.platformGoal === "playlist" || input.commercialLane === "mainstream") {
    commercialGuidance.push("Playlist/mainstream lanes benefit from tighter structure and fewer slow sections.");
  }

  if (input.complexity === "cinematic" || input.genreFamily === "cinematic") {
    arrangementGuidance.push("Cinematic projects can justify longer builds if movement and contrast are clear.");
  }

  if (input.projectType === "sample_pack_loop" || input.projectType === "loop") {
    platformGuidance.push("Loop assets should be cleanly repeatable and usually stay in 4, 8, or 16 bar logic.");
  }

  if (input.userRequestedSeconds) {
    if (input.userRequestedSeconds > warningSeconds) {
      notes.push("User-requested runtime exceeds warning threshold. Require a structure reason before approving.");
    } else if (input.userRequestedSeconds < minSeconds) {
      notes.push("User-requested runtime is below recommended minimum. Best used as a clip, intro, or preview.");
    } else {
      notes.push("User-requested runtime fits the recommended threshold.");
    }
  }

  return {
    minSeconds,
    idealSeconds,
    maxSeconds,
    warningSeconds,
    hardLimitSeconds,
    label: secondsToLabel(idealSeconds),
    notes,
    arrangementGuidance,
    platformGuidance,
    commercialGuidance,
  };
}

export function formatRuntime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}
