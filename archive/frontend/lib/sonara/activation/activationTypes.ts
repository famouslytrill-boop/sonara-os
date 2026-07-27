export type ActivationStepId =
  | "create_first_project"
  | "generate_song_fingerprint"
  | "review_genre_arrangement_core"
  | "review_runtime_target"
  | "review_prompt_length"
  | "review_external_generator_settings"
  | "add_authentic_writer_details"
  | "add_lyric_structure"
  | "export_first_prompt_pack"
  | "visit_store_pricing"
  | "upgrade_plan";

export type ActivationStep = {
  id: ActivationStepId;
  label: string;
  completed: boolean;
};

export type ActivationState = {
  steps: ActivationStep[];
  score: number;
  nextBestStep: ActivationStep;
};
