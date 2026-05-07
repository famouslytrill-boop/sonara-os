import type { RetentionInsight, RetentionSignal } from "./retentionTypes";

export function getRetentionInsight(signals: RetentionSignal[]): RetentionInsight {
  const weights: Record<RetentionSignal, number> = {
    created_project_no_export: 18,
    visited_pricing_no_checkout: 10,
    generated_prompt_not_saved: 14,
    failed_checkout: 22,
    inactive_7_days: 18,
    repeated_blocked_sound_rights: 16,
    confused_tutorial_feedback: 14,
    activation_incomplete: 16,
  };
  const riskScore = Math.min(100, signals.reduce((sum, signal) => sum + weights[signal], 0));

  return {
    riskScore,
    signals,
    nextAction:
      signals[0] === "created_project_no_export"
        ? "Guide the creator to export a first bundle."
        : "Show one clear next step without fake urgency or shame copy.",
  };
}
