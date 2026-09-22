// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { getScreenshotDerivedStrategies } = require("./sonara-screenshot-derived-strategies.cjs");

// Source-grounded agent architecture metadata. The five execution patterns and
// ten business-AI capability groups below are planning/control-plane records.
// They do not execute tools, grant provider permissions, or widen tenant scope.
const AGENT_PATTERNS = Object.freeze([
  pattern({
    key: "single_shot",
    label: "Single-shot agent",
    executionShape: "one_model_invocation_no_explicit_tool_loop",
    suitedFor: ["classification", "information_extraction", "summarization", "formatting", "simple_deterministic_drafts"],
    defaultRisk: "low",
    toolLoopAllowed: false,
    independentVerificationRequired: false,
    maxIterations: 1,
    boundaries: ["No external side effects", "Use deterministic local rules instead when a model is unnecessary"]
  }),
  pattern({
    key: "iterative_react",
    label: "Iterative ReAct agent",
    executionShape: "reason_act_observe_repeat_with_bounded_loop",
    suitedFor: ["tool_use", "search", "data_lookup", "troubleshooting", "bounded_dynamic_tasks"],
    defaultRisk: "medium",
    toolLoopAllowed: true,
    independentVerificationRequired: false,
    maxIterations: 8,
    boundaries: ["Every tool must be allowlisted and tenant-scoped", "Stop on approval-required actions, repeated failure, or exhausted iteration budget"]
  }),
  pattern({
    key: "planner_executor",
    label: "Planner-executor agent",
    executionShape: "planner_creates_structured_plan_then_specialized_executors_run_subtasks",
    suitedFor: ["complex_workflows", "research", "multi_step_business_processes", "parallelizable_work", "long_running_jobs"],
    defaultRisk: "medium",
    toolLoopAllowed: true,
    independentVerificationRequired: false,
    maxIterations: 16,
    boundaries: ["Planning never grants execution authority", "Executors inherit the narrowest tool, tenant, cost, and approval boundaries"]
  }),
  pattern({
    key: "reflexive",
    label: "Reflexive agent",
    executionShape: "generate_critique_refine_with_quality_stop_condition",
    suitedFor: ["content_quality", "code_generation", "analysis_quality", "complex_reasoning", "clarity_improvement"],
    defaultRisk: "medium",
    toolLoopAllowed: false,
    independentVerificationRequired: false,
    maxIterations: 4,
    boundaries: ["Self-critique is not independent verification", "Do not use reflection to bypass policy, approvals, tests, or source requirements"]
  }),
  pattern({
    key: "verifier_gated",
    label: "Verifier-gated agent",
    executionShape: "agent_output_is_checked_by_independent_verifier_before_release_or_action",
    suitedFor: ["financial_actions", "security_sensitive_work", "compliance", "deployment", "data_mutation", "high_impact_workflows"],
    defaultRisk: "high",
    toolLoopAllowed: true,
    independentVerificationRequired: true,
    maxIterations: 6,
    boundaries: ["Verifier must be logically independent from the producing step", "Failed verification blocks, retries within budget, or escalates to a human reviewer"]
  })
]);

