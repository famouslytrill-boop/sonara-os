// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Screenshot intake received 30 September 2026. Screenshots are source leads,
// not adoption, execution, product-claim, or publishing authority.

const REPOSITORIES = [
  {
    key: "paymenter_hosting_billing",
    label: "Paymenter hosting billing platform",
    repository: "Paymenter/Paymenter",
    repoUrl: "https://github.com/Paymenter/Paymenter",
    repositoryVerified: true,
    license: "MIT for repository code; verify dependency, extension, and any separately supplied assets or services before reuse",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "self_hosted_hosting_billing_application",
    placement: "Billing workflow and product-operations reference only; no PHP service, extension, or billing code is imported",
    productFit: ["Business Builder", "Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["self-hosted billing and webshop for hosting businesses", "subscription and invoice management", "extension-based customization"],
    safety: [
      "Upstream README targets hosting companies and requires PHP 8.3+, Composer, a web server, and MariaDB; it is not evidence of fit for SONARA's Stripe-backed product catalog.",
      "Paymenter publishes a security policy that supports versions >=1.5.0; the screenshot's version badge is not a current release or security guarantee.",
      "Billing state must remain provider-authoritative, tenant-scoped, idempotent, reconciled, and free of raw card/CVV storage."
    ],
    blockedUses: ["replacing Stripe or SONARA's canonical billing/entitlement contract from a screenshot", "storing raw payment-card data", "treating a self-hosted billing app as a drop-in adapter"],
    nextStep: "Compare only subscription, invoice, extension, and administrator workflows against SONARA's existing Stripe and entitlement contracts using synthetic records; keep the product dependency-free unless a measured gap is proven.",
    sourceEvidence: [
      "https://github.com/Paymenter/Paymenter",
      "https://github.com/Paymenter/Paymenter/blob/master/LICENSE",
      "https://github.com/Paymenter/Paymenter/blob/master/README.md",
      "https://github.com/Paymenter/Paymenter/blob/master/SECURITY.md",
      "https://github.com/Paymenter/Paymenter/blob/master/composer.json"
    ]
  },
  {
    key: "jspaint_pixel_editor",
    label: "JS Paint browser drawing application",
    repository: "1j01/jspaint",
    repoUrl: "https://github.com/1j01/jspaint",
    repositoryVerified: true,
    license: "MIT for repository code (LICENSE.txt); third-party assets and Microsoft Paint names/trade dress are not granted by that license",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "browser_and_electron_raster_editor",
    placement: "Creator Studio interaction reference only; no editor code, assets, branding, or Electron runtime is imported",
    productFit: ["Creator Studio", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["web-based raster drawing and editing", "touch and zoom interactions", "themes and accessibility features described in upstream README"],
    safety: [
      "The repository is a recreation of Microsoft Paint; the MIT code license does not grant rights to Microsoft names, marks, or distinctive branding.",
      "The package also includes an Electron application path and dependencies; repository-level MIT does not make every nested dependency or user-created asset license identical.",
      "Opening remote image URLs or uploading content would require explicit user intent, safe URL handling, rights/provenance, and a reviewed storage boundary."
    ],
    blockedUses: ["copying Microsoft Paint branding or distinctive trade dress", "loading arbitrary remote URLs or uploading user work without clear consent", "adding the Electron desktop runtime to SONARA's web process"],
    nextStep: "Use only general concepts such as reversible edits, touch-aware canvas controls, and explicit export states; validate an original SONARA editor prototype against current Creator Studio routes and accessibility checks before proposing code reuse.",
    sourceEvidence: [
      "https://github.com/1j01/jspaint",
      "https://github.com/1j01/jspaint/blob/master/LICENSE.txt",
      "https://github.com/1j01/jspaint/blob/master/README.md",
      "https://github.com/1j01/jspaint/blob/master/package.json"
    ]
  },
  {
    key: "ossu_computer_science_curriculum",
    label: "Open Source Society University computer-science curriculum",
    repository: "ossu/computer-science",
    repoUrl: "https://github.com/ossu/computer-science",
    repositoryVerified: true,
    license: "MIT for the repository's own curriculum organization and code; linked courseware, textbooks, videos, and services retain their own terms",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "curated_online_learning_curriculum",
    placement: "Founder/developer learning reference; not a SONARA customer-facing credential or course-content source",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "reference_only",
    capabilities: ["self-directed computer-science course sequence", "curriculum sections from introductory through advanced study and a final project", "community learning reference"],
    safety: [
      "The MIT file covers OSSU repository material, not every externally linked course, book, video, assessment, or credential.",
      "The README describes a self-study curriculum; it is not an accredited degree or a SONARA-issued qualification.",
      "A curriculum's links, enrollment terms, availability, and completion requirements can change independently."
    ],
    blockedUses: ["advertising an OSSU path as an accredited degree", "rehosting third-party course material under the repository MIT license", "claiming verified credentials or outcomes without evidence"],
    nextStep: "Use the curriculum as a personal study map only; if learning resources are ever surfaced in SONARA, link to the provider and preserve its current terms and accessibility requirements.",
    sourceEvidence: [
      "https://github.com/ossu/computer-science",
      "https://github.com/ossu/computer-science/blob/master/LICENSE",
      "https://github.com/ossu/computer-science/blob/master/README.md"
    ]
  },
  {
    key: "awesome_ai_games_directory",
    label: "Awesome AI Games repository directory",
    repository: "AgentsLoop/awesome-opus-5.5-games",
    repoUrl: "https://github.com/AgentsLoop/awesome-opus-5.5-games",
    repositoryVerified: true,
    license: "NONE DECLARED in the repository root at review; listed game repositories and their assets have separate owners and licenses",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "curated_game_repository_and_screenshot_directory",
    placement: "Reference-only game-discovery lead; no catalog ingestion, game code, screenshots, scores, or model attribution is adopted",
    productFit: ["Creator Studio", "Internal Development", "Research Lab"],
    integrationStatus: "reference_only_no_license",
    capabilities: ["directory of claimed AI-created games and links to source repositories", "screenshot-based ranking and categorization described by its README"],
    safety: [
      "The submitted screenshot showed 843 games and 570 source repositories, while the reviewed README showed 872 and 598; repository metadata described 300 games. These counts conflict and are promotional/self-reported, not independently measured.",
      "The README describes screenshot ratings as visual impressions, not runtime playtests or proof of production quality; model attribution is also a repository claim.",
      "No root LICENSE was present in the reviewed repository listing, so its directory text and bundled images are not cleared for copying or redistribution."
    ],
    blockedUses: ["treating repository counts, visual scores, or model attribution as verified quality metrics", "copying its directory text or screenshots without permission", "using the repository as proof of playable or production-ready games"],
    nextStep: "Do not import the directory. If SONARA later evaluates game examples, inspect each linked source repository, its license, actual runnable state, attribution evidence, and an independent playtest separately.",
    sourceEvidence: [
      "https://github.com/AgentsLoop/awesome-opus-5.5-games",
      "https://github.com/AgentsLoop/awesome-opus-5.5-games/blob/main/README.md",
      "https://api.github.com/repos/AgentsLoop/awesome-opus-5.5-games"
    ]
  },
  {
    key: "slowmist_blockchain_security_handbook",
    label: "SlowMist blockchain self-guard handbook",
    repository: "slowmist/Blockchain-dark-forest-selfguard-handbook",
    repoUrl: "https://github.com/slowmist/Blockchain-dark-forest-selfguard-handbook",
    repositoryVerified: true,
    license: "NONE DECLARED in the repository root at review; handbook text, translations, diagrams, and PDFs are not cleared for reuse",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "multilingual_crypto_security_reference",
    placement: "Unlicensed educational reference only; do not redistribute content or present it as SONARA security advice",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "reference_only_no_license",
    capabilities: ["multilingual wallet, signing, phishing, device, privacy, and incident-response guidance described by its README"],
    safety: [
      "Repository metadata and root listing showed no declared license; source visibility is not permission to copy or rehost the handbook.",
      "The README links multilingual Markdown and PDF editions and attributes authorship/translations; rights in contributed text and diagrams must be respected.",
      "Cryptocurrency threats and response instructions age quickly; verify any security decision against current primary vendor guidance and qualified incident responders."
    ],
    blockedUses: ["rehosting or copying unlicensed handbook text, images, or PDFs", "giving wallet, key-management, investment, or incident-response assurances based on an old handbook", "collecting or handling customer private keys or recovery phrases"],
    nextStep: "Keep only the general lesson that users need clear security and recovery education; do not ingest or quote the handbook. Any SONARA security guidance requires fresh, first-party source review and security-owner approval.",
    sourceEvidence: [
      "https://github.com/slowmist/Blockchain-dark-forest-selfguard-handbook",
      "https://github.com/slowmist/Blockchain-dark-forest-selfguard-handbook/blob/main/README.md",
      "https://api.github.com/repos/slowmist/Blockchain-dark-forest-selfguard-handbook"
    ]
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "novapay_finance_dashboard_mockup",
    label: "NovaPay finance dashboard mockup",
    status: "visual_reference_only",
    observedTheme: "Dark finance dashboard with balances, assets, allocation, transactions, spending, cards, charts, and a premium upgrade path.",
    reason: "The balances, transactions, logos, returns, and customer/account data are mockup content; this image does not identify a verified product or live financial feed.",
    nextStep: "Keep financial screens tied to tenant-owned ledger/provider records, reconciliation time, currency, and permission scope. Never seed sample balances or call illustrative allocation a recommendation."
  },
  {
    key: "invoice_generator_mobile_flow",
    label: "Invoice generator mobile flow mockup",
    status: "visual_reference_only",
    observedTheme: "Mobile onboarding, invoice list, customer list, invoice creation, payment status, reports, settings, and PDF actions.",
    reason: "Screen sequence is a design concept and does not demonstrate route wiring, tax correctness, payment settlement, email delivery, or PDF generation.",
    nextStep: "Map invoice creation to the existing business records, permissions, tax/numbering policy, durable document output, provider state, and tested export route before adapting any interaction."
  },
  {
    key: "developer_portfolio_dark_landing_mockup",
    label: "Dark developer portfolio landing-page mockup",
    status: "visual_reference_only",
    observedTheme: "A long-form portfolio page combines a clear hero, biography, skills, project cards, services, testimonials, and contact form.",
    reason: "The portrait, name, contact details, project claims, reviews, and statistics belong to a third-party profile and cannot be reused as SONARA proof or assets.",
    nextStep: "Use only high-level information hierarchy. Every SONARA project card or contact control must describe real work and resolve to a verified route."
  },
  {
    key: "grocery_and_task_mobile_mockups",
    label: "Grocery shopping and personal task mobile mockups",
    status: "visual_reference_only",
    observedTheme: "Two mobile concepts show category/product/cart/delivery states and tasks/projects/calendar/profile states.",
    reason: "The images contain illustrative items, prices, names, counts, schedules, and fulfillment states; they do not prove catalog, inventory, delivery, team, or calendar integrations.",
    nextStep: "Borrow only task grouping and mobile hierarchy. Connect any SONARA action to tenant-owned records, server-validated totals, truthful status, accessible controls, and a tested recovery route."
  },
  {
    key: "npm_vs_pnpm_comparison_infographic",
    label: "npm versus pnpm comparison infographic",
    status: "tooling_reference_only",
    observedTheme: "A side-by-side package-manager comparison emphasizes pnpm's content-addressed store, linking, workspace support, and disk use.",
    reason: "The poster makes broad speed and storage comparisons without a reproducible benchmark, and its claims depend on project shape, cache, platform, and configuration.",
    nextStep: "Keep SONARA's pinned pnpm and lockfile as repository authority. Use official pnpm documentation and repeatable project benchmarks for any future toolchain decision; do not add npm scripts or lockfiles from this poster."
  },
  {
    key: "architecture_firm_portfolio_mockup",
    label: "Architecture and interiors portfolio mockup",
    status: "visual_reference_only",
    observedTheme: "An image-led studio site organizes services, project galleries, featured work, proof, consultation, and contact details.",
    reason: "The brand, project photography, years of experience, completion counts, testimonial, rating, and location are illustrative and not SONARA evidence.",
    nextStep: "Use restrained project storytelling only where SONARA has rights-cleared work and verifiable outcomes; keep customer-facing claims tied to first-party proof."
  },
  {
    key: "bike_delivery_mobile_mockup",
    label: "Bike delivery mobile flow mockup",
    status: "visual_reference_only",
    observedTheme: "Customer flow covers pickup/dropoff, parcel details, service choice, payment, order tracking, courier contact, completion, rating, and profile.",
    reason: "The map, courier, delivery estimates, prices, payment options, discounts, safety claims, and order history are mockup content, not a dispatch integration.",
    nextStep: "If a delivery product is built, model a canonical job lifecycle with consented location, dispatch ownership, ETA source, payment state, proof, cancellation, and outage behavior before rendering live tracking."
  },
  {
    key: "agent_memory_architecture_claims",
    label: "Five-layer agent memory architecture article screenshot",
    status: "unverified_research_claims",
    observedTheme: "The article proposes working, episodic, semantic, procedural, and forgetting layers, and displays token-reduction and latency claims.",
    reason: "The image does not identify a traceable paper or experiment for its numerical claims; named inspirations do not establish their endorsement or validate the proposed architecture.",
    nextStep: "Treat the five-layer sketch as a hypothesis. For SONARA memory, keep source records authoritative, tenant-scoped, attributable, correctable, retention-bounded, and deletable; benchmark any token or latency claim on a reproducible workload."
  },
  {
    key: "claude_business_operator_infographic",
    label: "Claude business-operator feature infographic",
    status: "unverified_product_summary",
    observedTheme: "The graphic groups projects, artifacts, reasoning, code, computer use, skills, connectors, workers, planning, and memory into a proposed business-operator workflow.",
    reason: "No canonical product document, plan/version, configuration, or permission boundary is cited; the image cannot establish that every listed feature is currently available or included.",
    nextStep: "Treat this as an organizing metaphor only. Verify current provider documentation for any Claude capability and preserve SONARA's own connector, scope, approval, execution, and audit contracts."
  },
  {
    key: "antixor_ecommerce_storefront_mockup",
    label: "Antixor ecommerce storefront mockup",
    status: "visual_reference_only",
    observedTheme: "Storefront composition combines search, category discovery, offers, product cards, ratings, trust cues, editorial content, service links, and footer navigation.",
    reason: "Brand names, product images, prices, reviews, stock, delivery, discount, and payment badges are illustrative and do not establish a real merchant or checkout.",
    nextStep: "Use only the page structure as a prompt for route review. Never invent reviews, stock, prices, discounts, payment security, or delivery claims; each action needs real catalog and order state."
  },
  {
    key: "github_git_workflow_cheatsheet",
    label: "Git and GitHub workflow cheatsheet graphic",
    status: "education_reference_only",
    observedTheme: "The chart groups local Git, branches, remotes, pull requests, Actions, repository settings, and deployment commands.",
    reason: "A command poster can omit repository state, current-base synchronization, branch protection, credential context, destructive effects, and exact-head test evidence.",
    nextStep: "Use repository documentation and inspect status before each command. Keep SONARA's latest-main, isolated-branch, reviewed-PR, exact-head-check, intentional-merge, and controlled-deploy sequence authoritative."
  },
  {
    key: "n8n_real_estate_lead_workflow_diagram",
    label: "n8n real-estate lead intake and follow-up workflow diagram",
    status: "workflow_pattern_reference",
    observedTheme: "The diagram appears to connect form/email intake, agent steps, contact records, calendar or email tools, and response branches.",
    reason: "The screenshot does not establish the exact workflow file, live credentials, tenant isolation, consent, idempotency, retry/dead-letter behavior, or provider terms.",
    nextStep: "Do not import or activate the pictured flow. Translate any approved use case into an owned lead/job record, deduplicated event, explicit tenant scope, audit trail, and owner approval before sending or booking."
  },
  {
    key: "attendance_dashboard_mockup",
    label: "HireSense attendance dashboard mockup",
    status: "visual_reference_only",
    observedTheme: "The dashboard combines time-series, attendance status, check-in history, leave tabs, and employee-level notes.",
    reason: "The employee names, late/absent flags, hours, rates, and AI forecast are illustrative; workforce monitoring introduces privacy, accuracy, and policy questions.",
    nextStep: "Do not present inferred attendance risk as fact. Any future workforce screen needs customer authorization, transparent source and correction paths, role-scoped access, retention policy, and human review."
  },
  {
    key: "n8n_gmail_support_triage_workflow_diagram",
    label: "Gmail support and finance triage workflow diagram",
    status: "workflow_pattern_reference",
    observedTheme: "The workflow labels incoming mail into support, billing, priority, and promotion branches and depicts generated replies.",
    reason: "Classification can be wrong and generated replies can disclose information or create commitments; the graphic omits tenant scoping, data retention, duplicate handling, escalation, and approval.",
    nextStep: "Use tenant-authorized read-only intake and deterministic known-label routing first. Preserve source messages and classification confidence; require a human to approve outbound replies, refunds, booking, and account changes."
  },
  {
    key: "agent_management_dashboard_mockup_batch21",
    label: "Agent management dashboard mockup, Batch 21",
    status: "visual_reference_only",
    observedTheme: "The screen presents agent actions, approvals, spend pacing, guardrails, hours saved, and agent activity.",
    reason: "The displayed counts, dollar totals, savings, forecast percentages, and guardrail results are not SONARA telemetry and have no cited measurement method.",
    nextStep: "Extend only from the existing evidence-backed dashboard contract: action events, provider receipts, tenant scope, budget enforcement, approvals, freshness, and measured-versus-estimated labels."
  },
  {
    key: "claude_digital_product_build_flow",
    label: "Digital product problem-to-release workflow poster",
    status: "process_reference_only",
    observedTheme: "The poster sequences problem discovery, product brief, first artifact, iteration, tests, sharing/export, and monetization.",
    reason: "The example calculator and workflow stages are generic guidance; the poster does not validate demand, formulas, legal rights, accessibility, pricing, or release readiness.",
    nextStep: "Use evidence-bearing stages and acceptance criteria. Validate formulas independently, test boundaries and accessibility, and require approval for publication, monetization changes, and customer-impacting execution."
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  {
    key: "aha_3d_batch20_existing",
    label: "AHa-3D Real2Sim",
    repository: "KevinXu02/aha-3d",
    source: "Batch 20 screenshot radar",
    note: "Repeated in the current uploads; keep the existing Apache-2.0/multi-license, identifiable-footage, and isolated GPU-worker review. Do not create a second record."
  },
  {
    key: "frontend_ui_design_agents_batch20_existing",
    label: "Frontend UI Design Agents Collection",
    repository: "mustafakendiguzel/claude-code-ui-agents",
    source: "Batch 20 screenshot radar",
    note: "Repeated in this upload; the existing MIT source record remains a process reference, not evidence of functional routes or accessibility."
  },
  {
    key: "logo_design_skill_batch20_existing",
    label: "Logo Design Skill for Claude and AI Agents",
    repository: "kaankiziltug/logo-design-skill",
    source: "Batch 20 screenshot radar",
    note: "Repeated in this upload; preserve the existing rule that bundled third-party trademark logos are excluded from the skill's MIT grant."
  }
];

const DEDUPLICATED_REFERENCES = [
  {
    key: "claude_business_operator_infographic_repeated",
    label: "Repeated Claude business-operator infographic",
    source: "Repeated twice within the 30 September upload",
    note: "Catalog the pattern once. Its listed provider capabilities remain unverified until checked against current first-party documentation."
  },
  {
    key: "awesome_ai_games_game_frame_repeated",
    label: "Second screenshot frame from Awesome AI Games directory",
    source: "Same repository and game list shown twice in the 30 September upload",
    note: "The game frame is not a separate source record or playtest; preserve the repository-level count and quality limitations."
  }
];

const ARCHITECTURE_EXTENSIONS = [
  {
    key: "ledger_backed_financial_dashboard_contract",
    title: "Ledger-backed finance dashboard contract",
    product: "Business Builder",
    principle: "A financial dashboard is a view over authoritative, reconciled records; the visual style cannot supply missing money state.",
    implementation: "Read tenant-scoped balances and transactions from the canonical ledger/provider adapter; label pending, settled, failed, reversed and reconciled states; show currency, as-of time and source; calculate totals deterministically; keep investment guidance out of operational balances; use synthetic data only in clearly marked demos."
  },
  {
    key: "agent_memory_provenance_and_forgetting_contract",
    title: "Agent memory provenance, correction and forgetting contract",
    product: "SONARA One",
    principle: "Retrieved memory can provide context, but only the authorized source record can provide current truth; users need to inspect, correct, scope, and delete retained context.",
    implementation: "Separate ephemeral request context, attributable event history, approved durable facts, and reviewed procedural guidance; attach source, tenant, owner, timestamp, confidence, retention and sensitivity metadata; let corrections supersede old facts; enforce access checks before retrieval and deletion across derived indexes; never treat model-generated summaries as authority or retain sensitive content by default."
  },
  {
    key: "mobile_workflow_route_and_state_contract",
    title: "Mobile workflow route and state contract",
    product: "Business Builder",
    principle: "A polished phone mockup is useful only when its step sequence maps to real records, permissions, and recoverable states.",
    implementation: "For each mobile flow map screen -> route/action -> actor/tenant scope -> input/output record -> durable status -> error/retry/cancel path; test narrow viewports, large text, keyboard and touch targets; show offline or stale state explicitly; never display fabricated price, tracking, attendance, rating, or completion data."
  },
  {
    key: "email_triage_approval_and_durability_contract",
    title: "Email triage and outbound approval contract",
    product: "Growth Studio",
    principle: "Email classification is fallible and an outbound reply is an external side effect that needs policy, consent, and a durable receipt.",
    implementation: "Use scoped read access and source-message IDs; deduplicate ingestion; preserve raw source separately from derived labels; capture classifier version/confidence; route uncertain or sensitive cases to a human; require preview and approval before send; make delivery idempotent where the provider supports it; record provider receipt, retry ceiling, failure state, reconciliation, retention, and disconnect behavior."
  },
  {
    key: "operator_dashboard_metric_evidence_contract",
    title: "Operator dashboard metric evidence contract",
    product: "SONARA One",
    principle: "Spend, action, forecast, and time-saved figures need explicit measurement provenance and freshness before appearing as product facts.",
    implementation: "For each metric define event source, tenant scope, aggregation window, unit, freshness, denominator, estimate method and missing-data state; enforce budget caps in the execution path, not only in the chart; expose approval and guardrail events from audit records; never seed promotional example totals as live telemetry."
  },
  {
    key: "developer_command_cheatsheet_safety_contract",
    title: "Developer command and deployment reference contract",
    product: "Internal Development",
    principle: "A command graphic is not a safe runbook because it omits current repository state and consequences.",
    implementation: "Before any command, establish repository, branch, dirty files, base SHA, credentials and target; annotate destructive or external effects; prefer the repository's documented pnpm scripts; run checks on exact head; require reviewed PR and controlled deployment; verify live SHA and rollback path."
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
    checkedOn: "2026-09-30",
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch21_2026_09_30"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH21 = Object.freeze(REPOSITORIES.map(freezeRepository));
const NON_REPOSITORY_REFERENCES_BATCH21 = Object.freeze(NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
  ...item,
  source: "user_submitted_screenshot_research_batch21_2026_09_30"
})));
const CONFIRMED_EXISTING_RECORDS_BATCH21 = Object.freeze(CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item })));
const DEDUPLICATED_REFERENCES_BATCH21 = Object.freeze(DEDUPLICATED_REFERENCES.map((item) => Object.freeze({ ...item })));
const ARCHITECTURE_EXTENSIONS_BATCH21 = Object.freeze(ARCHITECTURE_EXTENSIONS.map((item) => Object.freeze({ ...item })));

