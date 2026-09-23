// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Batch 18 screenshot intake, 22 September 2026.
//
// The user supplied agent-engineering, RAG, system-design, product-design and
// open-source repository screenshots. This module converts those screenshots
// into governed research records. Nothing here clones, installs, authenticates
// to, executes, or enables a third-party project.
//
// External screenshots are evidence leads, not runtime authority. A repository
// is only marked verified after matching an authoritative upstream and checking
// its current licence posture.

const REPOSITORIES = [
  {
    key: "nanobot",
    label: "nanobot",
    repository: "HKUDS/nanobot",
    repoUrl: "https://github.com/HKUDS/nanobot",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "lightweight_personal_agent_framework_reference",
    placement: "Agent Control Plane research; isolated local/dev runtime only if later approved",
    productFit: ["SONARA One", "Agent Control Plane", "Founder Operations", "Research Lab"],
    integrationStatus: "optional_adapter_after_review",
    capabilities: [
      "small self-hosted agent core",
      "WebUI and chat-app adapters",
      "tools, memory, MCP and multi-agent workflows",
      "automation and local/self-hosted model options"
    ],
    safety: [
      "External tools never bypass SONARA agent authority, tenant scope, approval, rate, budget or audit controls.",
      "Chat-channel identity is not equivalent to account authority; every action must map to a SONARA principal and tenant.",
      "Local/self-hosted models and plugins remain separately reviewed for provenance, privacy, network access and licences."
    ],
    blockedUses: [
      "giving chat users shell, filesystem, provider-secret or production-deploy authority by default",
      "using external memory as a cross-tenant source of truth",
      "unreviewed autonomous publishing, spend, deletion or account mutation"
    ],
    nextStep: "Benchmark nanobot only as a lightweight orchestration/reference implementation against SONARA's existing agent runner, memory, MCP and approval contracts; adopt only a measured missing capability."
  },
  {
    key: "seekdb",
    label: "seekdb",
    repository: "oceanbase/seekdb",
    repoUrl: "https://github.com/oceanbase/seekdb",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "agent_state_and_hybrid_search_database_candidate",
    placement: "Isolated data/retrieval benchmark; PostgreSQL/Supabase remains production authority",
    productFit: ["SONARA One", "Research Lab", "Agent Memory", "RAG"],
    integrationStatus: "optional_adapter_after_review",
    capabilities: [
      "MySQL-compatible embedded or server deployment",
      "vector, full-text and scalar retrieval in one query surface",
      "ACID state storage",
      "copy-on-write fork/merge sandbox research for agent exploration"
    ],
    safety: [
      "Upstream benchmark claims are not SONARA production evidence until independently reproduced on representative workloads.",
      "A second state store cannot become an accidental competing source of truth for tenant, billing, entitlement or audit data.",
      "Agent sandbox/fork semantics must preserve tenant isolation, provenance, retention and deletion obligations."
    ],
    blockedUses: [
      "migrating production state because of benchmark marketing alone",
      "storing secrets or customer data without the same encryption, tenant and deletion controls as current systems",
      "allowing a forked agent state to commit directly into authoritative business records"
    ],
    nextStep: "Run an offline hybrid-search benchmark against current PostgreSQL/pgvector patterns using synthetic tenant data; compare relevance, write latency, operational burden, recovery and cost before any adapter proposal."
  },
  {
    key: "floci",
    label: "Floci",
    repository: "floci-io/floci",
    repoUrl: "https://github.com/floci-io/floci",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "local_cloud_emulator",
    placement: "Developer/CI infrastructure only; never production cloud authority",
    productFit: ["Internal Development", "Release Engineering", "Infrastructure"],
    integrationStatus: "developer_tool_after_review",
    capabilities: [
      "local AWS-shaped API emulation",
      "Docker-based development and CI workflows",
      "SDK, CLI, Terraform/CDK/OpenTofu compatibility testing",
      "offline/local integration-test environments"
    ],
    safety: [
      "Emulator parity is not cloud-provider production proof; provider-specific behavior still needs real controlled integration evidence.",
      "Never route production credentials or production endpoints into the emulator environment.",
      "Pin emulator versions/images and treat Docker socket access as privileged."
    ],
    blockedUses: [
      "claiming AWS production compatibility from emulator-only tests",
      "mounting production secrets into local test containers",
      "exposing a Docker socket to untrusted customer or agent workloads"
    ],
    nextStep: "Use only if SONARA has AWS-specific integration tests that currently require paid/shared infrastructure; start with one disposable S3/SQS-style test lane and compare behavior against a real sandbox account."
  },
  {
    key: "weknora",
    label: "WeKnora",
    repository: "Tencent/WeKnora",
    repoUrl: "https://github.com/Tencent/WeKnora",
    repositoryVerified: true,
    license: "MIT for Tencent project code; third-party components retain their own licences",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "enterprise_rag_and_agent_knowledge_framework",
    placement: "RAG/knowledge architecture benchmark; isolated service only after tenant/security review",
    productFit: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio", "Research Lab"],
    integrationStatus: "optional_adapter_after_review",
    capabilities: [
      "RAG quick Q&A",
      "ReAct agent with retrieval, MCP and web-search orchestration",
      "multi-source ingestion",
      "wiki/knowledge-graph generation with revision and rollback",
      "multi-tenant RBAC, audit and observability patterns"
    ],
    safety: [
      "Generated wikis and graphs are derived artifacts, not automatically verified facts.",
      "Any external web or MCP tool remains permissioned through SONARA's source/tool policies and approval boundary.",
      "Knowledge ingestion must preserve tenant isolation, document rights, provenance, retention, deletion and auditability."
    ],
    blockedUses: [
      "cross-tenant retrieval or shared embeddings without explicit isolation",
      "treating generated knowledge as authoritative without source evidence",
      "letting an external agent bypass SONARA tool, source or publishing policy"
    ],
    nextStep: "Compare WeKnora's ingestion/retrieval/revision model against SONARA's current grounded-retrieval architecture using a synthetic multi-tenant document corpus; measure citation quality, rollback, auditability and operations before any service adoption."
  },
  {
    key: "openexecutive",
    label: "Open Executive",
    repository: "SenteLabsAI/OpenExecutive",
    repoUrl: "https://github.com/SenteLabsAI/OpenExecutive",
    repositoryVerified: true,
    license: "Apache-2.0",
    licenseRisk: "medium",
    reciprocalLicense: false,
    runtimeClass: "multi_agent_executive_advisor_reference",
    placement: "Business/Founder advisory research; no independent corporate authority",
    productFit: ["Business Builder", "Founder Operations", "SONARA One", "Research Lab"],
    integrationStatus: "adapt_patterns_after_review",
    capabilities: [
      "single executive persona backed by specialist agents",
      "strategy, finance, people, legal, operations, marketing, product and board routing",
      "company-document retrieval and episodic memory",
      "evaluation rubrics for persona, domain accuracy, context use, routing and actionability"
    ],
    safety: [
      "Advisory agents cannot approve spend, contracts, hiring, legal filings, credit, deployment, customer communications or board actions.",
      "Domain labels such as CFO or General Counsel do not turn model output into professional advice or legal authority.",
      "Evaluation rubrics should be adapted to SONARA-owned tests and calibrated against real business tasks."
    ],
    blockedUses: [
      "presenting generated legal, financial or HR recommendations as professional determinations",
      "allowing an executive agent to self-approve consequential business actions",
      "letting a model-written memory overwrite audited company records"
    ],
    nextStep: "Adapt the specialist-routing and rubric ideas into SONARA's existing bounded advisory agents while keeping deterministic business records, approvals and professional-review boundaries authoritative."
  }
];

