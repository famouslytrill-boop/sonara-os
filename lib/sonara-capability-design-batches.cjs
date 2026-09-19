// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Batches 8 and 9 are internal convergence records, not new external-tool
// installs. They tell the product what SONARA can honestly claim today and what
// the current design/correctness authority is. Nothing in this module executes
// a provider, grants a credential, writes customer data, or widens agent
// authority.

const CAPABILITY_BATCH8 = Object.freeze([
  capability({
    key: "sonara_one_platform",
    label: "SONARA One platform",
    product: "SONARA One",
    capabilityStatus: "available_core",
    capabilities: [
      "one connected platform for Business Builder, Creator Studio, and Growth Studio",
      "tenant-scoped customer workspaces and shared account surfaces",
      "metered capability quoting and append-only usage credit accounting",
      "approval-gated agent authority with outcome-based demotion",
      "governed prompt library with versions, collections, connections, and prepared runs",
      "record assistants that inspect organization-owned data without requiring a model provider"
    ],
    evidence: [
      "lib/sonara-paid-capabilities.cjs",
      "lib/sonara-agent-authority.cjs",
      "routes/sonara-prompt-library-routes.cjs",
      "routes/sonara-assistant-routes.cjs",
      "lib/sonara-record-checks.cjs"
    ],
    boundaries: [
      "External/provider execution remains separately configured, authorized, metered, and release-gated.",
      "Sensitive actions remain human-approved through SONARA's agent-authority rules.",
      "Production promotion remains subject to the controlled deployment evidence gates."
    ]
  }),
  capability({
    key: "business_builder_operations",
    label: "Business Builder operations",
    product: "Business Builder",
    capabilityStatus: "available_with_setup",
    capabilities: [
      "customers, quotes, invoices, receivables, recurring work, and payment follow-up",
      "public booking, multi-site availability, staff assignment, calendar downloads, and week calendar feeds",
      "staff, shifts, time, pay-rate and labour-cost operating records",
      "inventory, stock counts, transfers, waste, recipes, menus, vendors, purchase orders, vehicles, and maintenance",
      "connected-account payments using Stripe Connect when the workspace completes provider setup",
      "browser-to-browser customer calling, permission-controlled location check-ins, and web-push notifications"
    ],
    evidence: [
      "routes/sonara-last9-routes.cjs",
      "lib/sonara-calendar-invite.cjs",
      "lib/sonara-connected-payments.cjs",
      "routes/sonara-connected-payment-routes.cjs",
      "lib/sonara-web-push.cjs"
    ],
    boundaries: [
      "Carrier voice and carrier SMS are not represented as available until a reviewed carrier adapter and inbound webhook exist.",
      "Connected payments require the business's connected provider account and live provider readiness.",
      "Calendar revision sequencing still needs the Batch 9 correctness repair before it can claim monotonic update replacement."
    ]
  }),
  capability({
    key: "creator_studio_production",
    label: "Creator Studio production",
    product: "Creator Studio",
    capabilityStatus: "available_with_setup",
    capabilities: [
      "artists, releases, catalog, assets, content planning, deliverables, media kits, offers, and monetization records",
      "private asset attachments and short-lived organization-scoped access",
      "prompt blueprints and shared prompt-library workflows",
      "local transcription/caption workflow when the reviewed Whisper adapter is configured",
      "metered media-generation jobs through configured supported providers or the isolated media-worker contract"
    ],
    evidence: [
      "routes/creator-generation-routes.cjs",
      "lib/creator-generation-billing.cjs",
      "lib/sonara-whisper-adapter.cjs",
      "routes/sonara-asset-file-routes.cjs",
      "routes/sonara-prompt-library-routes.cjs"
    ],
    boundaries: [
      "Generation is setup-, rights-, consent-, cost-, and provider-readiness gated; a catalog record is not a runnable provider.",
      "Voice cloning remains restricted by SONARA's consent and anti-impersonation policy.",
      "Publishing and other customer-impacting actions remain approval-gated."
    ]
  }),
  capability({
    key: "growth_studio_campaigns",
    label: "Growth Studio campaigns and measurement",
    product: "Growth Studio",
    capabilityStatus: "available_with_setup",
    capabilities: [
      "lead capture, scoring, routing, segments, campaign records, content queues, touchpoints, experiments, conversions, and consent records",
      "owner-approved campaign email dispatch through the configured mail provider",
      "recipient eligibility checks, suppression screening, unsubscribe handling, and explicit skipped/not-attempted outcomes",
      "bounded campaign sending of up to the runtime's verified per-request cap instead of silent truncation",
      "provider and measurement control surfaces for connected marketing and analytics systems"
    ],
    evidence: [
      "routes/growth-studio-control-routes.cjs",
      "lib/growth-studio-sender.cjs",
      "lib/growth-studio-dispatch.cjs",
      "lib/growth-studio-suppression.cjs",
      "lib/growth-studio-unsubscribe.cjs"
    ],
    boundaries: [
      "Customer campaigns require an authorized owner action and applicable consent/opt-out controls.",
      "Carrier SMS inbound processing remains provider-specific and is not claimed as complete.",
      "A campaign send is never treated as proof of conversion, attribution, or guaranteed growth."
    ]
  }),
  capability({
    key: "sonara_record_assistants",
    label: "SONARA record assistants",
    product: "Business Builder · Creator Studio · Growth Studio",
    capabilityStatus: "available_core",
    capabilities: [
      "deterministic checks over organization-owned operating records",
      "named findings, clean states, and explicit unreadable-data states",
      "direct links back to the record surface where a human can resolve the finding"
    ],
    evidence: ["routes/sonara-assistant-routes.cjs", "lib/sonara-record-checks.cjs"],
    boundaries: [
      "These assistant pages do not silently call OpenAI, Anthropic, or another model provider.",
      "A failed read is not rendered as zero findings."
    ]
  }),
  capability({
    key: "claude_skill_workflow",
    label: "Claude skill workflow",
    product: "Developer workflow",
    capabilityStatus: "development_compatible",
    capabilities: [
      "portable instruction/skill patterns for repository research, verification, implementation, and review",
      "shared SONARA authority, tenancy, pnpm, security, and release contracts across coding agents"
    ],
    evidence: [".ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md", "CLAUDE.md", "AGENTS.md"],
    boundaries: [
      "Claude compatibility does not grant a model or tool broader authority than SONARA's own policies.",
      "Third-party skills are reviewed individually before adoption and cannot bypass release gates."
    ],
    externalStatus: "compatible_workflow_not_customer_runtime"
  }),
  capability({
    key: "chatgpt_plugin_workflow",
    label: "ChatGPT and Codex plugin workflow",
    product: "Developer and connected-app workflow",
    capabilityStatus: "research_ready",
    capabilities: [
      "map SONARA skills to reusable plugin-style instructions",
      "use connected apps only through their own authorization and workspace permission boundaries",
      "reuse prompt-library model/MCP compatibility metadata without pretending a prepared prompt was executed"
    ],
    evidence: ["routes/sonara-prompt-library-routes.cjs", ".ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md"],
    boundaries: [
      "SONARA has not packaged this Batch 8 descriptor as a production ChatGPT plugin.",
      "Prepared prompt records remain providerCalled=false until a separately reviewed provider execution path is used.",
      "Connected-account authorization is never inferred from plugin installation."
    ],
    externalStatus: "not_connected_by_this_batch"
  }),
  capability({
    key: "spec_driven_cross_agent_delivery",
    label: "Spec-driven cross-agent delivery",
    product: "Internal development",
    capabilityStatus: "pilot_ready",
    capabilities: [
      "requirements to acceptance criteria to implementation evidence to release verification",
      "shared delivery contracts usable by Claude, Codex, and other reviewed coding agents"
    ],
    evidence: [".ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md", "lib/sonara-screenshot-tool-radar-batch7.cjs"],
    boundaries: [
      "Spec/skill tooling assists delivery; repository tests and release evidence remain authoritative.",
      "No agent may merge, deploy, publish, spend, or perform consequential actions merely because a spec says to do so."
    ],
    externalStatus: "governed_internal_pilot"
  })
]);

