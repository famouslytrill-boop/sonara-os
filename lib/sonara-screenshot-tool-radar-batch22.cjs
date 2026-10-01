// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Screenshot intake received 30 September 2026. Research only; nothing is installed or enabled.

const ROOTS = [
  {
    key: "microsoft_data_formulator",
    label: "Microsoft Research Data Formulator",
    repository: "microsoft/data-formulator",
    repoUrl: "https://github.com/microsoft/data-formulator",
    repositoryVerified: true,
    license: "MIT for repository code; connected data, model/provider, and dependencies retain their own terms",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "interactive_data_exploration_and_visualization",
    placement: "Research reference; no code, data loader, model or connector is adopted",
    productFit: ["Growth Studio", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["interactive data exploration", "visualization workflows", "AI-assisted transformations and data-source extensions"],
    safety: ["A dashboard mockup or repository does not prove the displayed metrics are real.", "External loaders and model calls need independent credential, tenant-isolation, data-retention and cost review."],
    blockedUses: ["presenting sample charts or balances as customer telemetry", "sending tenant data to an unreviewed model or external loader"],
    nextStep: "Use the interaction pattern only with synthetic fixtures; any adapter must use approved tenant-scoped sources and expose provenance, freshness and deterministic totals.",
    sourceEvidence: ["https://github.com/microsoft/data-formulator", "https://github.com/microsoft/data-formulator/blob/main/README.md", "https://github.com/microsoft/data-formulator/blob/main/LICENSE"]
  },
  {
    key: "ruashots_open_h3_ir",
    label: "OpenH3-IR structured prompt compiler",
    repository: "ruashots/open-h3-ir",
    repoUrl: "https://github.com/ruashots/open-h3-ir",
    repositoryVerified: true,
    license: "Apache-2.0 for repository code; MiniMax H3 model terms are separate and restrict use in the United States and other excluded territories",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "model_specific_prompt_compiler",
    placement: "Reference only; do not configure or call MiniMax H3",
    productFit: ["Creator Studio", "Research Lab"],
    integrationStatus: "reference_only_model_terms_blocked",
    capabilities: ["structured context compiler for text, image, video and reference inputs", "validation and ComfyUI-oriented workflows described upstream"],
    safety: ["Open-source compiler licensing does not grant rights to the separate model or service.", "The model agreement lists the United States among excluded territories; this project is not an eligible model path for a US-operated service."],
    blockedUses: ["calling MiniMax H3 from the United States", "treating Apache-2.0 on compiler code as a license for model weights, hosted inference or generated assets"],
    nextStep: "Keep only the general lesson that multimodal prompts benefit from explicit, validated structure; implement provider-neutral schemas and test with eligible models under their own terms.",
    sourceEvidence: ["https://github.com/ruashots/open-h3-ir", "https://github.com/ruashots/open-h3-ir/blob/main/README.md", "https://github.com/ruashots/open-h3-ir/blob/main/LICENSE"]
  },
  {
    key: "niko1221_strata_local_inference",
    label: "Strata local inference launcher",
    repository: "Niko1221/Strata",
    repoUrl: "https://github.com/Niko1221/Strata",
    repositoryVerified: true,
    license: "MIT for Strata code; model weights, hardware requirements and optional provider features have separate terms",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "local_gpu_model_launcher_and_api",
    placement: "Research reference; no model download or local service is started",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["local inference launcher for supported consumer NVIDIA hardware", "OpenAI/Anthropic-compatible local API described by the README"],
    safety: ["The screenshot's large-model and tokens-per-second figures are hardware- and configuration-dependent claims, not SONARA benchmarks.", "Local endpoints, model downloads, GPU memory, model licensing and network binding need explicit review before use."],
    blockedUses: ["claiming consumer hardware can run every advertised model", "exposing a local inference endpoint to a network without authentication and firewall review"],
    nextStep: "If a local-model experiment is approved, record exact weights, license, hardware, quantization, cold-start, latency, quality, power and security results.",
    sourceEvidence: ["https://github.com/Niko1221/Strata", "https://github.com/Niko1221/Strata/blob/main/README.md", "https://github.com/Niko1221/Strata/blob/main/LICENSE"]
  },
  {
    key: "kaankiziltug_logo_design_skill",
    label: "Logo Design Skill for Claude and AI agents",
    repository: "kaankiziltug/logo-design-skill",
    repoUrl: "https://github.com/kaankiziltug/logo-design-skill",
    repositoryVerified: true,
    license: "Repository presents an MIT license; bundled reference logos, marks and examples retain their owners' rights",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "branding_workflow_skill_and_reference_library",
    placement: "Research reference only; no skill, logo asset or third-party mark is imported",
    productFit: ["Creator Studio", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["brief, research, concept, geometry, optical refinement, palette, typography and presentation workflow described upstream"],
    safety: ["A code license does not grant rights to third-party logos used as examples.", "Generated marks require human review for distinctiveness, trademark clearance, accessibility and export quality."],
    blockedUses: ["copying example logos or using them as output templates", "claiming trademark availability without a qualified clearance search"],
    nextStep: "Translate the process into an original, human-reviewed SONARA brand workflow; preserve briefs, source assets, iterations and approvals as attributable project records.",
    sourceEvidence: ["https://github.com/kaankiziltug/logo-design-skill", "https://github.com/kaankiziltug/logo-design-skill/blob/main/README.md", "https://github.com/kaankiziltug/logo-design-skill/blob/main/LICENSE"]
  },
  {
    key: "sirallap_agentglass_local_agent_console",
    label: "AgentGlass local coding-agent console",
    repository: "SirAllap/agentglass",
    repoUrl: "https://github.com/SirAllap/agentglass",
    repositoryVerified: true,
    license: "MIT for code; bundled portrait artwork is separately identified upstream as CC BY 4.0 and requires attribution",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "privileged_local_agent_observability_and_control_ui",
    placement: "Security research reference; do not install or connect to SONARA workspaces",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "reference_only_privileged_local_tool",
    capabilities: ["local coding-agent session, cost and tool-call visibility", "human-gated local terminal, Git, Docker and browser operations described upstream"],
    safety: ["This is a privileged local operator tool, not a hosted multi-tenant service.", "Any control over terminals, repositories, browsers or containers is a high-impact security boundary; inspect the exact source and threat model before installation."],
    blockedUses: ["connecting a local privileged console to customer tenants", "copying CC BY artwork without attribution", "assuming a visual approval gate provides sandboxing or authorization"],
    nextStep: "Use only the design lesson of showing agent activity, cost, waiting state and explicit approval. Any SONARA operator console must use server-enforced permissions, isolated execution and immutable audit events.",
    sourceEvidence: ["https://github.com/SirAllap/agentglass", "https://github.com/SirAllap/agentglass/blob/main/README.md", "https://github.com/SirAllap/agentglass/blob/main/LICENSE"]
  }
];

const VISUAL_REFERENCES = [
  ["real_estate_site", "Real-estate website mockup", "Find/search, filters, property cards, market content, agent profiles, testimonials and contact funnel; every listing, price, rating, statistic and testimonial is illustrative."],
  ["finance_dashboard", "Finance dashboard mockup", "Balance cards, trends, expenses and payment history; no displayed value is connected to a live ledger."],
  ["automation_workflow", "n8n social and messaging automation diagrams", "Webhook, agent, code, conditional branches, spreadsheets, calendar and message nodes; diagrams do not prove credentials, consent, retries or tenant isolation."],
  ["git_github_explainer", "Git and GitHub explainer", "Local version control versus hosted collaboration; command posters omit branch state, review gates, credentials and rollback context."],
  ["developer_product_showcase", "Jev TypeSafe showcase", "Structured choice, score, null, merge and parallel paths; screenshot alone does not verify the project or release claim."],
  ["video_generator_directory", "Free AI video-generator infographic", "Tool discovery and comparison layout; the list, prices, free tiers, availability and feature claims are time-sensitive and unverified."],
  ["data_formulator_ui", "Data Formulator dashboard screenshot", "Visual query-to-chart and branchable analysis; treat charts as mock data and preserve query, source, provenance and freshness."],
  ["saved_repositories_gallery", "Saved repository and tool reels", "Paperless-ngx, Remotion, browser-use, reverse-skill and video-editing leads are not adopted; verify exact upstream, license, version and security state individually."],
  ["server_types_chart", "Server types infographic", "Web, application, database, file, mail, proxy, DNS, load-balancer, authentication, cache, cloud and CI/CD roles; examples are prompts for architecture review, not a deployment design."],
  ["api_design_chart", "Backend API design infographic", "Request, validation, business logic, persistence, response, status codes and tests; examples must be checked against actual framework and authorization code."],
  ["git_vercel_deploy_chart", "GitHub to Vercel deployment infographic", "Repository import and deploy sequence; a successful diagram is not proof of correct environment variables, preview isolation or production health."],
  ["ecommerce_information_architecture", "E-commerce information architecture", "Search, categories, wishlist, account, cart and checkout paths; map every screen to an owned route and tested state."],
  ["automation_agency_diagram", "Axivra multi-agent business-automation diagram", "Email, calendar, web, content and social agents; no agent or provider should be enabled based on a poster."],
  ["video_streaming_api", "Video-streaming REST API infographic", "Upload, metadata, authentication, range requests and playback; storage, DRM, transcode, consent and bandwidth requirements are not established."],
  ["docker_basics", "Docker beginner infographic", "Image, container, port, volume and registry concepts; commands can expose ports or delete data, so use current official docs and reviewed runbooks."],
  ["logistics_site", "ShipX logistics website mockup", "Ocean, land and air services, tracking, metrics and testimonials; mock operational claims are not SONARA evidence."],
  ["muse_product_story", "Meta Muse product-design article screenshot", "Narrative product design and people-centered framing; future-dated screenshot and source page need independent verification before product or model claims."],
  ["sonara_dashboard_concept", "SONARA multi-workspace dashboard concept", "Unified navigation, role-specific workspaces, recent activity and theme controls; current implementation, accessibility, data wiring and labels remain authoritative."],
  ["system_design_grids", "HackProduct system-design and agent-workflow diagrams", "YouTube, Airbnb, Netflix, Uber, Instagram, agent routing, eval and production patterns; these are educational sketches, not evidence of internal company architectures."],
  ["mobile_responsive_reference", "Phone, tablet and web previews", "Responsive hierarchy should preserve task, status, navigation and accessibility across widths without claiming a separate native app."],
  ["brand_and_logo_showcase", "Logo-design skill example gallery", "Brand identity process and mark-grid presentation; do not reproduce example marks, typefaces or layouts without rights review."],
  ["local_ai_reference", "Local AI stack diagrams", "Harness, model, tools, files, scheduler and guardrails; a local stack still needs isolation, policy, observability, secrets handling and recovery."],
  ["general_reference", "Miscellaneous workflow, dashboard and educational screenshots", "Treat all numbers, people, logos, source claims, software capabilities and outcome metrics as unverified until checked against primary sources."]
].map(([key, label, observedTheme]) => ({ key: `batch22_${key}`, label, status: "visual_reference_only", observedTheme, reason: "The screenshot establishes a visual or educational lead, not a production implementation, license, live data source or tested business outcome.", nextStep: "Keep only the general design question; require an owned route, source-backed data, permission checks, accessible behavior and a tested failure state before implementing." }));

const ARCHITECTURE_EXTENSIONS = [
  { key: "research_provenance_boundary", title: "Research provenance and license boundary", product: "Research Lab", principle: "A saved screenshot is a lead, never a license or product specification.", implementation: "Store source URL, retrieval date, license evidence, claim status and adoption decision. Keep third-party binaries and code out unless rights and security review approve them." },
  { key: "workflow_node_execution_contract", title: "Workflow node execution contract", product: "Business Builder", principle: "A node diagram becomes operational only when inputs, authority, retries and side effects are explicit.", implementation: "Represent each step with typed input/output, tenant scope, idempotency key, timeout, retry ceiling, human gate, audit event, compensation and observable terminal state. Default external actions to disabled." },
  { key: "metrics_and_dashboard_truth", title: "Dashboard metric evidence contract", product: "SONARA One", principle: "A polished metric card must be traceable to a real event or clearly labeled as sample data.", implementation: "Expose source, tenant, unit, time window, freshness, denominator and missing-data state; compute deterministic totals and reject invented values." },
  { key: "responsive_route_contract", title: "Responsive route and state contract", product: "All workspaces", principle: "Responsive screens should preserve the same task and record lifecycle.", implementation: "Map each visible control to one registered route or explicit action, retain the same authorization and tenant checks at every viewport, and test keyboard, zoom, touch targets, errors and narrow reflow." },
  { key: "media_asset_pipeline_contract", title: "Media asset pipeline contract", product: "Creator Studio", principle: "Upload, transform, store and stream are distinct steps with explicit rights and lifecycle.", implementation: "Track consent and provenance; validate MIME, size and ownership; use bounded object storage and signed access; record transcode status, cancellation, expiry and deletion; never imply streaming or DRM from a mock API diagram." },
  { key: "local_agent_privilege_contract", title: "Local agent privilege boundary", product: "Internal Development", principle: "Visibility and approval prompts do not replace isolation or authorization.", implementation: "Keep customer data separate from local developer sessions; apply server-side policy, sandbox boundaries, scoped credentials, explicit approval, immutable audit and recovery for every terminal, browser, Git or container action." }
].map((item) => Object.freeze(item));

const SCREENSHOT_TOOL_RADAR_BATCH22 = Object.freeze(ROOTS.map((item) => Object.freeze({
  ...item,
  productFit: Object.freeze(item.productFit),
  capabilities: Object.freeze(item.capabilities),
  safety: Object.freeze(item.safety),
  blockedUses: Object.freeze(item.blockedUses),
  sourceEvidence: Object.freeze(item.sourceEvidence),
  checkedOn: "2026-10-01",
  configurationStatus: "cataloged_disabled",
  runtimeStatus: "not_executed",
  enabledInProduction: false,
  canExecute: false,
  humanReviewRequired: true,
  source: "user_submitted_screenshot_research_batch22_2026_09_30"
})));
const NON_REPOSITORY_REFERENCES_BATCH22 = Object.freeze(VISUAL_REFERENCES.map((item) => Object.freeze({ ...item, source: "user_submitted_screenshot_research_batch22_2026_09_30" })));
const ARCHITECTURE_EXTENSIONS_BATCH22 = Object.freeze(ARCHITECTURE_EXTENSIONS);

function getPublicScreenshotToolCatalogBatch22() {
  return SCREENSHOT_TOOL_RADAR_BATCH22.map((item) => ({ ...item, productFit: [...item.productFit], capabilities: [...item.capabilities], safety: [...item.safety], blockedUses: [...item.blockedUses], sourceEvidence: [...item.sourceEvidence] }));
}
function getNonRepositoryReferencesBatch22() { return NON_REPOSITORY_REFERENCES_BATCH22.map((item) => ({ ...item })); }
function getArchitectureExtensionsBatch22() { return ARCHITECTURE_EXTENSIONS_BATCH22.map((item) => ({ ...item })); }
function getScreenshotToolReadinessBatch22() {
  const repositories = getPublicScreenshotToolCatalogBatch22();
  return { ok: true, batch: 22, mode: "static_governed_screenshot_research_batch22", screenshotCount: 30, repositoryCount: repositories.length, verifiedCount: repositories.filter((item) => item.repositoryVerified).length, reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length, nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH22.length, confirmedExistingRecordCount: 0, deduplicatedReferenceCount: 0, architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH22.length, productionExecutionCount: 0, repositories, nonRepositoryReferences: getNonRepositoryReferencesBatch22(), confirmedExistingRecords: [], deduplicatedReferences: [], architectureExtensions: getArchitectureExtensionsBatch22() };
}

module.exports = { SCREENSHOT_TOOL_RADAR_BATCH22, NON_REPOSITORY_REFERENCES_BATCH22, ARCHITECTURE_EXTENSIONS_BATCH22, getPublicScreenshotToolCatalogBatch22, getNonRepositoryReferencesBatch22, getArchitectureExtensionsBatch22, getScreenshotToolReadinessBatch22 };