function getPublicScreenshotToolCatalogBatch21() {
  return SCREENSHOT_TOOL_RADAR_BATCH21.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    sourceEvidence: [...item.sourceEvidence]
  }));
}

function getNonRepositoryReferencesBatch21() {
  return NON_REPOSITORY_REFERENCES_BATCH21.map((item) => ({ ...item }));
}

function getConfirmedExistingRecordsBatch21() {
  return CONFIRMED_EXISTING_RECORDS_BATCH21.map((item) => ({ ...item }));
}

function getDeduplicatedReferencesBatch21() {
  return DEDUPLICATED_REFERENCES_BATCH21.map((item) => ({ ...item }));
}

function getArchitectureExtensionsBatch21() {
  return ARCHITECTURE_EXTENSIONS_BATCH21.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch21() {
  const repositories = getPublicScreenshotToolCatalogBatch21();
  return {
    ok: true,
    batch: 21,
    mode: "static_governed_screenshot_research_batch21",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH21.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH21.length,
    deduplicatedReferenceCount: DEDUPLICATED_REFERENCES_BATCH21.length,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH21.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch21(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch21(),
    deduplicatedReferences: getDeduplicatedReferencesBatch21(),
    architectureExtensions: getArchitectureExtensionsBatch21()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH21,
  NON_REPOSITORY_REFERENCES_BATCH21,
  CONFIRMED_EXISTING_RECORDS_BATCH21,
  DEDUPLICATED_REFERENCES_BATCH21,
  ARCHITECTURE_EXTENSIONS_BATCH21,
  getPublicScreenshotToolCatalogBatch21,
  getNonRepositoryReferencesBatch21,
  getConfirmedExistingRecordsBatch21,
  getDeduplicatedReferencesBatch21,
  getArchitectureExtensionsBatch21,
  getScreenshotToolReadinessBatch21
};