const DESIGN_BATCH9 = Object.freeze([
  design({
    key: "v3_identity_authority",
    label: "SONARA v3 identity authority",
    status: "active",
    evidence: [
      "docs/BRAND_GUIDELINES.md",
      "public/brand/sonara-one-mark-v3.svg",
      "public/brand/sonara-industries-logo-v3.svg",
      "public/brand/business-builder-mark-v3.svg",
      "public/brand/creator-studio-mark-v3.svg",
      "public/brand/growth-studio-mark-v3.svg"
    ],
    rule: "Use SONARA One publicly with the coordinated v3 parent/product mark family; retain legacy Prism Wave assets only for compatibility, not as the active rendered identity."
  }),
  design({
    key: "balanced_precision_shell",
    label: "Balanced Precision interface shell",
    status: "active",
    evidence: ["ui/sonara/styles/99-sonara-cinematic-system.css", "docs/BRAND_GUIDELINES.md"],
    rule: "Keep work surfaces restrained, information-dense, responsive, and legible; reserve cinematic treatment for deliberate public/startup moments."
  }),
  design({
    key: "truthful_startup_and_progress",
    label: "Truthful startup and loading",
    status: "active",
    evidence: ["docs/BRAND_GUIDELINES.md", "public/site.webmanifest"],
    rule: "Use real completion signals, indeterminate progress when duration is unknown, fail-safe timeouts, Skip animation, and reduced-motion support; never fabricate a completion percentage."
  }),
  design({
    key: "customer_safe_state_language",
    label: "Customer-safe state language",
    status: "active",
    evidence: ["lib/sonara-plain-language.cjs", "AGENTS.md"],
    rule: "Render unavailable capabilities as honest Setup Required, Permission Required, Review Required, unavailable, or not offered states instead of fake success or placeholder activity."
  }),
  design({
    key: "booking_calendar_revision_sequence",
    label: "Booking calendar revision sequence",
    status: "fix_required",
    evidence: ["lib/sonara-calendar-invite.cjs"],
    rule: "Persist and monotonically advance an iCalendar SEQUENCE for booking revisions. The current builder reads calendar_sequence, but the governed source scan does not identify a writer, so repeated exports cannot yet claim reliable revision supersession."
  }),
  design({
    key: "growth_recipient_snapshot_review",
    label: "Growth campaign recipient snapshot",
    status: "review_required",
    evidence: ["routes/growth-studio-control-routes.cjs", "lib/growth-studio-sender.cjs", "lib/growth-studio-dispatch.cjs"],
    rule: "Confirm that the exact owner-approved recipient decision remains the exact set dispatched across retries/resume work before adding queued multi-invocation campaigns. Do not infer approval from a later audience re-query."
  }),
  design({
    key: "cross_agent_authority",
    label: "Cross-agent authority boundary",
    status: "active",
    evidence: ["lib/sonara-agent-authority.cjs", "AGENTS.md", ".ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md"],
    rule: "Claude, ChatGPT, Codex, plugins, skills, MCP-compatible metadata, and future agent adapters inherit SONARA authorization, tenant isolation, audit, approval, and release gates; none is an authority bypass."
  }),
  design({
    key: "license_decision_boundary",
    label: "License decision boundary",
    status: "active",
    evidence: [".ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md", "data/open-source-tools.ts"],
    rule: "Permissive, reciprocal, mixed, source-available, model-weight, dataset, template, and hosted-service rights remain separate decisions. Research-only wording never substitutes for verified adoption rights."
  })
]);

