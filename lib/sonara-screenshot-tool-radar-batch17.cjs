// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Batch 17 screenshot intake, 22 September 2026.
//
// The user supplied fifteen screenshots containing repository cards, social-post
// prompts, and engineering memes. This module records only source-grounded
// external repository research. It does not clone, install, authenticate to,
// execute, or enable any third-party project.
//
// A screenshot is a lead, not an adoption decision. Every repository below was
// matched to an authoritative upstream before being marked repositoryVerified.
// Existing earlier SONARA records are confirmed rather than duplicated.

const REPOSITORIES = [
  {
    key: "laya_decision_engine",
    label: "Laya",
    repository: "NandhaKishorM/laya",
    repoUrl: "https://github.com/NandhaKishorM/laya",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "typed_decision_model_research",
    placement: "Isolated Python/model worker benchmark; never an implicit authority layer",
    productFit: ["SONARA One", "Business Builder", "Growth Studio", "Research Lab"],
    integrationStatus: "optional_adapter_after_review",
    capabilities: [
      "typed choice/score/noul decision outputs",
      "non-autoregressive low-latency decision-model research",
      "multilingual routing, moderation and triage research"
    ],
    safety: [
      "Treat latency, calibration and benchmark numbers as upstream claims until reproduced on SONARA workloads.",
      "Model output is advisory and cannot grant financial, security, publication, tenant, deployment or account authority.",
      "Model weights, datasets and hosted endpoints remain separately versioned and rights-reviewed from the Apache-2.0 source."
    ],
    blockedUses: [
      "using a model score as sole authorization for consequential actions",
      "placing a Python/Torch model inside the Vercel request path without a measured requirement",
      "marketing upstream benchmark claims as SONARA production measurements"
    ],
    nextStep: "Build a small offline evaluation set for routing/classification and compare accuracy, calibration, latency and cost against deterministic rules and existing providers before considering an isolated adapter."
  },
  {
    key: "kaneo",
    label: "Kaneo",
    repository: "usekaneo/kaneo",
    repoUrl: "https://github.com/usekaneo/kaneo",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "project_management_reference",
    placement: "Business Builder/project-operations architecture research",
    productFit: ["Business Builder", "Founder Operations", "Internal Development"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "project, task, label and kanban workflow patterns",
      "self-hosted project-management architecture",
      "MCP-facing project/task management patterns"
    ],
    safety: [
      "SONARA organization/tenant records remain authoritative; an external project system cannot widen tenant scope.",
      "MCP operations require the same authorization, schema validation, approval and audit controls as every other tool.",
      "Adopt measured workflow gaps rather than shipping a second overlapping project-management product."
    ],
    blockedUses: [
      "bulk copying product trade dress or customer-facing identity",
      "letting an MCP endpoint bypass SONARA authorization",
      "creating a second project-management source of truth"
    ],
    nextStep: "Gap-map Kaneo's project/task interaction model against Business Builder and implement only missing high-value workflow patterns with SONARA-owned schemas and UI."
  },
  {
    key: "open_interpreter",
    label: "Open Interpreter",
    repository: "openinterpreter/openinterpreter",
    repoUrl: "https://github.com/openinterpreter/openinterpreter",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "developer_agent_reference",
    placement: "Founder/developer workstation or isolated coding/QA sandbox only",
    productFit: ["Internal Development", "Founder Operations", "Research Lab"],
    integrationStatus: "developer_tool_after_review",
    capabilities: [
      "terminal coding-agent workflow",
      "skills, hooks, MCP and AGENTS.md interoperability",
      "sandboxed QA and command execution patterns"
    ],
    safety: [
      "Shell, filesystem, browser and MCP access are delegated authority and must be scoped to a disposable or repository-owned environment.",
      "No coding agent receives protected-branch merge, production deploy, customer-data, provider-secret or billing authority.",
      "Repository AGENTS.md and exact-head CI remain authoritative regardless of the developer client."
    ],
    blockedUses: [
      "unattended production shell execution",
      "credential or secret collection into prompts/logs",
      "bypassing protected branches or exact-head verification"
    ],
    nextStep: "Keep as an optional developer client candidate and validate it only against a disposable branch using the existing SONARA handoff, test and approval contracts."
  },
  {
    key: "builderio_mitosis",
    label: "Mitosis",
    repository: "BuilderIO/mitosis",
    repoUrl: "https://github.com/BuilderIO/mitosis",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "cross_framework_component_compiler_reference",
    placement: "Build-time frontend architecture research only",
    productFit: ["Design System", "Internal Development", "Public Website"],
    integrationStatus: "reference_only",
    capabilities: [
      "single component source compiled to multiple frontend frameworks",
      "design-system portability patterns",
      "build-time component generation"
    ],
    safety: [
      "The current SONARA frontend/runtime contract remains authoritative; do not add a compiler layer without a measured multi-framework need.",
      "Generated output still requires accessibility, browser, performance and visual-regression evidence.",
      "Build-time generation must be deterministic and pinned."
    ],
    blockedUses: [
      "introducing a second component abstraction solely for novelty",
      "treating generated output as accessibility or quality proof"
    ],
    nextStep: "Use as architecture reference while keeping SONARA's present CSS/component authority; reconsider only if multiple maintained client frameworks create measured duplication."
  },
  {
    key: "nanocoder",
    label: "Nanocoder",
    repository: "Nano-Collective/nanocoder",
    repoUrl: "https://github.com/Nano-Collective/nanocoder",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "multi_provider_terminal_coding_agent",
    placement: "Developer workstation only",
    productFit: ["Internal Development", "Founder Operations"],
    integrationStatus: "developer_tool_after_review",
    capabilities: [
      "multi-provider terminal coding agent",
      "skills, subagents, tools, event subscriptions and MCP",
      "checkpointing and local/provider-selectable workflows"
    ],
    safety: [
      "Provider choice changes data exposure; model/API credentials remain local and never enter repository content.",
      "Auto-accept or unrestricted modes are prohibited for protected branches, production infrastructure and customer data.",
      "Use repository-native instructions and deterministic checks so changing coding clients does not change release authority."
    ],
    blockedUses: [
      "unreviewed auto-accept or yolo mode on production",
      "coding-agent possession of production secrets",
      "agent self-approval for merge or deploy"
    ],
    nextStep: "Evaluate as an optional owner workstation client only; compare skill portability and checkpoint behavior against current Codex/Claude workflows without changing release authority."
  },
  {
    key: "tuios",
    label: "TUIOS",
    repository: "Gaurav-Gosain/tuios",
    repoUrl: "https://github.com/Gaurav-Gosain/tuios",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "terminal_workspace_reference",
    placement: "Developer workstation / terminal-operations research",
    productFit: ["Internal Development", "Founder Operations"],
    integrationStatus: "reference_only",
    capabilities: [
      "terminal multiplexer/window-manager workflows",
      "event-driven rendering and workspace organization",
      "modal keyboard and command-palette interaction"
    ],
    safety: [
      "Terminal panes can expose privileged shells and credentials; workspace convenience never grants production authority.",
      "Keep production and staging credentials separated even when shown in one local workspace.",
      "Do not add a Go terminal runtime to the customer web application merely for developer convenience."
    ],
    blockedUses: [
      "customer-facing production terminal exposure",
      "mixing privileged production shells with unrestricted agent access"
    ],
    nextStep: "Use local workspace and event-driven rendering ideas for founder/developer operations; no web-runtime dependency is justified."
  },
  {
    key: "quickemu",
    label: "Quickemu",
    repository: "quickemu-project/quickemu",
    repoUrl: "https://github.com/quickemu-project/quickemu",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "virtual_machine_test_lab",
    placement: "Local release/device compatibility lab",
    productFit: ["Release Engineering", "Internal Development"],
    integrationStatus: "developer_tool_after_review",
    capabilities: [
      "repeatable Windows, macOS, Linux and other VM launch workflows",
      "QEMU configuration automation",
      "cross-platform manual QA environments"
    ],
    safety: [
      "Downloaded operating-system images keep their own licences and redistribution rules.",
      "VM automation does not replace real-device/browser coverage or CI.",
      "Use disposable test credentials and isolated networking for risky compatibility/security tests."
    ],
    blockedUses: [
      "redistributing unlicensed operating-system images",
      "treating one VM run as production compatibility proof"
    ],
    nextStep: "Consider for owner-side compatibility testing where current browser/device CI has a measured gap; pin images/configurations and record reproducible QA evidence."
  },
  {
    key: "ponytail",
    label: "Ponytail",
    repository: "DietrichGebert/ponytail",
    repoUrl: "https://github.com/DietrichGebert/ponytail",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "developer_minimalism_skill_reference",
    placement: "Repository-owned coding-quality strategy, adapted rather than blindly installed",
    productFit: ["Internal Development", "Agent Control Plane"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "YAGNI-first implementation ladder",
      "reuse-before-rewrite coding discipline",
      "agent skill portability across coding clients"
    ],
    safety: [
      "Minimal code never removes trust-boundary validation, accessibility, data-loss handling, tests, auditability or security controls.",
      "Upstream benchmark reductions are not SONARA measurements until reproduced.",
      "Repository-owned rules must remain understandable and reviewable without an external plugin."
    ],
    blockedUses: [
      "deleting necessary validation or safety controls in pursuit of fewer lines",
      "installing lifecycle hooks without review",
      "citing upstream benchmark percentages as SONARA results"
    ],
    nextStep: "Implement a SONARA-owned minimal-change ladder in the agent strategy catalog and require existing security/accessibility/release gates to remain intact."
  },
  {
    key: "oneterm",
    label: "OneTerm",
    repository: "veops/oneterm",
    repoUrl: "https://github.com/veops/oneterm",
    repositoryVerified: true,
    license: "AGPL-3.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "bastion_host_architecture_reference",
    placement: "Infrastructure access-control research only",
    productFit: ["Internal Security", "Founder Operations", "Research Lab"],
    integrationStatus: "reference_only_license_gated",
    capabilities: [
      "authentication/authorization/account/audit bastion-host patterns",
      "controlled SSH/RDP/VNC infrastructure access",
      "session and access audit concepts"
    ],
    safety: [
      "AGPL network-use obligations require explicit legal/architecture review before any hosted derivative.",
      "Production access needs least privilege, short-lived credentials, MFA, immutable audit and break-glass controls.",
      "Do not expose a general terminal/bastion capability to customer agents."
    ],
    blockedUses: [
      "copying AGPL implementation into proprietary hosted SONARA services",
      "general customer or agent access to production infrastructure shells"
    ],
    nextStep: "Use the 4A access-control model as architecture research; keep actual SONARA infrastructure access behind current provider/IAM controls."
  },
  {
    key: "windrecorder",
    label: "Windrecorder",
    repository: "yuka-friends/Windrecorder",
    repoUrl: "https://github.com/yuka-friends/Windrecorder",
    repositoryVerified: true,
    license: "GPL-2.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "local_screen_memory_reference",
    placement: "Privacy-sensitive local memory/capture research only",
    productFit: ["Founder Operations", "Research Lab"],
    integrationStatus: "research_only_privacy_gated",
    capabilities: [
      "local screen history and rewind",
      "OCR/image-description retrieval",
      "activity statistics and memory-search UX"
    ],
    safety: [
      "Screen capture can contain passwords, private messages, health/financial data and customer records; silent capture is prohibited.",
      "Any future capture feature requires explicit opt-in, local-first processing, pause/exclusion controls, retention/deletion controls and redaction.",
      "GPL source remains outside proprietary runtime unless an explicit licence architecture permits otherwise."
    ],
    blockedUses: [
      "employee surveillance or covert capture",
      "automatic upload of raw screens",
      "cross-tenant or unrelated personal-data indexing",
      "copying GPL implementation into proprietary product paths"
    ],
    nextStep: "Adopt only privacy principles and local-first indexing ideas; do not ship continuous screen recording without a separately reviewed user-consent product requirement."
  },
  {
    key: "titanium_browser_android",
    label: "Titanium Browser for Android",
    repository: "jqssun/android-titanium-browser",
    repoUrl: "https://github.com/jqssun/android-titanium-browser",
    repositoryVerified: true,
    license: "GPL-2.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "android_browser_reference",
    placement: "Android/browser interoperability and security research only",
    productFit: ["Android Client Research", "Internal Security"],
    integrationStatus: "reference_only_license_gated",
    capabilities: [
      "Chromium/Vanadium-derived Android browser architecture",
      "extension-capable mobile browsing",
      "mobile browser privacy/security patterns"
    ],
    safety: [
      "Browser forks create a large patch/security-maintenance burden and must not become a SONARA launch dependency without a dedicated team.",
      "GPL obligations and Chromium/Vanadium downstream notices require path-level review.",
      "Do not weaken browser security to enable automation or extensions."
    ],
    blockedUses: [
      "shipping a browser fork as an incidental application feature",
      "weakening sandbox, TLS or site-isolation protections",
      "copying GPL browser code into proprietary app paths"
    ],
    nextStep: "Keep as Android/browser security reference; prefer supported system browser/custom-tab/TWA pathways for SONARA unless a measured requirement proves otherwise."
  },
  {
    key: "audiobookshelf_mobile",
    label: "Audiobookshelf Mobile App",
    repository: "advplyr/audiobookshelf-app",
    repoUrl: "https://github.com/advplyr/audiobookshelf-app",
    repositoryVerified: true,
    license: "GPL-3.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "mobile_media_app_reference",
    placement: "Creator Studio/media mobile UX research only",
    productFit: ["Creator Studio", "Android Client Research"],
    integrationStatus: "reference_only_license_gated",
    capabilities: [
      "cross-platform Nuxt/Capacitor mobile media application",
      "self-hosted audiobook/podcast client workflows",
      "offline/mobile media-library interaction patterns"
    ],
    safety: [
      "GPL source is not copied into proprietary SONARA clients without an explicit licence decision.",
      "Media-library rights, offline storage, downloads and playback remain separate product/legal requirements.",
      "A reference app does not establish streaming/licensing rights for content."
    ],
    blockedUses: [
      "copying GPL UI/application code into proprietary clients",
      "assuming media playback software grants content distribution rights"
    ],
    nextStep: "Use mobile media-navigation/offline-state patterns as UX research for Creator Studio; implement any needed behavior with SONARA-owned code and rights controls."
  },
  {
    key: "storefront_ui",
    label: "Storefront UI",
    repository: "vuestorefront/storefront-ui",
    repoUrl: "https://github.com/vuestorefront/storefront-ui",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "ecommerce_design_system_reference",
    placement: "Business Builder/ecommerce UI research; current stack fit must be measured first",
    productFit: ["Business Builder", "Design System", "Public Website"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "accessible ecommerce component patterns",
      "product-card, quantity, filtering and checkout UI patterns",
      "tokenized Tailwind/React/Vue design-system architecture"
    ],
    safety: [
      "SONARA design tokens and accessibility requirements remain authoritative.",
      "Do not add React/Vue/Tailwind runtime weight solely to obtain visual components if current web primitives can implement the same behavior.",
      "Checkout UI never substitutes for Stripe/payment-state authority."
    ],
    blockedUses: [
      "wholesale visual copying or trade-dress imitation",
      "introducing a framework migration without measured value",
      "treating UI state as payment truth"
    ],
    nextStep: "Extract ecommerce interaction requirements into SONARA's DESIGN.md and Business Builder backlog; adopt a package only if a current client stack and bundle/accessibility benchmark justify it."
  },
  {
    key: "matrixone",
    label: "MatrixOne",
    repository: "matrixorigin/matrixone",
    repoUrl: "https://github.com/matrixorigin/matrixone",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "database_architecture_reference",
    placement: "Data/versioning research; Supabase/PostgreSQL remains production authority",
    productFit: ["SONARA One", "Research Lab", "Internal Development"],
    integrationStatus: "research_only",
    capabilities: [
      "HTAP database architecture",
      "Git-style data snapshots/branch/merge/rollback concepts",
      "vector and full-text search architecture"
    ],
    safety: [
      "Do not create a second production database authority without a measured workload, ADR, migration plan and operational proof.",
      "Tenant isolation/RLS, backup, PITR and migration authority remain in the current Postgres/Supabase system.",
      "Database benchmarks and compatibility claims must be reproduced on SONARA workloads."
    ],
    blockedUses: [
      "replacing Supabase/PostgreSQL from screenshot research alone",
      "dual-write architecture without reconciliation and rollback proof"
    ],
    nextStep: "Clean-room adopt useful data-versioning ideas into existing migration/memory workflows; evaluate the database itself only if a workload proves Postgres insufficient."
  },
  {
    key: "matrixone_memoria",
    label: "Memoria",
    repository: "matrixorigin/Memoria",
    repoUrl: "https://github.com/matrixorigin/Memoria",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "agent_memory_architecture_reference",
    placement: "Agent-memory governance research; existing SONARA memory control plane remains authoritative",
    productFit: ["SONARA One", "Agent Control Plane", "Research Lab"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "snapshot/branch/merge/rollback concepts for memory",
      "memory provenance and mutation audit trails",
      "semantic plus full-text retrieval and contradiction quarantine"
    ],
    safety: [
      "No cross-tenant memory and no silent collection of sensitive personal data or credentials.",
      "Remembered context remains editable/removable and cannot authorize consequential actions.",
      "Do not introduce MatrixOne as a second database solely to obtain memory features."
    ],
    blockedUses: [
      "cross-tenant retrieval",
      "credential/secret memory",
      "memory records overriding authoritative business data",
      "unreviewed install scripts"
    ],
    nextStep: "Implement repository-owned memory version/provenance/rollback semantics on the existing memory control plane before considering any external runtime."
  },
  {
    key: "navi",
    label: "navi",
    repository: "denisidoro/navi",
    repoUrl: "https://github.com/denisidoro/navi",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "terminal_runbook_reference",
    placement: "Founder/developer terminal documentation",
    productFit: ["Internal Development", "Founder Operations"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "interactive command-line cheatsheets",
      "argument suggestions and shell-widget workflows",
      "shareable terminal runbooks"
    ],
    safety: [
      "A discoverable command is not permission to run it; destructive, production, credential and data-mutation commands require explicit review.",
      "Repository-owned runbooks must pin environment assumptions and identify read-only versus mutating operations.",
      "Do not auto-import community cheatsheet repositories into trusted command execution."
    ],
    blockedUses: [
      "one-key execution of destructive production commands",
      "auto-downloading arbitrary command packs into a trusted environment"
    ],
    nextStep: "Convert SONARA's approved terminal procedures into repository-owned, reviewable runbooks/commands; optional navi use can remain a developer convenience."
  },
  {
    key: "excalidraw",
    label: "Excalidraw",
    repository: "excalidraw/excalidraw",
    repoUrl: "https://github.com/excalidraw/excalidraw",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "collaborative_whiteboard_reference",
    placement: "Creator Studio/Business Builder diagram and whiteboard research",
    productFit: ["Creator Studio", "Business Builder", "Design System"],
    integrationStatus: "optional_adapter_after_review",
    capabilities: [
      "infinite-canvas diagramming and wireframes",
      "exportable drawings",
      "collaborative whiteboard interaction patterns"
    ],
    safety: [
      "Customer drawings inherit tenant, sharing, retention and export controls.",
      "Do not expose collaboration or external persistence until identity, authorization and data lifecycle are verified.",
      "SONARA visual identity remains independent of Excalidraw's trade dress."
    ],
    blockedUses: [
      "cross-tenant collaborative documents",
      "public sharing enabled by default",
      "copying product identity instead of integrating a bounded capability"
    ],
    nextStep: "Evaluate the package only if diagramming becomes a measured Creator/Business Builder requirement; otherwise retain interaction/export patterns as design research."
  },
  {
    key: "autoskills",
    label: "AutoSkills",
    repository: "midudev/autoskills",
    repoUrl: "https://github.com/midudev/autoskills",
    repositoryVerified: true,
    license: "CC BY-NC 4.0",
    licenseRisk: "critical",
    reciprocalLicense: false,
    runtimeClass: "skill_supply_chain_research",
    placement: "Research only; clean-room security/supply-chain pattern extraction",
    productFit: ["Agent Control Plane", "Internal Development", "Research Lab"],
    integrationStatus: "blocked_commercial_source",
    capabilities: [
      "technology detection and skill selection",
      "curated skill registry",
      "hash verification and skills lockfile pattern"
    ],
    safety: [
      "The upstream licence is noncommercial, so source/content is not incorporated into commercial SONARA.",
      "The useful security idea is architectural: curated allowlist, local detection, manifest hashes, dry run and lock records.",
      "Skills remain instruction context and never grant tool/provider/account permissions."
    ],
    blockedUses: [
      "copying or adapting CC BY-NC source/content into commercial SONARA",
      "live installation from random skill repositories",
      "skills that silently widen shell/network/account authority"
    ],
    nextStep: "Implement an original SONARA skill-manifest/hash/lock design from requirements, without copying AutoSkills source or bundled skill content."
  },
  {
    key: "official_design_md",
    label: "Official DESIGN.md",
    repository: "VoltAgent/official-design-md",
    repoUrl: "https://github.com/VoltAgent/official-design-md",
    repositoryVerified: true,
    license: "MIT index; linked third-party DESIGN.md files keep their own rights",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "design_documentation_standard_reference",
    placement: "Repository-root design authority",
    productFit: ["Design System", "Public Website", "All Product Apps", "Internal Development"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "agent-readable design authority concept",
      "first-party DESIGN.md discovery/index pattern",
      "separation of build instructions from visual/interaction instructions"
    ],
    safety: [
      "Do not copy third-party DESIGN.md files or trade dress; write SONARA's own first-party document from existing design authority.",
      "DESIGN.md summarizes design intent but does not override accessibility, runtime CSS tokens, tested components or brand/legal rules.",
      "Visual claims must match shipped UI."
    ],
    blockedUses: [
      "copying another company's DESIGN.md as SONARA identity",
      "letting a markdown file silently override canonical runtime tokens"
    ],
    nextStep: "Create a first-party root DESIGN.md that points to SONARA's canonical CSS/brand sources and gives agents explicit layout, type, spacing, motion and polish rules."
  },
  {
    key: "ai_cfo_agent",
    label: "AI CFO Agent",
    repository: "daniel-st3/ai-cfo-agent",
    repoUrl: "https://github.com/daniel-st3/ai-cfo-agent",
    repositoryVerified: true,
    license: "MIT (upstream README declaration; repository has no root LICENSE file in this verification pass)",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "financial_intelligence_reference",
    placement: "Business Builder deterministic finance analytics research",
    productFit: ["Business Builder", "Founder Operations", "Research Lab"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "KPI and runway dashboard patterns",
      "rules-first financial decision-support pattern",
      "scenario and Monte Carlo analysis concepts",
      "board snapshot/report workflow"
    ],
    safety: [
      "Financial outputs are decision support, not accounting, tax, investment or legal advice.",
      "Deterministic formulas and source data lineage must be visible before model-generated narrative.",
      "No autonomous movement of money, trading, credit decisions, payroll changes or accounting entries from a research pattern.",
      "Upstream cost and performance claims are not SONARA measurements."
    ],
    blockedUses: [
      "autonomous financial transactions or securities trading",
      "model-generated numbers without deterministic reconciliation",
      "presenting estimated scores as audited financial statements",
      "repeating upstream cost claims as SONARA production economics"
    ],
    nextStep: "Add repository-owned deterministic cash/runway/growth/margin formulas with explicit null/error states; later benchmark scenario simulation against reconciled sample data before any customer-facing release."
  },
  {
    key: "openwrt",
    label: "OpenWrt",
    repository: "openwrt/openwrt",
    repoUrl: "https://github.com/openwrt/openwrt",
    repositoryVerified: true,
    license: "GPL-2.0-only core; package/component licences vary",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "network_os_reference",
    placement: "Network/edge infrastructure research only",
    productFit: ["Internal Security", "Device Runtime Research", "Research Lab"],
    integrationStatus: "reference_only_license_gated",
    capabilities: [
      "embedded Linux/network appliance architecture",
      "package/configuration management patterns",
      "router/network security operations"
    ],
    safety: [
      "Do not make a router firmware distribution part of SONARA's launch scope.",
      "Every package/component can have its own licence and security lifecycle.",
      "Network configuration changes are consequential and require explicit operator authorization and rollback."
    ],
    blockedUses: [
      "automatic customer router reconfiguration",
      "bundling firmware/packages without component-level rights review",
      "copying GPL implementation into proprietary hosted code"
    ],
    nextStep: "Retain network configuration, rollback and package-governance ideas for future edge/device research; no runtime integration is justified now."
  },
  {
    key: "blockads_android",
    label: "BlockAds Android",
    repository: "pass-with-high-score/blockads-android",
    repoUrl: "https://github.com/pass-with-high-score/blockads-android",
    repositoryVerified: true,
    license: "GPL-3.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "android_network_privacy_reference",
    placement: "Android/privacy/security research only",
    productFit: ["Android Client Research", "Internal Security"],
    integrationStatus: "research_only_security_gated",
    capabilities: [
      "local VPN/DNS filtering architecture",
      "per-app network filtering and local-first privacy patterns",
      "scheduled filter-list update and settings backup patterns"
    ],
    safety: [
      "VPN, DNS interception and HTTPS filtering are high-trust capabilities and are outside normal SONARA customer-app scope.",
      "Do not intercept or modify unrelated user traffic.",
      "GPL source remains outside proprietary client paths without a separate licence architecture."
    ],
    blockedUses: [
      "TLS interception or MITM as a hidden product feature",
      "collecting browsing history",
      "copying GPL implementation into proprietary mobile code",
      "network modification without explicit user consent"
    ],
    nextStep: "Retain local-first privacy, per-app scope and update-integrity lessons; do not implement traffic interception as part of the current application."
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  {
    key: "jev_ultrafast_existing_batch16",
    label: "Jev Ultrafast",
    repository: "browser-use/jev-ultrafast",
    registerSource: "Batch 16 screenshot research",
    agrees: true,
    nextStep: "Keep the existing isolated browser-worker benchmark and independent postcondition-verification boundary; no duplicate record."
  },
  {
    key: "munder_difflin_existing_batch16",
    label: "Munder Difflin",
    repository: "chaitanyagiri/munder-difflin",
    registerSource: "Batch 16 screenshot research",
    agrees: true,
    nextStep: "Keep the existing bounded multi-agent engineering record; no duplicate record."
  },
  {
    key: "livecharts2_existing_batch16",
    label: "LiveCharts2",
    repository: "Live-Charts/LiveCharts2",
    registerSource: "Batch 16 screenshot research",
    agrees: true,
    nextStep: "Keep the existing .NET visualization reference; no second runtime is introduced."
  },
  {
    key: "phi_cookbook_existing_batch2",
    label: "Phi Cookbook",
    repository: "microsoft/PhiCookBook",
    registerSource: "Batch 2 screenshot research",
    agrees: true,
    nextStep: "Keep code licensing separate from model-weight/data licensing; no duplicate record."
  },
  {
    key: "wechaty_existing_batch7",
    label: "Wechaty",
    repository: "wechaty/wechaty",
    registerSource: "Batch 7 screenshot research",
    agrees: true,
    nextStep: "Keep messaging automation consent/provider-policy gated; no duplicate record."
  },
  {
    key: "clash_verge_existing_batch6",
    label: "Clash Verge Rev",
    repository: "clash-verge-rev/clash-verge-rev",
    registerSource: "Batch 6 screenshot research",
    agrees: true,
    nextStep: "Keep proxy/network-client research behind reciprocal-licence and security boundaries; no duplicate record."
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "anysearch_screenshot_unresolved",
    label: "AnySearch screenshot",
    status: "repository_identity_unresolved",
    observedTheme: "Search/agent tooling branded AnySearch.",
    reason: "Multiple public projects use the name and the screenshot alone does not prove which repository is authoritative.",
    nextStep: "Keep as a lead only until an exact upstream link is supplied or independently established; do not guess a dependency."
  },
  {
    key: "castor_editor_screenshot_unresolved",
    label: "Castor terminal editor screenshot",
    status: "repository_identity_unresolved",
    observedTheme: "Terminal-native AI text/editor workflow.",
    reason: "The screenshot did not expose a stable upstream path that could be verified without guessing.",
    nextStep: "Retain the terminal/editor interaction idea; verify a specific upstream before licence or adoption decisions."
  },
  {
    key: "mercury_code_screenshot_unresolved",
    label: "Mercury Code screenshot",
    status: "repository_identity_unresolved",
    observedTheme: "Coding-agent or developer-tool release shown as Mercury Code.",
    reason: "Name collision and insufficient repository identity in the screenshot prevent authoritative matching.",
    nextStep: "Preserve as a research lead only; do not install a similarly named repository."
  },
  {
    key: "mercury_cloud_screenshot_unresolved",
    label: "Mercury Cloud screenshot",
    status: "repository_identity_unresolved",
    observedTheme: "Cloud/developer platform public-beta reference.",
    reason: "The screenshot does not establish one authoritative repository and should not be matched by name alone.",
    nextStep: "Keep the product/workflow idea only until an exact source is verified."
  },
  {
    key: "lazycode_screenshot_unresolved",
    label: "LazyCode/LazyCodex screenshot",
    status: "repository_identity_unresolved",
    observedTheme: "Coding assistant for complex codebases with memory/planning/editing/debugging.",
    reason: "The visible name does not establish a unique upstream repository.",
    nextStep: "Retain the product requirements as agent-control-plane research; verify exact source before evaluating code."
  },
  {
    key: "fastnesai_screenshot_unresolved",
    label: "fastnesai screenshot",
    status: "repository_identity_unresolved",
    observedTheme: "Terminal content-generation/AI workflow.",
    reason: "The screenshot text is insufficient to establish an authoritative source repository.",
    nextStep: "Preserve only as a workflow lead."
  },
  {
    key: "i_have_add_screenshot_unresolved",
    label: "i-have-add screenshot",
    status: "repository_identity_unresolved",
    observedTheme: "Productivity skill/tool positioned as preventing AI from burying the answer.",
    reason: "No authoritative repository identity was established from the supplied image.",
    nextStep: "Retain the concise-answer/productivity concept; do not attribute code or licence."
  },
  {
    key: "studio_grade_structure_prompt",
    label: "Studio-grade structure review prompt",
    status: "user_supplied_design_workflow",
    observedTheme: "Premium-site information architecture, intentional sections and layout choices.",
    reason: "This is a design-review method rather than a repository dependency.",
    nextStep: "Encode as original SONARA DESIGN.md and premium-UI review skill."
  },
  {
    key: "typography_upgrade_prompt",
    label: "Typography upgrade prompt",
    status: "user_supplied_design_workflow",
    observedTheme: "Font pairing, hierarchy, scale and amateur-typography detection.",
    reason: "This is a design-review method rather than a repository dependency.",
    nextStep: "Encode typography hierarchy and measurable line-length/scale rules in SONARA design guidance."
  },
  {
    key: "white_space_audit_prompt",
    label: "White-space audit prompt",
    status: "user_supplied_design_workflow",
    observedTheme: "Spacing rhythm, density and premium visual breathing room.",
    reason: "This is a design-review method rather than a repository dependency.",
    nextStep: "Encode spacing rhythm and density checks in the premium-UI review skill."
  },
  {
    key: "micro_interaction_prompt",
    label: "Micro-interaction review prompt",
    status: "user_supplied_design_workflow",
    observedTheme: "Small hover/scroll interactions that add polish without gimmicks.",
    reason: "This is a design-review method rather than a repository dependency.",
    nextStep: "Require purpose, bounded duration, reduced-motion behavior and no interaction that obscures task state."
  },
  {
    key: "portfolio_framer_prompt",
    label: "Portfolio/case-study framing prompt",
    status: "user_supplied_design_workflow",
    observedTheme: "Persuasive project presentation, selective evidence and concise captions.",
    reason: "This is a content/design workflow rather than a repository dependency.",
    nextStep: "Use as an evidence-first case-study template for SONARA product/service proof pages."
  },
  {
    key: "final_polish_prompt",
    label: "Final polish review prompt",
    status: "user_supplied_design_workflow",
    observedTheme: "Pre-launch detection of unfinished visual details and prioritized cleanup.",
    reason: "This is a QA workflow rather than a repository dependency.",
    nextStep: "Run after functional/accessibility correctness, not instead of it."
  },
  {
    key: "dont_push_friday_meme",
    label: "Do not push Friday meme",
    status: "engineering_culture_reference",
    observedTheme: "Avoid risky release timing without support coverage.",
    reason: "Useful lesson is change-risk management, not a literal weekday ban.",
    nextStep: "Base release timing on rollback readiness, observability, staffing and blast radius rather than calendar superstition."
  },
  {
    key: "automation_failure_meme",
    label: "Automation fails halfway meme",
    status: "engineering_culture_reference",
    observedTheme: "Incomplete automation creates hidden manual toil.",
    reason: "Useful lesson is explicit failure/recovery design.",
    nextStep: "Every workflow needs idempotency, retry/backoff, checkpointing, dead-letter/escalation and observable failure states."
  },
  {
    key: "quality_over_hype_meme",
    label: "Quality over hype meme",
    status: "engineering_culture_reference",
    observedTheme: "Prefer demonstrated quality over popularity signals.",
    reason: "Popularity metrics do not prove security, fit, maintenance or business value.",
    nextStep: "Keep repository selection evidence-based: licence, maintenance, security, stack fit, measured gap and reversible adoption."
  }
];

const ARCHITECTURE_EXTENSIONS = [
  {
    key: "typed_fast_decision_lane",
    title: "Typed fast-decision lane",
    product: "SONARA One",
    principle: "Use a constrained choice/score decision surface only where it can be independently evaluated and deterministic rules are insufficient.",
    implementation: "Define allowed labels -> benchmark against deterministic baseline -> calibrate/threshold -> abstain on uncertainty -> verifier/approval for consequential outcomes -> log model/version/evidence."
  },
  {
    key: "curated_skill_supply_chain",
    title: "Curated skill supply chain",
    product: "Agent Control Plane",
    principle: "Agent skills are supply-chain inputs and must be selected, hashed, pinned and reviewable.",
    implementation: "Local stack detection -> approved registry -> static/prompt/security review -> SHA-256 manifest -> dry run -> owner approval -> repository lock record -> drift verification."
  },
  {
    key: "minimal_change_ladder",
    title: "Minimal-change engineering ladder",
    product: "Internal Development",
    principle: "The safest implementation is the smallest change that satisfies the requirement without deleting safety or correctness.",
    implementation: "Need? -> existing code/stdlib/platform? -> existing dependency? -> tiny repository-owned change -> new dependency only after measured gap; never remove security/accessibility/tests for brevity."
  },
  {
    key: "versioned_memory_contract",
    title: "Versioned memory contract",
    product: "SONARA One",
    principle: "Memory mutations need provenance, history, rollback and conflict handling just like code/data changes.",
    implementation: "Tenant-scoped memory proposal -> provenance/confidence -> approval where required -> immutable revision -> retrieval -> contradiction quarantine -> supersede/rollback/delete."
  },
  {
    key: "financial_truth_before_narrative",
    title: "Financial truth before narrative",
    product: "Business Builder",
    principle: "Financial intelligence starts with reconciled deterministic formulas; model narrative may explain but never invent the numbers.",
    implementation: "Source rows -> normalize/classify -> reconcile -> deterministic KPI formula -> data-quality flags -> scenario assumptions -> optional narrative -> human decision."
  },
  {
    key: "design_authority_document",
    title: "Agent-readable design authority",
    product: "Design System",
    principle: "Agents need one concise first-party description of how SONARA should look and behave, while runtime tokens/tests remain canonical.",
    implementation: "Root DESIGN.md references canonical CSS/brand docs, defines hierarchy/spacing/motion/content rules, names anti-patterns, and requires accessibility/performance evidence."
  },
  {
    key: "automation_recovery_contract",
    title: "Automation recovery contract",
    product: "SONARA One",
    principle: "An automation is not complete until failure, retry, resume and escalation behavior are explicit.",
    implementation: "Idempotency key -> checkpoint -> bounded retry/backoff -> dead-letter/escalation -> operator-visible status -> replay safety -> postcondition verification."
  }
];

function freezeRepository(item) {
  return Object.freeze({
    ...item,
    productFit: Object.freeze([...item.productFit]),
    capabilities: Object.freeze([...item.capabilities]),
    safety: Object.freeze([...item.safety]),
    blockedUses: Object.freeze([...item.blockedUses]),
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch17_2026_09_22"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH17 = Object.freeze(REPOSITORIES.map(freezeRepository));
const NON_REPOSITORY_REFERENCES_BATCH17 = Object.freeze(
  NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
    ...item,
    source: "user_submitted_screenshot_research_batch17_2026_09_22"
  }))
);
const CONFIRMED_EXISTING_RECORDS_BATCH17 = Object.freeze(
  CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item }))
);
const ARCHITECTURE_EXTENSIONS_BATCH17 = Object.freeze(
  ARCHITECTURE_EXTENSIONS.map((item) => Object.freeze({ ...item }))
);