const CONFIRMED_EXISTING_RECORDS = [
  {
    key: "openshorts_existing_batch13",
    label: "OpenShorts",
    repository: "mutonby/openshorts",
    source: "Batch 13",
    note: "Repeated in the new screenshots. Existing Batch 13 record remains authoritative: MIT core, separately licensed cloud/ directory, isolated Creator Studio media-worker research only."
  },
  {
    key: "twenty_existing_open_source_registry",
    label: "Twenty",
    repository: "twentyhq/twenty",
    source: "data/open-source-tools.ts",
    note: "Existing open-source registry record remains authoritative. Current upstream licence is mixed: most code AGPLv3, enterprise-marked files commercial, named SDK/UI/application packages MIT, with an application exception for separate apps using published interfaces."
  }
];

const NON_REPOSITORY_REFERENCES = [
  {
    key: "meta_muse_product_design",
    label: "Meta Muse product-design article",
    status: "official_product_design_reference",
    observedTheme: "A proactive personal agent must make context, delegation, progress, privacy and user control legible rather than hiding autonomy behind chat.",
    reason: "Official product-design material is useful architecture/UX evidence but is not a SONARA code dependency.",
    nextStep: "Adapt the control-plane lessons: explicit access grants, visible background work, reviewable task state, reversible permissions and clear data boundaries."
  },
  {
    key: "meta_muse_agent_safety",
    label: "Meta Muse agent-safety architecture",
    status: "official_security_reference",
    observedTheme: "High-capability agents need isolation, prompt-injection resistance, tool discipline, trajectory monitoring and narrow authority.",
    reason: "Useful security reference; not a drop-in implementation.",
    nextStep: "Use as a gap checklist against SONARA's existing agent authority, sandbox, approval, observability and source-permission controls."
  },
  {
    key: "hackproduct_production_agent_loops",
    label: "Production AI loop diagrams",
    status: "educational_architecture_reference",
    observedTheme: "Production agents require repeated context, reasoning, tool, RAG, memory, evaluation, reliability and learning loops rather than one prompt-response call.",
    reason: "The screenshots are conceptual engineering diagrams, not executable specifications.",
    nextStep: "Map each loop to an owned SONARA subsystem and require explicit state, evidence and failure handling."
  },
  {
    key: "hackproduct_rag_production",
    label: "RAG production and retrieval concepts",
    status: "educational_architecture_reference",
    observedTheme: "Chunking, embeddings, vector/semantic/hybrid retrieval, reranking, metadata filtering, context windows, grounding, hallucination control, drift and evaluation belong in one retrieval-quality contract.",
    reason: "General architecture guidance rather than a repository dependency.",
    nextStep: "Keep retrieval evaluation source-grounded and measure recall/precision/citation faithfulness on SONARA corpora before expanding providers."
  },
  {
    key: "hackproduct_workflow_system_patterns",
    label: "Workflow and system-design pattern diagrams",
    status: "educational_architecture_reference",
    observedTheme: "Queues, caching, retries, circuit breakers, sagas, fan-out/fan-in, orchestration, streaming, read/write separation and chunk stores are recurring production patterns.",
    reason: "Reference patterns need workload-specific evidence before implementation.",
    nextStep: "Use the smallest pattern that solves a measured failure mode; preserve idempotency, backpressure, observability and rollback."
  },
  {
    key: "ai_matt_agent_design_patterns",
    label: "AI agent design pattern diagrams",
    status: "educational_architecture_reference",
    observedTheme: "Single-shot, iterative ReAct, planner-executor, reflexive and verifier-gated agents have different reliability/cost/control properties.",
    reason: "Pattern taxonomy is useful; the diagram is not a runtime dependency.",
    nextStep: "Select agent topology from task complexity and consequence, defaulting consequential work to independent verification and human approval."
  },
  {
    key: "ai_matt_business_ai_skills",
    label: "Business AI skills diagram",
    status: "educational_capability_reference",
    observedTheme: "AI-assisted building, agentic workflows, context engineering, RAG, evaluation, workflow automation, analytics, multimodality, security/approvals and systems thinking form a practical business capability stack.",
    reason: "Useful completeness checklist, not evidence that any capability is production-ready.",
    nextStep: "Map each capability to a SONARA owner, runtime boundary, test evidence and customer-facing truth state."
  },
  {
    key: "gpt6_astra_infographic",
    label: "GPT-6 Astra infographic",
    status: "third_party_model_reference",
    observedTheme: "Computer use, coding, research, tool use, connected apps, project memory and reasoning-effort controls are being presented as one end-to-end work model.",
    reason: "Model names, capabilities, pricing and API details are volatile and must come from current OpenAI documentation, not a social infographic.",
    nextStep: "Keep Provider Gateway model metadata source-grounded and versioned; treat the infographic only as a prompt to re-check current official model documentation."
  },
  {
    key: "platform_system_design_cards",
    label: "Platform system-design cards",
    status: "educational_system_design_reference",
    observedTheme: "YouTube, Netflix, Airbnb, Uber, WhatsApp, Facebook and Instagram diagrams illustrate domain decomposition, storage, caching, search, media delivery, queues and read/write paths.",
    reason: "Simplified interview-style diagrams omit many real production constraints and must not be copied as implementation plans.",
    nextStep: "Use them only as decomposition prompts when designing SONARA media, commerce, messaging, booking or delivery subsystems."
  },
  {
    key: "local_ai_agent_stack",
    label: "Local AI agent stack diagram",
    status: "educational_local_first_reference",
    observedTheme: "Local harness, local model, MCP tools, files/memory and scheduler with optional cloud fallback can reduce unnecessary data exposure and improve offline resilience.",
    reason: "Local-first placement is useful when the workload and device support it, but local execution is not automatically safer or more reliable.",
    nextStep: "Apply local-first only to bounded device-side workloads with explicit permission, encrypted storage, resource budgets, update strategy and cloud-fallback policy."
  }
];

