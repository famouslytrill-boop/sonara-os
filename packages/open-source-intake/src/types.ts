export type OpenSourceProjectCategory =
  | "recommendation_system"
  | "ERP"
  | "agent_memory"
  | "local_model_runtime"
  | "mapping"
  | "DNS_privacy_security"
  | "spec_driven_development"
  | "profile_builder"
  | "AI_education"
  | "VPN_security"
  | "scraping"
  | "file_storage_collaboration"
  | "browser_agent"
  | "VPN_ops"
  | "model_compression"
  | "unknown"
  | "spatial_3d"
  | "skills_taxonomy"
  | "voice_ai"
  | "robotics_resource_list"
  | "customer_support"
  | "tutoring_learning_ai"
  | "music_audio_ui"
  | "image_generation"
  | "code_review"
  | "image_editing"
  | "remote_desktop_or_android_desktop"
  | "whatsapp_automation"
  | "command_center"
  | "api_testing"
  | "voice_audio"
  | "local_first_ai_agent"
  | "agent_skill_optimization"
  | "long_video_generation"
  | "defensive_security_testing"
  | "satellite_mapping";

export type OpenSourceLicenseRisk = "low" | "medium" | "high" | "critical" | "unknown";
export type OpenSourceSecurityRisk = "low" | "medium" | "high" | "critical" | "unknown";
export type OpenSourceProductFit = string;

export type OpenSourceIntegrationStatus =
  | "not_reviewed"
  | "reviewed_reference_only"
  | "approved_for_adapter"
  | "approved_for_self_hosting"
  | "blocked"
  | "coming_later"
  | "removed";

export type OpenSourceUseMode =
  | "reference_only"
  | "concept_adapter"
  | "optional_provider_adapter"
  | "self_hosted_service"
  | "internal_admin_tool"
  | "beta_gated_feature"
  | "blocked"
  | "needs_legal_review"
  | "needs_security_review";

export type OpenSourceProjectRecord = Readonly<{
  id: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  normalizedUrl: string;
  category: OpenSourceProjectCategory;
  useMode: OpenSourceUseMode;
  ownerProvidedUseMode?: string;
  productFit: readonly OpenSourceProductFit[];
  licenseRisk: OpenSourceLicenseRisk;
  securityRisk: OpenSourceSecurityRisk;
  integrationStatus: OpenSourceIntegrationStatus;
  rules: readonly string[];
  licenseNotes?: string;
  securityNotes?: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type OpenSourceAuditEvent = Readonly<{
  id: string;
  projectId: string;
  repoOwner: string;
  repoName: string;
  eventType:
    | "project.intake_created"
    | "project.license_review_required"
    | "project.security_review_required"
    | "project.blocked"
    | "project.reference_only";
  summary: string;
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type ExternalProjectRecommendation = Readonly<{
  projectId: string;
  repo: string;
  recommendedStatus: OpenSourceIntegrationStatus;
  recommendedUseMode: OpenSourceUseMode;
  decision: "allow_reference" | "allow_adapter_after_review" | "block" | "needs_review";
  reasons: readonly string[];
  requiredReviews: readonly ("legal" | "security" | "owner")[];
}>;
