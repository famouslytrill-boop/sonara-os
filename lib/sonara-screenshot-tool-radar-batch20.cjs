// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Consolidated screenshot intake received 28 September 2026. Screenshots are
// discovery evidence only; every candidate remains disabled and non-executing.

const REPOSITORIES = [
  {
    key: "aha_3d_real2sim",
    label: "AHa-3D Real2Sim",
    repository: "KevinXu02/aha-3d",
    repoUrl: "https://github.com/KevinXu02/aha-3d",
    repositoryVerified: true,
    license: "Apache-2.0 for project-authored code, skills and asset libraries; embedded PyTorch3D utility is BSD; model checkpoints, SMPL-X/MHR assets, upstream projects and source footage have separate terms",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "gpu_heavy_video_to_3d_research_pipeline",
    placement: "Research Lab reference only; no Blender process, video ingest, model download, body asset, or rendering path is connected",
    productFit: ["Creator Studio", "Research Lab", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["reconstruct editable Blender scenes from indoor video", "estimate people motion and refine object contact", "use reusable furniture and material libraries"],
    safety: [
      "Repository-authored code is Apache-2.0, but the same grant does not cover separately sourced body assets, model checkpoints, footage or embedded third-party utilities.",
      "Video can contain identifiable people, private locations and incidental personal data; use requires documented rights, consent and retention controls.",
      "The upstream describes a Linux/NVIDIA workstation workflow; GPU, model, Blender and asset requirements must be measured before any isolated experiment."
    ],
    blockedUses: ["processing customer or bystander footage without documented rights and consent", "treating reconstructed geometry or motion as verified physical truth", "running downloaded models or Blender inside the web request process"],
    nextStep: "Keep as research. If Creator Studio establishes a user-owned indoor-video use case, design a disposable media-worker benchmark using synthetic footage and itemized asset licenses before considering an adapter.",
    sourceEvidence: [
      "https://github.com/KevinXu02/aha-3d",
      "https://github.com/KevinXu02/aha-3d/blob/main/README.md",
      "https://github.com/KevinXu02/aha-3d/blob/main/DISTRIBUTION.md"
    ]
  },
  {
    key: "frontend_ui_design_agents",
    label: "Frontend UI Design Agents Collection",
    repository: "mustafakendiguzel/claude-code-ui-agents",
    repoUrl: "https://github.com/mustafakendiguzel/claude-code-ui-agents",
    repositoryVerified: true,
    license: "MIT repository; this intake does not copy its prompt text, screenshots or examples",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "agent_prompt_and_design_reference",
    placement: "SONARA-authored design-skill research only; the current DESIGN.md and product-design authority remain canonical",
    productFit: ["Public Website", "Business Builder", "Creator Studio", "Growth Studio", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["categorized UI, frontend, component, UX research, animation, responsive and accessibility prompt examples", "prompt metadata and contribution conventions"],
    safety: [
      "A prompt collection is guidance, not proof that a UI works, meets accessibility requirements, or matches SONARA's current design authority.",
      "Prompts and generated interface content can request changes outside a task; review scope, route behavior, data states and tests before accepting output.",
      "The repository MIT license permits code use under its terms but does not make generated outputs or third-party assets automatically safe to use."
    ],
    blockedUses: ["bulk-copying prompts into SONARA skills without source and license records", "allowing design prompts to change production routes, permissions or claims without review"],
    nextStep: "Use the intake only to inform a repository-owned skill contract: route inventory, page states, accessibility, data provenance, empty/error/loading states and acceptance checks.",
    sourceEvidence: [
      "https://github.com/mustafakendiguzel/claude-code-ui-agents",
      "https://github.com/mustafakendiguzel/claude-code-ui-agents/blob/main/LICENSE",
      "https://github.com/mustafakendiguzel/claude-code-ui-agents/blob/main/README.md"
    ]
  },
  {
    key: "strata_local_inference",
    label: "Strata local inference engine",
    repository: "Niko1221/Strata",
    repoUrl: "https://github.com/Niko1221/Strata",
    repositoryVerified: true,
    license: "MIT for repository code; Qwen3.8-Flash-Next, quantized checkpoints, fine-tunes, llama.cpp/ggml components and other model artifacts have separate licenses and notices",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "local_gpu_llm_runtime_research",
    placement: "Local-only Research Lab reference; no provider endpoint, downloaded model, credentials, tenant content or Provider Gateway route is configured",
    productFit: ["Research Lab", "Internal Development", "Creator Studio"],
    integrationStatus: "reference_only",
    capabilities: ["runs a quantized local model with a localhost OpenAI/Anthropic-compatible endpoint", "offers a local chat and image-input path on supported hardware"],
    safety: [
      "The project code MIT license does not grant rights to model weights, fine-tunes, training data or bundled third-party components.",
      "The upstream performance and hardware statements are project-reported claims, not SONARA benchmarks; hardware, quantization, quality, memory, latency, thermal and energy costs need independent measurement.",
      "A localhost model server is a new credential and network trust boundary; bind scope, authentication, origins, logs, model provenance and resource budgets require review."
    ],
    blockedUses: ["exposing a local inference endpoint to the public internet", "treating local execution as proof that data is never logged or accessible", "replacing Provider Gateway or changing model defaults from a screenshot"],
    nextStep: "If a measured offline task emerges, run a user-approved synthetic-data benchmark on an isolated workstation and record model revision, model license, quality, memory, speed, energy and failure behavior.",
    sourceEvidence: [
      "https://github.com/Niko1221/Strata",
      "https://github.com/Niko1221/Strata/blob/main/LICENSE",
      "https://github.com/QwenLM/Qwen3.8-Flash-Next",
      "https://github.com/Niko1221/Strata/blob/main/README.md"
    ]
  },
  {
    key: "invokeai_creative_engine",
    label: "InvokeAI creative engine",
    repository: "invoke-ai/InvokeAI",
    repoUrl: "https://github.com/invoke-ai/InvokeAI",
    repositoryVerified: true,
    license: "Apache-2.0 for repository code; included model-specific notices and separately downloaded model weights, adapters, assets and provider APIs have their own terms",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "local_or_worker_image_generation_application",
    placement: "Creator Studio model/workflow reference only; no model is approved, downloaded, exposed or routed through SONARA",
    productFit: ["Creator Studio", "Research Lab", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["locally hosted visual-media UI and canvas", "node-based image workflows", "image gallery and metadata recall"],
    safety: [
      "InvokeAI code licensing is separate from the licenses and use restrictions of every supported model and adapter.",
      "A generation workflow needs asset ownership, provenance, consent, model safety review, output rights, resource limits and user controls.",
      "The upstream security policy states that only its latest version receives security updates; any future isolated trial must pin and recheck a supported revision."
    ],
    blockedUses: ["claiming every supported model is commercially permitted", "using generated likenesses or protected styles without rights review", "placing an unreviewed model server on the customer request path"],
    nextStep: "Compare workflow provenance and asset recall against Creator Studio's existing media contracts; any generation experiment must be a separate approved, resource-bounded provider/worker proposal.",
    sourceEvidence: [
      "https://github.com/invoke-ai/InvokeAI",
      "https://github.com/invoke-ai/InvokeAI/blob/main/LICENSE",
      "https://github.com/invoke-ai/InvokeAI/blob/main/SECURITY.md",
      "https://github.com/invoke-ai/InvokeAI/blob/main/InvokeAI_Statement_of_Values.md"
    ]
  },
  {
    key: "logo_design_skill_reference",
    label: "Logo Design Skill for Claude and AI Agents",
    repository: "kaankiziltug/logo-design-skill",
    repoUrl: "https://github.com/kaankiziltug/logo-design-skill",
    repositoryVerified: true,
    license: "MIT for skill text, scripts, templates and catalog data; bundled real-world SVG logos are third-party trademarks and explicitly excluded from the MIT grant",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "brand_design_guidance_and_logo_reference_library",
    placement: "Brand-design process reference only; do not copy, render, distribute or train from bundled trademark logos",
    productFit: ["Public Website", "Creator Studio", "Internal Development"],
    integrationStatus: "reference_only",
    capabilities: ["brand briefing and concept workflow", "SVG construction and visual tests", "logo presentation and export tools"],
    safety: [
      "The upstream states the SVG logo library contains marks owned by their respective owners and is not covered by MIT.",
      "Similarity tests and source research do not establish trademark clearance; SONARA marks require original design and separate review.",
      "Any downstream skill or tool execution must be inspected for dependencies, filesystem access, generated file scope and test coverage."
    ],
    blockedUses: ["copying or tracing library marks", "treating MIT on skill code as a license for logo assets or brand names"],
    nextStep: "Use only general process concepts to guide original SONARA design work; keep all examples and outputs newly authored and review trademark clearance independently.",
    sourceEvidence: [
      "https://github.com/kaankiziltug/logo-design-skill",
      "https://github.com/kaankiziltug/logo-design-skill/blob/main/LICENSE",
      "https://github.com/kaankiziltug/logo-design-skill/blob/main/TRADEMARKS.md",
      "https://github.com/kaankiziltug/logo-design-skill/blob/main/skills/logo-design/SKILL.md"
    ]
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "ecommerce_visual_mockup_antixor",
    label: "Antixor ecommerce storefront mockup",
    status: "visual_reference_only",
    observedTheme: "Product discovery, category navigation, product cards, offers, brand proof, customer reviews and trust/service information.",
    reason: "The screenshot is a branded design mockup, not a verified SONARA source or a tested storefront. Sample reviews, offers, prices and trust claims are illustrative.",
    nextStep: "Use only the information architecture concepts; map each action to the existing commerce routes and verified catalog data, with no fabricated prices, availability, testimonials or badges."
  },
  {
    key: "digital_product_build_test_workflow",
    label: "Digital-product problem-to-release workflow",
    status: "process_reference_only",
    observedTheme: "Find a real problem, define user and product, build a first artifact, iterate, test edge cases, share/export and consider monetization.",
    reason: "The poster is generic guidance and its product/calculator visuals do not establish formula correctness or deployment readiness.",
    nextStep: "Use the stage gates as a product workflow. Formula processing remains paused until the owner explicitly instructs it."
  },
  {
    key: "agentic_framework_star_shortlist",
    label: "Agentic AI framework shortlist infographic",
    status: "unverified_comparative_lead",
    observedTheme: "The screenshot lists LangGraph, OpenAI Agents Python, Google ADK, Pydantic AI, Semantic Kernel, smolagents, AgentScope, Mastra, Browser Use, mem0, Letta, SWE-agent, OpenHands, MCP servers and CAMEL, with approximate star counts.",
    reason: "The names and star counts are a discovery shortlist only; no versions, exact licenses, security posture, overlap analysis or benchmark was provided for the group. Counts are volatile and not evidence of fit.",
    nextStep: "Keep SONARA's current agent authority, provider, workflow and pnpm contracts in place. Review an individual upstream only against a measured capability gap."
  },
  {
    key: "n8n_content_creation_automation",
    label: "n8n multi-agent content and video automation diagrams",
    status: "workflow_pattern_reference",
    observedTheme: "The screenshots show brand/product research, asset or clip selection, sequence editing, graphics, text, sound and video assembly, plus Google Drive, Gmail and social publishing nodes.",
    reason: "The pictured flows do not show tenant scopes, rights records, retry/idempotency rules, approval states or provider terms, and do not establish that a flow is safe to activate.",
    nextStep: "Map the useful steps to Creator Studio's existing media project graph. Keep outbound email/posts behind explicit approval and per-provider credentials; isolate media processing and record rights/provenance."
  },
  {
    key: "n8n_real_estate_lead_and_email_automation",
    label: "n8n real-estate lead intake and Gmail triage diagrams",
    status: "workflow_pattern_reference",
    observedTheme: "The screenshots show lead/contact/calendar tasks and classification of incoming email into customer-support, finance/billing, high-priority and promotion queues with generated replies.",
    reason: "Classification errors and generated replies can affect customers; diagrams omit data retention, authorization, deduplication, escalation and approval rules.",
    nextStep: "Use deterministic routing for explicit known labels where possible, preserve original messages and evidence, tenant-scope connectors, make queue state auditable, and require human approval before sending, booking or contacting leads."
  },
  {
    key: "agent_manager_dashboard_mockup",
    label: "AI agent management dashboard mockup",
    status: "visual_reference_only",
    observedTheme: "An operations view with agent activity, pending approval, spend, hours-saved estimates, pacing, guardrails and decision history.",
    reason: "All screenshot counts, dollar values, hours-saved claims and guardrail outcomes are illustrative and have no evidence source.",
    nextStep: "Model a SONARA dashboard around auditable action events, approval status, budget caps, source timestamps and measured completion; show unavailable metrics as unavailable rather than inventing values."
  },
  {
    key: "backend_api_and_server_type_infographics",
    label: "Backend API and server-type infographics",
    status: "conceptual_reference_only",
    observedTheme: "The posters explain request/server/database/response, CRUD endpoints, status codes and common server roles such as web, database, cache, mail, DNS, proxy, load balancing and CI/CD.",
    reason: "Illustrative Express/MongoDB/PostgreSQL snippets omit production authentication, authorization, tenant isolation, validation, migration authority, observability and error contracts.",
    nextStep: "Map the concepts to existing SONARA route, Supabase/RLS, storage, worker and CI contracts. Do not use the poster as a schema, endpoint, server inventory or database migration specification."
  },
  {
    key: "video_streaming_api_infographic",
    label: "Video streaming REST API infographic",
    status: "conceptual_reference_only",
    observedTheme: "The diagram covers upload metadata, video listing, authentication, likes, pagination and HTTP range streaming.",
    reason: "The demo Node/Express/Mongo example is not a reviewed secure architecture and does not establish media ownership, signed access, retention, quotas or cross-tenant safety.",
    nextStep: "Use SONARA's existing storage and media contracts. Any future video route needs tenant authorization, bounded upload validation, signed read access, range-request tests, quota/retention behavior and provenance."
  },
  {
    key: "git_github_vercel_deploy_infographic",
    label: "GitHub to Vercel deployment infographic",
    status: "deployment_process_reference",
    observedTheme: "The graphic teaches local Git changes, remote repository, Vercel import, framework settings and deployed URL.",
    reason: "The simplified direct push-to-main path omits SONARA's protected branches, latest-base synchronization, exact-head CI, deployment verification, rollback and production authorization.",
    nextStep: "Keep the controlled sequence: latest repository base, isolated branch, reviewed PR, exact-head blocking checks, intentional merge, controlled deploy, verify live commit and rollback readiness."
  },
  {
    key: "docker_basics_infographic",
    label: "Docker basics infographic",
    status: "education_reference_only",
    observedTheme: "Container images, Dockerfile, port mapping, logs, shell access, restart and registry workflow.",
    reason: "Commands are environment-specific; broad cleanup commands such as docker system prune can delete stopped containers, unused networks/images and build cache, and volumes when requested.",
    nextStep: "Use the repo's pinned container files and existing infrastructure preflight. Do not execute copied commands or destructive cleanup from this poster."
  },
  {
    key: "commerce_and_logistics_ia_mockups",
    label: "Commerce and logistics information-architecture mockups",
    status: "visual_reference_only",
    observedTheme: "Commerce separates home, categories, search, wishlist, account, cart and staged checkout; logistics organizes services, tracking, proof and contact calls to action.",
    reason: "The mockups contain synthetic names, metrics, reviews and operational claims; the diagrams are not requirements or proof of available services.",
    nextStep: "Map desired customer tasks to existing product route inventories and verified data. Each CTA must reach a working route or be removed; use no invented service, testimonial or performance metrics."
  },
  {
    key: "engineering_skills_and_reverse_skill_shortlist",
    label: "Engineering skills, reverse-skill and AI-skills site screenshots",
    status: "unresolved_repository_and_service_lead",
    observedTheme: "The screenshots show repository folders such as .agents, .claude, skills, security tooling, reverse-skill and an AI-skills directory, but the exact repositories and hosted-service owners are not legible.",
    reason: "No exact source, license, version, dependency or service terms can be attributed safely from the cropped cards.",
    nextStep: "Keep unresolved until an exact URL is supplied or source-matched. Do not install a skill bundle, security tool or browser extension based on these images."
  },
  {
    key: "browser_use_video_editing_reel",
    label: "Browser Use video-editing reel",
    status: "unresolved_project_scope",
    observedTheme: "A cropped GitHub page shows browser-use branding beside a creator describing video editing with coding agents.",
    reason: "The visible title/path does not establish the exact repository or whether the reel describes browser-use itself, a fork, or an adjacent editing project. Related Browser Use records do not verify this specific screen.",
    nextStep: "Keep unresolved; do not treat browser automation as video-editing capability or grant a browser worker media/file access from this screenshot."
  },
  {
    key: "wolfcut_video_editor_owner_resolution",
    label: "WolfCut open-source video editor screenshot",
    status: "repository_owner_unresolved",
    observedTheme: "The image identifies a desktop CapCut alternative called WolfCut. Several similarly named repositories and forks exist; current candidates include mtcto/wolfcut and a repository reference to jub0t/WolfCut.",
    reason: "The screenshot does not expose the owner or URL, so the candidate source cannot be matched conclusively. Project alpha status and model/FFmpeg dependencies would also need a fresh review.",
    nextStep: "Do not add a repository record or install it until the exact screenshot source is identified; retain as a Creator Studio editing workflow lead only."
  },
  {
    key: "revenue_claims_and_reverse_engineered_prompt_screenshots",
    label: "AI revenue and reverse-engineered prompt promotional screenshots",
    status: "claim_and_rights_warning",
    observedTheme: "The collage promotes repositories that allegedly earn money with AI and a prompt library described as reverse-engineered or stolen.",
    reason: "Social engagement and earnings language do not substantiate commercial outcomes; reverse-engineered proprietary prompts, marks or assets are not an acceptable source for SONARA content.",
    nextStep: "Use no earnings claim without SONARA evidence, and do not import stolen, scraped or reverse-engineered proprietary prompt content."
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  { key: "paperless_ngx_existing", label: "Paperless-ngx", repository: "paperless-ngx/paperless-ngx", source: "Maintained data/open-source-tools.ts registry", note: "The collage's document archive screenshot repeats the governed GPL-3.0 document-management reference. Keep personal documents tenant-scoped and do not import code without a copyleft review." },
  { key: "remotion_existing", label: "Remotion", repository: "remotion-dev/remotion", source: "Maintained data/open-source-tools.ts registry", note: "The current custom Remotion License includes an organization-size threshold; check the existing formal record before use. It is not blanket MIT/open-source permission." },
  { key: "openvid_existing", label: "OpenVid", repository: "CristianOlivera1/openvid", source: "Maintained data/open-source-tools.ts registry", note: "The collage repeats the in-browser screen-recording/product-demo editor. The upstream README describes local IndexedDB recording, FFmpeg.wasm and Supabase cloud backups as coming soon; these claims do not imply SONARA adoption or production readiness." },
  { key: "archify_existing", label: "Archify", repository: "tt-a1i/archify", source: "Batch 3 and maintained formal registry", note: "The codebase-diagram promotion repeats the existing development-only, source-grounded architecture skill candidate." },
  { key: "openmontage_existing", label: "OpenMontage", repository: "calesthio/OpenMontage", source: "Maintained data/open-source-tools.ts registry", note: "The video-production automation screenshot repeats the existing AGPL-3.0 media project record; code is not copied and publishing remains approval-gated." },
  { key: "window_sweaters_existing", label: "Window Sweaters", repository: "saragordic/window-sweaters", source: "Batch 19 screenshot radar", note: "Duplicate macOS personalization screenshot; GPL-3.0 and no hosted product adoption." },
  { key: "god_eye_existing", label: "God's Eye View", repository: "bilawalsidhu/gods-eye-view", source: "Batch 19 screenshot radar", note: "Duplicate screenshot; preserve existing public-data provenance and anti-surveillance boundaries." },
  { key: "reactive_resume_existing", label: "Reactive Resume", repository: "reactive-resume/reactive-resume", source: "Batch 19 screenshot radar", note: "Duplicate résumé template gallery; existing tenant privacy and user-owned document controls remain authoritative." }
];

const ARCHITECTURE_EXTENSIONS = [
  {
    key: "governed_product_build_lifecycle",
    title: "Digital product build, test and release lifecycle",
    product: "SONARA One",
    principle: "A product workflow advances through explicit evidence-bearing states; each stage has an owner, inputs, exit criteria and a safe stop condition.",
    implementation: "Problem evidence -> user and outcome -> typed product brief -> scoped artifact -> validation plan -> build -> edge-case/accessibility/device checks -> human review -> export or controlled release -> measured iteration. Monetization follows verified entitlement and payment state, not a poster. Formula processing stays disabled until the owner explicitly requests it."
  },
  {
    key: "commerce_route_and_checkout_state_contract",
    title: "Commerce discovery and checkout route contract",
    product: "Business Builder",
    principle: "An information architecture is useful only when every visible action resolves to a route and each route shows real data and recoverable states.",
    implementation: "Map home/category/search/product/saved/account/cart/checkout to existing routes; define loading, empty, error and success states; calculate totals from deterministic server-owned prices and tax rules; revalidate stock and price at checkout; make payment idempotent; never synthesize reviews, discounts, inventory or shipping promises."
  },
  {
    key: "approval_gated_automation_and_delivery",
    title: "Approval-gated automation and delivery",
    product: "Growth Studio",
    principle: "An agent or workflow can draft and classify; it must not silently send messages, publish posts, contact leads or change customer records.",
    implementation: "Use tenant-scoped connectors -> schema-validated input -> deterministic known-label routing -> durable action intent with idempotency key -> preview destination and payload -> owner approval for external effect -> execute once with bounded retry -> persist provider receipt/result -> reconcile or escalate."
  },
  {
    key: "media_project_rights_and_render_pipeline",
    title: "Media production rights and render pipeline",
    product: "Creator Studio",
    principle: "A polished video is a project artifact built from traceable, user-owned inputs; its workflow does not imply rights to footage, people, music, models or brand marks.",
    implementation: "Create a project manifest for asset source, owner/license, consent, transcript, edit decision list, captions, music/voice rights, generation/model version and output provenance; isolate CPU/GPU processing with size/time/resource limits; retain a reviewable timeline and user-controlled export/delete/share states; publish only after explicit approval."
  },
  {
    key: "media_and_streaming_route_contract",
    title: "Media upload and streaming route contract",
    product: "Creator Studio",
    principle: "A video endpoint needs tenant-aware access and media lifecycle controls beyond basic CRUD and range requests.",
    implementation: "Use authenticated tenant-scoped metadata, bounded content-type/size/duration checks, object storage IDs rather than request-process files, signed short-lived reads, byte-range correctness tests, quota and retention enforcement, scan/provenance state, safe retry/idempotency and deletion reconciliation."
  },
  {
    key: "api_server_and_data_authority_mapping",
    title: "API, server and database responsibility map",
    product: "SONARA One",
    principle: "Educational server diagrams explain vocabulary; production data authority comes from the existing route, database, RLS, queue and deployment contracts.",
    implementation: "For each user task document route -> authenticated actor -> tenant scope -> validation -> service/data owner -> durable event -> response/error -> audit/telemetry -> test. Map each workload to an existing server/worker capability before proposing a service; do not add Express/Mongo/Postgres duplication from a poster."
  },
  {
    key: "evidence_backed_agent_operations_dashboard",
    title: "Evidence-backed agent operations dashboard",
    product: "SONARA One",
    principle: "Operations metrics must link to observed events and distinguish measured facts from estimates or unavailable information.",
    implementation: "Show tenant-scoped action ledger, approval queue, spend from provider receipts, budget remaining, failure/retry state and last-updated timestamp; disclose estimate method for time saved; expose guardrail events with source and outcome; never seed example counts, savings or compliance claims as live data."
  },
  {
    key: "deployment_path_and_release_evidence",
    title: "Protected change-to-deployment path",
    product: "Internal Development",
    principle: "A deployment graphic is not release authority; each merged artifact must be tested against the current repository and verified at the deployed commit.",
    implementation: "Fetch latest main -> create isolated branch -> implement -> run focused and required full gates on exact head -> open reviewed PR -> merge intentionally -> deploy through the controlled pipeline -> verify live SHA, auth, tenant/RLS, database, workflows and rollback evidence. Never copy a direct-push-to-main tutorial over branch protections."
  },
  {
    key: "agent_framework_adoption_scorecard",
    title: "Agent-framework adoption scorecard",
    product: "Agent Control Plane",
    principle: "A framework list or star count cannot select SONARA's runtime; adoption must close a measured gap without duplicating controls.",
    implementation: "For one candidate at a time compare exact revision/license/dependencies, tool model, tenant boundaries, persistence/replay, human approval, observability, evaluation, failure isolation, provider independence, migration cost and operating burden against current SONARA contracts. Record reject/hold/adopt evidence; never infer production authority from a benchmark or catalog entry."
  }
];

function freezeRepository(item) {
  return Object.freeze({
    ...item,
    productFit: Object.freeze([...item.productFit]),
    capabilities: Object.freeze([...item.capabilities]),
    safety: Object.freeze([...item.safety]),
    blockedUses: Object.freeze([...item.blockedUses]),
    sourceEvidence: Object.freeze([...item.sourceEvidence]),
    checkedOn: "2026-09-28",
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch20_2026_09_28"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH20 = Object.freeze(REPOSITORIES.map(freezeRepository));
const NON_REPOSITORY_REFERENCES_BATCH20 = Object.freeze(NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
  ...item,
  source: "user_submitted_screenshot_research_batch20_2026_09_28"
})));
const CONFIRMED_EXISTING_RECORDS_BATCH20 = Object.freeze(CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item })));
const ARCHITECTURE_EXTENSIONS_BATCH20 = Object.freeze(ARCHITECTURE_EXTENSIONS.map((item) => Object.freeze({ ...item })));

function getPublicScreenshotToolCatalogBatch20() {
  return SCREENSHOT_TOOL_RADAR_BATCH20.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    sourceEvidence: [...item.sourceEvidence]
  }));
}

function getNonRepositoryReferencesBatch20() {
  return NON_REPOSITORY_REFERENCES_BATCH20.map((item) => ({ ...item }));
}

function getConfirmedExistingRecordsBatch20() {
  return CONFIRMED_EXISTING_RECORDS_BATCH20.map((item) => ({ ...item }));
}

function getArchitectureExtensionsBatch20() {
  return ARCHITECTURE_EXTENSIONS_BATCH20.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch20() {
  const repositories = getPublicScreenshotToolCatalogBatch20();
  return {
    ok: true,
    batch: 20,
    mode: "static_governed_screenshot_research_batch20",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH20.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH20.length,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH20.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch20(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch20(),
    architectureExtensions: getArchitectureExtensionsBatch20()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH20,
  NON_REPOSITORY_REFERENCES_BATCH20,
  CONFIRMED_EXISTING_RECORDS_BATCH20,
  ARCHITECTURE_EXTENSIONS_BATCH20,
  getPublicScreenshotToolCatalogBatch20,
  getNonRepositoryReferencesBatch20,
  getConfirmedExistingRecordsBatch20,
  getArchitectureExtensionsBatch20,
  getScreenshotToolReadinessBatch20
};
