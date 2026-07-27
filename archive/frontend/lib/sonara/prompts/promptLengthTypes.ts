export type PromptLengthMode =
  | "short"
  | "standard"
  | "long"
  | "ultra";

export type PromptSituation =
  | "song_generation"
  | "album_track"
  | "album_sequence"
  | "sound_pack"
  | "release_plan"
  | "streaming_metadata"
  | "marketplace_listing"
  | "external_generator"
  | "suno_style"
  | "udio_style"
  | "video_prompt"
  | "lyric_video"
  | "visualizer"
  | "broadcast_kit"
  | "social_clip"
  | "brand_export"
  | "artist_profile"
  | "prompt_pack_product"
  | "runtime_analysis"
  | "general";

export type PromptPlatformTarget =
  | "sonara"
  | "suno"
  | "udio"
  | "sora"
  | "runway"
  | "pika"
  | "capcut"
  | "youtube"
  | "tiktok"
  | "spotify"
  | "apple_music"
  | "marketplace"
  | "generic";

export type PromptDetailLevel = {
  mode: PromptLengthMode;
  targetMinCharacters: number;
  targetIdealCharacters: number;
  targetMaxCharacters: number;
  allowedSections: string[];
  forbiddenBehaviors: string[];
  notes: string[];
};

export type PromptLengthInput = {
  situation: PromptSituation;
  platformTarget?: PromptPlatformTarget;
  userRequestedMode?: PromptLengthMode;
  needsStructure?: boolean;
  needsLegalFooter?: boolean;
  needsMetadata?: boolean;
  needsRuntimeTarget?: boolean;
  needsSliderSettings?: boolean;
  needsSoundRights?: boolean;
  needsVisualDirection?: boolean;
  needsCommercialCopy?: boolean;
};
