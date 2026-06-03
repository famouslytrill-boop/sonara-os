import { determineIntegrationStatus } from "./integration-status.ts";
import { classifyLicenseRisk } from "./license-risk-classifier.ts";
import { classifySecurityRisk } from "./security-risk-classifier.ts";
import type {
  OpenSourceProjectCategory,
  OpenSourceProjectRecord,
  OpenSourceProductFit,
  OpenSourceUseMode
} from "./types.ts";
import { normalizeExternalProjectUrl } from "./url-normalizer.ts";

type ProjectInput = Readonly<{
  repoOwner: string;
  repoName: string;
  category: OpenSourceProjectCategory;
  useMode: OpenSourceUseMode;
  ownerProvidedUseMode?: string;
  productFit: readonly OpenSourceProductFit[];
  rules: readonly string[];
  licenseNotes?: string;
  securityNotes?: string;
  repoUrl?: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export const openSourceProjectRegistry: readonly OpenSourceProjectRecord[] = Object.freeze([
  project({
    repoOwner: "xai-org",
    repoName: "x-algorithm",
    category: "recommendation_system",
    useMode: "concept_adapter",
    productFit: ["Growth Studio", "Research Lab", "Graph Builder"],
    rules: [
      "Do not copy ranking logic into production without license and security review.",
      "Use for transparency, explainability, ranking simulation, and campaign scoring ideas.",
      "Do not build manipulative addictive feed mechanics.",
      "Do not claim partnership with X or xAI."
    ],
    licenseNotes: "License review required before copying or production adaptation.",
    securityNotes: "Ranking systems require manipulation and safety review."
  }),
  project({
    repoOwner: "frappe",
    repoName: "erpnext",
    category: "ERP",
    useMode: "reference_only",
    ownerProvidedUseMode: "reference_only or self_hosted_service_after_review",
    productFit: ["Business Builder", "Operations", "Inventory", "Accounting references"],
    rules: [
      "GPL license risk.",
      "Do not copy source into proprietary packages.",
      "Use as workflow reference for accounting, CRM, orders, stock, projects, and assets.",
      "If self-hosted, isolate service and document license obligations."
    ],
    licenseNotes: "GPL license risk; legal review required for any use beyond reference."
  }),
  project({
    repoOwner: "EverMind-AI",
    repoName: "EverOS",
    category: "agent_memory",
    useMode: "concept_adapter",
    ownerProvidedUseMode: "EverOS or EverMemOS-style memory system",
    productFit: [
      "Customer Memory Timeline",
      "Learning Loop",
      "Self-Correction Engine",
      "Agent Memory"
    ],
    rules: [
      "Do not store sensitive personal memory without consent.",
      "Add retention controls, delete/export controls, and audit logs.",
      "Use for structured long-horizon memory architecture only."
    ],
    licenseNotes: "License review required before implementation.",
    securityNotes: "Memory systems require consent, retention, and audit review."
  }),
  project({
    repoOwner: "Michael-A-Kuykendall",
    repoName: "shimmy",
    category: "local_model_runtime",
    useMode: "needs_security_review",
    ownerProvidedUseMode: "needs_review",
    productFit: ["Developer Tools", "Local Model Provider Registry"],
    rules: [
      "Review license before use.",
      "No automatic local model downloads in production.",
      "Keep behind LOCAL_MODELS_ENABLED=false."
    ],
    licenseNotes: "License unknown; legal review required.",
    securityNotes: "Local model runtimes require model provenance and download controls."
  }),
  project({
    repoOwner: "organicmaps",
    repoName: "organicmaps",
    category: "mapping",
    useMode: "reference_only",
    productFit: ["Location Preview", "Venue Map Preview", "Growth Studio Local View"],
    rules: [
      "Do not copy mobile app code unless license reviewed.",
      "Use OpenStreetMap/provider abstraction.",
      "No emergency routing or GPS precision guarantees."
    ],
    licenseNotes: "License review required before code reuse."
  }),
  project({
    repoOwner: "pi-hole",
    repoName: "pi-hole",
    category: "DNS_privacy_security",
    useMode: "internal_admin_tool",
    ownerProvidedUseMode: "internal_admin_tool_reference",
    productFit: ["Security Center", "Link Guard", "Phishing Defense", "Network Safety"],
    rules: [
      "Do not make customer DNS filtering a launch promise.",
      "Use as inspiration for blocklists, domain reputation, and phishing defense.",
      "Admin/internal only."
    ],
    licenseNotes: "License review required before any deployment or bundling.",
    securityNotes: "DNS/security tooling must stay internal until reviewed."
  }),
  project({
    repoOwner: "github",
    repoName: "spec-kit",
    category: "spec_driven_development",
    useMode: "concept_adapter",
    productFit: ["Spec-Driven Build System"],
    rules: [
      "Already integrated conceptually.",
      "Do not copy GitHub branding.",
      "Use spec to plan to tasks to acceptance workflow."
    ],
    licenseNotes: "Concept only; no source copied."
  }),
  project({
    repoOwner: "amruthpillai",
    repoName: "reactive-resume",
    category: "profile_builder",
    useMode: "concept_adapter",
    productFit: ["Creator Proof Card", "Business Proof Passport", "Resume/Portfolio Builder"],
    rules: [
      "Review license.",
      "Do not copy UI or templates blindly.",
      "Use as inspiration for structured proof/profile documents."
    ],
    licenseNotes: "License review required before copying UI, templates, or data model."
  }),
  project({
    repoOwner: "FareedKhan-dev",
    repoName: "train-llm-from-scratch",
    category: "AI_education",
    useMode: "reference_only",
    productFit: ["Research Lab", "Developer Formula Studio"],
    rules: [
      "Educational only.",
      "Do not train production LLMs from scratch during MVP.",
      "Document compute/cost warnings."
    ],
    licenseNotes: "Reference only; no production training dependency."
  }),
  project({
    repoOwner: "jedisct1",
    repoName: "dsvpn",
    category: "VPN_security",
    useMode: "internal_admin_tool",
    ownerProvidedUseMode: "internal_admin_tool_reference",
    productFit: ["Admin network security", "Private infrastructure notes"],
    rules: [
      "Do not expose as customer feature.",
      "Do not automate VPN install on production without ops approval."
    ],
    licenseNotes: "License review required before deployment.",
    securityNotes: "VPN tooling requires ops/security approval."
  }),
  project({
    repoOwner: "zohaibbashir",
    repoName: "Google-Maps-Scrapper",
    category: "scraping",
    useMode: "blocked",
    productFit: [],
    rules: [
      "Do not use direct Google scraping.",
      "Use official APIs, OpenStreetMap, public datasets, or customer-provided data.",
      "Block scraping workflows that violate provider terms."
    ],
    licenseNotes: "Blocked by product/legal policy.",
    securityNotes: "Direct scraping is blocked for production."
  }),
  project({
    repoOwner: "nextcloud",
    repoName: "server",
    category: "file_storage_collaboration",
    useMode: "needs_legal_review",
    ownerProvidedUseMode: "self_hosted_service_after_review or reference_only",
    productFit: ["Files & Records", "Asset Vault", "Customer Records"],
    rules: [
      "AGPL license risk.",
      "Do not copy code into proprietary app.",
      "Could be separately self-hosted/admin-managed after legal review.",
      "Prefer Supabase Storage/S3-compatible storage for MVP."
    ],
    licenseNotes: "AGPL license risk; legal review required before self-hosting or integration."
  }),
  project({
    repoOwner: "nicedreamzapp",
    repoName: "browser-agent",
    category: "browser_agent",
    useMode: "needs_security_review",
    ownerProvidedUseMode: "internal_admin_tool_needs_review",
    productFit: ["Developer Tools", "QA automation", "Research Lab"],
    rules: [
      "No autonomous browsing against private accounts without approval.",
      "No credential entry automation.",
      "No scraping protected websites."
    ],
    licenseNotes: "License review required.",
    securityNotes: "Browser automation requires credential, scraping, and account-safety review."
  }),
  project({
    repoOwner: "angristan",
    repoName: "openvpn-install",
    category: "VPN_ops",
    useMode: "internal_admin_tool",
    ownerProvidedUseMode: "internal_admin_tool_reference",
    productFit: ["Infrastructure/Security docs"],
    rules: ["Admin infrastructure only.", "Do not run from app.", "Ops manual only."],
    licenseNotes: "License review required before operational use.",
    securityNotes: "VPN setup scripts must remain outside the customer app."
  }),
  project({
    repoOwner: "Tencent",
    repoName: "AngelSlim",
    category: "model_compression",
    useMode: "reference_only",
    productFit: ["AI Provider Registry", "Local Models Research"],
    rules: ["Research only.", "No production optimization claims without benchmark."],
    licenseNotes: "Reference only until license and benchmark review."
  }),
  project({
    repoOwner: "dograh-hq",
    repoName: "dograh",
    category: "unknown",
    useMode: "needs_security_review",
    ownerProvidedUseMode: "needs_review",
    productFit: [],
    rules: ["Add to intake registry only.", "Do not integrate until reviewed."],
    licenseNotes: "Unknown project; legal review required.",
    securityNotes: "Unknown project; security review required."
  }),
  project({
    repoOwner: "cartesiancs",
    repoName: "map3d",
    category: "spatial_3d",
    useMode: "concept_adapter",
    productFit: ["GeoWorldPreviewEngine", "SpatialOps", "Venue Preview"],
    rules: [
      "No certified engineering or zoning claims.",
      "No emergency routing claims.",
      "Use for planning previews only."
    ],
    licenseNotes: "License review required before implementation."
  }),
  project({
    repoOwner: "rohitg00",
    repoName: "agentmemory",
    category: "agent_memory",
    useMode: "concept_adapter",
    productFit: ["Learning Loop", "Customer Memory Timeline", "Agent Memory"],
    rules: ["Consent, retention, export/delete required.", "No hidden memory of sensitive data."],
    licenseNotes: "License review required before implementation.",
    securityNotes: "Memory systems require consent, retention, and deletion controls."
  }),
  project({
    repoOwner: "numman-ali",
    repoName: "openskills",
    category: "skills_taxonomy",
    useMode: "concept_adapter",
    productFit: ["Creator Studio", "Learning", "Training", "Proof Cards"],
    rules: [
      "Use as inspiration for skills tagging and training checklist.",
      "Review license before use."
    ],
    licenseNotes: "License review required before use."
  }),
  project({
    repoOwner: "debpalash",
    repoName: "OmniVoice-Studio",
    category: "voice_ai",
    useMode: "beta_gated_feature",
    productFit: ["Voice Studio", "Creator Studio"],
    rules: [
      "Consent gate required.",
      "No public figure/celebrity/customer impersonation.",
      "Voice cloning disabled by default."
    ],
    licenseNotes: "License review required before beta adapter work.",
    securityNotes: "Voice AI requires consent, disclosure, impersonation, and owner approval gates."
  }),
  project({
    repoOwner: "mathworks-robotics",
    repoName: "awesome-matlab-robotics",
    category: "robotics_resource_list",
    useMode: "reference_only",
    productFit: ["Research Lab only"],
    rules: [
      "Not MVP.",
      "Do not add robotics control systems to customer app.",
      "Educational/reference only."
    ],
    licenseNotes: "Reference list only."
  }),
  project({
    repoOwner: "chatwoot",
    repoName: "chatwoot",
    category: "customer_support",
    useMode: "self_hosted_service",
    ownerProvidedUseMode: "self_hosted_service_or_adapter",
    productFit: ["Support Inbox", "Customer Command Center"],
    rules: [
      "Strong candidate for support tooling.",
      "Prefer adapter/embed or separate service.",
      "Do not copy branding.",
      "Verify license and deployment."
    ],
    licenseNotes: "License and deployment review required before self-hosting.",
    securityNotes: "Support tooling requires customer data privacy review."
  }),
  project({
    repoOwner: "HKUDS",
    repoName: "DeepTutor",
    category: "tutoring_learning_ai",
    useMode: "concept_adapter",
    productFit: ["Help Center", "Training", "Learning Loop"],
    rules: ["Use for training/tutorial concepts.", "Do not claim educational certification."],
    licenseNotes: "License review required before implementation."
  }),
  project({
    repoOwner: "fspecii",
    repoName: "ace-step-ui",
    category: "music_audio_ui",
    useMode: "beta_gated_feature",
    productFit: ["Creator Studio", "Music/Audio tools"],
    rules: ["Review license.", "No copyrighted music cloning.", "Creator tools beta only."],
    licenseNotes: "License review required before beta use.",
    securityNotes: "Media tools require provenance and rights-safety gates."
  }),
  project({
    repoOwner: "NVlabs",
    repoName: "Sana",
    category: "image_generation",
    useMode: "optional_provider_adapter",
    productFit: ["Visual Intelligence Studio"],
    rules: [
      "Local model disabled by default.",
      "Asset rights gate required.",
      "No fake proof, IDs, certifications, or deceptive visuals."
    ],
    licenseNotes: "License and model terms review required before adapter use.",
    securityNotes:
      "Image generation requires beta gate, rights review, and owner approval before publishing."
  }),
  project({
    repoOwner: "heyhank-app",
    repoName: "heyhank",
    category: "unknown",
    useMode: "needs_security_review",
    ownerProvidedUseMode: "needs_review",
    productFit: [],
    rules: ["Intake only.", "No integration until reviewed."],
    licenseNotes: "Unknown project; legal review required.",
    securityNotes: "Unknown project; security review required."
  }),
  project({
    repoOwner: "ig-imanish",
    repoName: "opencode-review",
    category: "code_review",
    useMode: "internal_admin_tool",
    productFit: ["Developer Tools", "GitHub CI review"],
    rules: [
      "Use as inspiration for automated code review.",
      "Do not auto-merge.",
      "Human approval required."
    ],
    licenseNotes: "License review required before implementation."
  }),
  project({
    repoOwner: "Diolinux",
    repoName: "PhotoGIMP",
    category: "image_editing",
    useMode: "reference_only",
    productFit: ["Creator Studio visual workflow"],
    rules: ["Do not bundle unless license reviewed.", "Could recommend externally."],
    licenseNotes: "License review required before bundling."
  }),
  project({
    repoOwner: "orailnoor",
    repoName: "DroidDesk",
    category: "remote_desktop_or_android_desktop",
    useMode: "needs_security_review",
    productFit: ["Internal ops maybe"],
    rules: ["Do not expose remote desktop to customers.", "Security review required."],
    licenseNotes: "License review required.",
    securityNotes: "Remote desktop tooling requires security review before any use."
  }),
  project({
    repoOwner: "harnexa",
    repoName: "nexa-gauge",
    category: "unknown",
    useMode: "needs_security_review",
    ownerProvidedUseMode: "needs_review",
    productFit: ["Possible dashboard metrics"],
    rules: ["Intake only."],
    licenseNotes: "Unknown project; legal review required.",
    securityNotes: "Unknown project; security review required."
  }),
  project({
    repoOwner: "rmyndharis",
    repoName: "OpenWA",
    category: "whatsapp_automation",
    useMode: "blocked",
    ownerProvidedUseMode: "blocked_or_official_api_only",
    productFit: ["Customer messaging maybe later"],
    rules: [
      "Do not use unofficial WhatsApp automation for production.",
      "Use official WhatsApp Business API or approved providers only.",
      "Customer communication approval required."
    ],
    licenseNotes: "Blocked by product/legal policy.",
    securityNotes: "Unofficial messaging automation is blocked for production."
  }),
  project({
    repoOwner: "crshdn",
    repoName: "mission-control",
    category: "command_center",
    useMode: "concept_adapter",
    productFit: ["Owner Command Center", "Admin Dashboard"],
    rules: ["Review license.", "Use as UI/ops inspiration only."],
    licenseNotes: "License review required before copying UI or workflow logic."
  }),
  project({
    repoOwner: "usebruno",
    repoName: "bruno",
    category: "api_testing",
    useMode: "internal_admin_tool",
    productFit: ["Developer Utility Center", "API testing docs"],
    rules: [
      "Do not expose API secrets.",
      "Use as inspiration or external dev tool.",
      "No secrets in collections."
    ],
    licenseNotes: "License review required before bundling or integration.",
    securityNotes: "API testing collections must not store secrets."
  }),
  project({
    repoOwner: "supertone-inc",
    repoName: "supertonic",
    category: "voice_audio",
    useMode: "beta_gated_feature",
    productFit: ["Voice Studio", "Creator Studio"],
    rules: ["Consent gate required.", "Voice cloning/output publishing requires owner approval."],
    licenseNotes: "License review required before beta use.",
    securityNotes: "Voice output requires consent, disclosure, and approval gates."
  }),
  project({
    repoOwner: "open-jarvis",
    repoName: "OpenJarvis",
    category: "local_first_ai_agent",
    useMode: "reference_only",
    ownerProvidedUseMode: "reference_only_high_value_candidate",
    productFit: [
      "Shared Infrastructure",
      "Local Edge Mode",
      "Owner Command Center",
      "AI Agent Shell",
      "Business Builder assistant",
      "Creator Studio assistant",
      "Growth Studio assistant"
    ],
    rules: [
      "Reference only; do not install or copy code.",
      "No automatic shell access in production.",
      "No private file access without consent.",
      "No hidden scheduled tasks.",
      "No autonomous production actions.",
      "No customer data processing without permission."
    ],
    licenseNotes: "Apache-2.0; review license required before adapter or bundled use.",
    securityNotes:
      "Local-first agents require consent, shell/file-action approvals, audit logs, and scheduled-task review.",
    metadata: {
      recommendedAction: "high_value_candidate",
      githubRadarScore: 84,
      licenseRiskLabel: "review_required",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: ["openjarvis_review_enabled", "local_first_agent_shell_review_enabled"]
    }
  }),
  project({
    repoOwner: "microsoft",
    repoName: "SkillOpt",
    category: "agent_skill_optimization",
    useMode: "concept_adapter",
    ownerProvidedUseMode: "reference_only_priority_candidate",
    productFit: [
      "Codex Sprint Generator",
      "AI Agent Quality Layer",
      "Developer Formula Studio",
      "GitHub Opportunity Radar",
      "Owner Command Center",
      "Research Lab"
    ],
    rules: [
      "Reference only; do not install or copy code.",
      "No self-modifying production agents.",
      "No unsafe autonomous deployment.",
      "No hidden prompt changes.",
      "No high-risk workflow changes without validation."
    ],
    licenseNotes: "MIT; allowed with attribution review before any adaptation.",
    securityNotes:
      "Skill optimization must require validation, audit logs, and owner review before production prompt changes.",
    metadata: {
      recommendedAction: "priority_candidate",
      githubRadarScore: 88,
      licenseRiskLabel: "allowed_with_review",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: [
        "skillopt_review_enabled",
        "agent_skill_optimizer_enabled",
        "codex_skill_generator_enabled"
      ]
    }
  }),
  project({
    repoOwner: "NVlabs",
    repoName: "LongLive",
    category: "long_video_generation",
    useMode: "reference_only",
    ownerProvidedUseMode: "research_only_research_prototype_candidate",
    productFit: [
      "Creator Studio",
      "Creative Model Hub",
      "Research Lab",
      "Video Commercial Generator",
      "Campaign Builder"
    ],
    rules: [
      "Research only; do not install or copy code.",
      "No bundled model weights without license review.",
      "No production claims of real-time generation until tested.",
      "No copyrighted style or character imitation.",
      "No fake endorsements.",
      "No non-consensual likeness generation."
    ],
    licenseNotes:
      "Apache-2.0 for repo code; review license required for model weights, dependencies, and commercial use.",
    securityNotes:
      "Long-video generation requires rights review, likeness consent, compute review, and human approval.",
    metadata: {
      recommendedAction: "research_prototype_candidate",
      githubRadarScore: 76,
      licenseRiskLabel: "review_required",
      commercialUseStatus: "model_and_dependency_review_required",
      integrationStatusLabel: "research_only",
      featureFlags: ["longlive_review_enabled", "creator_long_video_research_enabled"]
    }
  }),
  project({
    repoOwner: "GH05TCREW",
    repoName: "pentestagent",
    category: "defensive_security_testing",
    useMode: "reference_only",
    ownerProvidedUseMode: "restricted_reference_only_defensive_security_reference_only",
    productFit: [
      "Security Command Center",
      "Launch Security Gate",
      "Internal Security Review",
      "Research Lab"
    ],
    rules: [
      "Restricted internal reference only; do not install or copy code.",
      "No public pentest automation.",
      "No unauthorized scanning.",
      "No exploit automation.",
      "No bug bounty automation without explicit written authorization.",
      "No customer-facing hacking tools.",
      "No tactical or offensive security workflows."
    ],
    licenseNotes: "MIT; security and legal review required before any internal testing workflow.",
    securityNotes:
      "Defensive testing references must remain internal, authorization-gated, and audit-logged.",
    metadata: {
      recommendedAction: "defensive_security_reference_only",
      githubRadarScore: 62,
      licenseRiskLabel: "restricted_security_review_required",
      commercialUseStatus: "internal_review_required",
      integrationStatusLabel: "restricted_reference_only",
      publicRecommendationAllowed: false,
      featureFlags: [
        "pentestagent_research_only_enabled",
        "defensive_security_agent_review_enabled"
      ]
    }
  }),
  project({
    repoOwner: "nasa-gibs",
    repoName: "worldview",
    category: "satellite_mapping",
    useMode: "reference_only",
    ownerProvidedUseMode: "reference_only_mapping_reference_candidate",
    productFit: [
      "Growth Studio",
      "Business Builder service area planning",
      "Venue and event planning",
      "Research Lab",
      "Mapping and Location Tools"
    ],
    rules: [
      "Reference only; do not install or copy code.",
      "No copying NASA UI/code without license review.",
      "No NASA partnership, endorsement, or affiliation claims.",
      "No surveillance.",
      "No people tracking.",
      "No emergency routing claims."
    ],
    licenseNotes: "NASA-1.3; review license required before code reuse or hosted map adaptation.",
    securityNotes:
      "Mapping research must avoid surveillance, people tracking, and emergency routing claims.",
    metadata: {
      recommendedAction: "mapping_reference_candidate",
      githubRadarScore: 73,
      licenseRiskLabel: "review_required",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: ["nasa_worldview_review_enabled", "mapping_research_layer_enabled"]
    }
  }),
  project({
    repoOwner: "foundation",
    repoName: "foundation-emails",
    category: "email_templates",
    useMode: "reference_only",
    ownerProvidedUseMode: "reference_only_email_template_candidate",
    productFit: ["Support Center", "Transactional email templates", "Customer Success"],
    rules: [
      "Reference only; do not install or copy templates without license and accessibility review.",
      "Outbound email still requires a configured provider.",
      "Do not claim support email delivery is live until tested."
    ],
    licenseNotes:
      "MIT; attribution, accessibility, and deliverability review required before adaptation.",
    securityNotes:
      "Email templates must avoid secrets, private customer data, and misleading delivery claims.",
    metadata: {
      recommendedAction: "email_template_reference_candidate",
      githubRadarScore: 71,
      licenseRiskLabel: "allowed_with_review",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: ["foundation_emails_review_enabled"]
    }
  }),
  project({
    repoOwner: "jeremykenedy",
    repoName: "laravel-auth",
    category: "auth_pattern",
    useMode: "reference_only",
    ownerProvidedUseMode: "auth_pattern_reference_only",
    productFit: ["Auth readiness", "Owner bootstrap docs", "Admin security review"],
    rules: [
      "Reference only; do not copy framework code into the TypeScript workspace.",
      "Supabase Auth remains the launch auth direction.",
      "Use only as comparison material for login, account recovery, and admin controls."
    ],
    licenseNotes: "Review license required before copying any implementation pattern.",
    securityNotes: "Auth patterns require session, MFA, password, and account recovery review.",
    metadata: {
      recommendedAction: "auth_pattern_reference",
      githubRadarScore: 55,
      licenseRiskLabel: "review_required",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only"
    }
  }),
  project({
    repoOwner: "dword-design",
    repoName: "nuxt-mail",
    category: "mail_route",
    useMode: "reference_only",
    ownerProvidedUseMode: "mail_route_reference_only",
    productFit: ["Support email readiness", "Outbound email adapter planning"],
    rules: [
      "Reference only; do not add Nuxt dependencies to this workspace.",
      "Outbound email requires configured provider credentials.",
      "Do not send real emails from local checks."
    ],
    licenseNotes: "Review license required before adapting route patterns.",
    securityNotes: "Mail routes must redact secrets and avoid stack traces in user-facing errors.",
    metadata: {
      recommendedAction: "mail_route_reference",
      githubRadarScore: 54,
      licenseRiskLabel: "review_required",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only"
    }
  }),
  project({
    repoOwner: "tbxark",
    repoName: "mail2telegram",
    category: "internal_alerting",
    useMode: "needs_security_review",
    ownerProvidedUseMode: "optional_internal_alert_adapter_review",
    productFit: ["Admin alerts", "Support operations", "Incident response"],
    rules: [
      "Internal alert adapter review only; do not expose to customers.",
      "Do not forward customer data, support messages, credentials, or secrets to chat tools.",
      "Use redaction and audit logs before any notification bridge."
    ],
    licenseNotes: "License review required before any adapter or self-hosted use.",
    securityNotes:
      "Alert bridges require credential redaction, destination ownership, and privacy review.",
    metadata: {
      recommendedAction: "internal_alert_adapter_review",
      githubRadarScore: 58,
      licenseRiskLabel: "review_required",
      commercialUseStatus: "internal_review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: ["mail2telegram_internal_alert_review_enabled"]
    }
  }),
  project({
    repoOwner: "qdrant",
    repoName: "qdrant",
    category: "vector_database",
    useMode: "reference_only",
    ownerProvidedUseMode: "high_value_candidate_reference_only",
    productFit: ["Smart Document Reader", "Research Lab", "Business Memory Graph"],
    rules: [
      "Reference only until privacy, deletion, backup, and cost review pass.",
      "Do not sync private tenant records to an external vector store without approval.",
      "Vector indexes must inherit source document permissions."
    ],
    licenseNotes: "Apache-2.0; allowed with attribution and privacy/security review.",
    securityNotes: "External vector stores require deletion, retention, and data residency review.",
    metadata: {
      recommendedAction: "high_value_candidate",
      githubRadarScore: 86,
      licenseRiskLabel: "allowed_with_review",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: ["qdrant_review_enabled"]
    }
  }),
  project({
    repoOwner: "milvus-io",
    repoName: "milvus",
    category: "vector_database",
    useMode: "reference_only",
    ownerProvidedUseMode: "future_enterprise_candidate_reference_only",
    productFit: ["Vector search", "Research Lab", "Enterprise knowledge retrieval"],
    rules: [
      "Reference only; no production sync until operations and cost review pass.",
      "Do not expose private embeddings across organizations.",
      "Keep Supabase-first launch architecture unless migration is approved."
    ],
    licenseNotes: "Apache-2.0; review required before service adoption.",
    securityNotes:
      "Large vector infrastructure requires privacy, backups, and tenant isolation review.",
    metadata: {
      recommendedAction: "future_enterprise_candidate",
      githubRadarScore: 78,
      licenseRiskLabel: "allowed_with_review",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: ["milvus_review_enabled"]
    }
  }),
  project({
    repoOwner: "surrealdb",
    repoName: "surrealdb",
    category: "database_technology",
    useMode: "reference_only",
    ownerProvidedUseMode: "research_only",
    productFit: ["Database technology review", "Local Edge Mode", "Research Lab"],
    rules: [
      "Research only; Supabase remains the source of truth.",
      "Do not migrate tenant records without architecture, license, and operational review.",
      "Do not promise arbitrary user-created databases."
    ],
    licenseNotes: "BSL/source-available; review license required before product use.",
    securityNotes:
      "Database replacement candidates require migration, backup, and tenant isolation review.",
    metadata: {
      recommendedAction: "research_only",
      githubRadarScore: 64,
      licenseRiskLabel: "review_required",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: ["surrealdb_review_enabled"]
    }
  }),
  project({
    repoOwner: "cockroachdb",
    repoName: "cockroach",
    category: "database_technology",
    useMode: "reference_only",
    ownerProvidedUseMode: "future_scale_reference",
    productFit: ["Database scaling plan", "Future enterprise architecture", "Research Lab"],
    rules: [
      "Future scale reference only; Supabase remains the launch database.",
      "Review license, cost, migration, and operational complexity before adoption.",
      "Do not claim distributed SQL is part of the product until implemented and tested."
    ],
    licenseNotes: "BSL/source-available and commercial terms require legal review.",
    securityNotes:
      "Distributed database adoption requires backup, failover, and access control review.",
    metadata: {
      recommendedAction: "future_scale_reference",
      githubRadarScore: 67,
      licenseRiskLabel: "review_required",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: ["cockroachdb_review_enabled"]
    }
  }),
  project({
    repoOwner: "taosdata",
    repoName: "TDengine",
    category: "database_technology",
    useMode: "reference_only",
    ownerProvidedUseMode: "restricted_reference_only",
    productFit: ["Research Lab", "Time-series database review"],
    rules: [
      "Restricted reference only; do not bundle or integrate into closed-source product code.",
      "AGPL-3.0 legal review required before any use beyond research notes.",
      "Supabase remains the launch database."
    ],
    licenseNotes:
      "AGPL-3.0; legal review required and closed-source product integration is blocked.",
    securityNotes: "Time-series telemetry tools require retention and privacy review.",
    metadata: {
      recommendedAction: "restricted_reference_only",
      githubRadarScore: 49,
      licenseRiskLabel: "restricted",
      commercialUseStatus: "blocked_without_legal_review",
      integrationStatusLabel: "restricted_reference_only",
      featureFlags: ["tdengine_restricted_review_enabled"]
    }
  }),
  project({
    repoOwner: "MiCode",
    repoName: "Xiaomi_Kernel_OpenSource",
    category: "kernel_source_reference",
    useMode: "blocked",
    ownerProvidedUseMode: "blocked_from_product_integration",
    productFit: ["Research Lab only"],
    rules: [
      "Blocked from product integration.",
      "Do not copy kernel source into app code or packages.",
      "Do not use as a dependency, device-control layer, or mobile release path."
    ],
    licenseNotes:
      "Kernel source licensing and device-specific terms require review; product integration blocked.",
    securityNotes:
      "Kernel source is outside SONARA app scope and must not become device-control code.",
    metadata: {
      recommendedAction: "blocked_from_product_integration",
      githubRadarScore: 10,
      licenseRiskLabel: "blocked",
      commercialUseStatus: "blocked",
      integrationStatusLabel: "blocked",
      publicRecommendationAllowed: false,
      featureFlags: ["xiaomi_kernel_product_integration_blocked"]
    }
  }),
  project({
    repoOwner: "BelledonneCommunications",
    repoName: "linphone-iphone",
    category: "sip_voip",
    useMode: "reference_only",
    ownerProvidedUseMode: "restricted_sip_voip_reference_only",
    productFit: [
      "Business Builder",
      "Growth Studio",
      "Support Center",
      "Voice Agent Builder",
      "Phone/Communication Center",
      "Admin Command Center"
    ],
    rules: [
      "Restricted SIP/VoIP architecture reference only.",
      "Do not copy GPL source or bundle it into closed-source product code without legal review.",
      "No robocalling, covert recording, hidden call logging, or emergency dispatch claims.",
      "No SIP credential exposure or automatic customer calls without approval."
    ],
    licenseNotes:
      "GPL-3.0 / proprietary dual license; proprietary license and legal review required for closed-source use.",
    securityNotes:
      "VoIP requires consent, call recording, telecom, credential, and human handoff review.",
    metadata: {
      recommendedAction: "sip_voip_architecture_reference_only",
      githubRadarScore: 57,
      licenseRiskLabel: "restricted",
      commercialUseStatus: "proprietary_license_required_for_closed_source",
      integrationStatusLabel: "reference_only",
      featureFlags: [
        "linphone_sip_voip_reference_enabled",
        "sip_phone_system_review_enabled",
        "voice_agent_sip_handoff_review_enabled"
      ]
    }
  }),
  project({
    repoOwner: "heygen-com",
    repoName: "hyperframes",
    category: "html_to_video",
    useMode: "reference_only",
    ownerProvidedUseMode: "high_value_html_to_video_candidate_reference_only",
    productFit: [
      "Creator Studio",
      "Growth Studio",
      "Business Builder",
      "Creative Model Hub",
      "Campaign Builder",
      "Social Video Generator",
      "Product Demo Generator",
      "Codex Sprint Generator",
      "GitHub Opportunity Radar"
    ],
    rules: [
      "Reference only; do not install or copy source code.",
      "No production rendering without queues, storage, auth, quotas, tests, and rights gates.",
      "No copyrighted asset misuse, fake endorsements, non-consensual likeness, or implied HeyGen partnership.",
      "No unbounded CPU/GPU/FFmpeg jobs or unlimited rendering claims."
    ],
    licenseNotes: "Apache-2.0; allowed with review before adapter work.",
    securityNotes:
      "Video rendering requires queue, quota, storage, rights, and compute safety review.",
    metadata: {
      recommendedAction: "high_value_candidate",
      githubRadarScore: 82,
      licenseRiskLabel: "allowed_with_review",
      commercialUseStatus: "review_required",
      integrationStatusLabel: "reference_only",
      featureFlags: [
        "hyperframes_video_rendering_review_enabled",
        "html_to_video_templates_enabled",
        "video_render_queue_planned"
      ]
    }
  }),
  project({
    repoOwner: "dmtrKovalenko",
    repoName: "fff",
    category: "unknown",
    useMode: "needs_security_review",
    ownerProvidedUseMode: "needs_review",
    productFit: [],
    rules: ["Intake only."],
    licenseNotes: "Unknown project; legal review required.",
    securityNotes: "Unknown project; security review required."
  })
]);

export function getOpenSourceProjectRegistry(): readonly OpenSourceProjectRecord[] {
  return openSourceProjectRegistry;
}

export function findOpenSourceProject(
  repoOwner: string,
  repoName: string
): OpenSourceProjectRecord | null {
  const owner = repoOwner.toLowerCase();
  const name = repoName.toLowerCase();
  return (
    openSourceProjectRegistry.find(
      (project) =>
        project.repoOwner.toLowerCase() === owner && project.repoName.toLowerCase() === name
    ) ?? null
  );
}

export function getBlockedOpenSourceProjects(): readonly OpenSourceProjectRecord[] {
  return openSourceProjectRegistry.filter((project) => project.integrationStatus === "blocked");
}

export function getLicenseReviewProjects(): readonly OpenSourceProjectRecord[] {
  return openSourceProjectRegistry.filter(
    (project) =>
      project.licenseRisk === "unknown" ||
      project.licenseRisk === "high" ||
      project.licenseRisk === "critical" ||
      project.useMode === "needs_legal_review"
  );
}

export function getSecurityReviewProjects(): readonly OpenSourceProjectRecord[] {
  return openSourceProjectRegistry.filter(
    (project) =>
      project.securityRisk === "unknown" ||
      project.securityRisk === "high" ||
      project.securityRisk === "critical" ||
      project.useMode === "needs_security_review"
  );
}

export function getReferenceOnlyProjects(): readonly OpenSourceProjectRecord[] {
  return openSourceProjectRegistry.filter(
    (project) =>
      project.integrationStatus === "reviewed_reference_only" ||
      project.useMode === "reference_only" ||
      project.useMode === "concept_adapter"
  );
}

export function getOpenSourceIntakeSummary() {
  const blocked = getBlockedOpenSourceProjects().length;
  const licenseReview = getLicenseReviewProjects().length;
  const securityReview = getSecurityReviewProjects().length;
  const notReviewed = openSourceProjectRegistry.filter(
    (project) => project.integrationStatus === "not_reviewed"
  ).length;
  const betaGated = openSourceProjectRegistry.filter(
    (project) => project.useMode === "beta_gated_feature"
  ).length;
  return Object.freeze({
    total: openSourceProjectRegistry.length,
    blocked,
    licenseReview,
    securityReview,
    notReviewed,
    betaGated,
    referenceOnly: getReferenceOnlyProjects().length
  });
}

function project(input: ProjectInput): OpenSourceProjectRecord {
  const repoUrl = normalizeExternalProjectUrl(
    input.repoUrl ?? `https://github.com/${input.repoOwner}/${input.repoName}`
  );
  const licenseRisk = classifyLicenseRisk({
    licenseNotes: input.licenseNotes,
    useMode: input.useMode
  });
  const securityRisk = classifySecurityRisk({
    category: input.category,
    useMode: input.useMode,
    rules: input.rules
  });
  const integrationStatus = determineIntegrationStatus({
    useMode: input.useMode,
    licenseRisk,
    securityRisk
  });
  return Object.freeze({
    id: createProjectId(input.repoOwner, input.repoName),
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    repoUrl,
    normalizedUrl: repoUrl,
    category: input.category,
    useMode: input.useMode,
    ownerProvidedUseMode: input.ownerProvidedUseMode,
    productFit: Object.freeze([...input.productFit]),
    licenseRisk,
    securityRisk,
    integrationStatus,
    rules: Object.freeze([...input.rules]),
    licenseNotes: input.licenseNotes,
    securityNotes: input.securityNotes,
    metadata: Object.freeze({
      source: "owner_provided_intake_candidate",
      externalCodeCopied: false,
      productionDependencyInstalled: false,
      integrationConfigured: false,
      ...(input.metadata ?? {})
    })
  });
}

function createProjectId(repoOwner: string, repoName: string): string {
  return `${repoOwner}_${repoName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
