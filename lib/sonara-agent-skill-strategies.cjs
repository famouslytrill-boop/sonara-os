"use strict";

const SKILL_STRATEGIES = Object.freeze([
  skill({
    key: "governed_batch_convergence",
    label: "Governed Batch 1-10 convergence",
    batches: [1,2,3,4,5,6,7,8,9,10],
    triggers: ["integrate batch research", "add screenshot tools", "update models and engines", "converge architecture"],
    steps: [
      "Resolve current production/design authority before applying older research.",
      "Deduplicate repositories and preserve every batch as provenance.",
      "Verify upstream identity, license, runtime fit, security boundary, and product fit before promotion.",
      "Choose reference, adapter, isolated worker, local companion, or blocked placement.",
      "Implement the smallest reversible slice and require CI/release evidence before merge."
    ],
    boundaries: ["Research never widens runtime authority", "Later evidence may correct older metadata but cannot bypass tenant or approval policy"]
  }),
  skill({
    key: "commercial_open_source_adoption",
    label: "Commercial open-source adoption",
    batches: [1,2,3,4,5,6,7,10],
    triggers: ["adopt open source", "install repository", "commercially safe technology"],
    steps: [
      "Verify the actual repository license and distinguish source license from model/data/content licenses.",
      "Prefer permissive MIT/Apache/BSD/CC0 projects when they solve a measured gap.",
      "Keep GPL/AGPL/MPL/custom-license projects behind an explicit isolation/license decision.",
      "Keep unlicensed or unresolved source out of product code.",
      "Record provenance, version, configuration state, runtime boundary, and rollback path."
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
      "Evaluate quality, rights, privacy, retention, latency, cost, availability, and fallback behavior.",
      "Persist provider/model/version/provenance metadata without logging secrets or unnecessary payload content."
    ],
    boundaries: ["A registry record cannot execute a provider", "Model weights and datasets remain separately licensed"]
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
  })
]);

function getAgentSkillStrategyCatalog() {
  return {
    ok: true,
    mode: "portable_cross_agent_skill_contract",
    strategyCount: SKILL_STRATEGIES.length,
    strategies: SKILL_STRATEGIES.map(clone),
    packaging: {
      claudeCode: {
        status: "repository_native",
        path: ".claude/skills",
        rule: "Claude skills remain project-scoped and inherit SONARA authority, tenancy, secrets, and release rules."
      },
      codex: {
        status: "repository_native",
        path: "AGENTS.md",
        rule: "Codex follows repository AGENTS.md plus the same governed strategy records; plugins/skills never expand connected-app permissions."
      },
      chatgpt: {
        status: "packaging_candidate_not_installed_by_repo",
        path: null,
        rule: "A future ChatGPT plugin/skill may package these instructions, but installation and any connected app authorization remain separate workspace/user actions."
      }
    },
    boundaries: [
      "A skill is instruction/workflow context, not an authorization grant.",
      "Connected apps, MCP servers, providers, and external accounts retain their own authentication and action controls.",
      "No skill can bypass SONARA tenant isolation, owner approvals, provider policy, audit logging, or release gates."
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

function clone(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

module.exports = {
  SKILL_STRATEGIES,
  getAgentSkillStrategyCatalog
};
