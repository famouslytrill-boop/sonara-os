// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Screenshot intake received 4 October 2026. The 34 screenshots are research
// evidence only. No repository, hosted service, model endpoint, workflow,
// credential, security scanner, reverse-engineering tool, or third-party asset
// is installed or enabled by this record.

const REPOSITORIES = [
  {
    key: "colbymchenry_codegraph",
    label: "CodeGraph",
    repository: "colbymchenry/codegraph",
    repoUrl: "https://github.com/colbymchenry/codegraph",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "local_code_knowledge_graph_and_change_impact_reference",
    placement: "Internal Development research/benchmark only; it must not become release authority",
    productFit: ["Internal Development", "Engineering Intelligence", "Release Evidence"],
    integrationStatus: "reference_only_benchmark_candidate",
    capabilities: [
      "local code graph indexing and relationship lookup",
      "repository navigation and code-impact hints",
      "agent context reduction through pre-indexed code structure"
    ],
    safety: [
      "A code graph can expose proprietary source, file paths and dependency structure; evaluation must stay on an isolated repository clone with no production secrets.",
      "Impact analysis is advisory. Exact-head tests, security checks and release gates remain authoritative.",
      "Any local index, daemon, telemetry or cache path must be reviewed before repository source is exposed."
    ],
    blockedUses: [
      "skipping required tests because graph analysis predicts low impact",
      "uploading SONARA source or secrets to an unreviewed hosted index",
      "letting graph-derived confidence authorize merge, deployment or migration"
    ],
    nextStep: "Benchmark one isolated clone against SONARA's existing repository-intelligence scripts. Measure lookup accuracy, token/tool-call reduction and false-negative change-impact risk before considering any developer-only adapter.",
    sourceEvidence: [
      "https://github.com/colbymchenry/codegraph",
      "https://github.com/colbymchenry/codegraph/blob/main/README.md",
      "https://github.com/colbymchenry/codegraph/blob/main/LICENSE"
    ]
  },
  {
    key: "alishahryar1_free_claude_code",
    label: "Free Claude Code",
    repository: "Alishahryar1/free-claude-code",
    repoUrl: "https://github.com/Alishahryar1/free-claude-code",
    repositoryVerified: true,
    license: "AGPL-3.0-only",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "multi_harness_model_routing_and_browser_session_reference",
    placement: "Internal Development research only; no production dependency, proxy, credential flow or customer model routing",
    productFit: ["Internal Development", "Agent Control Plane", "Provider Gateway"],
    integrationStatus: "research_only_copyleft_and_provider_review",
    capabilities: [
      "multi-harness routing across coding-agent clients",
      "multi-model and browser-session workflow patterns",
      "terminal, IDE and mobile access patterns"
    ],
    safety: [
      "AGPL obligations are incompatible with casually copying this implementation into SONARA's proprietary runtime.",
      "Provider access, free-tier claims, keys, proxies and account sessions are separate terms-of-service and security boundaries.",
      "Never use this project to bypass payment, provider controls, rate limits, account restrictions or credential protections."
    ],
    blockedUses: [
      "copying AGPL application code into SONARA proprietary production paths",
      "proxying customer credentials through an unreviewed third-party relay",
      "using the project to evade provider billing, quotas, account rules or access controls"
    ],
    nextStep: "Retain only the provider-neutral multi-harness routing idea. Any later implementation must use SONARA-owned adapters, provider-approved authentication, explicit budgets and the existing Provider Gateway.",
    sourceEvidence: [
      "https://github.com/Alishahryar1/free-claude-code",
      "https://github.com/Alishahryar1/free-claude-code/blob/main/README.md",
      "https://github.com/Alishahryar1/free-claude-code/blob/main/LICENSE"
    ]
  },
  {
    key: "nexmoe_vidbee",
    label: "VidBee",
    repository: "nexmoe/VidBee",
    repoUrl: "https://github.com/nexmoe/VidBee",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "local_media_ingest_transcript_and_search_reference",
    placement: "Creator Studio research/reference; no third-party downloader is enabled",
    productFit: ["Creator Studio", "Media Library", "Transcript Workflow"],
    integrationStatus: "reference_only_rights_and_provider_review",
    capabilities: [
      "local media import and searchable transcript workflows",
      "audio/video download adapters for supported services",
      "summarization, translation and question-answering with selectable providers"
    ],
    safety: [
      "Repository code licensing does not grant rights to download, reproduce, transform or republish third-party media.",
      "Site terms, copyright, creator permission, access controls and territorial restrictions remain source-specific.",
      "Raw media and transcripts can contain personal or confidential data and require tenant isolation, retention and deletion controls."
    ],
    blockedUses: [
      "circumventing DRM, access controls or platform restrictions",
      "downloading or republishing media without user rights or authorization",
      "sending private transcripts to an unreviewed model provider"
    ],
    nextStep: "Use the workflow as a Creator Studio benchmark: user-owned/local media -> rights record -> isolated ingest worker -> transcript -> searchable chunks -> optional provider analysis -> export provenance.",
    sourceEvidence: [
      "https://github.com/nexmoe/VidBee",
      "https://github.com/nexmoe/VidBee/blob/main/README.md",
      "https://github.com/nexmoe/VidBee/blob/main/LICENSE"
    ]
  },
  {
    key: "sqlmapproject_sqlmap",
    label: "sqlmap",
    repository: "sqlmapproject/sqlmap",
    repoUrl: "https://github.com/sqlmapproject/sqlmap",
    repositoryVerified: true,
    license: "GPL-2.0-or-later with project clarifications; alternative commercial licence offered upstream",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "authorized_security_testing_reference",
    placement: "Internal Security research only; no production scanner or customer-facing execution path",
    productFit: ["Internal Development", "Security Verification"],
    integrationStatus: "authorized_staging_research_only",
    capabilities: [
      "SQL injection detection and verification",
      "database-security testing on explicitly authorized targets",
      "request and parameter testing workflows"
    ],
    safety: [
      "Use only against systems SONARA owns or has explicit authorization to test, with a target allowlist and bounded test plan.",
      "Upstream licensing includes project-specific derived-work clarifications; do not embed or parse it inside proprietary SONARA without legal/licence review.",
      "High-impact database, filesystem, command-execution, credential or takeover features are outside this intake."
    ],
    blockedUses: [
      "scanning third-party targets without explicit authorization",
      "database takeover, credential extraction, file read/write or operating-system command execution",
      "embedding or parsing sqlmap output in a proprietary product without licence review"
    ],
    nextStep: "Do not install from this intake. If a security team later approves a staging benchmark, restrict it to an owned disposable target and detection-only test cases with audit evidence and cleanup.",
    sourceEvidence: [
      "https://github.com/sqlmapproject/sqlmap",
      "https://github.com/sqlmapproject/sqlmap/blob/master/README.md",
      "https://github.com/sqlmapproject/sqlmap/blob/master/LICENSE"
    ]
  },
  {
    key: "we_promise_sure",
    label: "Sure",
    repository: "we-promise/sure",
    repoUrl: "https://github.com/we-promise/sure",
    repositoryVerified: true,
    license: "AGPL-3.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "personal_finance_product_and_data_model_reference",
    placement: "Business Builder / product-design research only; no financial-account connection or code reuse",
    productFit: ["Business Builder", "Financial Operations", "Product Design"],
    integrationStatus: "research_only_copyleft_financial_data_boundary",
    capabilities: [
      "personal finance workflow and information-architecture reference",
      "financial account, transaction and budget product patterns",
      "self-hostable application architecture reference"
    ],
    safety: [
      "Financial data is sensitive and must not be imported from another product or connected without explicit customer authorization and provider review.",
      "AGPL source stays outside proprietary runtime unless a deliberate licence-compatible architecture is approved.",
      "Screenshots and upstream UX are references, not customer finance records or compliance proof."
    ],
    blockedUses: [
      "copying AGPL application code into proprietary SONARA services",
      "ingesting customer bank credentials or transactions through an unreviewed adapter",
      "making financial advice, credit, investment or compliance claims from product screenshots"
    ],
    nextStep: "Extract only generic ledger, reconciliation and financial-dashboard requirements into SONARA-owned schemas and UI; keep regulated integrations behind provider-specific review.",
    sourceEvidence: [
      "https://github.com/we-promise/sure",
      "https://github.com/we-promise/sure/blob/main/README.md",
      "https://github.com/we-promise/sure/blob/main/LICENSE"
    ]
  },
  {
    key: "tntcrafthim_piik",
    label: "Piik",
    repository: "TNTcraftHIM/Piik",
    repoUrl: "https://github.com/TNTcraftHIM/Piik",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "p2p_screen_sharing_reference",
    placement: "Shared platform / Creator Studio communication research only",
    productFit: ["Creator Studio", "Collaboration", "Device Capabilities"],
    integrationStatus: "reference_only_privacy_and_realtime_review",
    capabilities: [
      "P2P-first screen sharing with browser viewing",
      "desktop capture and optional self-hosting patterns",
      "room/session based realtime collaboration"
    ],
    safety: [
      "Screen capture can expose credentials, notifications, private files and unrelated applications; explicit capture selection and consent are mandatory.",
      "Room authentication, signaling, TURN/relay privacy, encryption, abuse controls and recording policy require independent review.",
      "No background or silent capture is authorized."
    ],
    blockedUses: [
      "silent or background screen capture",
      "recording or retaining a participant's screen without explicit authorization",
      "using a shared room identifier as the sole authorization boundary for sensitive sessions"
    ],
    nextStep: "Use as a realtime-collaboration architecture reference. Any SONARA implementation should prefer browser-native WebRTC primitives, scoped room authorization, explicit capture state and visible stop controls.",
    sourceEvidence: [
      "https://github.com/TNTcraftHIM/Piik",
      "https://github.com/TNTcraftHIM/Piik/blob/main/README.md",
      "https://github.com/TNTcraftHIM/Piik/blob/main/LICENSE"
    ]
  },
  {
    key: "microsoft_graphrag",
    label: "Microsoft GraphRAG",
    repository: "microsoft/graphrag",
    repoUrl: "https://github.com/microsoft/graphrag",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "graph_based_retrieval_and_summarization_reference",
    placement: "Shared RAG / Creator Project Graph research; not a source-of-truth replacement",
    productFit: ["Creator Studio", "Business Builder", "Growth Studio", "Agent Control Plane"],
    integrationStatus: "reference_only_retrieval_benchmark",
    capabilities: [
      "graph extraction from unstructured text",
      "global and local retrieval over entity relationships",
      "community summaries and graph-assisted RAG"
    ],
    safety: [
      "Graph extraction and summaries are probabilistic derived data, not authoritative records.",
      "Tenant graphs, embeddings, indexes and source documents must remain isolated and deletion-aware.",
      "Answers need source provenance and confidence/evidence handling; graph structure does not make a claim true."
    ],
    blockedUses: [
      "cross-tenant graph construction or retrieval",
      "using generated graph edges as authorization, billing, identity or compliance truth",
      "retaining derived graph data after required source deletion"
    ],
    nextStep: "Benchmark a small synthetic corpus against SONARA's existing tenant-scoped RAG and Creator Project Graph contracts. Measure retrieval quality, cost, latency and provenance before any worker integration.",
    sourceEvidence: [
      "https://github.com/microsoft/graphrag",
      "https://github.com/microsoft/graphrag/blob/main/README.md",
      "https://github.com/microsoft/graphrag/blob/main/LICENSE"
    ]
  },
  {
    key: "microsoft_data_science_for_beginners",
    label: "Data Science for Beginners",
    repository: "microsoft/Data-Science-For-Beginners",
    repoUrl: "https://github.com/microsoft/Data-Science-For-Beginners",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    reciprocalLicense: false,
    runtimeClass: "staff_learning_and_data_science_curriculum_reference",
    placement: "Internal learning reference only; no production dependency",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "educational_reference_only",
    capabilities: [
      "structured data-science learning curriculum",
      "lesson, lab and project progression patterns",
      "beginner-friendly statistical and data workflow examples"
    ],
    safety: [
      "Educational examples are not production models, security controls or customer analytics evidence.",
      "Dataset licences and privacy need separate review from curriculum source licensing.",
      "Do not copy example outputs into product claims."
    ],
    blockedUses: [
      "shipping tutorial code as production analytics without review",
      "treating teaching datasets as licensed customer-training data",
      "using classroom metrics as SONARA benchmark or customer evidence"
    ],
    nextStep: "Keep as staff-learning/reference material. Translate useful teaching patterns into SONARA-authored internal labs with owned or synthetic data.",
    sourceEvidence: [
      "https://github.com/microsoft/Data-Science-For-Beginners",
      "https://github.com/microsoft/Data-Science-For-Beginners/blob/main/README.md",
      "https://github.com/microsoft/Data-Science-For-Beginners/blob/main/LICENSE"
    ]
  },
  {
    key: "morluto_rea",
    label: "REA — Reverse Engineer Anything",
    repository: "morluto/rea",
    repoUrl: "https://github.com/morluto/rea",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "authorized_software_compatibility_and_reverse_engineering_research",
    placement: "Internal Development research only on SONARA-owned or explicitly authorized software",
    productFit: ["Internal Development", "Compatibility Research", "Security Verification"],
    integrationStatus: "research_only_authorization_required",
    capabilities: [
      "agent-assisted program behavior investigation",
      "binary and application inspection workflows",
      "evidence-oriented compatibility research patterns"
    ],
    safety: [
      "Reverse engineering must be limited to software SONARA owns, has permission to inspect, or is otherwise lawfully authorized to analyze.",
      "Do not use this intake for credential extraction, DRM/access-control circumvention, malware development or unauthorized third-party analysis.",
      "Agent conclusions require reproducible evidence and human review."
    ],
    blockedUses: [
      "unauthorized analysis of third-party applications or binaries",
      "circumventing DRM, authentication, access controls or licensing enforcement",
      "extracting credentials, private keys, secrets or customer data"
    ],
    nextStep: "Retain only the investigation/evidence workflow as a compatibility-testing reference. No reverse-engineering runtime is added to SONARA.",
    sourceEvidence: [
      "https://github.com/morluto/rea",
      "https://github.com/morluto/rea/blob/main/README.md",
      "https://github.com/morluto/rea/blob/main/LICENSE"
    ]
  },
  {
    key: "overmind_core_overmind",
    label: "Overmind",
    repository: "overmind-core/overmind",
    repoUrl: "https://github.com/overmind-core/overmind",
    repositoryVerified: true,
    license: "Mixed: SDK/CLI/client libraries under overmind/ are MIT; repository remainder AGPL-3.0",
    licenseRisk: "high",
    reciprocalLicense: true,
    runtimeClass: "agent_evaluation_training_and_continuous_improvement_reference",
    placement: "Agent Control Plane research only; no production trace export, arbitrary shell or training loop",
    productFit: ["Agent Control Plane", "Internal Development", "Evaluation"],
    integrationStatus: "research_only_mixed_license_privileged_execution",
    capabilities: [
      "agent trace evaluation and benchmark loops",
      "fine-tuning and continuous-improvement workflow concepts",
      "CLI, SDK, API and MCP-facing control patterns"
    ],
    safety: [
      "The upstream repository has mixed licensing; path-level review is mandatory before any code reuse.",
      "Its client/server control model can include privileged command execution; SONARA must never accept arbitrary shell instructions from an external training service.",
      "Production traces may contain source, prompts, customer data or secrets and must not be exported without explicit data-boundary review."
    ],
    blockedUses: [
      "granting an external service arbitrary shell access to SONARA hosts",
      "exporting production/customer traces to an unreviewed training or evaluation backend",
      "automatically promoting a fine-tuned model or policy into production"
    ],
    nextStep: "Use only the closed-loop evaluation lesson: traces -> scored evals -> candidate change -> offline regression -> human approval -> canary -> rollback. Build that loop inside existing SONARA authority boundaries.",
    sourceEvidence: [
      "https://github.com/overmind-core/overmind",
      "https://github.com/overmind-core/overmind/blob/main/README.md",
      "https://github.com/overmind-core/overmind/blob/main/LICENSE"
    ]
  },
  {
    key: "nvidia_model_optimizer",
    label: "NVIDIA Model Optimizer",
    repository: "NVIDIA/Model-Optimizer",
    repoUrl: "https://github.com/NVIDIA/Model-Optimizer",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "model_compression_quantization_and_inference_optimization_reference",
    placement: "Model Engine Control Plane / isolated GPU worker research only",
    productFit: ["Creator Studio", "Model Engine Control Plane", "Infrastructure"],
    integrationStatus: "benchmark_candidate_isolated_worker_only",
    capabilities: [
      "quantization and model compression",
      "distillation, pruning and neural architecture search",
      "deployment optimization for supported inference runtimes"
    ],
    safety: [
      "Model code licensing is separate from each model's weight, dataset, provider and output terms.",
      "Optimization can change model quality, safety behavior and numerical output; exact-revision regression benchmarks are required.",
      "GPU tooling belongs in isolated workers with explicit resource budgets, not the web request process."
    ],
    blockedUses: [
      "promoting a quantized or optimized model without accuracy and safety regression evidence",
      "treating Apache-2.0 tool licensing as permission to use any model weights",
      "running unbounded GPU optimization in the production web request path"
    ],
    nextStep: "Benchmark only after one exact model has passed SONARA's model-hub promotion gate. Record baseline vs optimized accuracy, latency, memory, cost and safety-eval deltas before any canary.",
    sourceEvidence: [
      "https://github.com/NVIDIA/Model-Optimizer",
      "https://github.com/NVIDIA/Model-Optimizer/blob/main/README.md",
      "https://github.com/NVIDIA/Model-Optimizer/blob/main/LICENSE"
    ]
  },
  {
    key: "cporter202_ai_agent_tools",
    label: "AI Agent Tools collection",
    repository: "cporter202/ai-agent-tools",
    repoUrl: "https://github.com/cporter202/ai-agent-tools",
    repositoryVerified: true,
    license: "NOASSERTION — no repository licence was detected during intake",
    licenseRisk: "high",
    reciprocalLicense: false,
    runtimeClass: "unlicensed_link_directory_reference",
    placement: "Research Lab discovery lead only",
    productFit: ["Internal Development", "Research Lab"],
    integrationStatus: "blocked",
    capabilities: [
      "curated directory of AI agent tools and resources",
      "discovery leads for later first-party verification"
    ],
    safety: [
      "A curated list is not evidence that linked tools are safe, current, commercially usable or licensed.",
      "No licence means repository content must not be copied into SONARA.",
      "Each linked project requires its own exact upstream identity, licence and security review."
    ],
    blockedUses: [
      "copying unlicensed repository content into SONARA",
      "bulk-installing or bulk-enabling linked agent tools",
      "treating stars, list placement or social promotion as security or production evidence"
    ],
    nextStep: "Use only as a discovery index. Promote an individual linked project only after exact-source verification and the normal repository intake gate.",
    sourceEvidence: [
      "https://github.com/cporter202/ai-agent-tools",
      "https://github.com/cporter202/ai-agent-tools/blob/main/README.md"
    ]
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "tradingview_ai_chart_copilot_batch24",
    label: "TradingView AI Chart Copilot",
    status: "hosted_product_reference_current_state_correction",
    observedTheme: "The screenshot describes a browser-extension AI chart assistant for natural-language chart analysis, indicators, alerts and watchlists.",
    reason: "Current first-party TradingView material says AI Chart Copilot is built into TradingView and the earlier browser extension is no longer the durable product path. Financial/trading outputs remain probabilistic and are not investment advice or order authority.",
    nextStep: "Use only the UX pattern: natural-language analytics -> visible chart changes -> reversible commands -> explicit source/timeframe -> confirmation before alerts or account actions. Do not copy stale extension instructions or automate trades."
  },
  {
    key: "voice_agent_realtime_architecture_batch24",
    label: "Voice agent cascaded versus realtime architecture",
    status: "architecture_reference",
    observedTheme: "The visual contrasts STT -> LLM -> TTS cascades with speech-to-speech realtime models, then highlights turn detection, tools, context and barge-in.",
    reason: "Illustrated latency values are not SONARA benchmarks and vary by model, network, codec, endpoint, region and turn-detection policy.",
    nextStep: "Define a provider-neutral voice-session contract with measured end-to-end latency, VAD/turn state, interruption, tool approval, recording consent, transcript provenance and deterministic postconditions."
  },
  {
    key: "project_policy_markdown_pack_batch24",
    label: "VOICE.md / AUDIENCE.md / STYLE.md / SEO.md project-policy pack",
    status: "workflow_reference",
    observedTheme: "The screenshot proposes source-controlled markdown files to hold voice, audience, formatting and SEO rules instead of retyping instructions.",
    reason: "Persistent project instructions are useful, but they are guidance rather than authorization and can become stale or conflict with product/security policy.",
    nextStep: "Use scoped, versioned SONARA-owned policy files with clear precedence, schema/validation, review dates and tests. Never store secrets or allow a style file to expand tool, tenant or deployment authority."
  },
  {
    key: "agent_context_memory_skills_routines_batch24",
    label: "Agent context, memory, skills and routine workflow",
    status: "workflow_reference",
    observedTheme: "The diagram sequences install/context, project memory, reusable skills, specialist agents and scheduled/autopilot work.",
    reason: "A diagram does not establish safe persistence, provider authorization, unattended execution or correct results.",
    nextStep: "Keep context, memory, skills and schedules as separate governed layers. Every background action needs explicit scope, resource budget, audit, idempotency, failure handling and approval classification."
  },
  {
    key: "genai_technology_stack_2026_batch24",
    label: "Generative AI technology-stack infographic",
    status: "ecosystem_reference",
    observedTheme: "The visual groups foundation models, inference runtimes, orchestration, embeddings/rerankers, vector databases, tuning, structured output, tool protocols, evaluation and guardrails.",
    reason: "A category map is not a dependency recommendation; each product has separate licensing, hosting, privacy, security, cost and maturity constraints.",
    nextStep: "Use the layers as a coverage checklist for SONARA's Provider Gateway, retrieval, tool protocol, observability, evaluation and safety surfaces. Keep implementation choices driven by measured gaps."
  },
  {
    key: "paddleocr_pipeline_visual_batch24",
    label: "PaddleOCR ingest/model/export architecture visual",
    status: "confirmed_technology_architecture_reference",
    observedTheme: "The screenshot frames document processing as ingest of PDFs/images/office files, OCR/layout/model processing, then structured Markdown/JSON for RAG and LLM contexts.",
    reason: "SONARA already has PaddleOCR as a review-required backend-worker candidate; the visual does not prove runtime readiness, accuracy, language quality or safe handling of arbitrary uploads.",
    nextStep: "Preserve the existing worker-only posture and formalize input limits, malware/content checks, page/image budgets, confidence spans, source coordinates, human review, export provenance and deletion."
  },
  {
    key: "api_security_basics_visual_batch24",
    label: "API security-basics infographic",
    status: "security_checklist_reference",
    observedTheme: "Authentication vs authorization, validation, SQL injection resistance, per-key rate limits, CORS, CSRF, secret handling, TLS, least privilege and audit logs.",
    reason: "The checklist is directionally sound but not a substitute for threat modeling, framework-specific controls, tenant-isolation tests or current OWASP guidance.",
    nextStep: "Map each control to SONARA's actual middleware, RLS/service-role boundaries, secret stores, audit events and adversarial tests. Fail closed where ownership or tenant scope is ambiguous."
  },
  {
    key: "ai_request_lifecycle_visual_batch24",
    label: "AI request lifecycle — edge through retry-safe completion",
    status: "architecture_reference",
    observedTheme: "The visual traces edge routing, authentication, rate limits, conversation state, context assembly, policy checks, model routing, GPU scheduling, streaming, billing/metering, logging/evaluation and retry safety.",
    reason: "These layers are useful production concepts, but the diagram is not evidence SONARA currently implements every layer or uses GPU scheduling.",
    nextStep: "Use as a runtime contract checklist and attach exact evidence for each implemented layer. Keep billing idempotent, policy server-side, retries side-effect safe and model routing budget/entitlement aware."
  },
  {
    key: "top_twelve_ai_concepts_batch24",
    label: "Top 12 AI concepts infographic",
    status: "educational_reference_only",
    observedTheme: "Tokens, context windows, embeddings, vector search, RAG, temperature, hallucination, prompt injection, fine-tuning, agents, tool calling and quantization.",
    reason: "The graphic is introductory education, not a design specification; several concepts need stronger production definitions and threat models.",
    nextStep: "Use it only as onboarding vocabulary. Repository architecture and tests remain the authority for retrieval, prompt injection, agent tools, model tuning and quantization."
  },
  {
    key: "nvidia_free_endpoint_promotion_batch24",
    label: "NVIDIA hosted free-endpoint model promotion",
    status: "volatile_provider_offer_reference",
    observedTheme: "The screenshot claims several current hosted models can be called through NVIDIA developer endpoints without a credit card.",
    reason: "Free-endpoint availability, model list, quotas, regions, terms, retention and commercial rights can change. A promotional screenshot is not a durable entitlement or cost model.",
    nextStep: "Keep NVIDIA behind Provider Gateway. At connection time, verify the exact model, endpoint terms, quota, retention, region and current price; never hardcode 'free' as a guaranteed SONARA capability."
  },
  {
    key: "open_source_agent_project_grid_batch24",
    label: "Nine open-source agent-project grid",
    status: "discovery_reference_only",
    observedTheme: "The infographic groups agent projects into build/customize, run/automate and share/coordinate categories.",
    reason: "A social infographic can contain stale names, ownership mistakes or mixed licences and is not enough to approve nine repositories at once.",
    nextStep: "Treat each project name as an independent research lead. Verify exact owner, licence, current security posture and product gap before adding any future record."
  },
  {
    key: "multi_agent_workflow_visual_batch24",
    label: "Multi-agent system workflow infographic",
    status: "architecture_reference",
    observedTheme: "The visual proposes user input -> planning/routing -> agent collaboration -> tools/data -> result aggregation -> final output plus feedback, with cooperative, hierarchical and independent topologies.",
    reason: "More agents can increase latency, cost, coordination failures and authority risk; the diagram does not prove better outcomes than a single bounded workflow.",
    nextStep: "Choose the smallest topology that satisfies the task. Require typed roles, tenant/tool scope, bounded parallelism, independent validation, deterministic aggregation and human approval for consequential actions."
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  {
    key: "munder_difflin_existing_batch24",
    label: "Munder Difflin",
    repository: "HarnessMD/munder-difflin",
    source: "Batch 16 developer-agent research",
    note: "The current screenshot repeats an existing MIT multi-agent harness reference. Existing branch-isolation, merge/release authority and local-agent boundaries remain authoritative."
  },
  {
    key: "tester_army_e2e_existing_batch24",
    label: "TesterArmy e2e",
    repository: "tester-army/e2e",
    source: "Batch 23 screenshot research",
    note: "Already governed as a benchmark/reference only. Existing Playwright release evidence remains authoritative."
  },
  {
    key: "autogpt_existing_batch24",
    label: "AutoGPT",
    repository: "Significant-Gravitas/AutoGPT",
    source: "Earlier screenshot research",
    note: "Already represented. Current upstream is mixed-license: the platform path is PolyForm Shield while classic components are MIT. No parallel agent OS is adopted."
  },
  {
    key: "openvid_existing_batch24",
    label: "OpenVid",
    repository: "CristianOlivera1/openvid",
    source: "Existing social/repository intake",
    note: "Already represented. Current root licence is PolyForm Noncommercial 1.0.0; keep as a noncommercial design/workflow reference, not reusable commercial source."
  },
  {
    key: "anti_slop_existing_batch24",
    label: "Anti Slop",
    repository: "miqdadbadjuber/anti-slop",
    source: "Batch 14 research",
    note: "Already governed as a design/copy quality reference. Its rules do not override SONARA design authority, accessibility or product-specific requirements."
  },
  {
    key: "context_mode_existing_batch24",
    label: "context-mode",
    repository: "mksglu/context-mode",
    source: "GitHub radar and AI integration research",
    note: "Already represented. Current Elastic License 2.0 and privileged context-routing/runtime behavior require continued research-only treatment."
  },
  {
    key: "paddleocr_existing_batch24",
    label: "PaddleOCR",
    repository: "PaddlePaddle/PaddleOCR",
    source: "Document AI / open-source catalog",
    note: "Already present as a review-required OCR backend-worker candidate. Batch 24 adds no dependency or runtime activation."
  },
  {
    key: "lead_gen_api_stack_existing_batch24",
    label: "Lead Gen API Stack",
    repository: "cporter202/lead-gen-api-stack",
    source: "Batch 2 research",
    note: "Already governed. No declared repository licence was detected previously, so it remains discovery/reference material rather than code to copy."
  },
  {
    key: "public_apis_existing_batch24",
    label: "Public APIs directory",
    repository: "public-apis/public-apis",
    source: "External repository research / GitHub radar",
    note: "Already used as a discovery directory. Each downstream API retains its own terms, authentication, privacy and reliability requirements."
  },
  {
    key: "awesome_llm_apps_existing_batch24",
    label: "Awesome LLM Apps",
    repository: "Shubhamsaboo/awesome-llm-apps",
    source: "GitHub radar",
    note: "Already represented as a reference directory. Examples do not grant provider credentials, model rights or production authority."
  }
];

const DEDUPLICATED_REFERENCES = [
  {
    key: "sure_duplicate_screenshot_batch24",
    label: "Duplicate Sure repository screenshot",
    canonicalKey: "we_promise_sure",
    reason: "The same repository view appears twice in the uploaded batch; it is counted as screenshot evidence but cataloged once."
  },
  {
    key: "nvidia_free_endpoint_duplicate_screenshot_batch24",
    label: "Duplicate NVIDIA free-endpoint promotion screenshot",
    canonicalKey: "nvidia_free_endpoint_promotion_batch24",
    reason: "The same provider-promotion image appears twice in the uploaded batch; volatile provider claims are kept in one governed reference."
  }
];

const ARCHITECTURE_EXTENSIONS = [
  {
    key: "code_change_impact_graph_contract_batch24",
    title: "Code-change impact graph contract",
    product: "Internal Development",
    principle: "Repository graphs may prioritize investigation and test selection, but they never authorize skipping mandatory release gates.",
    implementation: "Index an isolated exact-SHA tree -> map symbols/files/dependencies -> propose affected routes/tests -> compare against historical failures and ownership -> run mandatory baseline plus targeted tests -> record false positives/negatives -> retain graph version and source SHA -> reject any recommendation that would weaken exact-head CI."
  },
  {
    key: "realtime_voice_turn_taking_contract_batch24",
    title: "Realtime voice turn-taking and tool contract",
    product: "Creator Studio",
    principle: "Low-latency voice requires explicit state for listening, speaking, interruption and tool execution rather than a hidden audio loop.",
    implementation: "Capture consent -> negotiate audio/session capabilities -> VAD/turn detection -> speech or STT path -> model/tool plan -> approval-classified tool call -> deterministic read-back -> TTS/speech output -> barge-in cancellation -> transcript/provenance -> latency/error metrics -> retention/delete."
  },
  {
    key: "document_ai_ingest_structure_export_contract_batch24",
    title: "Document AI ingest, structure and export contract",
    product: "Business Builder",
    principle: "OCR output is evidence with confidence and coordinates, not unquestioned document truth.",
    implementation: "Upload allowlist and size/page limits -> malware/content validation -> isolated OCR/layout worker -> per-span confidence and source coordinates -> table/key-value normalization -> human review for low-confidence or consequential fields -> canonical JSON/Markdown -> tenant-scoped index -> export receipt -> retention/deletion."
  },
  {
    key: "graph_rag_provenance_contract_batch24",
    title: "GraphRAG provenance and tenant-boundary contract",
    product: "Shared RAG",
    principle: "Graph structure improves retrieval only when every derived node, edge and summary remains traceable to tenant-authorized source evidence.",
    implementation: "Chunk authorized source -> extract typed entities/relations with confidence -> retain source spans and revision -> build tenant-specific graph/index -> global/local retrieval -> return supporting sources -> flag contradictions -> recalculate on correction/delete -> never use generated edges as authorization or system-of-record truth."
  },
  {
    key: "agent_evaluation_promotion_loop_batch24",
    title: "Agent evaluation-to-promotion loop",
    product: "Agent Control Plane",
    principle: "Learning from traces is a proposal pipeline, not self-authorizing production training.",
    implementation: "Redacted approved traces -> versioned eval set -> score current baseline -> generate candidate prompt/tool/model change -> offline regression and adversarial tests -> cost/latency comparison -> human approval -> small tenant-safe canary -> SLO/quality watch -> rollback on regression -> record evidence."
  },
  {
    key: "project_instruction_policy_stack_batch24",
    title: "Project instruction policy stack",
    product: "Internal Development",
    principle: "Voice, audience, style, SEO and agent instructions should be versioned policy inputs with explicit precedence and scope.",
    implementation: "Define schema and owner for each policy file -> resolve global/product/workspace/task precedence -> validate allowed fields -> prohibit secrets and authority expansion -> version/review dates -> run output conformance tests -> surface effective policy and conflicts to operators."
  },
  {
    key: "ai_request_lifecycle_observability_contract_batch24",
    title: "AI request lifecycle and observability contract",
    product: "Shared Platform",
    principle: "A model call is one stage in a governed request path that includes identity, policy, budgets, metering, evidence and retry safety.",
    implementation: "Edge/request ID -> authenticate -> tenant/role authorize -> rate/resource budget -> load conversation/source state -> assemble bounded context -> policy/tool checks -> route provider/model -> stream with cancellation -> meter actual usage -> persist safe audit/eval metadata -> idempotent settle/retry -> explicit terminal state."
  },
  {
    key: "model_optimization_promotion_gate_batch24",
    title: "Model optimization promotion gate",
    product: "Model Engine Control Plane",
    principle: "Smaller or faster inference is not an upgrade unless quality, safety, compatibility and cost remain acceptable on SONARA workloads.",
    implementation: "Exact model/revision and rights -> baseline benchmark -> candidate quantization/pruning/distillation config -> isolated build -> accuracy/task/safety regression -> latency/throughput/memory/cost measurement -> runtime compatibility -> artifact provenance/hash -> staged canary -> rollback path -> explicit enable flag."
  },
  {
    key: "screen_sharing_privacy_boundary_batch24",
    title: "Screen-sharing privacy and session boundary",
    product: "Shared Platform",
    principle: "Screen sharing is a visible, revocable user action; room connectivity never implies permission to capture unrelated content.",
    implementation: "Authenticated room -> participant consent -> explicit screen/window/tab picker -> visible capture indicator -> scoped signaling/WebRTC session -> optional TURN with reviewed retention -> no recording by default -> explicit recording consent -> stop/revoke controls -> session expiry -> audit without storing screen content unnecessarily."
  },
  {
    key: "defensive_api_security_baseline_batch24",
    title: "Defensive API security baseline",
    product: "Shared Platform",
    principle: "Every API path needs independent authentication, authorization, validation, abuse control, transport security, least privilege and auditable outcomes.",
    implementation: "Authenticate actor -> resolve tenant/role server-side -> validate typed input -> parameterized data access -> CSRF/CORS policy by client type -> per-key/tenant rate and cost limits -> server-side secrets -> TLS -> least-privilege DB/service grants -> security/audit event -> adversarial tenant tests. Active scanners run only on explicitly authorized owned targets."
  },
  {
    key: "bounded_multi_agent_topology_contract_batch24",
    title: "Bounded multi-agent topology contract",
    product: "Agent Control Plane",
    principle: "Use the smallest agent topology that solves the task; extra agents must earn their latency, cost and coordination risk.",
    implementation: "Classify consequence and decomposability -> choose single agent unless parallelism is justified -> assign typed roles and tool scopes -> share only minimum tenant-safe context -> cap concurrency/time/cost -> aggregate deterministically where possible -> independent verifier for consequential outputs -> human approval for high-impact actions -> retain trace and failure state."
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
    checkedOn: "2026-10-04",
    configurationStatus: "cataloged_disabled",
    runtimeStatus: "not_executed",
    enabledInProduction: false,
    canExecute: false,
    humanReviewRequired: true,
    source: "user_submitted_screenshot_research_batch24_2026_10_04"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH24 = Object.freeze(REPOSITORIES.map(freezeRepository));
const NON_REPOSITORY_REFERENCES_BATCH24 = Object.freeze(NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
  ...item,
  source: "user_submitted_screenshot_research_batch24_2026_10_04"
})));
const CONFIRMED_EXISTING_RECORDS_BATCH24 = Object.freeze(CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item })));
const DEDUPLICATED_REFERENCES_BATCH24 = Object.freeze(DEDUPLICATED_REFERENCES.map((item) => Object.freeze({ ...item })));
const ARCHITECTURE_EXTENSIONS_BATCH24 = Object.freeze(ARCHITECTURE_EXTENSIONS.map((item) => Object.freeze({ ...item })));