const ARCHITECTURE_EXTENSIONS = [
  {
    key: "agent_topology_selection_contract",
    title: "Agent topology selection contract",
    product: "Agent Control Plane",
    principle: "Choose the smallest agent topology that satisfies task complexity and consequence; do not use multi-agent or reflection loops by default.",
    implementation: "Classify task -> single-shot for bounded transforms -> iterative ReAct for tool-driven exploration -> planner/executor for decomposable work -> verifier-gated for consequential outputs -> human approval where authority is required."
  },
  {
    key: "independent_verifier_gate",
    title: "Independent verifier gate",
    product: "SONARA One",
    principle: "High-consequence work needs verification that is logically independent from the generator.",
    implementation: "Generate proposal -> deterministic policy/schema checks -> independent verifier/eval -> owner approval when required -> execute through bounded command -> verify postcondition -> audit evidence."
  },
  {
    key: "production_agent_loop_contract",
    title: "Production agent loop contract",
    product: "Agent Control Plane",
    principle: "An agent is a loop over state, evidence and tools, not a single model response.",
    implementation: "Context assembly -> reason/plan -> tool/retrieval action -> observe -> memory proposal -> eval -> reliability policy -> bounded retry/replan -> completion evidence; every loop has explicit stop conditions and budgets."
  },
  {
    key: "grounded_rag_quality_contract",
    title: "Grounded RAG quality contract",
    product: "SONARA One",
    principle: "Retrieval quality is measured end to end, not inferred from having a vector database.",
    implementation: "Ingest -> normalize -> chunk -> embed/index -> hybrid retrieve -> rerank -> metadata/tenant filter -> assemble context -> answer with source evidence -> evaluate recall/faithfulness/drift -> quarantine weak sources."
  },
  {
    key: "agent_memory_state_contract",
    title: "Agent memory/state contract",
    product: "SONARA One",
    principle: "Memory is mutable state with provenance and authority boundaries, not an unstructured transcript bucket.",
    implementation: "Proposal -> tenant/principal scope -> provenance/confidence -> contradiction check -> approval if consequential -> immutable revision -> retrieval -> expiry/delete/rollback; audited business records remain authoritative."
  },
  {
    key: "model_gateway_control_contract",
    title: "Model gateway control contract",
    product: "Provider Gateway",
    principle: "Model selection must balance capability, cost, latency, privacy, availability and task risk without leaking provider details into product logic.",
    implementation: "Normalize task class -> eligible providers/models -> policy/privacy filter -> budget/latency envelope -> route -> retry/fallback/circuit-break -> record model/version/cost/latency/eval -> never let fallback widen authority."
  },
  {
    key: "workflow_durability_contract",
    title: "Workflow durability contract",
    product: "SONARA One",
    principle: "Long-running work must survive retries, partial failure and provider downtime without duplicating side effects.",
    implementation: "Idempotency key -> durable state/checkpoint -> queue -> bounded retry/backoff -> circuit breaker -> compensation/saga where needed -> dead-letter/escalation -> replay safety -> postcondition verification."
  },
  {
    key: "agent_observability_eval_contract",
    title: "Agent observability and eval contract",
    product: "Internal Development",
    principle: "Quality claims require traces, structured outcomes and regression evals tied to real task classes.",
    implementation: "Trace request/context/tool calls/model/version/tokens/latency/cost -> capture deterministic outcome labels -> run offline and canary evals -> compare against baseline -> alert on regressions -> preserve evidence with release SHA."
  },
  {
    key: "personal_agent_progressive_authority",
    title: "Personal-agent progressive authority",
    product: "SONARA One",
    principle: "A personal agent earns access capability-by-capability; context and convenience do not imply permission.",
    implementation: "Connect source explicitly -> show requested scope -> least-privilege token -> visible task plan/progress -> confirmation for sensitive actions -> revocation/reset -> retention controls -> auditable history."
  },
  {
    key: "local_first_execution_boundary",
    title: "Local-first execution boundary",
    product: "Client/Edge Research",
    principle: "Run work locally when it materially improves privacy, latency or offline resilience and the device can support it; cloud remains a deliberate fallback, not a hidden dependency.",
    implementation: "Capability detection -> explicit local permission -> encrypted local state -> resource limits -> sandboxed tools -> update/version policy -> cloud fallback with disclosure -> sync conflict resolution."
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
    source: "user_submitted_screenshot_research_batch18_2026_09_22"
  });
}