const BUSINESS_AI_SKILLS = Object.freeze([
  businessSkill({
    key: "ai_assisted_app_building",
    label: "AI-assisted application building",
    products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["plan", "build", "test", "refactor", "explain"],
    implementationState: "existing_engineering_workflow_plus_governed_expansion"
  }),
  businessSkill({
    key: "agentic_workflows",
    label: "Agentic workflows",
    products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["goal", "plan", "tool_use", "verification", "deliverable"],
    implementationState: "control_plane_ready_runtime_action_authority_remains_bounded"
  }),
  businessSkill({
    key: "context_engineering",
    label: "Context engineering",
    products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["instructions", "goals", "context", "constraints", "tool_contracts", "output_contracts"],
    implementationState: "repository_and_prompt_contracts_active"
  }),
  businessSkill({
    key: "rag_business_knowledge",
    label: "RAG and business knowledge",
    products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["trusted_documents", "knowledge_index", "retrieval", "grounded_answers"],
    implementationState: "policy_ready_semantic_runtime_provider_gated"
  }),
  businessSkill({
    key: "ai_evaluation",
    label: "AI evaluation",
    products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["accuracy", "relevance", "tool_success", "latency", "cost", "safety"],
    implementationState: "release_and_test_evidence_active_expand_per_workflow"
  }),
  businessSkill({
    key: "workflow_automation",
    label: "Workflow automation",
    products: ["Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["triggers", "actions", "human_checks", "state_updates", "task_handoffs"],
    implementationState: "existing_workflows_plus_approval_gated_expansion"
  }),
  businessSkill({
    key: "data_analysis_with_ai",
    label: "Data analysis with AI",
    products: ["Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["summaries", "spreadsheets", "dashboards", "trends", "recommendations"],
    implementationState: "deterministic_analytics_first_model_assistance_optional"
  }),
  businessSkill({
    key: "multimodal_ai",
    label: "Multimodal AI",
    products: ["Creator Studio", "Growth Studio", "Files & Records"],
    outcomes: ["text", "image", "audio", "video", "document_understanding", "cross_format_work"],
    implementationState: "provider_and_worker_pathways_governed_by_rights_and_readiness"
  }),
  businessSkill({
    key: "ai_security_approvals",
    label: "AI security and approvals",
    products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["access_control", "human_approval", "sensitive_data_guardrails", "auditability", "safe_outputs"],
    implementationState: "core_governance_active"
  }),
  businessSkill({
    key: "system_thinking_deployment",
    label: "System thinking and deployment",
    products: ["SONARA One", "Business Builder", "Creator Studio", "Growth Studio"],
    outcomes: ["problem_mapping", "workflow_design", "app_layer", "agent_layer", "deployment", "monitoring"],
    implementationState: "engineering_and_release_control_plane_active"
  })
]);

const VERIFIED_MODEL_PROFILES = Object.freeze([
  Object.freeze({
    key: "openai_gpt_6_astra",
    provider: "openai",
    model: "gpt-6-astra",
    label: "GPT-6 Astra",
    evidenceDate: "2026-09-16",
    evidenceSource: "OpenAI official model guidance and model page",
    apiSurface: "Responses API",
    reasoningEffort: Object.freeze(["low", "medium", "high", "xhigh", "max"]),
    contextWindowTokens: 1050000,
    maxOutputTokens: 128000,
    integrationState: "configuration_profile_only",
    enabledByRecord: false,
    canExecuteFromRecord: false,
    restrictions: Object.freeze([
      "Existing SONARA OpenAI provider remains opt-in and server-side; configure SONARA_OPENAI_MODEL explicitly rather than changing the safe default automatically.",
      "Model availability and account entitlement are provider-controlled and must be verified at runtime.",
      "Computer-use, external actions, cybersecurity, financial, deployment, destructive, and customer-account operations remain separately approval-gated.",
      "No model profile can bypass tenant isolation, provider policy, audit logging, release gates, or human approval."
    ])
  })
]);

const SKILL_STRATEGIES = Object.freeze([
  skill({
    key: "governed_batch_convergence",
    label: "Governed Batch 1-10 convergence",
    batches: [1,2,3,4,5,6,7,8,9,10],
    triggers: ["integrate batch research", "add screenshot tools", "update models and engines", "converge architecture"],
    steps: [
      "Resolve current production/design authority before applying older research.",
      "Deduplicate repositories and preserve every batch and formal registry source as provenance.",
      "Verify upstream identity, license, runtime fit, security boundary, and product fit before promotion.",
      "Choose reference, adapter, isolated worker, local companion, or blocked placement.",
      "Implement the smallest reversible slice and require CI/release evidence before merge."
    ],
    boundaries: ["Research never widens runtime authority", "Later evidence may correct older metadata but cannot bypass tenant, formal registry, or approval policy"]
  }),
  skill({
    key: "commercial_open_source_adoption",
    label: "Commercial open-source adoption",
    batches: [1,2,3,4,5,6,7,10],
    triggers: ["adopt open source", "install repository", "commercially safe technology"],
    steps: [
      "Verify the actual repository license and distinguish source license from model/data/content licenses.",
      "Use the formal open-source registry decision when it is stricter than an older screenshot/intake claim.",
      "Prefer permissive MIT/Apache/BSD/PostgreSQL/CC0 projects when they solve a measured gap and commercial-use status allows adoption.",
      "Keep GPL/AGPL/MPL/custom/source-available projects behind an explicit isolation/license decision.",
      "Keep unlicensed or unresolved source out of product code and record provenance, version, configuration state, runtime boundary, and rollback path."
    ],
    boundaries: ["Open source does not automatically mean unrestricted commercial use", "No remote install scripts or secrets in prompts"]
  }),
  skill({
    key: "provider_model_selection",
    label: "Provider and model selection",
    batches: [3,4,7,8,10],
    triggers: ["choose model", "add provider", "local AI", "media generation"],
    steps: [
      "Use deterministic SONARA rules when a model is unnecessary.",
      "Use Provider Gateway or an approved server-side adapter for hosted models.",
      "Use isolated workers for GPU/media/local-model workloads.",
      "Evaluate quality, rights, privacy, retention, latency, cost, availability, model-weight/data terms, and fallback behavior.",
      "Persist provider/model/version/provenance metadata without logging secrets or unnecessary payload content."
    ],
    boundaries: ["A registry record cannot execute a provider", "Model weights and datasets remain separately licensed"]
  }),
  skill({
    key: "learning_memory_governance",
    label: "Governed learning and memory",
    batches: [1,3,4,7,8,10],
    triggers: ["learn from", "remember", "memory", "personalize", "semantic search", "improve recommendations"],
    steps: [
      "Use authoritative organization records and deterministic checks before creating remembered context.",
      "Classify the candidate as operational fact, owner preference, approved pattern, product feedback, research evidence, or ephemeral context.",
      "Require organization scope, source provenance, purpose, retention policy, and explicit approval for preferences/patterns or sensitive memory.",
      "Never retain credentials, raw card/CVV data, access tokens, private keys, passwords, or service-role secrets.",
      "Enable semantic retrieval only after an embedding provider/model/dimension is explicitly reviewed and verified; otherwise keep text/metadata behavior deterministic.",
      "Keep memory editable/removable and never treat remembered context as authority for consequential actions."
    ],
    boundaries: ["No cross-tenant memory", "No covert sensitive-trait inference", "Memory cannot bypass owner, provider, campaign, payment, security, or release gates"]
  }),
  skill({
    key: "creator_media_pipeline",
    label: "Creator research-to-publish pipeline",
    batches: [2,3,4,5,6,7,8,10],
    triggers: ["create media", "creator workflow", "generate video", "generate music", "transcribe", "publish"],
    steps: [
      "Research and define source/rights constraints.",
      "Create through an approved provider or isolated worker.",
      "Run quality, consent, copyright, privacy, and cost checks.",
      "Require owner approval for consequential publishing or distribution.",
      "Persist deliverable, provider, model/version, output provenance, and measured outcome."
    ],
    boundaries: ["No voice cloning without explicit reviewed rights/consent", "No protected-artist imitation workflow", "Publishing remains approval-gated"]
  }),
  skill({
    key: "growth_campaign_execution",
    label: "Growth campaign execution",
    batches: [5,6,7,8,10],
    triggers: ["launch campaign", "send marketing", "lead follow-up", "growth automation"],
    steps: [
      "Build audience from authorized first-party records.",
      "Check consent, suppression, eligibility, frequency, and owner approval.",
      "Freeze the approved recipient snapshot before dispatch.",
      "Send through configured providers with bounded retries and idempotency.",
      "Record outcomes without silently expanding the audience on retry/resume."
    ],
    boundaries: ["No unsolicited scraping-to-outreach pipeline", "No guaranteed growth/conversion claims", "Recipient approval is immutable for a dispatch"]
  }),
  skill({
    key: "business_operations_delivery",
    label: "Business Builder operations delivery",
    batches: [1,5,6,7,8,10],
    triggers: ["business workflow", "booking", "invoice", "payment", "staff", "inventory"],
    steps: [
      "Use organization-scoped records and deterministic checks first.",
      "Keep booking, staff, inventory, customer, invoice, and payment operations independently auditable.",
      "Use provider-reported payment/dispute truth instead of generic fee estimates.",
      "Require approval for financial, destructive, or externally visible changes.",
      "Expose setup-required and review-required states rather than fake success."
    ],
    boundaries: ["No raw card/CVV storage", "Carrier voice/SMS is not claimed complete unless configured and verified"]
  }),
  skill({
    key: "authorized_security_review",
    label: "Authorized security review",
    batches: [1,3,4,6,7,10],
    triggers: ["security test", "OSINT", "scanner", "blue team", "reverse engineering"],
    steps: [
      "Confirm owned or explicitly authorized target scope before active testing.",
      "Prefer passive/source-grounded review before active probes.",
      "Run active tools only in isolated environments with bounded scope and audit logs.",
      "Record findings without collecting unrelated credentials or personal data.",
      "Keep fixes separate from exploit research and prove them with regression tests."
    ],
    boundaries: ["No credential capture, lock bypass, covert tracking, unauthorized crawling, or destructive testing"]
  }),
  skill({
    key: "release_evidence_delivery",
    label: "Release evidence delivery",
    batches: [8,9,10],
    triggers: ["merge", "deploy", "release", "fix CI", "production ready"],
    steps: [
      "Translate requirements into explicit acceptance criteria.",
      "Implement in a branch with the smallest reviewable diff.",
      "Run dependency, security, tenant-isolation, route, build, and release-evidence gates.",
      "Fix the underlying source/contract instead of bypassing tests.",
      "Merge only when required checks are green and production blockers are accurately named."
    ],
    boundaries: ["Never force-push main", "Never merge red required checks", "Never weaken a release gate to manufacture green"]
  }),
  skill({
    key: "agent_execution_pattern_routing",
    label: "Agent execution pattern routing",
    batches: [10],
    triggers: ["choose agent pattern", "single shot", "react agent", "planner executor", "reflexive agent", "verifier gate"],
    steps: [
      "Use single-shot for simple no-side-effect work.",
      "Use bounded iterative ReAct only when tool feedback is necessary.",
      "Use planner-executor for decomposable or long-running workflows while keeping executor permissions narrow.",
      "Use reflexive loops for quality improvement, never as a substitute for independent validation.",
      "Add verifier-gated review before high-impact, financial, security-sensitive, compliance, deployment, or data-mutation outcomes."
    ],
    boundaries: ["Agent patterns are composable control-plane choices, not autonomous authority", "Every loop has bounded iterations, cost/latency budgets, observability, and an explicit failure path"]
  }),
  skill({
    key: "business_ai_capability_delivery",
    label: "Business AI capability delivery",
    batches: [10],
    triggers: ["AI business skills", "context engineering", "RAG", "AI evaluation", "workflow automation", "multimodal", "system thinking"],
    steps: [
      "Map the business problem and workflow before selecting an agent or model.",
      "Build the context contract from instructions, goals, authoritative data, constraints, tools, and output requirements.",
      "Ground answers in trusted organization sources where retrieval is enabled and keep unsupported assumptions visible.",
      "Evaluate accuracy, relevance, tool success, latency, cost, privacy, and safety before promotion.",
      "Deploy only through owned SONARA workflows with monitoring, human approval where required, and rollback paths."
    ],
    boundaries: ["Do not add agents where deterministic workflow automation is sufficient", "Public product copy must reflect measured runtime readiness rather than control-plane plans"]
  })
]);

function getAgentSkillStrategyCatalog() {
  const screenshotDerived = getScreenshotDerivedStrategies();
  return {
    ok: true,
    mode: "portable_cross_agent_skill_contract",
    strategyCount: SKILL_STRATEGIES.length,
    strategies: SKILL_STRATEGIES.map(clone),
    agentArchitecture: {
      patternCount: AGENT_PATTERNS.length,
      patterns: AGENT_PATTERNS.map(clone),
      selectionPrinciples: [
        "Choose the simplest pattern that can safely complete the task.",
        "Treat agent patterns as composable: planner-executor may still require verifier-gated release, and a tool-using executor may use bounded ReAct.",
        "Use explicit stop conditions, iteration ceilings, timeout/cost budgets, observability, retries with idempotency, and escalation paths.",
        "Separate generation from verification for high-impact work; self-reflection alone is not an independent verifier.",
        "Keep side effects behind SONARA authority checks, tenant scope, provider policy, audit logs, and human approval."
      ]
    },
    businessAI: {
      skillCount: BUSINESS_AI_SKILLS.length,
      skills: BUSINESS_AI_SKILLS.map(clone),
      operatingSequence: ["problem", "workflow", "context", "deterministic_core", "agent_or_model_if_needed", "evaluation", "approval", "deploy", "observe", "improve"],
      publicClaimPolicy: "A planned/control-plane capability must not be marketed as live until runtime, security, tenant, provider, and release evidence verify it."
    },
    verifiedModelProfiles: VERIFIED_MODEL_PROFILES.map(clone),
    screenshotDerivedStrategies: screenshotDerived,
    packaging: {
      claudeCode: {
        status: "repository_native",
        path: ".claude/skills/governed-batch-convergence/SKILL.md",
        rule: "Claude skills remain project-scoped and inherit SONARA authority, tenancy, secrets, formal registry, source-evidence, and release rules."
      },
      codex: {
        status: "repository_native",
        path: "AGENTS.md",
        rule: "Codex follows repository AGENTS.md plus the same governed strategy records; plugins/skills never expand connected-app permissions."
      },
      chatgpt: {
        status: "repository_native_strategy_not_installed_as_app",
        path: ".ai/shared/CHATGPT_CODEX_BATCH_1_10_STRATEGY.md",
        rule: "ChatGPT/Codex repository strategy is present in source. A ChatGPT app/plugin connection still requires separate workspace/user installation and authorization."
      }
    },
    boundaries: [
      "A skill is instruction/workflow context, not an authorization grant.",
      "Connected apps, MCP servers, providers, and external accounts retain their own authentication and action controls.",
      "No skill, model profile, agent pattern, RAG source, or evaluator can bypass SONARA tenant isolation, owner approvals, formal repository policy, provider policy, audit logging, or release gates.",
      "A model profile records verified integration metadata but never enables a provider, changes credentials, or changes the configured default model."
    ]
  };
}

function skill(input) {
  return Object.freeze({
    humanReviewRequired: true,
    canExecuteFromRecord: false,
    ...input,
    batches: Object.freeze([...(input.batches || [])]),
    triggers: Object.freeze([...(input.triggers || [])]),
    steps: Object.freeze([...(input.steps || [])]),
    boundaries: Object.freeze([...(input.boundaries || [])])
  });
}

function pattern(input) {
  return Object.freeze({
    humanReviewRequired: true,
    canExecuteFromRecord: false,
    ...input,
    suitedFor: Object.freeze([...(input.suitedFor || [])]),
    boundaries: Object.freeze([...(input.boundaries || [])])
  });
}

function businessSkill(input) {
  return Object.freeze({
    humanReviewRequired: true,
    canExecuteFromRecord: false,
    ...input,
    products: Object.freeze([...(input.products || [])]),
    outcomes: Object.freeze([...(input.outcomes || [])])
  });
}

function clone(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

module.exports = {
  AGENT_PATTERNS,
  BUSINESS_AI_SKILLS,
  VERIFIED_MODEL_PROFILES,
  SKILL_STRATEGIES,
  getAgentSkillStrategyCatalog
};
