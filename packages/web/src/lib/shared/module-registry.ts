import type { ModuleRegistryItem } from "./types.ts";

export const moduleRegistry: ModuleRegistryItem[] = [
  {
    id: "business-builder",
    publicName: "Business Builder",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/business-builder",
    featureFlag: "BUSINESS_BUILDER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "creator-studio",
    publicName: "Creator Studio",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/creator-studio",
    featureFlag: "CREATOR_STUDIO_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "growth-studio",
    publicName: "Growth Studio",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/growth-studio",
    featureFlag: "GROWTH_STUDIO_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "trust-shield",
    publicName: "Trust Shield",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/trust-shield",
    featureFlag: "TRUST_SHIELD_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "security-center",
    publicName: "Security Center",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/security-center",
    featureFlag: "SECURITY_CENTER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "data-vault",
    publicName: "Data Vault",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/data-vault",
    featureFlag: "DATA_VAULT_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "payment-options",
    publicName: "Payment Options",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/payment-options",
    featureFlag: "PAYMENT_OPTIONS_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "payment-links",
    publicName: "Payment Links",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/payment-links",
    featureFlag: "PAYMENT_LINKS_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "connected-links",
    publicName: "Connected Links",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/connected-links",
    featureFlag: "EXTERNAL_CONNECTIONS_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "business-profile",
    publicName: "Business Profile",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/business-profile",
    featureFlag: "AUDIT_PROOF_LEDGER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "proof-card",
    publicName: "Proof Card",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/proof-card",
    featureFlag: "PROOF_RESULTS_LEDGER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "get-paid-page",
    publicName: "Get Paid Page",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/get-paid-page",
    featureFlag: "PAYMENT_LINKS_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "booking-page",
    publicName: "Booking Page",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/booking-page",
    featureFlag: "BOOKING_APPOINTMENTS_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "quotes",
    publicName: "Quotes",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/quotes",
    featureFlag: "QUOTES_PAYMENTS_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "reviews-feedback",
    publicName: "Reviews & Feedback",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/reviews-feedback",
    featureFlag: "CUSTOMER_COMMAND_CENTER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "customer-records",
    publicName: "Customer Records",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/customer-records",
    featureFlag: "CUSTOMER_RECORDS_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "files-records",
    publicName: "Files & Records",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/files-records",
    featureFlag: "DATA_VAULT_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "template-library",
    publicName: "Template Library",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/template-library",
    featureFlag: "TEMPLATE_MARKETPLACE_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "launch-checklist",
    publicName: "Launch Checklist",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/launch-checklist",
    featureFlag: "LAUNCH_READINESS_COMMAND_CENTER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "usage-meter",
    publicName: "Usage Meter",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/usage-meter",
    featureFlag: "AI_COST_USAGE_METER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "consent-center",
    publicName: "Consent Center",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/consent-center",
    featureFlag: "CONSENT_COMPLIANCE_CENTER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "help-center",
    publicName: "Help Center",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/help-center",
    featureFlag: "GUIDED_SUPPORT_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "debugging-tools",
    publicName: "Debugging Tools",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/debugging-tools",
    featureFlag: "DEBUGGING_INTELLIGENCE_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "safe-release-lab",
    publicName: "Safe Release Lab",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/safe-release-lab",
    featureFlag: "SAFE_RELEASE_LAB_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "proof-builder",
    publicName: "Proof Builder",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/proof-builder",
    featureFlag: "PROOF_ASSET_GENERATOR_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "privacy-timeline",
    publicName: "Privacy Timeline",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/privacy-timeline",
    featureFlag: "PRIVACY_TIMELINE_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "project-execution-spine",
    publicName: "Project Execution Spine",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/project-execution-spine",
    featureFlag: "PROJECT_EXECUTION_SPINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "final-launch-hardening",
    publicName: "Final Launch Hardening",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/final-launch-hardening",
    featureFlag: "FINAL_LAUNCH_HARDENING_ENGINE_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "implementation-sequencer",
    publicName: "Implementation Sequencer",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/implementation-sequencer",
    featureFlag: "IMPLEMENTATION_SEQUENCER_ENABLED",
    launchPriority: "q1_core",
    publicVisible: true,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "model-evaluation",
    publicName: "Model Evaluation",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/model-evaluation",
    featureFlag: "MULTI_MODEL_EVALUATION_ARENA_ENABLED",
    launchPriority: "admin_only",
    publicVisible: false,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "smart-debugger",
    publicName: "Smart Debugger",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/smart-debugger",
    featureFlag: "ADVANCED_DEBUGGER_ENGINE_ENABLED",
    launchPriority: "admin_only",
    publicVisible: false,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "revenue-experiments",
    publicName: "Results Tracker",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/revenue-experiments",
    featureFlag: "REVENUE_EXPERIMENT_LAB_ENABLED",
    launchPriority: "beta_gated",
    publicVisible: false,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "voice-ai-audio",
    publicName: "Audio Notes",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/voice-ai-audio",
    featureFlag: "VOICE_AI_AUDIO_LAYER_ENABLED",
    launchPriority: "beta_gated",
    publicVisible: false,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  },
  {
    id: "visual-generation",
    publicName: "Brand Creative",
    description:
      "Launch-scoped SONARA Industries module with typed scaffold and human-review gates.",
    productArea: "SONARA Industries",
    routeHint: "/visual-generation",
    featureFlag: "VISUAL_GENERATION_ENGINE_ENABLED",
    launchPriority: "beta_gated",
    publicVisible: false,
    dependencies: ["shared-registries"],
    safetyNotes: ["Feature-gated scaffold; no production automation."]
  }
];