function capability(input) {
  return Object.freeze({
    batch: 8,
    recordType: "internal_capability_truth",
    enabledByThisBatch: false,
    canExecuteFromThisRecord: false,
    humanReviewRequired: true,
    ...input,
    capabilities: Object.freeze([...(input.capabilities || [])]),
    evidence: Object.freeze([...(input.evidence || [])]),
    boundaries: Object.freeze([...(input.boundaries || [])])
  });
}

function design(input) {
  return Object.freeze({
    batch: 9,
    recordType: "design_correctness_authority",
    enabledByThisBatch: false,
    canExecuteFromThisRecord: false,
    ...input,
    evidence: Object.freeze([...(input.evidence || [])])
  });
}

function cloneCapability(item) {
  return {
    ...item,
    capabilities: [...item.capabilities],
    evidence: [...item.evidence],
    boundaries: [...item.boundaries]
  };
}

function cloneDesign(item) {
  return { ...item, evidence: [...item.evidence] };
}

function getCapabilityBatch8() {
  return CAPABILITY_BATCH8.map(cloneCapability);
}

function getDesignBatch9() {
  return DESIGN_BATCH9.map(cloneDesign);
}

function getCapabilityDesignReadiness() {
  return {
    ok: true,
    mode: "static_governed_capability_design_batches_8_9",
    batch8Count: CAPABILITY_BATCH8.length,
    batch9Count: DESIGN_BATCH9.length,
    productionExecutionAdded: 0,
    capabilities: getCapabilityBatch8(),
    designs: getDesignBatch9()
  };
}

module.exports = {
  CAPABILITY_BATCH8,
  DESIGN_BATCH9,
  getCapabilityBatch8,
  getDesignBatch9,
  getCapabilityDesignReadiness
};
