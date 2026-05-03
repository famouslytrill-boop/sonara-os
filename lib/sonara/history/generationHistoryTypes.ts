export type SonaraEngineName =
  | "authentic_writer"
  | "lyric_structure"
  | "arrangement_core"
  | "runtime_threshold"
  | "prompt_length"
  | "slider_recommendation"
  | "release_strategy"
  | "sound_identity"
  | "metadata_readiness"
  | "broadcast_kit"
  | "export_bundle";

export type GenerationSnapshot = {
  id: string;
  parentId?: string;
  engineName: SonaraEngineName;
  engineVersion: string;
  inputHash: string;
  inputData: Record<string, unknown>;
  settingsSnapshot: Record<string, unknown>;
  outputData: Record<string, unknown>;
  createdAt: string;
  label?: string;
  isSelected?: boolean;
};

export type RegenerationAction =
  | "regenerate_same_data"
  | "regenerate_with_changes"
  | "restore_previous"
  | "mark_selected"
  | "compare_versions";