const SCREENSHOT_TOOL_RADAR_BATCH18 = Object.freeze(REPOSITORIES.map(freezeRepository));
const NON_REPOSITORY_REFERENCES_BATCH18 = Object.freeze(
  NON_REPOSITORY_REFERENCES.map((item) => Object.freeze({
    ...item,
    source: "user_submitted_screenshot_research_batch18_2026_09_22"
  }))
);
const CONFIRMED_EXISTING_RECORDS_BATCH18 = Object.freeze(
  CONFIRMED_EXISTING_RECORDS.map((item) => Object.freeze({ ...item }))
);
const ARCHITECTURE_EXTENSIONS_BATCH18 = Object.freeze(
  ARCHITECTURE_EXTENSIONS.map((item) => Object.freeze({ ...item }))
);

function getPublicScreenshotToolCatalogBatch18() {
  return SCREENSHOT_TOOL_RADAR_BATCH18.map((item) => ({
    ...item,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    safety: [...item.safety],
    blockedUses: [...item.blockedUses]
  }));
}

function getNonRepositoryReferencesBatch18() {
  return NON_REPOSITORY_REFERENCES_BATCH18.map((item) => ({ ...item }));
}

function getConfirmedExistingRecordsBatch18() {
  return CONFIRMED_EXISTING_RECORDS_BATCH18.map((item) => ({ ...item }));
}

