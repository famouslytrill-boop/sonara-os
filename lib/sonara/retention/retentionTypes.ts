export type RetentionSignal =
  | "created_project_no_export"
  | "visited_pricing_no_checkout"
  | "generated_prompt_not_saved"
  | "failed_checkout"
  | "inactive_7_days"
  | "repeated_blocked_sound_rights"
  | "confused_tutorial_feedback"
  | "activation_incomplete";

export type RetentionInsight = {
  riskScore: number;
  signals: RetentionSignal[];
  nextAction: string;
};