function getPublicScreenshotToolCatalogBatch17() {
  return SCREENSHOT_TOOL_RADAR_BATCH17.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses]
  }));
}

function getNonRepositoryReferencesBatch17() {
  return NON_REPOSITORY_REFERENCES_BATCH17.map((item) => ({ ...item }));
}

function getConfirmedExistingRecordsBatch17() {
  return CONFIRMED_EXISTING_RECORDS_BATCH17.map((item) => ({ ...item }));
}

function getArchitectureExtensionsBatch17() {
  return ARCHITECTURE_EXTENSIONS_BATCH17.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch17() {
  const repositories = getPublicScreenshotToolCatalogBatch17();
  return {
    ok: true,
    batch: 17,
    mode: "static_governed_screenshot_research_batch17",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH17.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH17.length,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH17.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch17(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch17(),
    architectureExtensions: getArchitectureExtensionsBatch17()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH17,
  NON_REPOSITORY_REFERENCES_BATCH17,
  CONFIRMED_EXISTING_RECORDS_BATCH17,
  ARCHITECTURE_EXTENSIONS_BATCH17,
  getPublicScreenshotToolCatalogBatch17,
  getNonRepositoryReferencesBatch17,
  getConfirmedExistingRecordsBatch17,
  getArchitectureExtensionsBatch17,
  getScreenshotToolReadinessBatch17
};