function getArchitectureExtensionsBatch18() {
  return ARCHITECTURE_EXTENSIONS_BATCH18.map((item) => ({ ...item }));
}

function getScreenshotToolReadinessBatch18() {
  const repositories = getPublicScreenshotToolCatalogBatch18();
  return {
    ok: true,
    batch: 18,
    mode: "static_governed_screenshot_research_batch18",
    repositoryCount: repositories.length,
    verifiedCount: repositories.filter((item) => item.repositoryVerified).length,
    reciprocalLicenseCount: repositories.filter((item) => item.reciprocalLicense).length,
    nonRepositoryReferenceCount: NON_REPOSITORY_REFERENCES_BATCH18.length,
    confirmedExistingRecordCount: CONFIRMED_EXISTING_RECORDS_BATCH18.length,
    architectureExtensionCount: ARCHITECTURE_EXTENSIONS_BATCH18.length,
    productionExecutionCount: 0,
    repositories,
    nonRepositoryReferences: getNonRepositoryReferencesBatch18(),
    confirmedExistingRecords: getConfirmedExistingRecordsBatch18(),
    architectureExtensions: getArchitectureExtensionsBatch18()
  };
}

module.exports = {
  SCREENSHOT_TOOL_RADAR_BATCH18,
  NON_REPOSITORY_REFERENCES_BATCH18,
  CONFIRMED_EXISTING_RECORDS_BATCH18,
  ARCHITECTURE_EXTENSIONS_BATCH18,
  getPublicScreenshotToolCatalogBatch18,
  getNonRepositoryReferencesBatch18,
  getConfirmedExistingRecordsBatch18,
  getArchitectureExtensionsBatch18,
  getScreenshotToolReadinessBatch18
};
