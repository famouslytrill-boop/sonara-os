"use strict";

const { getPublicAIIntegrationCatalog } = require("./sonara-ai-integration-registry.cjs");
const { getRecommendedProductCatalog } = require("./sonara-recommended-product-catalog.cjs");

const SONARA_ECOSYSTEM_MANIFEST = {
  version: "2026-07-26",
  parentCompany: {
    name: "SONARA Industries",
    legalRole: "Parent company, admin, owner, payment, legal, and operations control layer.",
    publicPositioning: "Launch infrastructure for small businesses, creators, and growth teams.",
    operatingPrinciples: [
      "Every visible feature must produce real results or show Setup Required.",
      "No fake dashboards, fake payment success, fake automation, dead buttons, lorem ipsum, or placeholder claims.",
      "Secrets stay server-side. Public clients never receive service-role, Stripe, Resend, OAuth, or admin secrets.",
      "Core stack prefers free/open-source/local/self-hostable tools; paid APIs are optional adapters disabled by default.",
      "Use ™ for public marks where needed. Avoid ® until registration exists.",
      "Minimize public AI wording. Sell outcomes, workflows, readiness, and operating systems.",
      "Public names must not resurrect rejected legacy names like SoundOS, TableOS, TableOps, AlertOS, CivicSignal, or Launchpad."
    ],
    audience: [
      "People who cannot afford enterprise SaaS but need real systems.",
      "Small businesses needing offers, payments, operations, staff, inventory, and customer records.",
      "Creators needing music, catalog, release, monetization, and media workflows.",
      "Growth teams needing campaign planning, follow-up, consent, analytics, and automation readiness."
    ]
  },
  currentCompanies: [
    {
      key: "business_builder",
      name: "Business Builder",
      purpose: "Service-business and local-operator launch infrastructure.",
      routes: ["/business-builder", "/business-builder/dashboard", "/business-builder/owner", "/business-builder/billing", "/business-builder/employees", "/business-builder/launch-readiness", "/business-builder/product-lifecycle", "/business-builder/market-intelligence", "/business-builder/prompts"],
      apps: ["Offers", "Intake", "Customers", "Orders", "Payments", "Appointments", "Employees", "Inventory", "Vendors", "Locations", "Recipes", "Menu/POS", "Assets", "Payroll", "Reports"],
      modules: [
        "Offer Builder",
        "Intake & Request Queue",
        "Launch Setup Checklist",
        "Customer Records",
        "Order Records",
        "Stripe Checkout",
        "Billing Portal",
        "Employee Invites",
        "Employee Profiles",
        "Shift Scheduling",
        "Time Clock",
        "Wage Projection",
        "Payroll Export Prep",
        "Menu Items",
        "Recipe Cards",
        "Recipe Ingredients",
        "Food Cost Calculator",
        "Restaurant Margin Ops",
        "Inventory Items",
        "Waste Logs",
        "Vendor Accounts",
        "Vendor Invoices",
        "Business Locations",
        "Business Assets",
        "Vehicle/Trailer/Food Truck Records",
        "Route Tracking Sessions",
        "Shared Prompt Library",
        "Business Market Intelligence",
        "First Transaction Activation"]
    },
    {
      key: "creator_studio",
      name: "Creator Studio",
      purpose: "Creator product, music, media, catalog, release, and monetization infrastructure.",
      routes: ["/creator-studio", "/creator-studio/dashboard", "/creator-studio/launch-readiness", "/creator-studio/music-system", "/creator-studio/product-lifecycle", "/creator-studio/market-intelligence", "/creator-studio/prompts"],
      apps: ["Asset Catalog", "Creator Offers", "Release Checklist", "Catalog", "Monetization", "Music System", "Prompt Packs", "Release Packages", "Media Tools"],
      modules: [
        "Asset Catalog",
        "Creator Offers",
        "Release and Content Checklist",
        "Monetization Readiness",
        "Media Records",
        "Artist Identity Engine",
        "Song Development Studio",
        "Originality Guard",
        "Authenticity Layer",
        "Visual World Builder",
        "Release Command Center",
        "Fan Growth System",
        "Creator Commerce Hub",
        "Label Operations Suite",
        "Creator Artist Systems",
        "Creator Song Blueprints",
        "Creator Prompt Packs",
        "Creator Quality Checks",
        "Creator Release Packages",
        "Creator Export Packages",
        "Music Projects",
        "Music Tracks",
        "Music Stems",
        "DAW Export Profiles",
        "Music AI Providers",
        "Music AI Jobs",
        "Audio Analysis Reports",
        "Audio Transcription Segments",
        "Shared Prompt Library",
        "Creator Market Intelligence",
        "Rights and Provenance Evidence",
        "Brand Partnership Measurement"]
    },
    {
      key: "growth_studio",
      name: "Growth Studio",
      purpose: "Consent-safe growth, lead follow-up, experiments, and automation readiness.",
      routes: ["/growth-studio", "/growth-studio/dashboard", "/growth-studio/launch-readiness", "/growth-studio/product-lifecycle", "/growth-studio/market-intelligence", "/growth-studio/prompts"],
      apps: ["Campaign Workspace", "Leads", "Follow-Up", "Consent Checklist", "Analytics", "Automations", "Experiments"],
      modules: [
        "Campaign Workspace",
        "Lead and Customer Follow-Up",
        "Consent-Safe Campaign Checklist",
        "Automation Readiness",
        "Growth Records",
        "Growth Campaigns",
        "Growth Leads",
        "Growth Experiments",
        "Email Reply Rate",
        "Campaign ROI",
        "Lead Scoring",
        "Follow-Up Priority",
        "Booking Conversion",
        "Shared Prompt Library",
        "Growth Market Intelligence",
        "First-Party Customer Timeline",
        "Incrementality Planning",
        "Creator Partnership Measurement"]
    }
  ],
  recommendedProductCatalog: getRecommendedProductCatalog(),
  adminControlPlane: {
    routes: ["/admin", "/admin/users", "/admin/roles", "/admin/subscriptions", "/admin/webhooks", "/admin/support", "/admin/catalog", "/admin/system", "/admin/formulas", "/admin/ecosystem", "/admin/ai-integrations", "/admin/reference-intelligence", "/admin/system-design-intelligence", "/admin/model-safety-resilience", "/admin/prompt-library"],
    duties: [
      "Deployment and readiness visibility",
      "User/profile/organization/member records",
      "Owner/staff/customer permission enforcement",
      "Stripe subscription and webhook observability",
      "Support queue review",
      "Product catalog and module catalog status",
      "Formula table and runtime evaluator visibility",
      "Route/table/API/test readiness visualizer",
      "Governed AI integration catalog and bounded service readiness probes",
      "Prompt catalog, provenance, moderation, versions, collections, workflows, and prepared-run visibility",
      "Governed external-reference intake, provenance, rights, confidence, and approval",
      "Deterministic architecture review, capacity questions, failure gates, and module mapping",
      "Defensive model-safety resilience, refusal-integrity, provenance, egress, and license review",
      "Environment setup checks without exposing secrets",
      "Activity and audit-log inspection"
    ]
  },
  requiredDatabaseDomains: [
    {
      domain: "Core identity and tenant model",
      tables: ["profiles", "organizations", "organization_memberships", "user_roles", "sonara_platforms", "sonara_platform_pages", "sonara_platform_apps", "sonara_platform_modules", "sonara_platform_publications", "sonara_platform_templates"]
    },
    {
      domain: "Billing and entitlement model",
      tables: ["stripe_customers", "billing_subscriptions", "billing_webhook_events", "plans", "organization_entitlements", "purchases"]
    },
    {
      domain: "Operations model",
      tables: ["support_requests", "intake_requests", "launch_checklist_items", "customer_records", "order_records", "activity_events", "admin_audit_logs", "module_outputs"]
    },
    {
      domain: "Business Builder model",
      tables: ["business_workspaces", "business_memberships", "business_employee_invites", "business_locations", "business_service_items", "business_appointments", "business_assets", "inventory_items", "vendor_accounts", "vendor_invoices", "menu_items", "recipe_cards", "recipe_ingredients", "pos_sales_summaries", "waste_logs", "daily_profit_snapshots", "employee_profiles", "employee_shifts", "employee_time_entries", "employee_pay_periods", "employee_pay_statements", "employee_posts"]
    },
    {
      domain: "Creator Studio model",
      tables: ["creator_assets", "creator_releases", "creator_artist_systems", "creator_prompt_packs", "creator_song_blueprints", "creator_quality_checks", "creator_release_packages", "creator_export_packages", "music_projects", "music_tracks", "music_stems", "daw_export_profiles", "music_ai_providers", "music_ai_jobs", "audio_analysis_reports", "audio_transcription_segments"]
    },
    {
      domain: "Growth Studio model",
      tables: ["growth_campaigns", "growth_leads", "growth_experiments", "automation_rules"]
    },
    {
      domain: "Reference intelligence model",
      tables: ["reference_intelligence_sources", "reference_intelligence_insights", "reference_intelligence_actions"]
    },
    {
      domain: "Market intelligence model",
      tables: ["market_intelligence_segments", "market_intelligence_competitors", "market_intelligence_signals", "market_intelligence_opportunities", "market_intelligence_reviews", "market_intelligence_events"]
    },
    {
      domain: "Prompt Library model",
      tables: ["sonara_prompt_templates", "sonara_prompt_versions", "sonara_prompt_tags", "sonara_prompt_template_tags", "sonara_prompt_collections", "sonara_prompt_collection_items", "sonara_prompt_connections", "sonara_prompt_runs", "sonara_prompt_reports", "sonara_prompt_import_batches"]
    },
    {
      domain: "Formula and operating-twin model",
      tables: ["sonara_formula_groups", "sonara_formula_definitions", "sonara_formula_variables", "sonara_formula_templates", "sonara_formula_results", "sonara_control_plane_checks"]
    },
    {
      domain: "Storage and media model",
      tables: ["storage.objects", "storage.buckets"]
    }
  ],
  infrastructure: {
    requiredServices: ["Supabase Auth", "Supabase Postgres", "Supabase Storage", "Supabase Realtime", "Supabase Edge Functions", "Vercel", "Stripe", "Resend", "GitHub", "GitLab mirror", "Docker", "Rancher"],
    environmentRules: [
      "Public anon keys may be client-visible when intended by Supabase.",
      "Service role keys, Stripe secret keys, webhook secrets, Resend keys, OAuth secrets, and admin credentials must stay in Vercel server environment variables only.",
      "Do not hardcode secrets in repository files.",
      "Do not disable RLS broadly to make errors go away.",
      "Every migration must be idempotent: create table if not exists, create index if not exists, drop trigger if exists before create trigger, and safe upserts with matching unique indexes."
    ],
    storageBuckets: ["avatars", "business-assets", "creator-assets", "music-stems", "release-packages", "support-attachments", "exports"],
    realtimeChannels: ["organization:{id}:activity", "organization:{id}:support", "business:{id}:orders", "business:{id}:staff", "creator:{id}:jobs", "growth:{id}:campaigns"],
    edgeWorkerJobs: ["stripe-webhook-sync", "resend-email-dispatch", "storage-cleanup", "formula-result-backfill", "creator-audio-analysis", "daily-readiness-snapshot", "admin-alerts"]
  },
  externalInspirationAndAdapters: {
    designReferences: ["Stripe", "Spotify", "Apple Music", "GOV.UK", "macOS", "Windows 11", "Figma", "Framer"],
    appReferences: ["Square POS", "Booksy Biz", "WhatsApp Business", "QuickBooks for Business", "Wave", "Skype for Business", "Amazon Business", "Business Planner"],
    openSourceAndResearchQueue: [
      { name: "f/prompts.chat", source: "github", intendedUse: "MIT/CC0 prompt-library architecture and optional provenance-preserving prompt-data imports; original SONARA runtime, one login, no remote MCP or upstream customer-data flow", status: "implemented_original_adapter" },
      { name: "OpenCut", source: "github", intendedUse: "Creator Studio video editing/reference workflow", status: "review_required" },
      { name: "Clone Wars", source: "github", intendedUse: "UI/product pattern research only; do not copy proprietary assets", status: "review_required" },
      { name: "pydantic/monty", source: "github", intendedUse: "agent/tooling research queue", status: "review_required" },
      { name: "iptv-org/iptv", source: "github", intendedUse: "public stream index research only; licensing and content policy review required", status: "review_required" },
      { name: "NVIDIA Nemotron ASR Streaming", source: "huggingface", intendedUse: "speech-to-text/creator audio research adapter", status: "license_review_required" },
      { name: "OBS Studio", source: "open_source_reference", intendedUse: "recording, streaming, scenes/sources workflow inspiration", status: "reference_only" },
      { name: "Unreal Engine", source: "engine_reference", intendedUse: "future 3D/motion/physics/progressive UI research", status: "future_research" },
      { name: "liquidslr/system-design-notes", source: "github", intendedUse: "reference-only architecture topic index mapped into original SONARA review questions and module gates; no upstream text, diagrams, or code copied", status: "reference_only_no_license" },
      { name: "elder-plinius/OBLITERATUS", source: "github", intendedUse: "quarantined defensive reference for refusal-integrity, model-safety resilience, artifact provenance, telemetry, and license review; no refusal removal, model modification, export, telemetry, or customer runtime", status: "blocked_from_runtime_execution" }
    ],
    referenceIntelligence: {
      status: "review_required",
      sourceCount: 27,
      verifiedSourceCount: 0,
      routes: ["/admin/reference-intelligence", "/api/admin/reference-intelligence"],
      rules: [
        "Authenticated source review or owner-supplied transcript is required before content analysis.",
        "Facts, interpretation, confidence, rights, and proposed actions remain separate records.",
        "Unknown-rights material is reference-only and cannot be cloned, republished, or used as a direct production asset.",
        "Only owner-approved insights may become features, campaigns, content briefs, or automation rules."
      ]
    },
    systemDesignIntelligence: {
      status: "reference_only",
      source: "liquidslr/system-design-notes",
      pinnedCommit: "aa7ac69e206bca659020baa5954bb65cfd70ab99",
      licenseStatus: "no_license_file_detected",
      patternCount: 28,
      routes: ["/admin/system-design-intelligence", "/api/admin/system-design-intelligence", "/api/admin/system-design-intelligence/review"],
      executionMode: "deterministic_local_reference_engine",
      rules: [
        "No upstream chapter text, diagrams, screenshots, or book-derived assets are copied into SONARA.",
        "The upstream repository is not cloned, installed, fetched at runtime, or placed in the customer request path.",
        "Recommendations remain review-required and cannot deploy, bill, message, delete, trade, hold funds, or change infrastructure automatically.",
        "Owner/admin approval, tests, rollback, security, tenant, cost, and failure review are required before implementation."
      ]
    },
    modelSafetyResilience: {
      status: "quarantined_reference_only",
      source: "elder-plinius/OBLITERATUS",
      pinnedCommit: "a5a1ffa5849b442cf188b3c03fd4de71ddf5bdcc",
      upstreamLicense: "AGPL-3.0_with_commercial_option",
      routes: ["/admin/model-safety-resilience", "/api/admin/model-safety-resilience", "/api/admin/model-safety-resilience/review"],
      executionMode: "deterministic_local_policy_engine",
      rules: [
        "The upstream repository is not installed, cloned, imported, fetched, or executed in production.",
        "SONARA does not remove, weaken, bypass, or suppress model safety or refusal behavior.",
        "No modified model weights, Hugging Face uploads, telemetry, customer prompts, customer outputs, credentials, or production secrets are allowed.",
        "Only defensive safety evaluation, refusal-integrity monitoring, provenance, privacy, egress, and license review are permitted.",
        "Any future isolated research requires founder, legal, AI-safety, privacy, security, and human approval in a separate tested pull request."
      ]
    },
    promptLibrary: {
      status: "implemented_original_adapter",
      source: "f/prompts.chat",
      pinnedCommit: "a779dadd30bd967bbf1b2e3441ea706a3db1e20f",
      codeLicense: "MIT",
      promptDataLicense: "CC0-1.0",
      runtimeDependency: false,
      remoteMcpEnabled: false,
      routes: ["/prompt-library", "/business-builder/prompts", "/creator-studio/prompts", "/growth-studio/prompts", "/admin/prompt-library"],
      capabilities: ["catalog", "deterministic rendering", "saved templates", "versions", "collections", "connections", "prepared run records", "moderation", "provenance", "reviewed imports"],
      rules: [
        "Keep one SONARA authentication and organization model.",
        "Do not clone the upstream application stack or enable remote prompt fetch, telemetry, webhook, or MCP access by default.",
        "Only reviewed CC0 prompt data or approved MIT site-authored material may enter the import path.",
        "Customer inputs, outputs, credentials, and private records remain inside SONARA.",
        "Every database record is organization-scoped and row-level-security protected."
      ]
    },
    governedAIIntegrations: getPublicAIIntegrationCatalog(),
    adapterRules: [
      "Research does not mean copying assets, code, trademarks, private APIs, or proprietary product flows.",
      "GPL/AGPL dependencies require explicit review before commercial integration.",
      "Non-commercial model weights cannot be used in a commercial product without license approval.",
      "External tools begin as adapters or manual-link workflows until terms, API limits, data privacy, and cost are reviewed.",
      "AI integrations are disabled by default and may not execute prompts, workflows, shell commands, publishing, billing, deletion, or customer jobs during readiness checks.",
      "Developer CLIs stay on approved development workstations or isolated development containers and never enter the production customer request path."
    ]
  },
  uiExperience: {
    direction: "Premium, fast, reliable, mobile-first SaaS with depth, clarity, tactile feedback, progressive enhancement, and setup-aware UI.",
    layers: [
      "Plain readable mobile-first layouts",
      "Clear tabs for parent company and three companies",
      "Separate product pages, subpages, apps, subapps, and login paths",
      "Dashboard cards backed by live database reads",
      "Admin control-plane visualizer",
      "Optional sounds, voice, haptics, and alerts",
      "Reduced-motion safety",
      "3D/progressive motion layer only after core CRUD, auth, billing, storage, and realtime are stable"
    ],
    appStorePresentationRules: [
      "Use one-sentence value proposition above screenshots.",
      "Show real workflows in screenshots: dashboard, payments, schedule, customer record, creator project, campaign plan.",
      "Avoid fake badges and unsupported award claims.",
      "Use honest tags: business, creator tools, point of sale, communication, productivity, music workflow."
    ]
  },
  legalAndSafety: {
    requiredPages: ["Terms of Service", "Privacy Policy", "Refund Policy", "Cookie Policy", "Acceptable Use", "Accessibility", "Earnings Disclaimer", "AI Disclaimer", "Payment Terms", "Data Processing", "Security Policy", "CAN-SPAM", "Subprocessor Notice"],
    operationalSafety: [
      "Admin actions must be audited.",
      "Outbound campaigns require consent review.",
      "Claims, pricing, refund terms, and product availability must be truthful.",
      "Music/creator workflows require rights review and originality guardrails.",
      "Generated outputs must be saved with provenance metadata when applicable."
    ]
  },
  launchPriorities: [
    "Fix migrations so all required tables exist cleanly.",
    "Verify founder profile, organization, memberships, and roles.",
    "Verify Supabase Auth login and admin login.",
    "Verify Stripe live checkout and webhook event writes.",
    "Verify Resend domain and sender email.",
    "Create storage buckets and policies.",
    "Enable realtime channels after RLS policies are correct.",
    "Wire CRUD APIs per module.",
    "Review source-dated market evidence and scored opportunities before approving new product work.",
    "Link the opportunities you have prioritised to items on the roadmap.",
    "Add admin visualizers for routes, tables, permissions, formulas, storage, jobs, and integrations.",
    "Then deepen premium UI, motion, 3D, sounds, haptics, and app-store-grade presentation."
  ]
};

function getManifest() {
  return JSON.parse(JSON.stringify(SONARA_ECOSYSTEM_MANIFEST));
}

function getAllManifestTables() {
  return SONARA_ECOSYSTEM_MANIFEST.requiredDatabaseDomains.flatMap((domain) => domain.tables);
}

module.exports = {
  SONARA_ECOSYSTEM_MANIFEST,
  getManifest,
  getAllManifestTables
};