function getPublicScreenshotToolCatalogBatch24() {
  return SCREENSHOT_TOOL_RADAR_BATCH24.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses],
    sourceEvidence: [...item.sourceEvidence]
  }));
}

function getNonRepositoryReferencesBatch24() {
  return NON_REPOSITORY_REFERENCES_BATCH24.map((item) => ({ ...item }));
}

function getConfirmedExistingRecordsBatch24() {
  return CONFIRMED_EXISTING_RECORDS_BATCH24.map((item) => ({ ...item }));
}

function getDeduplicatedReferencesBatch24() {
  return DEDUPLICATED_REFERENCES_BATCH24.map((item) => ({ ...item }));
}

function getArchitectureExtensionsBatch24() {
  return ARCHITECTURE_EXTENSIONS_BATCH24.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch24() {
  const repositories = getPublicScreenshotToolCatalogBatch24();
  return {
    ok: true,
    batch: 24,
    mode: "static_governed_screenshot_research_batch24",
    screenshotCount: 34,
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH24.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH24.length,
    deduplicatedReferenceCount: DEDUPLICATED_REFERENCES_BATCH24.length,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH24.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch24(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch24(),
    deduplicatedReferences: getDeduplicatedReferencesBatch24(),
    architectureExtensions: getArchitectureExtensionsBatch24()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH24,
  NON_REPOSITORY_REFERENCES_BATCH24,
  CONFIRMED_EXISTING_RECORDS_BATCH24,
  DEDUPLICATED_REFERENCES_BATCH24,
  ARCHITECTURE_EXTENSIONS_BATCH24,
  getPublicScreenshotToolCatalogBatch24,
  getNonRepositoryReferencesBatch24,
  getConfirmedExistingRecordsBatch24,
  getDeduplicatedReferencesBatch24,
  getArchitectureExtensionsBatch24,
  getScreenshotToolReadinessBatch24
};
