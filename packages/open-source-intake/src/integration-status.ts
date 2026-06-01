import type {
  OpenSourceIntegrationStatus,
  OpenSourceLicenseRisk,
  OpenSourceSecurityRisk,
  OpenSourceUseMode
} from "./types.ts";

export const openSourceIntakeFeatureFlags = Object.freeze({
  OPEN_SOURCE_INTAKE_ENABLED: true,
  AUTO_INSTALL_EXTERNAL_REPOS: false,
  GPL_CODE_COPY_ALLOWED: false,
  AGPL_CODE_COPY_ALLOWED: false,
  RISKY_SCRAPING_TOOLS_ENABLED: false,
  UNOFFICIAL_MESSAGING_AUTOMATION_ENABLED: false,
  OPENJARVIS_REVIEW_ENABLED: true,
  LOCAL_FIRST_AGENT_SHELL_REVIEW_ENABLED: true,
  SKILLOPT_REVIEW_ENABLED: true,
  AGENT_SKILL_OPTIMIZER_ENABLED: true,
  CODEX_SKILL_GENERATOR_ENABLED: true,
  LONGLIVE_REVIEW_ENABLED: true,
  CREATOR_LONG_VIDEO_RESEARCH_ENABLED: true,
  PENTESTAGENT_RESEARCH_ONLY_ENABLED: true,
  DEFENSIVE_SECURITY_AGENT_REVIEW_ENABLED: true,
  NASA_WORLDVIEW_REVIEW_ENABLED: true,
  MAPPING_RESEARCH_LAYER_ENABLED: true
});

export function determineIntegrationStatus(input: {
  useMode: OpenSourceUseMode;
  licenseRisk: OpenSourceLicenseRisk;
  securityRisk: OpenSourceSecurityRisk;
}): OpenSourceIntegrationStatus {
  if (input.useMode === "blocked" || input.securityRisk === "critical") {
    return "blocked";
  }
  if (input.useMode === "reference_only" || input.useMode === "concept_adapter") {
    return "reviewed_reference_only";
  }
  if (input.useMode === "beta_gated_feature") {
    return "coming_later";
  }
  if (
    input.useMode === "needs_legal_review" ||
    input.useMode === "needs_security_review" ||
    input.licenseRisk === "high" ||
    input.licenseRisk === "critical" ||
    input.licenseRisk === "unknown" ||
    input.securityRisk === "high" ||
    input.securityRisk === "unknown"
  ) {
    return "not_reviewed";
  }
  if (input.useMode === "optional_provider_adapter") {
    return "approved_for_adapter";
  }
  if (input.useMode === "self_hosted_service") {
    return "approved_for_self_hosting";
  }
  return "not_reviewed";
}

export function isIntegrationBlocked(status: OpenSourceIntegrationStatus): boolean {
  return status === "blocked" || status === "removed";
}
