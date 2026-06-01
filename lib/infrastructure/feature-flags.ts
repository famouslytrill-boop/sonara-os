export type FeatureFlag = {
  key: string;
  defaultEnabled: boolean;
  ownerReviewRequired: boolean;
  description: string;
};

export const featureFlags: FeatureFlag[] = [
  { key: "provider_registry_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Shows governed provider readiness records." },
  { key: "open_source_registry_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Shows research-only open-source registry records." },
  { key: "observability_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables telemetry providers after privacy/security review." },
  { key: "error_tracking_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables third-party error tracking after secret and PII review." },
  { key: "agent_workflow_core_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables approval-gated agent workflow execution." },
  { key: "durable_workflows_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables durable workflow adapters after queue/runtime review." },
  { key: "smart_document_reader_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables document extraction review surfaces." },
  { key: "local_edge_mode_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables local draft/cache mode only." },
  { key: "voice_agent_builder_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables consent-gated voice agent planning." },
  { key: "agent_web_layer_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables browser/web action planning after approval checks." },
  { key: "creative_model_hub_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables creative model references after media rights review." },
  { key: "business_sub_app_builder_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables metadata-driven sub-app builder beta." },
  { key: "permission_center_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Shows governed browser permission surfaces." },
  { key: "security_command_center_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Shows security review and audit readiness views." },
  { key: "growth_campaign_planner_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Shows non-automated campaign planning tools." },
  { key: "payment_links_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables payment link organization after provider setup." },
  { key: "github_radar_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Shows GitHub Opportunity Radar admin and public research pages." },
  { key: "github_radar_manual_mode_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Allows owner-entered repository review without GitHub token." },
  { key: "github_radar_sync_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables GitHub metadata sync only when token and rate limits are configured." },
  { key: "github_radar_codex_prompt_generator_enabled", defaultEnabled: false, ownerReviewRequired: true, description: "Enables generation of review prompts, not automatic installs." },
  { key: "github_radar_auto_install_blocked", defaultEnabled: true, ownerReviewRequired: false, description: "Keeps dependency auto-installation blocked." },
  { key: "github_radar_admin_review_required", defaultEnabled: true, ownerReviewRequired: false, description: "Requires owner/admin review before repo adoption." },
  { key: "github_radar_public_research_pages_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Shows public research summaries without internal security notes." },
  { key: "growthbook_review_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Tracks GrowthBook review record." },
  { key: "flagsmith_review_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Tracks Flagsmith review record." },
  { key: "novu_review_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Tracks Novu review record." },
  { key: "openmeter_review_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Tracks OpenMeter review record." },
  { key: "documenso_review_enabled", defaultEnabled: true, ownerReviewRequired: true, description: "Tracks Documenso legal review requirement." },
  { key: "formbricks_review_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Tracks Formbricks review record." },
  { key: "plunk_review_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Tracks Plunk review record." },
  { key: "activepieces_review_enabled", defaultEnabled: true, ownerReviewRequired: true, description: "Tracks Activepieces review record." },
  { key: "n8n_review_enabled", defaultEnabled: true, ownerReviewRequired: true, description: "Tracks n8n license review record." },
  { key: "flowise_review_enabled", defaultEnabled: true, ownerReviewRequired: true, description: "Tracks Flowise review record." },
  { key: "renovate_review_enabled", defaultEnabled: true, ownerReviewRequired: true, description: "Tracks Renovate legal review record." },
  { key: "osv_scanner_review_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Tracks OSV Scanner review record." },
  { key: "gitleaks_review_enabled", defaultEnabled: true, ownerReviewRequired: false, description: "Tracks Gitleaks review record." },
  { key: "posthog_review_enabled", defaultEnabled: true, ownerReviewRequired: true, description: "Tracks PostHog privacy review record." },
];

export function isFeatureEnabled(key: string, overrides: Record<string, boolean> = {}) {
  const flag = featureFlags.find((item) => item.key === key);
  if (!flag) return false;
  return overrides[key] ?? flag.defaultEnabled;
}
