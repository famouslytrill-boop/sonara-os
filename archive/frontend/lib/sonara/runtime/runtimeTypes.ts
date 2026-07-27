export type RuntimeProjectType =
  | "single"
  | "album_track"
  | "album_intro"
  | "album_outro"
  | "interlude"
  | "hook_demo"
  | "loop"
  | "sample_pack_loop"
  | "sound_pack_preview"
  | "social_clip"
  | "visualizer"
  | "lyric_video"
  | "broadcast_segment"
  | "podcast_intro"
  | "ad_spot"
  | "full_performance";

export type RuntimePlatformGoal =
  | "streaming"
  | "playlist"
  | "radio"
  | "album"
  | "sync"
  | "social_short"
  | "youtube"
  | "broadcast"
  | "marketplace"
  | "demo"
  | "live";

export type RuntimeCommercialLane =
  | "mainstream"
  | "underground"
  | "cinematic"
  | "experimental"
  | "creator_asset"
  | "label_release"
  | "sync_ready"
  | "social_first"
  | "performance_first";

export type RuntimeGenreFamily =
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
  | "spoken"
  | "general";

export type RuntimeComplexity =
  | "minimal"
  | "standard"
  | "expanded"
  | "cinematic"
  | "extended";

export type RuntimeThresholdInput = {
  projectType: RuntimeProjectType;
  platformGoal: RuntimePlatformGoal;
  commercialLane: RuntimeCommercialLane;
  genreFamily?: RuntimeGenreFamily;
  complexity?: RuntimeComplexity;
  bpm?: number;
  hasIntro?: boolean;
  hasOutro?: boolean;
  hasBridge?: boolean;
  verseCount?: number;
  hookCount?: number;
  userRequestedSeconds?: number;
};

export type RuntimeThreshold = {
  minSeconds: number;
  idealSeconds: number;
  maxSeconds: number;
  warningSeconds: number;
  hardLimitSeconds: number;
  label:
    | "very_short"
    | "short"
    | "standard"
    | "extended"
    | "long_form"
    | "too_long";
  notes: string[];
  arrangementGuidance: string[];
  platformGuidance: string[];
  commercialGuidance: string[];
};
