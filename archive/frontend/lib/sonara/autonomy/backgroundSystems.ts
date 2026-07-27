import type { AutonomySystemCheck } from "./autonomyTypes";

export const backgroundSystemIds = [
  "brand_consistency_check",
  "trademark_symbol_check",
  "private_artist_name_scan",
  "export_footer_check",
  "sound_rights_check",
  "sound_discovery_check",
  "runtime_threshold_check",
  "prompt_length_check",
  "slider_recommendation_check",
  "authentic_writer_check",
  "lyric_structure_check",
  "explicit_language_mode_check",
  "generation_history_check",
  "passkey_readiness_check",
  "unsafe_biometric_storage_check",
  "vector_memory_check",
  "mobile_pwa_check",
  "monetization_config_check",
  "supabase_schema_check",
  "vercel_env_safety_check",
  "store_product_readiness_check",
  "obs_broadcast_kit_check",
  "docs_freshness_check",
  "activation_check",
  "conversion_check",
  "trust_page_check",
  "support_check",
  "launch_campaign_check",
  "founder_command_center_check",
  "open_source_stack_check",
  "ipo_discipline_check",
  "moat_check",
] as const;

export type BackgroundSystemId = (typeof backgroundSystemIds)[number];

export const defaultBackgroundChecks: AutonomySystemCheck[] = backgroundSystemIds.map((id) => ({
  id,
  label: id.replaceAll("_", " "),
  status:
    id.includes("config") ||
    id.includes("schema") ||
    id.includes("passkey") ||
    id.includes("generation_history")
      ? "needs_manual_setup"
      : id.includes("unsafe_biometric")
        ? "blocked"
        : "passing",
  severity:
    id.includes("unsafe_biometric") || id.includes("trademark") || id.includes("payment") || id.includes("schema")
      ? "critical"
      : id.includes("sound_discovery") || id.includes("store_product")
        ? "high"
        : "medium",
  summary: "Supervised background check is available as a status report.",
  recommendedAction: "Review the report before changing production data or publishing paid products.",
  canAutoFix: !id.includes("payment") && !id.includes("schema") && !id.includes("trademark") && !id.includes("sound_discovery") && !id.includes("unsafe_biometric"),
  requiresHumanApproval:
    id.includes("payment") ||
    id.includes("schema") ||
    id.includes("trademark") ||
    id.includes("store_product") ||
    id.includes("sound_discovery") ||
    id.includes("unsafe_biometric"),
}));
